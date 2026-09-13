"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Volume2 } from "lucide-react";
import { judgePresence, samplePresence } from "@/lib/face-presence";
import { playProctorBeep } from "@/lib/proctor-beep";

/** Continuous violation before first beep */
const VIOLATION_MS = 4000;
/** Re-beep while still violating */
const BEEP_EVERY_MS = 15_000;

/**
 * Eye / face / phone / empty-seat monitor.
 * Video stays in DOM so stream attaches and timer runs.
 */
export default function EyeFocusGuard({ enabled }: { enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Idle");
  const [mode, setMode] = useState<"heuristic" | "off">("off");
  const [permission, setPermission] = useState<"pending" | "ok" | "denied">(
    "pending"
  );
  const [expanded, setExpanded] = useState(true);
  const [retry, setRetry] = useState(0);
  const badMs = useRef(0);
  const raf = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAlarm = useRef(0);
  const baseline = useRef<{
    mean: number;
    eye: number;
    variance: number;
  } | null>(null);
  const calibFrames = useRef(0);
  const wallRef = useRef(0);
  const lastReason = useRef<string | null>(null);

  const attachStreamToVideo = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return false;
    try {
      if (video.srcObject !== stream) video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      return true;
    } catch {
      try {
        await video.play();
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      baseline.current = null;
      calibFrames.current = 0;
      wallRef.current = 0;
      badMs.current = 0;
      setStatus("Off");
      setMode("off");
      setPermission("pending");
      return;
    }

    let alive = true;
    setExpanded(true);

    function cleanup() {
      alive = false;
      cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      try {
        if (videoRef.current) videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
      baseline.current = null;
      calibFrames.current = 0;
      wallRef.current = 0;
      badMs.current = 0;
    }

    function alarm(reason: string) {
      const now = Date.now();
      // While violating: beep at least every 15s (first after VIOLATION_MS)
      if (now - lastAlarm.current < BEEP_EVERY_MS && lastAlarm.current > 0) {
        setStatus(`⚠️ ${reason}`);
        return;
      }
      lastAlarm.current = now;
      lastReason.current = reason;
      setStatus(`⚠️ ${reason}`);
      setExpanded(true);
      playProctorBeep({ durationMs: 2400, volume: 0.28 });
    }

    function loop() {
      if (!alive) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        raf.current = requestAnimationFrame(loop);
        return;
      }
      if (streamRef.current && video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
        void video.play().catch(() => undefined);
      }
      if (video.readyState < 2) {
        raf.current = requestAnimationFrame(loop);
        return;
      }

      const s = samplePresence(video, canvas);
      if (!s) {
        raf.current = requestAnimationFrame(loop);
        return;
      }

      if (calibFrames.current < 50) {
        calibFrames.current += 1;
        const b = baseline.current || {
          mean: s.faceMean,
          eye: s.eyeMean,
          variance: s.variance,
        };
        baseline.current = {
          mean: b.mean * 0.88 + s.faceMean * 0.12,
          eye: b.eye * 0.88 + s.eyeMean * 0.12,
          variance: b.variance * 0.88 + s.variance * 0.12,
        };
        setStatus(`Calibrating… ${calibFrames.current}/50 — look straight ahead`);
        raf.current = requestAnimationFrame(loop);
        return;
      }

      const v = judgePresence(s, baseline.current);
      const now = Date.now();
      if (!wallRef.current) wallRef.current = now;
      const dt = Math.min(250, Math.max(0, now - wallRef.current));
      wallRef.current = now;

      const bad = Boolean(v.reason);
      if (bad) {
        badMs.current += dt;
      } else {
        badMs.current = Math.max(0, badMs.current - dt * 1.2);
        if (badMs.current < 500) lastReason.current = null;
      }

      const secs = Math.floor(badMs.current / 1000);
      if (bad && badMs.current >= VIOLATION_MS && v.reason) {
        alarm(v.reason);
        // keep badMs so 15s re-beep continues while still violating
        if (badMs.current > VIOLATION_MS + BEEP_EVERY_MS) {
          // clamp so counter doesn't grow forever
          badMs.current = VIOLATION_MS;
        }
      } else if (bad && secs > 0) {
        setStatus(`${v.reason} · ${secs}s`);
      } else if (!bad) {
        setStatus("Focused · face + eyes OK");
        // slow baseline adapt when good
        const b = baseline.current!;
        baseline.current = {
          mean: b.mean * 0.98 + s.faceMean * 0.02,
          eye: b.eye * 0.98 + s.eyeMean * 0.02,
          variance: b.variance * 0.98 + s.variance * 0.02,
        };
      }

      raf.current = requestAnimationFrame(loop);
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setPermission("denied");
          setStatus("Camera API not available");
          return;
        }
        setStatus("Starting camera…");
        setPermission("pending");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPermission("ok");
        setMode("heuristic");

        await new Promise((r) => requestAnimationFrame(() => r(null)));
        let ok = await attachStreamToVideo();
        if (!ok) {
          await new Promise((r) => setTimeout(r, 120));
          ok = await attachStreamToVideo();
        }
        setStatus(
          ok
            ? "Calibrating… face center, eyes open"
            : "Camera on — open preview if blank"
        );
        wallRef.current = Date.now();
        lastAlarm.current = 0;
        loop();
      } catch (e) {
        setPermission("denied");
        setStatus(
          e instanceof Error
            ? `Allow camera: ${e.message}`
            : "Allow camera, then Retry"
        );
      }
    }

    void start();
    return () => cleanup();
  }, [enabled, retry, attachStreamToVideo]);

  useEffect(() => {
    if (!enabled || !expanded) return;
    void attachStreamToVideo();
  }, [enabled, expanded, attachStreamToVideo]);

  if (!enabled) return null;

  const videoEl = (
    <video
      ref={videoRef}
      muted
      playsInline
      autoPlay
      className={
        expanded
          ? "h-28 w-36 rounded-xl border border-slate-700 bg-black object-cover"
          : "pointer-events-none absolute h-px w-px opacity-0"
      }
      style={{ transform: "scaleX(-1)" }}
    />
  );

  if (!expanded) {
    return (
      <div className="relative">
        {videoEl}
        <canvas ref={canvasRef} className="hidden" />
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            void attachStreamToVideo();
          }}
          className="flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/95 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur"
          title={status}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              permission === "ok" ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <Camera className="h-3.5 w-3.5 text-indigo-300" />
          Eye · {status.slice(0, 28)}
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[min(100vw-2rem,340px)] rounded-2xl border border-slate-700 bg-slate-900 p-3 text-white shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-indigo-400" />
          Eye Focus
          <Volume2 className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Collapse"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {videoEl}
        <canvas ref={canvasRef} className="hidden" />
        <div className="min-w-[140px] flex-1 text-xs text-slate-300">
          <p>
            Cam:{" "}
            <span className="font-semibold text-white">{permission}</span> ·{" "}
            {mode}
          </p>
          <p className="mt-1 text-sm font-semibold text-indigo-300">{status}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            Face / eyes / empty / phone → beep ~15s
          </p>
          {(permission === "denied" || permission === "pending") && (
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="mt-2 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white"
            >
              Retry camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
