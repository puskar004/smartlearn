export const THEME_KEY = "sl_theme_v1";

export type ThemeMode = "light" | "dark";

export function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // ignore
  }
  return "dark";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  window.dispatchEvent(new Event("sl-theme"));
  return next;
}
