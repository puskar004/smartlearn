"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import {
  googleEmbedPdf,
  resolveEmbeddablePdf,
} from "@/lib/ncert-pdf";

type Props = {
  open: boolean;
  title: string;
  ncertLink?: string;
  onClose: () => void;
};

/**
 * Opens NCERT material inside SmartLearn so the student does not leave the tab.
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
    if (!open) return;
    setMode(pdf ? "pdf" : "portal");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pdf, onClose]);

  if (!open) return null;

  const src =
    mode === "pdf" && embed
      ? embed
      : ncertLink || "https://ncert.nic.in/textbook.php";

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-2xl">
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
                PDF reader
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
                NCERT portal
              </button>
            </div>
          )}
          {pdf && (
            <a
              href={pdf}
              download
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <ExternalLink className="h-3 w-3" /> Direct PDF
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
            // sandbox keeps navigation contained when possible
            referrerPolicy="no-referrer-when-downgrade"
          />
          <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-[10px] text-white">
            Reading inside SmartLearn · Esc to close · avoids full tab switch
          </p>
        </div>
      </div>
    </div>
  );
}
