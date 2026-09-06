"use client";

import { useEffect, useRef } from "react";

type MomentPayload = {
  at: number;
  imageDataUrl?: string;
  audioDataUrl?: string;
  note?: string;
};

/**
 * Every ~60s during a live test: capture a page snapshot + short mic clip
 * and POST to teacher (with student consent at start).
 */
export default function TestProctor({
  active,
  testCode,
  onMoment,
}: {
  active: boolean;
  testCode: string;
  onMoment?: (m: MomentPayload) => void;
}) {
  const micRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!active || !testCode) return;
    let cancelled = false;
    let timer: number | undefined;

    const setup = async () => {
      try {
        micRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch {
        // mic denied
      }
      try {
        // Prefer display capture for real screenshots
        screenRef.current = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const v = document.createElement("video");
        v.muted = true;
        v.srcObject = screenRef.current;
        await v.play();
        videoRef.current = v;
      } catch {
        // screen denied — still send heartbeat notes
      }

      const tick = async () => {
        if (cancelled) return;
        const moment: MomentPayload = { at: Date.now() };

        // screenshot from screen track or fallback blank note
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
              moment.imageDataUrl = canvas.toDataURL("image/jpeg", 0.45);
            }
          } else {
            moment.note = "Screen capture not granted — presence ping";
          }
        } catch {
          moment.note = "Snapshot failed";
        }

        // short voice clip (~2.5s)
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
          // ignore audio
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

      // first after 5s, then every 60s
      window.setTimeout(() => void tick(), 5000);
      timer = window.setInterval(() => void tick(), 60_000) as unknown as number;
    };

    void setup();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      micRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      videoRef.current = null;
    };
  }, [active, testCode, onMoment]);

  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}
