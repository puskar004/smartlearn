"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Music2, X } from "lucide-react";
import { spotifyEmbed, type SpotifyMood } from "@/lib/spotify-catalog";

const MUSIC_KEY = "sl_global_spotify_v1";

export type GlobalMusicState = {
  spotifyType: SpotifyMood["spotifyType"];
  spotifyId: string;
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

/** Spotify mini player — stays mounted so audio continues across pages. */
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
  if (!music?.spotifyId || !music.playing) return null;

  const src = spotifyEmbed(music.spotifyType, music.spotifyId, {
    compact: true,
  });

  return (
    <div
      className="fixed bottom-4 left-[76px] z-[80] w-[min(calc(100vw-6rem),380px)] overflow-hidden rounded-2xl border border-emerald-400/40 bg-[#121212] shadow-2xl lg:left-[272px]"
      data-global-music="1"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Music2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">
          Spotify · {music.title}
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-rose-300"
          title="Stop"
          onClick={() => setGlobalMusic(null)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <iframe
        key={`${music.spotifyType}-${music.spotifyId}`}
        title={music.title}
        src={src}
        className="h-[152px] w-full border-0 bg-black"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="bg-black px-3 py-1 text-[10px] text-emerald-500/90">
        Plays in-app · login inside player · no new tab · survives page changes
      </div>
    </div>
  );
}
