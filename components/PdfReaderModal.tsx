"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import {
  googleEmbedPdf,
  inAppPdfSrc,
  resolveEmbeddablePdf,
} from "@/lib/ncert-pdf";
import { setPdfReading } from "@/components/FocusLock";
import PdfJsViewer from "@/components/PdfJsViewer";

type Props = {
  open: boolean;
  title: string;
  ncertLink?: string;
  onClose: () => void;
};

type Mode = "reader" | "plugin" | "gview" | "portal";

/**
 * In-app NCERT/CBSE PDF reader.
 * Primary: pdf.js canvas via same-origin proxy (no Chrome X-Frame block).
 */
export default function PdfReaderModal({
  open,
  title,
  ncertLink,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("reader");
  const [tick, setTick] = useState(0);
  const pdf = resolveEmbeddablePdf(ncertLink);

  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const proxySrc = useMemo(() => {
    if (!pdf) return null;
    return inAppPdfSrc(pdf, origin);
  }, [pdf, origin]);

  const iframeSrc = useMemo(() => {
    if (!open) return "about:blank";
    if (mode === "portal" && ncertLink) return ncertLink;
    if (mode === "gview" && pdf) return googleEmbedPdf(pdf);
    if (mode === "plugin" && proxySrc) return `${proxySrc}&t=${tick}`;
    return "about:blank";
  }, [open, mode, pdf, ncertLink, proxySrc, tick]);

  useEffect(() => {
    setPdfReading(open);
    if (!open) return;
    setMode(pdf ? "reader" : "portal");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      setPdfReading(false);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, pdf, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/80 p-1 backdrop-blur-sm sm:p-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
          <FileText className="h-4 w-4 text-emerald-600" />
          <div className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
            {title}
          </div>
          {pdf && (
            <div className="flex flex-wrap rounded-lg bg-slate-200/70 p-0.5 text-[11px] font-semibold">
              {(
                [
                  ["reader", "Reader"],
                  ["plugin", "PDF"],
                  ["gview", "Viewer"],
                  ["portal", "NCERT page"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    mode === id
                      ? "bg-white text-emerald-700 shadow"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {proxySrc && (
            <a
              href={proxySrc}
              download={`${title.replace(/[^\w]+/g, "_").slice(0, 40)}.pdf`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Download className="h-3 w-3" /> Download
            </a>
          )}
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <ExternalLink className="h-3 w-3" /> Reload
          </button>
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
          {mode === "reader" && proxySrc ? (
            <PdfJsViewer
              key={`${proxySrc}-${tick}`}
              src={proxySrc}
              title={title}
            />
          ) : (
            <iframe
              key={`${iframeSrc}-${tick}`}
              title={title}
              src={iframeSrc}
              className="h-full w-full border-0 bg-white"
              allow="fullscreen"
            />
          )}
          <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/75 px-3 py-1 text-[10px] text-white">
            SmartLearn PDF reader · Esc closes · tab-switch paused
          </p>
        </div>
      </div>
    </div>
  );
}
