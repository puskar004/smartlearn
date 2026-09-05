"use client";

import { useState } from "react";
import {
  Music2,
  Play,
  CloudRain,
  Flame,
  Leaf,
  Zap,
  Heart,
  Brain,
  Piano,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SPOTIFY_MOODS, spotifyEmbed } from "@/lib/spotify-catalog";
import { setGlobalMusic } from "@/components/GlobalMusicPlayer";

const ICONS: Record<string, typeof Flame> = {
  focus: Flame,
  lofi: Music2,
  piano: Piano,
  intense: Zap,
  brain: Brain,
  jazz: Sparkles,
  nature: CloudRain,
  soft: Heart,
};

const COLORS: Record<string, string> = {
  focus: "from-indigo-500 to-violet-600",
  lofi: "from-fuchsia-500 to-pink-600",
  piano: "from-sky-400 to-cyan-600",
  intense: "from-amber-400 to-orange-600",
  brain: "from-emerald-400 to-teal-600",
  jazz: "from-rose-400 to-orange-500",
  nature: "from-slate-500 to-blue-700",
  soft: "from-pink-400 to-rose-500",
};

export default function StudyMusicPage() {
  const [moodId, setMoodId] = useState(SPOTIFY_MOODS[0].id);
  const mood = SPOTIFY_MOODS.find((m) => m.id === moodId) || SPOTIFY_MOODS[0];
  const embed = spotifyEmbed(mood.spotifyType, mood.spotifyId);

  const playAcrossApp = () => {
    setGlobalMusic({
      spotifyType: mood.spotifyType,
      spotifyId: mood.spotifyId,
      title: mood.label,
      playing: true,
    });
  };

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <Music2 className="h-3.5 w-3.5" /> Mood Music · Spotify only
        </div>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Spotify study soundtracks
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          YouTube removed. Log in to <strong>your Spotify</strong> inside the
          player below (no new tab). Use{" "}
          <strong>Play across app</strong> so music keeps going on Home, Join
          Class, and every section.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SPOTIFY_MOODS.map((m) => {
          const Icon = ICONS[m.id] || Leaf;
          const active = moodId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMoodId(m.id)}
              className={cn(
                "sl-card rounded-2xl border p-4 text-left transition",
                active
                  ? "border-emerald-400 bg-white shadow-md ring-2 ring-emerald-100"
                  : "border-white/80 bg-white/60 hover:border-emerald-200 hover:bg-white"
              )}
            >
              <div
                className={cn(
                  "inline-flex rounded-xl bg-gradient-to-br p-2.5 text-white shadow",
                  COLORS[m.id] || "from-slate-500 to-slate-700"
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={playAcrossApp}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500"
        >
          <Play className="h-3.5 w-3.5" /> Play across app
        </button>
        <span className="self-center text-[11px] text-slate-500">
          Mini player sticks to bottom · stays on route change
        </span>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-[#121212] shadow-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">
              {mood.label}
            </div>
            <div className="text-[11px] text-emerald-400/90">
              Spotify embed · sign in here if prompted · never opens a new tab
            </div>
          </div>
        </div>
        <iframe
          key={embed}
          title={mood.label}
          src={embed}
          className="h-[352px] w-full border-0 bg-black"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
