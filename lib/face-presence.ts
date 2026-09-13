/**
 * Lightweight webcam heuristics (no ML):
 * - face missing / empty seat
 * - eyes not toward camera
 * - phone-like bright rectangle in front of face
 */

export type PresenceSample = {
  faceMean: number;
  eyeMean: number;
  eyeL: number;
  eyeR: number;
  contrast: number;
  variance: number;
  centerBright: number;
  centerEdge: number;
  skinScore: number;
};

export type PresenceVerdict = {
  faceMissing: boolean;
  eyesOff: boolean;
  phoneLikely: boolean;
  emptySeat: boolean;
  reason: string | null;
};

function avgRegion(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number
) {
  let s = 0;
  let c = 0;
  let rS = 0;
  let gS = 0;
  let bS = 0;
  const x1 = Math.min(w, Math.floor(x0 + rw));
  const y1 = Math.min(data.length / (w * 4), Math.floor(y0 + rh));
  const xs = Math.max(0, Math.floor(x0));
  const ys = Math.max(0, Math.floor(y0));
  for (let y = ys; y < y1; y++) {
    for (let x = xs; x < x1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      s += 0.299 * r + 0.587 * g + 0.114 * b;
      rS += r;
      gS += g;
      bS += b;
      c++;
    }
  }
  const n = Math.max(1, c);
  return {
    mean: s / n,
    r: rS / n,
    g: gS / n,
    b: bS / n,
  };
}

function varianceRegion(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  mean: number
) {
  let s = 0;
  let c = 0;
  const x1 = Math.min(w, Math.floor(x0 + rw));
  const y1 = Math.floor(y0 + rh);
  const xs = Math.max(0, Math.floor(x0));
  const ys = Math.max(0, Math.floor(y0));
  const h = data.length / (w * 4);
  for (let y = ys; y < Math.min(h, y1); y++) {
    for (let x = xs; x < x1; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const d = lum - mean;
      s += d * d;
      c++;
    }
  }
  return s / Math.max(1, c);
}

/** Horizontal edge strength (phone screen borders). */
function edgeScore(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number
) {
  let s = 0;
  let c = 0;
  const xs = Math.max(1, Math.floor(x0));
  const ys = Math.max(1, Math.floor(y0));
  const x1 = Math.min(w - 1, Math.floor(x0 + rw));
  const y1 = Math.floor(y0 + rh);
  const h = data.length / (w * 4);
  for (let y = ys; y < Math.min(h - 1, y1); y += 2) {
    for (let x = xs; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      const j = (y * w + x + 1) * 4;
      const k = ((y + 1) * w + x) * 4;
      const l0 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const l1 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      const l2 = 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
      s += Math.abs(l0 - l1) + Math.abs(l0 - l2);
      c++;
    }
  }
  return s / Math.max(1, c);
}

export function samplePresence(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): PresenceSample | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  if (video.videoWidth < 2 || video.videoHeight < 2) return null;
  const w = 160;
  const h = 120;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const face = avgRegion(data, w, w * 0.2, h * 0.1, w * 0.6, h * 0.65);
  const eyeBand = avgRegion(data, w, w * 0.25, h * 0.18, w * 0.5, h * 0.18);
  const eyeL = avgRegion(data, w, w * 0.28, h * 0.2, w * 0.18, h * 0.14);
  const eyeR = avgRegion(data, w, w * 0.54, h * 0.2, w * 0.18, h * 0.14);
  const corners = [
    avgRegion(data, w, 0, 0, 16, 16).mean,
    avgRegion(data, w, w - 16, 0, 16, 16).mean,
    avgRegion(data, w, 0, h - 16, 16, 16).mean,
    avgRegion(data, w, w - 16, h - 16, 16, 16).mean,
  ];
  const cornerAvg = corners.reduce((a, b) => a + b, 0) / 4;
  const contrast = Math.abs(face.mean - cornerAvg);
  const variance = varianceRegion(
    data,
    w,
    w * 0.2,
    h * 0.1,
    w * 0.6,
    h * 0.65,
    face.mean
  );
  const center = avgRegion(data, w, w * 0.3, h * 0.25, w * 0.4, h * 0.45);
  const centerEdge = edgeScore(data, w, w * 0.28, h * 0.22, w * 0.44, h * 0.5);

  // Skin-ish: R > G > B and moderate brightness
  const skinScore =
    face.r > face.g && face.g > face.b * 0.85 && face.mean > 40 && face.mean < 210
      ? (face.r - face.b) / 40
      : 0;

  return {
    faceMean: face.mean,
    eyeMean: eyeBand.mean,
    eyeL: eyeL.mean,
    eyeR: eyeR.mean,
    contrast,
    variance,
    centerBright: center.mean,
    centerEdge,
    skinScore,
  };
}

export function judgePresence(
  s: PresenceSample,
  baseline: { mean: number; eye: number; variance: number } | null
): PresenceVerdict {
  const base = baseline || {
    mean: s.faceMean,
    eye: s.eyeMean,
    variance: s.variance,
  };

  // Empty / no person: flat frame, low structure
  const emptySeat =
    s.variance < 180 ||
    (s.contrast < 12 && s.variance < 320) ||
    (s.faceMean < 18 || s.faceMean > 245);

  // Face not centered / gone
  const faceMissing =
    emptySeat ||
    s.contrast < 14 ||
    s.skinScore < 0.15 ||
    s.variance < base.variance * 0.35 ||
    Math.abs(s.faceMean - base.mean) > 55;

  // Eyes closed / looking away (eye band darker or asymmetric collapse)
  const eyeAsym = Math.abs(s.eyeL - s.eyeR);
  const eyesOff =
    faceMissing ||
    s.eyeMean < base.eye * 0.82 ||
    s.eyeMean < base.mean * 0.7 ||
    (s.eyeMean < 70 && s.faceMean > 50) ||
    (eyeAsym > 28 && s.eyeMean < base.eye * 0.95);

  // Phone held up: very bright center + strong edges, face metrics collapse
  const phoneLikely =
    !emptySeat &&
    s.centerBright > 175 &&
    s.centerEdge > 28 &&
    s.centerBright > s.faceMean + 35 &&
    (s.skinScore < 0.4 || s.variance > base.variance * 1.4);

  let reason: string | null = null;
  if (emptySeat) reason = "Koi samne nahi hai — camera ke saamne baitho!";
  else if (phoneLikely) reason = "Mobile screen dikh rahi hai — phone hatao!";
  else if (faceMissing) reason = "Face camera par nahi — seedha baitho!";
  else if (eyesOff) reason = "Aankhen screen par nahi — dekhte raho!";

  return {
    faceMissing,
    eyesOff,
    phoneLikely,
    emptySeat,
    reason,
  };
}
