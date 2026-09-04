"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Volume2 } from "lucide-react";

/**
 * Requests camera + mic. Uses a simple brightness/motion heuristic on face
 * region as a lightweight "eyes closed / away" proxy when full ML isn't loaded.
 * After ~30s of low face activity → alarm.
 */
export default function EyeFocusGuard({ enabled }: { enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Idle");
  const [permission, setPermission] = useState<"pending" | "ok" | "denied">(
    "pending"
  );
  const closedMs = useRef(0);
  const raf = useRef<number>(0);
  const lastMean = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      cancelAnimationFrame(raf.current);
      setStatus("Off");
      return;
    }

    let alive = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
          audio: true,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPermission("ok");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Monitoring focus…");
        loop();
      } catch {
        setPermission("denied");
        setStatus("Camera/mic permission denied");
      }
    }

    function alarm() {
      setStatus("⚠️ Eyes closed / looking away ~30s — ALARM");
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = 640;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        let n = 0;
        const id = setInterval(() => {
          o.frequency.value = n % 2 ? 880 : 640;
          n++;
          if (n > 12) {
            clearInterval(id);
            o.stop();
            ctx.close();
          }
        }, 250);
      } catch {
        // ignore
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        raf.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = 64;
      canvas.height = 48;
      ctx.drawImage(video, 0, 0, 64, 48);
      const data = ctx.getImageData(16, 12, 32, 16).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const mean = sum / (data.length / 4);
      const prev = lastMean.current;
      lastMean.current = mean;

      // Low brightness or very stable dark frame ≈ eyes closed / face away
      const dark = mean < 45;
      const flat =
        prev != null && Math.abs(mean - prev) < 1.2 && mean < 70;

      if (dark || flat) {
        closedMs.current += 1000 / 30;
      } else {
        closedMs.current = Math.max(0, closedMs.current - 40);
      }

      const secs = Math.floor(closedMs.current / 1000);
      if (secs >= 30) {
        alarm();
        closedMs.current = 0;
      } else if (secs > 0) {
        setStatus(`Focus drift ${secs}s / 30s`);
      } else {
        setStatus("Eyes open · focused");
      }

      raf.current = requestAnimationFrame(loop);
    }

    void start();

    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Camera className="h-4 w-4 text-indigo-400" />
        Focus Camera Guard
        <Mic className="ml-2 h-4 w-4 text-teal-400" />
        <Volume2 className="h-4 w-4 text-amber-400" />
      </div>
      <div className="flex gap-3">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-28 w-40 rounded-xl bg-black object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="text-xs text-slate-400">
          <p>
            Permission:{" "}
            <span className="text-slate-200">{permission}</span>
          </p>
          <p className="mt-2 font-medium text-indigo-300">{status}</p>
          <p className="mt-2 leading-relaxed">
            If your eyes stay closed / face leaves frame ~30 seconds, SmartLearn
            rings an alarm to wake focus.
          </p>
        </div>
      </div>
    </div>
  );
}
