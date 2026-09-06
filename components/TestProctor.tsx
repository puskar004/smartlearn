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
  /** Called when screen share ends or required devices missing → exit test */
  onProctorFail: (reason: string) => void;
  onReady?: () => void;
  onMoment?: (m: MomentPayload) => void;
};

/**
 * Proctoring: require camera (shutter on) + mic + current-tab screen share.
 * If share stops → onProctorFail (exit test).
 * Every 60s: snapshot + short voice → teacher.
 */
export default function TestProctor({
  active,
  testCode,
  onProctorFail,
  onReady,
  onMoment,
}: Props) {
  const micRef = useRef<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camVideoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState("Starting proctor…");
  const [camOk, setCamOk] = useState(false);
  const failRef = useRef(onProctorFail);
  failRef.current = onProctorFail;

  useEffect(() => {
    if (!active || !testCode) return;
    let cancelled = false;
    let timer: number | undefined;

    const cleanup = () => {
      micRef.current?.getTracks().forEach((t) => t.stop());
      camRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      camRef.current = null;
      screenRef.current = null;
      videoRef.current = null;
    };

    const setup = async () => {
      // 1) Camera — must be live (shutter on)
      setStatus("Allow camera (shutter must stay ON)…");
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          cam.getTracks().forEach((t) => t.stop());
          return;
        }
        const vTrack = cam.getVideoTracks()[0];
        if (!vTrack || vTrack.readyState !== "live" || !vTrack.enabled) {
          cam.getTracks().forEach((t) => t.stop());
          failRef.current("Camera shutter is off or camera not live.");
          return;
        }
        camRef.current = cam;
        const cv = document.createElement("video");
        cv.muted = true;
        cv.playsInline = true;
        cv.srcObject = cam;
        await cv.play();
        camVideoRef.current = cv;
        // wait a frame to ensure light is on
        await new Promise((r) => setTimeout(r, 400));
        if (vTrack.muted || vTrack.readyState !== "live") {
          failRef.current("Camera shutter appears OFF. Turn camera on and retry.");
          cleanup();
          return;
        }
        setCamOk(true);
        vTrack.onended = () => {
          failRef.current("Camera stopped — test exited.");
        };
      } catch {
        failRef.current("Camera permission required. Allow camera and restart test.");
        return;
      }

      // 2) Mic
      setStatus("Allow microphone…");
      try {
        micRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch {
        failRef.current("Microphone permission required.");
        cleanup();
        return;
      }

      // 3) Screen — prefer THIS tab only
      setStatus(
        "Share screen: choose “Chrome Tab” / “This tab” → SmartLearn test tab"
      );
      try {
        const displayOpts = {
          video: {
            displaySurface: "browser" as const,
            frameRate: 5,
          },
          audio: false,
          // Chromium
          preferCurrentTab: true,
          selfBrowserSurface: "include" as const,
          surfaceSwitching: "exclude" as const,
          systemAudio: "exclude" as const,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const screen = await (navigator.mediaDevices as any).getDisplayMedia(
          displayOpts
        );
        if (cancelled) {
          screen.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          return;
        }
        const sTrack = screen.getVideoTracks()[0] as MediaStreamTrack & {
          getSettings?: () => { displaySurface?: string };
        };
        const surface = sTrack.getSettings?.()?.displaySurface;
        // If they shared a window/monitor instead of browser tab, still allow but warn
        if (surface && surface !== "browser") {
          // soft note — Chrome may not report surface on all builds
        }
        screenRef.current = screen;
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.srcObject = screen;
        await v.play();
        videoRef.current = v;

        // CRITICAL: if user stops sharing → exit test
        sTrack.onended = () => {
          failRef.current(
            "Screen sharing stopped — you are exited from the test."
          );
        };
      } catch {
        failRef.current(
          "Screen share required. Pick “This tab / Chrome Tab” for the test page."
        );
        cleanup();
        return;
      }

      if (cancelled) return;
      setStatus("Proctoring active · every 1 min");
      onReady?.();

      const tick = async () => {
        if (cancelled) return;

        // verify camera still live
        const camTrack = camRef.current?.getVideoTracks()[0];
        if (
          !camTrack ||
          camTrack.readyState !== "live" ||
          !camTrack.enabled ||
          camTrack.muted
        ) {
          failRef.current("Camera shutter turned OFF — test exited.");
          return;
        }
        const screenTrack = screenRef.current?.getVideoTracks()[0];
        if (!screenTrack || screenTrack.readyState !== "live") {
          failRef.current("Screen share ended — test exited.");
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
              // also stamp small camera PIP
              const camV = camVideoRef.current;
              if (camV && camV.videoWidth > 0) {
                const pw = 96;
                const ph = Math.round((camV.videoHeight / camV.videoWidth) * pw);
                ctx.drawImage(camV, w - pw - 8, h - ph - 8, pw, ph);
              }
              moment.imageDataUrl = canvas.toDataURL("image/jpeg", 0.45);
            }
          } else {
            moment.note = "No screen frame";
          }
        } catch {
          moment.note = "Snapshot failed";
        }

        try {
          const mic = micRef.current;
          if (mic) {
            const rec = new MediaRecorder(mic);
            const chunks: BlobPart[] = [];
            await new Promise<void>((resolve) => {
              rec.ondataavailable = (e) => {
                if (e.data.size) chunks.push(e.data);
              };
              rec.onstop = () => resolve();
              rec.start();
              setTimeout(() => {
                try {
                  rec.stop();
                } catch {
                  resolve();
                }
              }, 2500);
            });
            const blob = new Blob(chunks, { type: "audio/webm" });
            if (blob.size > 0 && blob.size < 180_000) {
              moment.audioDataUrl = await blobToDataUrl(blob);
            }
          }
        } catch {
          // ignore
        }

        onMoment?.(moment);
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

      window.setTimeout(() => void tick(), 4000);
      timer = window.setInterval(() => void tick(), 60_000) as unknown as number;
    };

    void setup();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      cleanup();
    };
  }, [active, testCode, onReady, onMoment]);

  if (!active) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950">
      <span className="inline-flex items-center gap-1">
        <Camera className={camOk ? "h-3.5 w-3.5 text-emerald-600" : "h-3.5 w-3.5"} />
        Cam {camOk ? "ON" : "…"}
      </span>
      <span className="inline-flex items-center gap-1">
        <Mic className="h-3.5 w-3.5" /> Mic
      </span>
      <span className="inline-flex items-center gap-1">
        <Monitor className="h-3.5 w-3.5" /> This tab share
      </span>
      <span className="text-amber-800/80">{status}</span>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}
