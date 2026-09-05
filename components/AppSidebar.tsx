"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Brain,
  CalendarDays,
  HelpCircle,
  Home,
  LineChart,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  ClipboardList,
  Target,
  GraduationCap,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ncert", label: "NCERT & Chapters", icon: BookOpen },
  { href: "/pyq", label: "PYQs", icon: ClipboardList },
  { href: "/quiz", label: "Practice & Quiz", icon: Target },
  { href: "/ai-tutor", label: "AI Tutor", icon: Brain },
  { href: "/blueprint", label: "Study Plan", icon: CalendarDays },
  { href: "/mistakes", label: "Progress", icon: LineChart },
  { href: "/feynman", label: "Achievements", icon: Trophy },
  { href: "/study-music", label: "Mood Music", icon: Music2 },
  { href: "/teacher", label: "Teacher Hub", icon: GraduationCap },
  { href: "/parent", label: "Parent Portal", icon: Shield },
];

const bottom = [
  { href: "/profile", label: "Settings", icon: Settings },
  { href: "/common-room", label: "Help & Support", icon: HelpCircle },
];

export default function AppSidebar() {
  const path = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col border-r border-indigo-100/80 bg-white/80 backdrop-blur-xl lg:w-[260px]">
      <Link href="/dashboard" className="flex items-center gap-3 px-4 py-5 lg:px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/smartlearn-logo.svg"
          alt=""
          className="h-10 w-10 rounded-xl shadow-md shadow-indigo-500/20"
        />
        <div className="hidden leading-tight lg:block">
          <div className="text-base font-extrabold tracking-tight text-slate-900">
            Smart<span className="text-violet-600">Learn</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Learning, Personalized
          </div>
        </div>
      </Link>

      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-2 lg:px-3">
        {nav.map((item) => {
          const active =
            path === item.href ||
            (item.href !== "/dashboard" && path.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-violet-100 text-violet-800 shadow-sm"
                  : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  active
                    ? "text-violet-600"
                    : "text-slate-400 group-hover:text-violet-500"
                )}
              />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 hidden rounded-2xl bg-gradient-to-br from-violet-100 via-fuchsia-50 to-amber-50 p-4 lg:block">
        <div className="flex items-center gap-2 text-violet-700">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-bold">Small steps</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
          “Consistency today, success tomorrow.”
        </p>
        <Link
          href="/blueprint"
          className="mt-3 inline-flex rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-500 hover:shadow-lg"
        >
          Keep Learning →
        </Link>
      </div>

      <div className="space-y-1 border-t border-slate-100 px-2 py-3 lg:px-3">
        {bottom.map((item) => {
          const Icon = item.icon;
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <Icon className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
