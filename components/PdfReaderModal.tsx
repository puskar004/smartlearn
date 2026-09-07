"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import {
  googleEmbedPdf,
  inAppPdfSrc,
  isNcertUrl,
  resolveEmbeddablePdf,
} from "@/lib/ncert-pdf";
import { setPdfReading } from "@/components/FocusLock";
import PdfJsViewer from "@/components/PdfJsViewer";

type Props = {
  open: boolean;
  title: string;
  ncertLink?: string;
  classCode?: string;
  materialId?: string;
  onClose: () => void;
};

type Mode = "reader" | "plugin" | "gview" | "portal";

export default function PdfReaderModal({
  open,
  title,
  ncertLink,
  classCode,
  materialId,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("reader");
  const [tick, setTick] = useState(0);
  const pdf = resolveEmbeddablePdf(ncertLink);
  const ncert = isNcertUrl(ncertLink) || isNcertUrl(pdf);

  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const proxySrc = useMemo(() => {
    if (!pdf && !classCode) return null;
    // Direct data PDF — open in-app without server
    if (pdf?.startsWith("data:")) return pdf;
    // Same-origin API file
    if (pdf?.startsWith("/api/")) return pdf;
    // Prefer direct https via our proxy (in-app, no new tab)
    if (pdf && /^https?:\/\//i.test(pdf)) {
      return inAppPdfSrc(pdf, origin);
    }
    if (classCode) {
      const q = new URLSearchParams();
      q.set("code", classCode.toUpperCase());
      if (materialId) q.set("id", materialId);
      if (pdf && pdf.length < 1500) q.set("url", pdf);
      return `/api/classroom/pdf?${q.toString()}`;
    }
    if (pdf) return inAppPdfSrc(pdf, origin);
    return null;
  }, [pdf, classCode, materialId, origin]);

  const stableSrc = useMemo(() => {
    if (!proxySrc) return null;
    if (proxySrc.startsWith("data:")) return proxySrc;
    const join = proxySrc.includes("?") ? "&" : "?";
    return `${proxySrc}${join}_r=${tick}`;
  }, [proxySrc, tick]);

  const gviewUrl = useMemo(() => {
    if (!pdf || pdf.startsWith("data:")) return null;
    // Prefer direct https PDF for Google viewer
    if (/^https?:\/\//i.test(pdf)) return googleEmbedPdf(pdf);
    return null;
  }, [pdf]);

  const iframeSrc = useMemo(() => {
    if (!open) return "about:blank";
    if (mode === "portal" && ncertLink) return ncertLink;
    if (mode === "gview" && gviewUrl) return gviewUrl;
    if (mode === "plugin" && stableSrc && !stableSrc.startsWith("data:")) {
      return stableSrc;
    }
    return "about:blank";
  }, [open, mode, ncertLink, gviewUrl, stableSrc]);

  useEffect(() => {
    setPdfReading(open);
    if (!open) return;
    // NCERT: start with reader (proxy+wayback); client falls back to Viewer
    setMode(stableSrc || pdf ? "reader" : gviewUrl ? "gview" : "portal");
    document.documentElement.dataset.pdfOpen = "1";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      setPdfReading(false);
      delete document.documentElement.dataset.pdfOpen;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-900/70 p-1 backdrop-blur-sm sm:p-3"
      data-pdf-reader="1"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
          <FileText className="h-4 w-4 text-emerald-600" />
          <div className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
            {title}
          </div>
          {(pdf || classCode) && (
            <div className="flex flex-wrap rounded-lg bg-slate-200/80 p-0.5 text-[11px] font-semibold">
              {(
                [
                  ["reader", "Reader"],
                  ["plugin", "PDF"],
                  ["gview", "Viewer"],
                  ["portal", "Source"],
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
          {pdf && /^https?:\/\//i.test(pdf) && (
            <a
              href={pdf}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50"
            >
              <Download className="h-3 w-3" /> Open file
            </a>
          )}
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-emerald-50"
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
          {mode === "reader" && stableSrc ? (
            <PdfJsViewer
              key={stableSrc}
              src={stableSrc}
              title={title}
              onFail={() => {
                // NCERT blocked on server → Google Viewer usually still works
                if (gviewUrl) setMode("gview");
                else if (ncertLink) setMode("portal");
              }}
            />
          ) : mode === "gview" && gviewUrl ? (
            <iframe
              key={`gview-${tick}`}
              title={title}
              src={gviewUrl}
              className="h-full w-full border-0 bg-white"
              allow="fullscreen"
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
          <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-[10px] text-white">
            SmartLearn PDF · Esc closes
            {ncert ? " · NCERT" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
