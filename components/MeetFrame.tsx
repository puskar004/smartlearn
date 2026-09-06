"use client";

import { ExternalLink, Video } from "lucide-react";

/**
 * Google Meet blocks iframes — show a clear join card instead of a broken placeholder.
 */
export default function MeetFrame({
  meetUrl,
  title = "Google Meet class",
}: {
  meetUrl: string;
  title?: string;
}) {
  const url = meetUrl.trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Paste a valid Google Meet link to start
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-6 text-center shadow-lg">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
        <Video className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-xs text-slate-400">
        Google Meet cannot run inside an app frame (Google policy). Open Meet in
        a window, sign in with your Google account, then return here.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
      >
        <ExternalLink className="h-4 w-4" /> Join Google Meet
      </a>
      <p className="mt-3 break-all text-[10px] text-slate-500">{url}</p>
    </div>
  );
}
