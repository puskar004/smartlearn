/** Persist eye-focus enable across pages (settings → rest of app) */

const KEY = "sl_eye_focus_on_v1";

export function isEyeFocusEnabled(userId?: string | null) {
  if (typeof window === "undefined") return false;
  try {
    const k = userId ? `${KEY}_${userId}` : KEY;
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}

export function setEyeFocusEnabled(on: boolean, userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const k = userId ? `${KEY}_${userId}` : KEY;
    if (on) localStorage.setItem(k, "1");
    else localStorage.removeItem(k);
    window.dispatchEvent(new Event("sl-eye-focus"));
  } catch {
    // ignore
  }
}
