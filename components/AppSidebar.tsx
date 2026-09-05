"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
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
  ClipboardList,
  Target,
  GraduationCap,
  Music2,
  Users,
  Upload,
  Radio,
  Link2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJoinedClass, getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";

const studentNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ncert", label: "NCERT & Chapters", icon: BookOpen },
  { href: "/pyq", label: "PYQs", icon: ClipboardList },
  { href: "/quiz", label: "Practice & Quiz", icon: Target },
  { href: "/ai-tutor", label: "AI Tutor", icon: Brain },
  { href: "/feynman", label: "Feynman Mode", icon: Sparkles },
  { href: "/blueprint", label: "Study Plan", icon: CalendarDays },
  { href: "/mistakes", label: "Progress", icon: LineChart },
  { href: "/study-music", label: "Mood Music", icon: Music2 },
  { href: "/join-class", label: "Join Teacher", icon: Link2 },
  { href: "/parent", label: "Parent Portal", icon: Shield },
  { href: "/common-room", label: "Common Room", icon: MessageSquare },
];

const teacherNav = [
  { href: "/teacher", label: "Teacher Home", icon: Home },
  { href: "/teacher?tab=students", label: "My Students", icon: Users },
  { href: "/teacher?tab=materials", label: "Upload Notes/Videos", icon: Upload },
  { href: "/teacher?tab=live", label: "Live Sessions", icon: Radio },
  { href: "/teacher?tab=code", label: "Class Code", icon: GraduationCap },
];

const bottomStudent = [
  { href: "/profile", label: "Settings", icon: Settings },
  { href: "/support", label: "Help & Support", icon: HelpCircle },
];

const bottomTeacher = [
  { href: "/profile", label: "Settings", icon: Settings },
];

export default function AppSidebar() {
  const path = usePathname();
  const { userId } = useAuth();
  const [role, setRoleState] = useState<"student" | "teacher">("student");
  const [joined, setJoined] = useState<string | null>(null);

  const refresh = () => {
    if (!userId) {
      setRoleState("student");
      setJoined(null);
      return;
    }
    setRoleState(getRole(userId));
    setJoined(getJoinedClass(userId));
  };

  useEffect(() => {
    refresh();
    window.addEventListener(ROLE_EVENT, refresh);
    return () => window.removeEventListener(ROLE_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isTeacher = role === "teacher";
  const nav = isTeacher ? teacherNav : studentNav;
  const bottom = isTeacher ? bottomTeacher : bottomStudent;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col border-r border-indigo-100/80 bg-white/80 backdrop-blur-xl lg:w-[260px]">
      <Link
        href={isTeacher ? "/teacher" : "/dashboard"}
        className="flex items-center gap-3 px-4 py-5 lg:px-5"
      >
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
          <div className="text-[10px] font-medium text-slate-400">
            {isTeacher ? "Teacher console" : "Learn. Grow. Achieve."}
          </div>
        </div>
      </Link>

      {isTeacher && (
        <div className="mx-3 mb-2 hidden rounded-xl bg-indigo-600 px-3 py-2 text-center text-[11px] font-bold text-white lg:block">
          TEACHER MODE
        </div>
      )}

      {!isTeacher && joined && (
        <div className="mx-3 mb-2 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800 lg:block">
          Linked to class <span className="font-mono">{joined}</span>
        </div>
      )}

      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-2 lg:px-3">
        {nav.map((item) => {
          const base = item.href.split("?")[0];
          const active =
            path === base ||
            (base !== "/dashboard" &&
              base !== "/teacher" &&
              path.startsWith(base)) ||
            (base === "/teacher" && path.startsWith("/teacher"));
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? isTeacher
                    ? "bg-indigo-100 text-indigo-900 shadow-sm"
                    : "bg-violet-100 text-violet-800 shadow-sm"
                  : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  active
                    ? isTeacher
                      ? "text-indigo-600"
                      : "text-violet-600"
                    : "text-slate-400 group-hover:text-violet-500"
                )}
              />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {!isTeacher && (
        <div className="mx-3 mb-3 hidden rounded-2xl bg-gradient-to-br from-violet-100 via-fuchsia-50 to-indigo-50 p-4 lg:block">
          <div className="flex items-center gap-2 text-violet-700">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-bold">Small steps</span>
          </div>
          <div className="text-xs font-bold text-violet-800">Big results!</div>
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
      )}

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
