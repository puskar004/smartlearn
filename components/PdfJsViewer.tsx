"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  /** Absolute or relative URL that returns application/pdf (our proxy) */
  src: string;
  title?: string;
};

/**
 * Renders PDF pages with pdf.js (canvas) — works when browser PDF plugin fails.
 */
export default function PdfJsViewer({ src, title }: Props) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker from CDN matching package major
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const res = await fetch(src, { cache: "force-cache" });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(
            t.includes("fetch failed")
              ? "Server could not reach NCERT PDF. Try again or Download."
              : `Load failed (${res.status})`
          );
        }
        const data = new Uint8Array(await res.arrayBuffer());
        if (data.byteLength < 100) throw new Error("Empty PDF response");
        // PDF magic
        const head = String.fromCharCode(...data.slice(0, 5));
        if (!head.startsWith("%PDF")) {
          throw new Error("Response was not a PDF (blocked or HTML error page)");
        }

        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        pdfRef.current = { doc };
        setPages(doc.numPages);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to open PDF");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        pdfRef.current?.doc?.destroy?.();
      } catch {
        // ignore
      }
      pdfRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const doc = pdfRef.current?.doc;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading || error) return;

    let cancelled = false;
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const viewport = p.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await p.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        // ignore render errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, scale, loading, error, pages]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        Loading {title || "PDF"}…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold text-rose-600">{error}</p>
        <a
          href={src}
          download="ncert.pdf"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
        >
          Download PDF file
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-200">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-300 bg-white px-2 py-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-slate-700">
          Page {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
          className="rounded-lg border border-slate-200 p-1.5"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
          className="rounded-lg border border-slate-200 p-1.5"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <canvas ref={canvasRef} className="mx-auto block shadow-lg" />
      </div>
    </div>
  );
}
