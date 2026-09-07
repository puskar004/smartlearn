"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Props = {
  src: string;
  title?: string;
  onFail?: (message: string) => void;
};

function isPdfMagic(data: Uint8Array) {
  return (
    data.byteLength >= 5 &&
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46
  );
}

async function bytesFromSrc(
  src: string,
  signal: AbortSignal
): Promise<Uint8Array> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    if (comma < 0) throw new Error("Invalid data PDF");
    const meta = src.slice(0, comma);
    const payload = src.slice(comma + 1);
    const bin = /;base64/i.test(meta)
      ? atob(payload)
      : decodeURIComponent(payload);
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    return data;
  }

  const res = await fetch(src, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let detail = `Load failed (${res.status})`;
    try {
      const j = JSON.parse(t) as { error?: string; detail?: string };
      detail = j.detail || j.error || detail;
    } catch {
      if (/ncert/i.test(t)) detail = "Could not open class PDF";
      else if (t.includes("fetch failed")) detail = "Could not reach PDF host";
    }
    throw new Error(detail);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Fetch PDF bytes → render with pdf.js canvas (always visible).
 * Local worker in /public — no CDN hang.
 */
export default function PdfJsViewer({ src, title, onFail }: Props) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<"canvas" | "iframe">("canvas");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<{ doc: any } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const ac = new AbortController();
    const hardTimeout = window.setTimeout(() => ac.abort(), 25000);
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000);

    setLoading(true);
    setError(null);
    setPages(0);
    setPage(1);
    setBlobUrl(null);
    setElapsed(0);
    setMode("canvas");

    (async () => {
      try {
        const data = await bytesFromSrc(src, ac.signal);
        if (cancelled) return;
        if (data.byteLength < 100) throw new Error("Empty PDF");
        if (!isPdfMagic(data)) {
          throw new Error("File is not a valid PDF (expired or blocked link)");
        }

        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        objectUrl = URL.createObjectURL(
          new Blob([copy.buffer], { type: "application/pdf" })
        );
        if (!cancelled) setBlobUrl(objectUrl);

        // pdf.js canvas render (works when iframe is blank)
        try {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const task = pdfjs.getDocument({ data: copy });
          const doc = await Promise.race([
            task.promise,
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error("PDF parse timeout")), 15000)
            ),
          ]);
          if (cancelled) {
            doc.destroy?.();
            return;
          }
          pdfRef.current = { doc };
          setPages(doc.numPages || 1);
          setMode("canvas");
          setLoading(false);
        } catch {
          // Fallback: native iframe/object
          if (cancelled) return;
          setMode("iframe");
          setLoading(false);
        }
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        const msg =
          name === "AbortError"
            ? "PDF took too long. Tap Reload or ask teacher to re-upload."
            : e instanceof Error
              ? e.message.replace(/ncert/gi, "PDF")
              : "Failed to open PDF";
        setError(msg);
        setLoading(false);
        onFail?.(msg);
      } finally {
        window.clearTimeout(hardTimeout);
        window.clearInterval(tick);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(hardTimeout);
      window.clearInterval(tick);
      try {
        pdfRef.current?.doc?.destroy?.();
      } catch {
        // ignore
      }
      pdfRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, onFail]);

  useEffect(() => {
    const doc = pdfRef.current?.doc;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading || error || mode !== "canvas") return;
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
        await p.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, scale, loading, error, pages, mode]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-sm text-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="font-semibold text-slate-100">
          Loading {title || "PDF"}…
        </p>
        {elapsed >= 5 && (
          <p className="text-[11px] text-slate-400">
            Still working ({elapsed}s)…
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
        <p className="text-sm font-semibold text-rose-300">{error}</p>
        <p className="max-w-sm text-[11px] text-slate-300">
          Tap Reload. If still broken, teacher must re-upload the PDF.
        </p>
        {blobUrl && (
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
          >
            Open PDF in new tab
          </a>
        )}
        <a
          href={blobUrl || src}
          download={`${(title || "notes").replace(/[^\w]+/g, "_").slice(0, 40)}.pdf`}
          className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold text-slate-200"
        >
          Download PDF
        </a>
      </div>
    );
  }

  if (mode === "iframe" && blobUrl) {
    return (
      <div className="flex h-full flex-col bg-slate-950">
        <div className="flex gap-2 border-b border-slate-700 bg-slate-900 px-2 py-1.5">
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white"
          >
            Open in new tab
          </a>
          <button
            type="button"
            onClick={() => setMode("canvas")}
            className="rounded-lg border border-slate-600 px-3 py-1 text-[11px] font-bold text-slate-200"
          >
            Try canvas
          </button>
        </div>
        <object
          data={blobUrl}
          type="application/pdf"
          className="min-h-0 w-full flex-1 bg-white"
        >
          <iframe
            title={title || "PDF"}
            src={blobUrl}
            className="h-full w-full border-0 bg-white"
          />
        </object>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-700 bg-slate-950 px-2 py-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-slate-600 p-1.5 text-slate-100 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-slate-100">
          Page {page} / {pages || 1}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          className="rounded-lg border border-slate-600 p-1.5 text-slate-100 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
          className="rounded-lg border border-slate-600 p-1.5 text-slate-100"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.8, s + 0.15))}
          className="rounded-lg border border-slate-600 p-1.5 text-slate-100"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        {blobUrl && (
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            New tab
          </a>
        )}
        <button
          type="button"
          onClick={() => setMode("iframe")}
          className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] font-bold text-slate-200"
        >
          Browser PDF
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-800 p-3">
        <canvas ref={canvasRef} className="mx-auto block bg-white shadow-lg" />
      </div>
    </div>
  );
}
