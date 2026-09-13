"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Brain,
  CalendarDays,
  HelpCircle,
  Home,
  LineChart,
  Settings,
  Sparkles,
  MessageCircle,
  ClipboardList,
  Target,
  GraduationCap,
  Users,
  Upload,
  Radio,
  Link2,
  MessageSquare,
  Newspaper,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJoinedClass, getRole, setRole } from "@/lib/teacher-store";
import { ROLE_EVENT, emitRoleChanged } from "@/lib/role-events";

const studentNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/ncert", label: "NCERT & Chapters", icon: BookOpen },
  { href: "/pyq", label: "PYQs", icon: ClipboardList },
  { href: "/quiz", label: "Practice & Quiz", icon: Target },
  { href: "/test", label: "Live Test", icon: ClipboardList },
  { href: "/live-class", label: "Live Class", icon: Radio },
  { href: "/ai-tutor", label: "AI Tutor", icon: Brain },
  { href: "/feynman", label: "Feynman Mode", icon: Sparkles },
  { href: "/flowchart", label: "Chapter Flowchart", icon: GitBranch },
  { href: "/blueprint", label: "Study Plan", icon: CalendarDays },
  { href: "/mistakes", label: "Progress", icon: LineChart },
  { href: "/news", label: "Exam News", icon: Newspaper },
  { href: "/join-class", label: "Class & Notes", icon: Link2 },
  { href: "/remarks", label: "Remarks", icon: MessageCircle },
  { href: "/common-room", label: "Common Room", icon: MessageSquare },
];

const teacherNav = [
  { href: "/teacher", label: "Teacher Home", icon: Home },
  { href: "/teacher?tab=students", label: "My Students", icon: Users },
  { href: "/teacher/test", label: "Live Tests", icon: ClipboardList },
  { href: "/teacher?tab=materials", label: "Upload Notes/Videos", icon: Upload },
  { href: "/teacher?tab=live", label: "Live Sessions", icon: Radio },
  { href: "/teacher?tab=attendance", label: "Attendance", icon: ClipboardList },
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
  /** Collapsed rail by default; hover expands full labels (overlay). */
  const [expanded, setExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    window.addEventListener("sl-joined-changed", refresh);
    return () => {
      window.removeEventListener(ROLE_EVENT, refresh);
      window.removeEventListener("sl-joined-changed", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Entering any section → collapse rail again
  useEffect(() => {
    setExpanded(false);
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, [path]);

  const onEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setExpanded(true);
  };

  const onLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setExpanded(false), 180);
  };

  const isTeacher = role === "teacher";
  const nav = isTeacher ? teacherNav : studentNav;
  const bottom = isTeacher ? bottomTeacher : bottomStudent;
  const showLabels = expanded;

  return (
    <aside
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocusCapture={onEnter}
      className={cn(
        "sl-app-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-indigo-100/80 bg-white/95 shadow-sm backdrop-blur-xl transition-[width,box-shadow] duration-200 ease-out md:flex",
        expanded
          ? "w-[min(260px,70vw)] shadow-xl shadow-indigo-500/10"
          : "w-[72px]"
      )}
    >
      <Link
        href={isTeacher ? "/teacher" : "/dashboard"}
        className={cn(
          "flex items-center gap-3 py-5",
          showLabels ? "px-5" : "justify-center px-2"
        )}
        title="CurioSphere"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/curiosphere-logo.svg"
          alt="CurioSphere"
          className="h-10 w-10 shrink-0 rounded-xl shadow-md shadow-indigo-500/20"
        />
        {showLabels && (
          <div className="min-w-0 leading-tight">
            <div className="text-base font-extrabold tracking-tight text-slate-900">
              Curio<span className="text-violet-600">Sphere</span>
            </div>
            <div className="text-[10px] font-medium text-slate-400">
              {isTeacher ? "Teacher console" : "Learn. Grow. Achieve."}
            </div>
          </div>
        )}
      </Link>

      {isTeacher && showLabels && (
        <div className="mx-3 mb-2 rounded-xl bg-indigo-600 px-3 py-2 text-center text-[11px] font-bold text-white">
          TEACHER MODE
        </div>
      )}

      {!isTeacher && joined && showLabels && (
        <div className="mx-3 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
          Linked to class <span className="font-mono">{joined}</span>
        </div>
      )}

      <nav
        className={cn(
          "mt-2 flex-1 space-y-1 overflow-y-auto overflow-x-hidden",
          showLabels ? "px-3" : "px-2"
        )}
      >
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
              title={item.label}
              className={cn(
                "group flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                showLabels ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
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
              {showLabels && (
                <span className="truncate whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {!isTeacher && showLabels && (
        <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-br from-violet-100 via-fuchsia-50 to-indigo-50 p-4">
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

      <div
        className={cn(
          "space-y-1 border-t border-slate-100 py-3",
          showLabels ? "px-3" : "px-2"
        )}
      >
        {bottom.map((item) => {
          const Icon = item.icon;
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "group flex items-center rounded-xl text-sm font-medium transition-all",
                showLabels ? "gap-3 px-3 py-2" : "justify-center px-2 py-2",
                active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <Icon className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-slate-600" />
              {showLabels && (
                <span className="truncate whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          );
        })}
        {!isTeacher && userId && (
          <button
            type="button"
            title="Join as Teacher"
            onClick={() => {
              setRole(userId, "teacher");
              emitRoleChanged();
              window.location.href = "/teacher";
            }}
            className={cn(
              "group flex w-full items-center rounded-xl text-left text-sm font-bold text-indigo-700 transition hover:bg-indigo-50",
              showLabels ? "gap-3 px-3 py-2" : "justify-center px-2 py-2"
            )}
          >
            <GraduationCap className="h-5 w-5 shrink-0 text-indigo-600" />
            {showLabels && (
              <span className="truncate whitespace-nowrap">Join as Teacher</span>
            )}
          </button>
        )}
        {isTeacher && userId && (
          <button
            type="button"
            title="Student panel"
            onClick={() => {
              setRole(userId, "student");
              emitRoleChanged();
              window.location.href = "/dashboard";
            }}
            className={cn(
              "group flex w-full items-center rounded-xl text-left text-sm font-bold text-violet-700 transition hover:bg-violet-50",
              showLabels ? "gap-3 px-3 py-2" : "justify-center px-2 py-2"
            )}
          >
            <BookOpen className="h-5 w-5 shrink-0 text-violet-600" />
            {showLabels && (
              <span className="truncate whitespace-nowrap">Student panel</span>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
