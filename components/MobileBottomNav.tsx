"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Brain,
  Home,
  Link2,
  MoreHorizontal,
  Radio,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const studentTabs = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ncert", label: "NCERT", icon: BookOpen },
  { href: "/quiz", label: "Quiz", icon: Target },
  { href: "/ai-tutor", label: "Tutor", icon: Brain },
  { href: "/join-class", label: "Class", icon: Link2 },
  { href: "/live-class", label: "Live", icon: Radio },
];

const teacherTabs = [
  { href: "/teacher", label: "Home", icon: Home },
  { href: "/teacher?tab=materials", label: "Notes", icon: BookOpen },
  { href: "/teacher/test", label: "Tests", icon: Target },
  { href: "/teacher?tab=live", label: "Live", icon: Radio },
  { href: "/teacher?tab=students", label: "Students", icon: Link2 },
  { href: "/profile", label: "More", icon: MoreHorizontal },
];

export default function MobileBottomNav({
  isTeacher,
}: {
  isTeacher: boolean;
}) {
  const path = usePathname() || "/";
  const tabs = isTeacher ? teacherTabs : studentTabs;

  return (
    <nav
      className="sl-mobile-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-indigo-100/80 bg-white/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-1 pt-1">
        {tabs.map((t) => {
          const base = t.href.split("?")[0];
          const active =
            path === base ||
            (base !== "/dashboard" &&
              base !== "/teacher" &&
              path.startsWith(base)) ||
            (base === "/teacher" &&
              path.startsWith("/teacher") &&
              t.href === "/teacher" &&
              !path.includes("/test")) ||
            (t.href.includes("/test") && path.includes("/test"));
          const Icon = t.icon;
          return (
            <li key={t.href + t.label} className="min-w-0 flex-1">
              <Link
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9px] font-bold leading-tight transition",
                  active
                    ? isTeacher
                      ? "text-indigo-700"
                      : "text-violet-700"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition",
                    active
                      ? isTeacher
                        ? "bg-indigo-100"
                        : "bg-violet-100"
                      : "bg-transparent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="max-w-full truncate px-0.5">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
