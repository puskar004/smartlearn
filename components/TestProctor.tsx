"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Monitor, Mic } from "lucide-react";

type MomentPayload = {
  at: number;
  imageDataUrl?: string;
  audioDataUrl?: string;
  note?: string;
};

type Props = {
  active: boolean;
  testCode: string;
  /** Only after proctor was ready — share stopped / cam ended */
  onProctorFail: (reason: string) => void;
  /** Setup failed — do NOT auto-submit; let student retry */
  onSetupError?: (reason: string) => void;
  onReady?: () => void;
  onMoment?: (m: MomentPayload) => void;
};

/**
 * Camera + mic + screen share for tests.
 * - Setup errors → onSetupError (retry, no auto-submit)
 * - After ready: if user stops share → onProctorFail (exit)
 */
export default function TestProctor({
  active,
  testCode,
  onProctorFail,
  onSetupError,
  onReady,
  onMoment,
}: Props) {
  const micRef = useRef<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const readyRef = useRef(false);
  const cancelledRef = useRef(false);

  const failRef = useRef(onProctorFail);
  const setupErrRef = useRef(onSetupError);
  const readyCbRef = useRef(onReady);
  const momentRef = useRef(onMoment);
  failRef.current = onProctorFail;
  setupErrRef.current = onSetupError;
  readyCbRef.current = onReady;
  momentRef.current = onMoment;

  const [status, setStatus] = useState("Starting proctor…");
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [screenOk, setScreenOk] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!active || !testCode) return;
    cancelledRef.current = false;
    readyRef.current = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let firstTick: ReturnType<typeof setTimeout> | undefined;

    const stopAll = () => {
      micRef.current?.getTracks().forEach((t) => t.stop());
      camRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      camRef.current = null;
      screenRef.current = null;
      videoRef.current = null;
      camVideoRef.current = null;
      if (previewRef.current) previewRef.current.srcObject = null;
    };

    const failSetup = (msg: string) => {
      if (cancelledRef.current) return;
      setStatus(msg);
      stopAll();
      setupErrRef.current?.(msg);
    };

    const failLive = (msg: string) => {
      // only after successful ready — avoids auto-submit during permission dialogs
      if (cancelledRef.current || !readyRef.current) return;
      readyRef.current = false;
      failRef.current(msg);
    };

    const setup = async () => {
      setCamOk(false);
      setMicOk(false);
      setScreenOk(false);

      // 1) Camera + mic together (one permission prompt often)
      setStatus("Allow camera + microphone…");
      try {
        const av = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });
        if (cancelledRef.current) {
          av.getTracks().forEach((t) => t.stop());
          return;
        }

        const vTrack = av.getVideoTracks()[0];
        const aTrack = av.getAudioTracks()[0];
        if (!vTrack || vTrack.readyState === "ended") {
          failSetup("Camera not available. Check system settings and retry.");
          return;
        }
        // Do NOT use vTrack.muted — browsers often report muted=true for local tracks
        if (!vTrack.enabled) vTrack.enabled = true;

        camRef.current = new MediaStream([vTrack]);
        if (aTrack) {
          if (!aTrack.enabled) aTrack.enabled = true;
          micRef.current = new MediaStream([aTrack]);
          setMicOk(true);
        } else {
          // try mic alone
          try {
            micRef.current = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            setMicOk(true);
          } catch {
            failSetup("Microphone required. Allow mic and press Retry.");
            return;
          }
        }

        const cv = document.createElement("video");
        cv.muted = true;
        cv.playsInline = true;
        cv.setAttribute("playsinline", "true");
        cv.srcObject = camRef.current;
        await cv.play().catch(() => undefined);
        camVideoRef.current = cv;

        if (previewRef.current) {
          previewRef.current.srcObject = camRef.current;
          void previewRef.current.play().catch(() => undefined);
        }

        // Wait until we actually get frames (proves shutter/light works)
        const gotFrame = await waitForVideoFrame(cv, 4000);
        if (!gotFrame) {
          failSetup(
            "Camera opened but no video frames. Close other apps using the camera, then Retry."
          );
          return;
        }

        setCamOk(true);
        vTrack.onended = () => {
          failLive("Camera was turned off — test exited.");
        };
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "NotAllowedError") {
          failSetup("Camera/mic blocked. Allow access in browser, then Retry.");
        } else if (name === "NotFoundError") {
          failSetup("No camera found. Plug in a camera and Retry.");
        } else if (name === "NotReadableError") {
          failSetup(
            "Camera is busy in another app. Close Zoom/Meet/etc., then Retry."
          );
        } else {
          failSetup("Could not open camera/mic. Allow permissions and Retry.");
        }
        return;
      }

      // 2) Screen share
      setStatus("Share screen → pick This tab / Chrome Tab (this SmartLearn page)");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const screen: MediaStream = await (
          navigator.mediaDevices as any
        ).getDisplayMedia({
          video: true,
          audio: false,
          preferCurrentTab: true,
          selfBrowserSurface: "include",
        });
        if (cancelledRef.current) {
          screen.getTracks().forEach((t) => t.stop());
          return;
        }
        const sTrack = screen.getVideoTracks()[0];
        if (!sTrack) {
          failSetup("Screen share failed. Retry and choose a tab.");
          return;
        }
        screenRef.current = screen;
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.srcObject = screen;
        await v.play().catch(() => undefined);
        videoRef.current = v;
        setScreenOk(true);

        sTrack.onended = () => {
          failLive("Screen sharing stopped — you exited the test.");
        };
      } catch {
        failSetup(
          "Screen share required. Click Retry, then choose This tab / Chrome Tab."
        );
        return;
      }

      if (cancelledRef.current) return;

      readyRef.current = true;
      setStatus("Proctoring active · snapshot every 1 min");
      readyCbRef.current?.();

      const tick = async () => {
        if (cancelledRef.current || !readyRef.current) return;

        const camTrack = camRef.current?.getVideoTracks()[0];
        // Only fail if track truly ended — not muted flag
        if (!camTrack || camTrack.readyState === "ended") {
          failLive("Camera disconnected — test exited.");
          return;
        }
        if (!camTrack.enabled) {
          camTrack.enabled = true;
        }

        const screenTrack = screenRef.current?.getVideoTracks()[0];
        if (!screenTrack || screenTrack.readyState === "ended") {
          failLive("Screen share ended — test exited.");
          return;
        }

        const moment: MomentPayload = { at: Date.now() };

        try {
          const v = videoRef.current;
          if (v && v.videoWidth > 0) {
            const canvas = document.createElement("canvas");
            const w = 480;
            const h = Math.round((v.videoHeight / v.videoWidth) * w) || 270;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(v, 0, 0, w, h);
              const camV = camVideoRef.current;
              if (camV && camV.videoWidth > 0) {
                const pw = 96;
                const ph = Math.round(
                  (camV.videoHeight / camV.videoWidth) * pw
                );
                ctx.drawImage(camV, w - pw - 8, h - ph - 8, pw, ph);
              }
              moment.imageDataUrl = canvas.toDataURL("image/jpeg", 0.45);
            }
          } else {
            moment.note = "Screen frame pending";
          }
        } catch {
          moment.note = "Snapshot skipped";
        }

        try {
          const mic = micRef.current;
          if (mic && typeof MediaRecorder !== "undefined") {
            const mime = MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : undefined;
            const rec = mime
              ? new MediaRecorder(mic, { mimeType: mime })
              : new MediaRecorder(mic);
            const chunks: BlobPart[] = [];
            await new Promise<void>((resolve) => {
              rec.ondataavailable = (e) => {
                if (e.data.size) chunks.push(e.data);
              };
              rec.onstop = () => resolve();
              rec.onerror = () => resolve();
              try {
                rec.start();
                setTimeout(() => {
                  try {
                    if (rec.state === "recording") rec.stop();
                    else resolve();
                  } catch {
                    resolve();
                  }
                }, 2000);
              } catch {
                resolve();
              }
            });
            const blob = new Blob(chunks, { type: mime || "audio/webm" });
            if (blob.size > 200 && blob.size < 180_000) {
              moment.audioDataUrl = await blobToDataUrl(blob);
            }
          }
        } catch {
          // audio optional on tick
        }

        momentRef.current?.(moment);
        try {
          await fetch("/api/tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "moment",
              code: testCode,
              moment: {
                at: moment.at,
                imageDataUrl: moment.imageDataUrl?.slice(0, 120_000),
                audioDataUrl: moment.audioDataUrl?.slice(0, 120_000),
                note: moment.note,
              },
            }),
          });
        } catch {
          // offline
        }
      };

      firstTick = setTimeout(() => void tick(), 8000);
      timer = setInterval(() => void tick(), 60_000);
    };

    void setup();

    return () => {
      cancelledRef.current = true;
      readyRef.current = false;
      if (timer) clearInterval(timer);
      if (firstTick) clearTimeout(firstTick);
      // stop tracks WITHOUT calling failLive (cleanup ≠ user stop)
      stopAll();
    };
    // only re-run when active/test/retry — NOT when parent callbacks change
  }, [active, testCode, retryKey]);

  if (!active) return null;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950">
        <span className="inline-flex items-center gap-1">
          <Camera
            className={
              camOk ? "h-3.5 w-3.5 text-emerald-600" : "h-3.5 w-3.5 text-slate-400"
            }
          />
          Cam {camOk ? "ON" : "…"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Mic
            className={
              micOk ? "h-3.5 w-3.5 text-emerald-600" : "h-3.5 w-3.5 text-slate-400"
            }
          />
          Mic {micOk ? "ON" : "…"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Monitor
            className={
              screenOk
                ? "h-3.5 w-3.5 text-emerald-600"
                : "h-3.5 w-3.5 text-slate-400"
            }
          />
          Share {screenOk ? "ON" : "…"}
        </span>
        <span className="min-w-0 flex-1 text-amber-800/90">{status}</span>
        {!readyRef.current && (
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-500"
          >
            Retry permissions
          </button>
        )}
      </div>
      {/* Live preview proves camera is on */}
      <div className="flex items-center gap-3">
        <video
          ref={previewRef}
          muted
          playsInline
          autoPlay
          className="h-16 w-16 rounded-full border-2 border-emerald-400 object-cover bg-slate-900"
        />
        <p className="text-[10px] text-slate-500">
          Your camera preview (must stay on). Share <strong>this tab</strong> when
          asked — not another window.
        </p>
      </div>
    </div>
  );
}

function waitForVideoFrame(video: HTMLVideoElement, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const check = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}
