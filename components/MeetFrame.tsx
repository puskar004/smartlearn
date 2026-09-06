"use client";

import { useState } from "react";
import { ExternalLink, Video } from "lucide-react";

/** In-app Google Meet area. Meet often blocks iframes — fallback opens same-tab. */
export default function MeetFrame({
  meetUrl,
  title = "Google Meet class",
}: {
  meetUrl: string;
  title?: string;
}) {
  const [blocked, setBlocked] = useState(false);
  const url = meetUrl.trim();

  if (!url) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl bg-slate-900 text-sm text-slate-400">
        No Meet link yet
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[50vh] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <Video className="h-4 w-4 text-emerald-400" />
          {title}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
        >
          <ExternalLink className="h-3 w-3" /> Open Meet (login here)
        </a>
      </div>
      {!blocked ? (
        <iframe
          title="Google Meet"
          src={url}
          className="min-h-[55vh] w-full flex-1 bg-black"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setBlocked(true)}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-slate-300">
            Google Meet blocked the in-app frame. Open Meet to log in with your
            account and join class.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
          >
            Join Google Meet
          </a>
        </div>
      )}
      <p className="bg-slate-900 px-3 py-1.5 text-[10px] text-slate-500">
        Use your Google account inside Meet · stays linked to this SmartLearn
        session
      </p>
    </div>
  );
}
