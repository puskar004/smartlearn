"use client";

import { useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";

const tracks = [
  { id: "lofi", label: "Lo-fi Study Pulse", freq: 220 },
  { id: "focus", label: "Deep Focus Drone", freq: 164 },
  { id: "calm", label: "Calm Revision Air", freq: 196 },
];

export default function StudyMusicPage() {
  const [current, setCurrent] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  const stop = () => {
    try {
      oscRef.current?.stop();
      oscRef.current?.disconnect();
      ctxRef.current?.close();
    } catch {
      // ignore
    }
    oscRef.current = null;
    ctxRef.current = null;
    setCurrent(null);
  };

  const play = (id: string, freq: number) => {
    stop();
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    ctxRef.current = ctx;
    oscRef.current = osc;
    setCurrent(id);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
        <Music2 className="h-3.5 w-3.5" /> Study Music
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Soft tones for long sessions
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Lightweight ambient tones generated in-browser — no lyrics, no
        distraction videos.
      </p>

      <ul className="mt-8 space-y-3">
        {tracks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <span className="text-sm font-semibold text-slate-800">
              {t.label}
            </span>
            <button
              type="button"
              onClick={() =>
                current === t.id ? stop() : play(t.id, t.freq)
              }
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              {current === t.id ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Stop
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Play
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
