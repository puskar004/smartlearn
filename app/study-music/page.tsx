"use client";

import { useMemo, useState } from "react";
import { Music2, Pause, Play, CloudRain, Flame, Leaf, Zap, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type Mood = {
  id: string;
  label: string;
  blurb: string;
  color: string;
  Icon: typeof Leaf;
  /** In-app YouTube search embed — study-safe keywords only */
  query: string;
};

const MOODS: Mood[] = [
  {
    id: "focus",
    label: "Deep Focus",
    blurb: "Instrumental concentration",
    color: "from-indigo-500 to-violet-600",
    Icon: Flame,
    query: "lofi hip hop study beats instrumental no vocals concentration music",
  },
  {
    id: "calm",
    label: "Calm Revise",
    blurb: "Soft ambient for theory",
    color: "from-sky-400 to-cyan-600",
    Icon: Leaf,
    query: "calm ambient study music instrumental peaceful piano revision",
  },
  {
    id: "rain",
    label: "Rainy Desk",
    blurb: "Rain + soft pads",
    color: "from-slate-500 to-blue-700",
    Icon: CloudRain,
    query: "rain sounds soft lo-fi study music instrumental",
  },
  {
    id: "energy",
    label: "Energy Boost",
    blurb: "Upbeat but lyric-light",
    color: "from-amber-400 to-orange-600",
    Icon: Zap,
    query: "upbeat instrumental study music electronic focus no lyrics",
  },
  {
    id: "soft",
    label: "Soft Heart",
    blurb: "Gentle acoustic focus",
    color: "from-rose-400 to-pink-600",
    Icon: Heart,
    query: "soft acoustic instrumental study playlist calm guitar",
  },
];

function embedFor(query: string) {
  return `https://www.youtube-nocookie.com/embed?rel=0&modestbranding=1&listType=search&list=${encodeURIComponent(query)}`;
}

export default function StudyMusicPage() {
  const [mood, setMood] = useState<Mood>(MOODS[0]);
  const [playing, setPlaying] = useState(true);

  const src = useMemo(() => embedFor(mood.query), [mood]);

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
          Pick a mood — SmartLearn loads instrumental / study-safe music{" "}
          <strong>inside the page</strong> (no random entertainment tabs).
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {MOODS.map((m) => {
          const Icon = m.Icon;
          const active = mood.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMood(m);
                setPlaying(true);
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
                {m.label}
              </div>
              <div className="text-[11px] text-slate-500">{m.blurb}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm font-bold text-white">
            Now playing · {mood.label}
          </div>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
          >
            {playing ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause view
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Show player
              </>
            )}
          </button>
        </div>
        {playing && (
          <iframe
            key={src}
            title={mood.label}
            src={src}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        <p className="bg-slate-900 px-4 py-2 text-[11px] text-slate-500">
          In-app only · study / instrumental search filter · stays on SmartLearn
        </p>
      </div>
    </div>
  );
}
