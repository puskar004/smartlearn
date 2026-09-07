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
    if (comma < 0) throw new Error("Invalid PDF data");
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
    try {
      const j = JSON.parse(t) as { error?: string; detail?: string };
      throw new Error(j.detail || j.error || `Load failed (${res.status})`);
    } catch (e) {
      if (e instanceof Error && e.message !== `Load failed (${res.status})`)
        throw e;
      throw new Error(`Load failed (${res.status})`);
    }
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Stable PDF viewer — no retry loops (those caused shake + endless loading). */
export default function PdfJsViewer({ src, title }: Props) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<{ doc: any } | null>(null);
  const srcRef = useRef(src);

  useEffect(() => {
    srcRef.current = src;
    let cancelled = false;
    let objectUrl: string | null = null;
    const ac = new AbortController();
    const hardTimeout = window.setTimeout(() => ac.abort(), 18000);

    setLoading(true);
    setError(null);
    setPages(0);
    setPage(1);
    setBlobUrl(null);

    (async () => {
      try {
        const data = await bytesFromSrc(src, ac.signal);
        if (cancelled || srcRef.current !== src) return;
        if (data.byteLength < 100) throw new Error("Empty PDF");
        if (!isPdfMagic(data)) {
          throw new Error("Not a valid PDF (link expired). Ask teacher to re-upload.");
        }

        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        objectUrl = URL.createObjectURL(
          new Blob([copy.buffer], { type: "application/pdf" })
        );
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobUrl(objectUrl);

        try {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const doc = await Promise.race([
            pdfjs.getDocument({ data: copy }).promise,
            new Promise<never>((_, rej) =>
              window.setTimeout(() => rej(new Error("parse timeout")), 12000)
            ),
          ]);
          if (cancelled || srcRef.current !== src) {
            doc.destroy?.();
            return;
          }
          pdfRef.current = { doc };
          setPages(doc.numPages || 1);
          setLoading(false);
        } catch {
          // Native fallback — still show something
          if (cancelled) return;
          setPages(0);
          setLoading(false);
        }
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "AbortError"
            ? "PDF timed out. Tap Reload or ask teacher to re-upload."
            : e instanceof Error
              ? e.message
              : "Failed to open PDF"
        );
        setLoading(false);
      } finally {
        window.clearTimeout(hardTimeout);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(hardTimeout);
      try {
        pdfRef.current?.doc?.destroy?.();
      } catch {
        // ignore
      }
      pdfRef.current = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
        await p.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, scale, loading, error, pages]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-slate-700">
          Loading {title || "PDF"}…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <p className="text-sm font-semibold text-rose-600">{error}</p>
        <p className="max-w-sm text-xs text-slate-500">
          Ask teacher to re-upload this PDF, then Refresh materials.
        </p>
        {blobUrl && (
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
          >
            Open in new tab
          </a>
        )}
      </div>
    );
  }

  // Canvas pages available
  if (pages > 0) {
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
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <canvas ref={canvasRef} className="mx-auto block bg-white shadow-lg" />
        </div>
      </div>
    );
  }

  // Native embed fallback
  if (blobUrl) {
    return (
      <object
        data={blobUrl}
        type="application/pdf"
        className="h-full w-full bg-white"
      >
        <iframe
          title={title || "PDF"}
          src={blobUrl}
          className="h-full w-full border-0 bg-white"
        />
      </object>
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      No PDF to show
    </div>
  );
}
