"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import {
  googleEmbedPdf,
  resolveEmbeddablePdf,
} from "@/lib/ncert-pdf";
import { setPdfReading } from "@/components/FocusLock";

type Props = {
  open: boolean;
  title: string;
  ncertLink?: string;
  onClose: () => void;
};

/**
 * In-app NCERT reader — stays on SmartLearn (no external tab).
 * Suppresses Focus Lock while open.
 */
export default function PdfReaderModal({
  open,
  title,
  ncertLink,
  onClose,
}: Props) {
  const [mode, setMode] = useState<"pdf" | "portal">("pdf");
  const pdf = resolveEmbeddablePdf(ncertLink);
  const embed = pdf ? googleEmbedPdf(pdf) : null;

  useEffect(() => {
    setPdfReading(open);
    if (!open) return;
    setMode(pdf ? "pdf" : "portal");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // prevent background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      setPdfReading(false);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, pdf, onClose]);

  if (!open) return null;

  // Prefer direct PDF embed, then google viewer, never navigate away
  const src =
    mode === "pdf" && pdf
      ? pdf
      : mode === "pdf" && embed
        ? embed
        : mode === "portal" && ncertLink
          ? ncertLink
          : pdf || ncertLink || "about:blank";

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/80 p-1 backdrop-blur-sm sm:p-3"
      // keep focus inside modal so browser doesn't treat as leave
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
          <FileText className="h-4 w-4 text-emerald-600" />
          <div className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
            {title}
          </div>
          {pdf && (
            <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setMode("pdf")}
                className={`rounded-md px-2.5 py-1 transition ${
                  mode === "pdf"
                    ? "bg-white text-emerald-700 shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => setMode("portal")}
                className={`rounded-md px-2.5 py-1 transition ${
                  mode === "portal"
                    ? "bg-white text-indigo-700 shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                NCERT page
              </button>
            </div>
          )}
          {pdf && (
            <a
              href={pdf}
              // same tab download attempt without leaving SPA chrome when possible
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={(e) => {
                // stay in app: open blob attempt
                e.preventDefault();
                setMode("pdf");
              }}
            >
              <ExternalLink className="h-3 w-3" /> Reload PDF
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Close reader"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-100">
          <iframe
            title={title}
            src={src}
            className="h-full w-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
            // sandbox allows pdf plugins but blocks top-navigation
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
          />
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/75 px-3 py-1 text-[10px] text-white">
            Reading inside SmartLearn · Esc closes · tab-switch alert paused
          </p>
        </div>
      </div>
    </div>
  );
}
