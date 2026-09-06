"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Monitor, Mic } from "lucide-react";

type MomentPayload = {
  at: number;
  imageDataUrl?: string;
  audioDataUrl?: string;
  note?: string;
  videoKey?: string;
};

type Props = {
  active: boolean;
  testCode: string;
  onProctorFail: (reason: string) => void;
  onSetupError?: (reason: string) => void;
  onReady?: () => void;
  onMoment?: (m: MomentPayload) => void;
};

/** Snap + short audio every second while test runs */
const INTERVAL_MS = 1_000;

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
  const recorderRef = useRef<MediaRecorder | null>(null);
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
    let chunkTimer: ReturnType<typeof setInterval> | undefined;

    const stopAll = () => {
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      recorderRef.current = null;
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
      if (cancelledRef.current || !readyRef.current) return;
      readyRef.current = false;
      failRef.current(msg);
    };

    const uploadVideoBlob = async (blob: Blob) => {
      if (blob.size < 500 || blob.size > 1_500_000) return;
      const dataUrl = await blobToDataUrl(blob);
      try {
        const res = await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "video",
            code: testCode,
            dataUrl: dataUrl.slice(0, 2_000_000),
          }),
        });
        const data = await res.json();
        if (data.videoKey) {
          momentRef.current?.({
            at: Date.now(),
            note: "screen-video",
            videoKey: data.videoKey,
          });
        }
      } catch {
        // ignore
      }
    };

    const setup = async () => {
      setCamOk(false);
      setMicOk(false);
      setScreenOk(false);

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
          failSetup("Camera not available. Retry.");
          return;
        }
        if (!vTrack.enabled) vTrack.enabled = true;

        camRef.current = new MediaStream([vTrack]);
        if (aTrack) {
          if (!aTrack.enabled) aTrack.enabled = true;
          micRef.current = new MediaStream([aTrack]);
          setMicOk(true);
        } else {
          micRef.current = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          setMicOk(true);
        }

        const cv = document.createElement("video");
        cv.muted = true;
        cv.playsInline = true;
        cv.srcObject = camRef.current;
        await cv.play().catch(() => undefined);
        camVideoRef.current = cv;
        if (previewRef.current) {
          previewRef.current.srcObject = camRef.current;
          void previewRef.current.play().catch(() => undefined);
        }
        const gotFrame = await waitForVideoFrame(cv, 4000);
        if (!gotFrame) {
          failSetup("No camera frames. Close other apps using camera, Retry.");
          return;
        }
        setCamOk(true);
        vTrack.onended = () => failLive("Camera turned off — test exited.");
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "NotAllowedError")
          failSetup("Allow camera/mic, then Retry.");
        else if (name === "NotReadableError")
          failSetup("Camera busy in another app. Close it, Retry.");
        else failSetup("Camera/mic failed. Retry.");
        return;
      }

      setStatus("Share This tab / Chrome Tab (SmartLearn test page)…");
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const screen: MediaStream = await (
          navigator.mediaDevices as any
        ).getDisplayMedia({
          video: { frameRate: 8 },
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
          failSetup("Screen share failed. Retry.");
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
        sTrack.onended = () =>
          failLive("Screen sharing stopped — test exited.");

        // Continuous screen recording in ~30s chunks for teacher
        try {
          const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
            ? "video/webm;codecs=vp8"
            : MediaRecorder.isTypeSupported("video/webm")
              ? "video/webm"
              : "";
          const rec = mime
            ? new MediaRecorder(screen, {
                mimeType: mime,
                videoBitsPerSecond: 250_000,
              })
            : new MediaRecorder(screen);
          let chunks: BlobPart[] = [];
          rec.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
          };
          rec.onstop = () => {
            const blob = new Blob(chunks, { type: "video/webm" });
            chunks = [];
            void uploadVideoBlob(blob);
          };
          rec.start(1000);
          recorderRef.current = rec;
          // every 30s stop/start to flush a chunk
          chunkTimer = setInterval(() => {
            try {
              if (recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
                // restart
                chunks = [];
                const r2 = mime
                  ? new MediaRecorder(screen, {
                      mimeType: mime,
                      videoBitsPerSecond: 250_000,
                    })
                  : new MediaRecorder(screen);
                r2.ondataavailable = (e) => {
                  if (e.data.size) chunks.push(e.data);
                };
                r2.onstop = () => {
                  const blob = new Blob(chunks, { type: "video/webm" });
                  chunks = [];
                  void uploadVideoBlob(blob);
                };
                r2.start(1000);
                recorderRef.current = r2;
              }
            } catch {
              // ignore
            }
          }, 10_000);
        } catch {
          // video optional if MediaRecorder fails
        }
      } catch {
        failSetup("Screen share required. Retry → This tab.");
        return;
      }

      if (cancelledRef.current) return;
      readyRef.current = true;
      setStatus("Proctoring ON · snap every 1s · screen video continuous");
      readyCbRef.current?.();

      let tickN = 0;
      let posting = false;
      const tick = async () => {
        if (cancelledRef.current || !readyRef.current) return;
        if (posting) return; // don't stack requests
        const camTrack = camRef.current?.getVideoTracks()[0];
        if (!camTrack || camTrack.readyState === "ended") {
          failLive("Camera disconnected — test exited.");
          return;
        }
        if (!camTrack.enabled) camTrack.enabled = true;
        const screenTrack = screenRef.current?.getVideoTracks()[0];
        if (!screenTrack || screenTrack.readyState === "ended") {
          failLive("Screen share ended — test exited.");
          return;
        }

        tickN += 1;
        const moment: MomentPayload = { at: Date.now() };
        try {
          const v = videoRef.current;
          if (v && v.videoWidth > 0) {
            const canvas = document.createElement("canvas");
            const w = 400;
            const h = Math.round((v.videoHeight / v.videoWidth) * w) || 225;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(v, 0, 0, w, h);
              const camV = camVideoRef.current;
              if (camV && camV.videoWidth > 0) {
                const pw = 72;
                const ph = Math.round(
                  (camV.videoHeight / camV.videoWidth) * pw
                );
                ctx.drawImage(camV, w - pw - 6, h - ph - 6, pw, ph);
              }
              moment.imageDataUrl = canvas.toDataURL("image/jpeg", 0.35);
            }
          }
        } catch {
          moment.note = "snap skip";
        }

        // audio every 5th snap (~5s) to avoid overlap
        if (tickN % 5 === 0) {
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
                  }, 800);
                } catch {
                  resolve();
                }
              });
              const blob = new Blob(chunks, { type: mime || "audio/webm" });
              if (blob.size > 100 && blob.size < 120_000) {
                moment.audioDataUrl = await blobToDataUrl(blob);
              }
            }
          } catch {
            // ignore
          }
        }

        momentRef.current?.(moment);
        posting = true;
        try {
          await fetch("/api/tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "moment",
              code: testCode,
              moment: {
                at: moment.at,
                imageDataUrl: moment.imageDataUrl?.slice(0, 90_000),
                audioDataUrl: moment.audioDataUrl?.slice(0, 80_000),
                note: moment.note || `snap-${tickN}`,
              },
            }),
          });
        } catch {
          // offline
        } finally {
          posting = false;
        }
      };

      firstTick = setTimeout(() => void tick(), 800);
      timer = setInterval(() => void tick(), INTERVAL_MS);
    };

    void setup();
    return () => {
      cancelledRef.current = true;
      readyRef.current = false;
      if (timer) clearInterval(timer);
      if (firstTick) clearTimeout(firstTick);
      if (chunkTimer) clearInterval(chunkTimer);
      stopAll();
    };
  }, [active, testCode, retryKey]);

  if (!active) return null;

  return (
    <div className="mb-3 space-y-2">
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
          Share+Video {screenOk ? "ON" : "…"}
        </span>
        <span className="min-w-0 flex-1 text-amber-800/90">{status}</span>
        {!readyRef.current && (
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white"
          >
            Retry
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <video
          ref={previewRef}
          muted
          playsInline
          autoPlay
          className="h-14 w-14 rounded-full border-2 border-emerald-400 object-cover bg-slate-900"
        />
        <p className="text-[10px] text-slate-500">
          Every 30s: photo + voice + screen video → teacher (kept until teacher
          deletes test).
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
