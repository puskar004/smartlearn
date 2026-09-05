"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Music2, X } from "lucide-react";
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

/**
 * Single persistent Spotify iframe (right side).
 * Never unmounts on route change so audio keeps playing.
 */
export default function GlobalMusicPlayer() {
  const path = usePathname() || "";
  const [music, setMusic] = useState<GlobalMusicState | null>(null);
  const [collapsed, setCollapsed] = useState(false);

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

  // Collapse a bit on music page so it doesn't cover the full player until armed
  useEffect(() => {
    if (path.startsWith("/study-music") && !music?.playing) {
      setCollapsed(false);
    }
  }, [path, music?.playing]);

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
      className="fixed bottom-4 right-3 z-[80] w-[min(calc(100vw-5rem),300px)] overflow-hidden rounded-2xl border border-emerald-400/50 bg-[#121212] shadow-2xl lg:right-5"
      data-global-music="1"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Music2 className="h-4 w-4 shrink-0 animate-pulse text-emerald-400" />
        <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">
          {music.title}
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          title={collapsed ? "Expand" : "Minimise"}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-rose-300"
          title="Stop"
          onClick={() => setGlobalMusic(null)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Keep iframe always in DOM — CSS hide only (collapse) so stream continues */}
      <div
        className={
          collapsed
            ? "pointer-events-none h-0 max-h-0 overflow-hidden opacity-0"
            : "h-[152px]"
        }
        aria-hidden={collapsed}
      >
        <iframe
          key={`side-${music.spotifyType}-${music.spotifyId}`}
          title={music.title}
          src={src}
          className="h-[152px] w-full border-0 bg-black"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {!collapsed && (
        <div className="bg-black px-3 py-1 text-[10px] text-emerald-500/90">
          Side player · stays on Home, NCERT, Quiz…
        </div>
      )}
    </div>
  );
}
