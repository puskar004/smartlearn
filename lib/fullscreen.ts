/** Cross-browser fullscreen helpers for live exam lock */

export function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    d.fullscreenElement ||
    d.webkitFullscreenElement ||
    d.mozFullScreenElement ||
    d.msFullscreenElement ||
    null
  );
}

export function isDocumentFullscreen() {
  return Boolean(getFullscreenElement());
}

export async function requestDocumentFullscreen(
  target?: HTMLElement | null
): Promise<boolean> {
  if (typeof document === "undefined") return false;
  if (isDocumentFullscreen()) return true;

  const el =
    target ||
    document.documentElement ||
    (document.body as HTMLElement | null);
  if (!el) return false;

  const anyEl = el as HTMLElement & {
    requestFullscreen?: (opts?: FullscreenOptions) => Promise<void>;
    webkitRequestFullscreen?: () => void | Promise<void>;
    webkitRequestFullScreen?: () => void | Promise<void>;
    mozRequestFullScreen?: () => void | Promise<void>;
    msRequestFullscreen?: () => void | Promise<void>;
  };

  try {
    if (typeof anyEl.requestFullscreen === "function") {
      try {
        await anyEl.requestFullscreen({ navigationUI: "hide" });
      } catch {
        await anyEl.requestFullscreen();
      }
    } else if (typeof anyEl.webkitRequestFullscreen === "function") {
      await Promise.resolve(anyEl.webkitRequestFullscreen());
    } else if (typeof anyEl.webkitRequestFullScreen === "function") {
      await Promise.resolve(anyEl.webkitRequestFullScreen());
    } else if (typeof anyEl.mozRequestFullScreen === "function") {
      await Promise.resolve(anyEl.mozRequestFullScreen());
    } else if (typeof anyEl.msRequestFullscreen === "function") {
      await Promise.resolve(anyEl.msRequestFullscreen());
    } else {
      return false;
    }
  } catch {
    // try body as fallback
    try {
      const body = document.body as typeof anyEl;
      if (body && body !== anyEl && typeof body.requestFullscreen === "function") {
        await body.requestFullscreen({ navigationUI: "hide" }).catch(() =>
          body.requestFullscreen!()
        );
      } else {
        return isDocumentFullscreen();
      }
    } catch {
      return isDocumentFullscreen();
    }
  }

  // Wait briefly for browser to apply
  await new Promise((r) => setTimeout(r, 50));
  if (isDocumentFullscreen()) return true;
  await new Promise((r) => setTimeout(r, 150));
  return isDocumentFullscreen();
}

export function onFullscreenChange(cb: () => void) {
  const handler = () => cb();
  document.addEventListener("fullscreenchange", handler);
  document.addEventListener("webkitfullscreenchange", handler as EventListener);
  document.addEventListener("mozfullscreenchange", handler as EventListener);
  document.addEventListener("MSFullscreenChange", handler as EventListener);
  return () => {
    document.removeEventListener("fullscreenchange", handler);
    document.removeEventListener(
      "webkitfullscreenchange",
      handler as EventListener
    );
    document.removeEventListener(
      "mozfullscreenchange",
      handler as EventListener
    );
    document.removeEventListener(
      "MSFullscreenChange",
      handler as EventListener
    );
  };
}
