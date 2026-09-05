"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Music2, Pause, Play, X } from "lucide-react";
import { ytEmbed } from "@/lib/media-catalog";

const MUSIC_KEY = "sl_global_music_v1";

export type GlobalMusicState = {
  id: string;
  title: string;
  playing: boolean;
};

export function setGlobalMusic(state: GlobalMusicState | null) {
  if (typeof window === "undefined") return;
  if (!state) localStorage.removeItem(MUSIC_KEY);
  else localStorage.setItem(MUSIC_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("sl-music"));
}

export function getGlobalMusic(): GlobalMusicState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MUSIC_KEY);
    return raw ? (JSON.parse(raw) as GlobalMusicState) : null;
  } catch {
    return null;
  }
}

/** Stays mounted across Home / Join Class / Teacher / every section. */
export default function GlobalMusicPlayer() {
  const path = usePathname() || "";
  const [music, setMusic] = useState<GlobalMusicState | null>(null);

  useEffect(() => {
    const sync = () => setMusic(getGlobalMusic());
    sync();
    window.addEventListener("sl-music", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sl-music", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const hideChrome =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/sign-in") ||
    path.startsWith("/sign-up");

  if (hideChrome) return null;
  if (!music?.id) return null;

  const playing = Boolean(music.playing);

  return (
    <div
      className="fixed bottom-4 left-[76px] z-[80] w-[min(calc(100vw-6rem),360px)] overflow-hidden rounded-2xl border border-violet-300 bg-slate-950 shadow-2xl lg:left-[272px]"
      data-global-music="1"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Music2 className="h-4 w-4 shrink-0 text-violet-300" />
        <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">
          {music.title}
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          title={playing ? "Pause" : "Play"}
          onClick={() =>
            setGlobalMusic({ ...music, playing: !playing })
          }
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
          title="Stop"
          onClick={() => setGlobalMusic(null)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {playing && (
        <iframe
          key={`play-${music.id}`}
          title={music.title}
          src={ytEmbed(music.id, { autoplay: true })}
          className="h-[72px] w-full border-0 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      <div className="bg-slate-900 px-3 py-1 text-[10px] text-violet-300/80">
        Keeps playing on Home · Join Class · every section
      </div>
    </div>
  );
}
