"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getTheme, toggleTheme, type ThemeMode } from "@/lib/theme";

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const m = getTheme();
    applyTheme(m);
    setMode(m);
    const sync = () => setMode(getTheme());
    window.addEventListener("sl-theme", sync);
    return () => window.removeEventListener("sl-theme", sync);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setMode(toggleTheme())}
      className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={mode === "dark" ? "Light mode" : "Dark mode"}
    >
      {mode === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
