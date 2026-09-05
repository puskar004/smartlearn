"use client";

import { useMemo, useRef, useState } from "react";
import {
  Music2,
  Play,
  CloudRain,
  Flame,
  Leaf,
  Zap,
  Heart,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOOD_PLAYLISTS, ytEmbed } from "@/lib/media-catalog";

const MOOD_META = [
  { id: "focus", color: "from-indigo-500 to-violet-600", Icon: Flame },
  { id: "calm", color: "from-sky-400 to-cyan-600", Icon: Leaf },
  { id: "rain", color: "from-slate-500 to-blue-700", Icon: CloudRain },
  { id: "energy", color: "from-amber-400 to-orange-600", Icon: Zap },
  { id: "soft", color: "from-rose-400 to-pink-600", Icon: Heart },
] as const;

export default function StudyMusicPage() {
  const [moodId, setMoodId] = useState<string>("focus");
  const [clipIdx, setClipIdx] = useState(0);
  const [toneOn, setToneOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const playlist = MOOD_PLAYLISTS[moodId];
  const clip = playlist.clips[clipIdx % playlist.clips.length];
  const embed = useMemo(() => ytEmbed(clip.id), [clip.id]);

  const stopTone = () => {
    try {
      nodesRef.current.forEach((n) => {
        try {
          (n as OscillatorNode).stop?.();
        } catch {
          // ignore
        }
        n.disconnect?.();
      });
      void ctxRef.current?.close();
    } catch {
      // ignore
    }
    nodesRef.current = [];
    ctxRef.current = null;
    setToneOn(false);
  };

  const playTone = () => {
    stopTone();
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.04;
    master.connect(ctx.destination);

    const freqs =
      moodId === "energy"
        ? [196, 247, 294]
        : moodId === "rain"
          ? [110, 146]
          : moodId === "soft"
            ? [174, 220]
            : [164, 196, 246];

    const nodes: AudioNode[] = [master];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      g.gain.value = 0.25 / freqs.length;
      o.connect(g);
      g.connect(master);
      o.start();
      nodes.push(o, g);
    });

    // soft noise for rain mood
    if (moodId === "rain") {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const ng = ctx.createGain();
      ng.gain.value = 0.015;
      noise.connect(ng);
      ng.connect(master);
      noise.start();
      nodes.push(noise, ng);
    }

    ctxRef.current = ctx;
    nodesRef.current = nodes;
    setToneOn(true);
  };

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-bold text-fuchsia-700">
          <Music2 className="h-3.5 w-3.5" /> Mood Music
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Play by how you feel
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          YouTube player below works in-page. If your network blocks embeds, use{" "}
          <strong>Instant ambient tone</strong> (always works offline-ish).
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {MOOD_META.map((m) => {
          const pl = MOOD_PLAYLISTS[m.id];
          const Icon = m.Icon;
          const active = moodId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMoodId(m.id);
                setClipIdx(0);
                stopTone();
              }}
              className={cn(
                "sl-card rounded-2xl border p-4 text-left transition",
                active
                  ? "border-violet-300 bg-white shadow-md ring-2 ring-violet-100"
                  : "border-white/80 bg-white/60 hover:border-violet-200 hover:bg-white"
              )}
            >
              <div
                className={cn(
                  "inline-flex rounded-xl bg-gradient-to-br p-2.5 text-white shadow",
                  m.color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-bold text-slate-900">
                {pl.label}
              </div>
              <div className="text-[11px] text-slate-500">{pl.blurb}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {playlist.clips.map((c, i) => (
          <button
            key={c.id + i}
            type="button"
            onClick={() => {
              setClipIdx(i);
              stopTone();
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              clipIdx === i
                ? "bg-violet-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-violet-50"
            )}
          >
            Track {i + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => (toneOn ? stopTone() : playTone())}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition",
            toneOn
              ? "bg-emerald-600 text-white"
              : "bg-slate-900 text-white hover:bg-slate-800"
          )}
        >
          <Volume2 className="h-3.5 w-3.5" />
          {toneOn ? "Stop ambient tone" : "Instant ambient tone"}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">
              {clip.title}
            </div>
            <div className="text-[11px] text-slate-400">{clip.channel}</div>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${clip.id}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11px] font-semibold text-violet-300 hover:underline"
          >
            Open YT
          </a>
        </div>
        <iframe
          key={embed}
          title={clip.title}
          src={embed}
          className="aspect-video w-full bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <p className="flex items-center gap-2 bg-slate-900 px-4 py-2 text-[11px] text-slate-500">
          <Play className="h-3 w-3" />
          In-app embed · if blank, try another track or ambient tone
        </p>
      </div>
    </div>
  );
}
