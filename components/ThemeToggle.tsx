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
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-500 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={mode === "dark" ? "Light mode" : "Dark mode"}
    >
      {mode === "dark" ? (
        <>
          <Sun className="h-3.5 w-3.5 text-amber-300" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
}
