"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Bell, Flame, Search, Sparkles, Star, X } from "lucide-react";
import NavAuth from "@/components/NavAuth";
import { loadProgress } from "@/lib/user-store";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";
import {
  clearAllNotifications,
  loadNotifications,
  markAllRead,
  unreadCount,
  type AppNotification,
} from "@/lib/notifications";
import { displayName } from "@/lib/display-name";
import { getTabSwitchCount } from "@/components/FocusLock";

export default function AppTopBar() {
  const { userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [switches, setSwitches] = useState(0);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const name = displayName(user);

  useEffect(() => {
    if (!userId) return;
    // One-time full clear of old notification clutter
    try {
      const wipeKey = `sl_notif_wiped_once_v1_${userId}`;
      if (!localStorage.getItem(wipeKey)) {
        clearAllNotifications(userId);
        localStorage.setItem(wipeKey, "1");
      }
    } catch {
      // ignore
    }

    const sync = () => {
      if (!userId) return;
      const p = loadProgress(userId);
      setXp(p.xp);
      setStreak(p.streak);
      setRole(getRole(userId));
      setNotes(loadNotifications(userId));
      setUnread(unreadCount(userId));
      setSwitches(getTabSwitchCount(userId));
    };
    sync();
    window.addEventListener(ROLE_EVENT, sync);
    window.addEventListener("sl-notifications", sync);
    window.addEventListener("sl-progress", sync);
    window.addEventListener("sl-tasks", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(ROLE_EVENT, sync);
      window.removeEventListener("sl-notifications", sync);
      window.removeEventListener("sl-progress", sync);
      window.removeEventListener("sl-tasks", sync);
      window.removeEventListener("focus", sync);
    };
  }, [userId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const isTeacher = role === "teacher";

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearchOpen(false);
    router.push(`/ncert?q=${encodeURIComponent(term)}`);
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5 lg:gap-3 lg:px-5">
        {!isTeacher && (
          <form
            onSubmit={onSearch}
            className="relative hidden min-w-0 flex-1 md:block"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chapters, topics…"
              className="w-full max-w-xl rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
          </form>
        )}
        {isTeacher && <div className="min-w-0 flex-1" />}

        <div className="ml-auto flex min-w-0 flex-shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
          {!isTeacher && (
            <>
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 md:hidden"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <Link
                href="/blueprint"
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 p-2 text-white shadow-md shadow-violet-500/25 sm:gap-1.5 sm:px-2.5 sm:py-1.5"
                title="What should I study now?"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden text-[11px] font-bold sm:inline lg:text-xs">
                  Study now
                </span>
              </Link>
            </>
          )}

          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => {
                setOpen((v) => !v);
                if (userId && !open) {
                  setNotes(markAllRead(userId));
                  setUnread(0);
                }
              }}
              className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Notifications
                    </div>
                    {!isTeacher && (
                      <div className="mt-0.5 text-[10px] text-slate-500">
                        Tab switches:{" "}
                        <strong className="text-amber-700">{switches}</strong>
                      </div>
                    )}
                  </div>
                  {userId && notes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNotes(clearAllNotifications(userId));
                        setUnread(0);
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <ul className="max-h-72 overflow-y-auto">
                  {notes.length === 0 && (
                    <li className="px-3 py-6 text-center text-xs text-slate-400">
                      Tab-switch alerts, Common Room & support appear here.
                    </li>
                  )}
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="border-b border-slate-50 px-3 py-2.5"
                    >
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => setOpen(false)}
                          className="block"
                        >
                          <div className="text-xs font-bold text-slate-800">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {n.body}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400">
                            {new Date(n.at).toLocaleString()}
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div className="text-xs font-bold text-slate-800">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {n.body}
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {!isTeacher && (
            <>
              <div className="hidden items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-600 xs:flex sm:gap-1.5 sm:px-2.5 sm:text-xs">
                <Flame className="h-3.5 w-3.5" />
                <span className="tabular-nums">{streak}d</span>
              </div>
              <div className="hidden items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 sm:flex sm:px-2.5 sm:text-xs">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span className="tabular-nums">{xp.toLocaleString()}</span>
              </div>
            </>
          )}

          {isTeacher && (
            <div className="hidden rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-800 sm:block">
              TEACHER
            </div>
          )}

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {user && (
              <div className="hidden text-right leading-tight min-[400px]:block">
                <div className="max-w-[72px] truncate text-[11px] font-bold text-slate-800 sm:max-w-[120px] sm:text-xs">
                  {name}
                </div>
                <div className="text-[9px] text-slate-400 sm:text-[10px]">
                  {isTeacher ? "Teacher" : "Student"}
                </div>
              </div>
            )}
            <NavAuth />
          </div>
        </div>
      </div>

      {/* Mobile search drawer */}
      {searchOpen && !isTeacher && (
        <div className="border-t border-slate-100 px-3 py-2 md:hidden">
          <form onSubmit={onSearch} className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search chapters, topics…"
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="rounded-full p-2 text-slate-400"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
