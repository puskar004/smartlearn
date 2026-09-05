"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Volume2 } from "lucide-react";

type Landmark = { x: number; y: number };

type FaceLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    ts: number
  ) => { faceLandmarks?: Landmark[][] };
  close?: () => void;
};

/**
 * Eye / face focus monitor.
 * Uses improved heuristic (reliable without heavy ML install).
 * Optional MediaPipe if available via window global after script inject.
 */
export default function EyeFocusGuard({ enabled }: { enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Idle");
  const [mode, setMode] = useState<"mediapipe" | "heuristic" | "off">("off");
  const [permission, setPermission] = useState<"pending" | "ok" | "denied">(
    "pending"
  );
  const closedMs = useRef(0);
  const raf = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const lastAlarm = useRef(0);
  const baseline = useRef<{ mean: number; eye: number } | null>(null);
  const calibFrames = useRef(0);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      setStatus("Off");
      setMode("off");
      setPermission("pending");
      return;
    }

    let alive = true;

    function cleanup() {
      cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      try {
        landmarkerRef.current?.close?.();
      } catch {
        // ignore
      }
      landmarkerRef.current = null;
      baseline.current = null;
      calibFrames.current = 0;
    }

    function alarm(reason: string) {
      const now = Date.now();
      if (now - lastAlarm.current < 8000) return;
      lastAlarm.current = now;
      setStatus(`⚠️ ${reason}`);
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = 720;
        g.gain.value = 0.12;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        let n = 0;
        const id = setInterval(() => {
          o.frequency.value = n % 2 ? 960 : 720;
          n++;
          if (n > 16) {
            clearInterval(id);
            o.stop();
            void ctx.close();
          }
        }, 200);
      } catch {
        // ignore
      }
    }

    function sample(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      const w = 120;
      const h = 90;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      const avg = (x: number, y: number, rw: number, rh: number) => {
        const img = ctx.getImageData(
          Math.floor(x),
          Math.floor(y),
          Math.floor(rw),
          Math.floor(rh)
        );
        let s = 0;
        let c = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          s +=
            0.299 * img.data[i] +
            0.587 * img.data[i + 1] +
            0.114 * img.data[i + 2];
          c++;
        }
        return s / Math.max(1, c);
      };

      const faceMean = avg(w * 0.22, h * 0.12, w * 0.56, h * 0.6);
      const eyeMean = avg(w * 0.28, h * 0.2, w * 0.44, h * 0.16);
      const mouthMean = avg(w * 0.35, h * 0.55, w * 0.3, h * 0.12);

      // variance proxy via corner samples
      const corners = [
        avg(0, 0, 12, 12),
        avg(w - 12, 0, 12, 12),
        avg(0, h - 12, 12, 12),
        avg(w - 12, h - 12, 12, 12),
      ];
      const cornerAvg = corners.reduce((a, b) => a + b, 0) / 4;
      const contrast = Math.abs(faceMean - cornerAvg);

      return { faceMean, eyeMean, mouthMean, contrast };
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPermission("denied");
          setStatus("Camera API not available");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: true,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPermission("ok");
        setMode("heuristic");
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          await video.play();
        }
        setStatus("Calibrating… keep eyes open 2 sec");
        loop();
      } catch (e) {
        setPermission("denied");
        setStatus(
          e instanceof Error
            ? `Permission blocked: ${e.message}`
            : "Allow camera + mic, then toggle again"
        );
      }
    }

    function loop() {
      if (!alive) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        raf.current = requestAnimationFrame(loop);
        return;
      }

      const s = sample(video, canvas);
      if (!s) {
        raf.current = requestAnimationFrame(loop);
        return;
      }

      // Calibrate first ~45 frames while user looks at camera
      if (calibFrames.current < 45) {
        calibFrames.current += 1;
        const b = baseline.current || { mean: s.faceMean, eye: s.eyeMean };
        baseline.current = {
          mean: b.mean * 0.85 + s.faceMean * 0.15,
          eye: b.eye * 0.85 + s.eyeMean * 0.15,
        };
        setStatus(`Calibrating… ${calibFrames.current}/45`);
        raf.current = requestAnimationFrame(loop);
        return;
      }

      const base = baseline.current!;
      const faceAway =
        s.contrast < 12 || s.faceMean < 18 || s.faceMean > 240;
      const eyesClosed =
        faceAway ||
        s.eyeMean < base.eye * 0.78 ||
        s.eyeMean < base.mean * 0.65 ||
        (s.eyeMean < 55 && s.faceMean > 70);

      const dt = 1000 / 30;
      if (eyesClosed) closedMs.current += dt;
      else closedMs.current = Math.max(0, closedMs.current - dt * 2);

      const secs = Math.floor(closedMs.current / 1000);
      if (secs >= 30) {
        alarm(
          faceAway
            ? "Face not in frame ~30s — sit in front of camera!"
            : "Eyes closed / looking down ~30s — ALARM"
        );
        closedMs.current = 0;
      } else if (secs > 0) {
        setStatus(
          `${faceAway ? "Face away" : "Eyes drooping"} · ${secs}s / 30s`
        );
      } else {
        setStatus("Focused · eyes open");
      }

      raf.current = requestAnimationFrame(loop);
    }

    void start();
    return () => {
      alive = false;
      cleanup();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-lg">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Camera className="h-4 w-4 text-indigo-400" />
        Eye Focus Guard
        <Mic className="h-4 w-4 text-teal-400" />
        <Volume2 className="h-4 w-4 text-amber-400" />
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {mode}
        </span>
      </div>
      <div className="flex flex-wrap gap-4">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="h-36 w-48 rounded-xl border border-slate-700 bg-black object-cover mirror"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="min-w-[180px] flex-1 text-xs text-slate-300">
          <p>
            Camera:{" "}
            <span className="font-semibold text-white">{permission}</span>
          </p>
          <p className="mt-2 text-sm font-semibold text-indigo-300">{status}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed text-slate-400">
            <li>Click enable below / in Profile</li>
            <li>Allow camera when browser asks</li>
            <li>Sit in light, face centered</li>
            <li>Wait for “Focused · eyes open”</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
