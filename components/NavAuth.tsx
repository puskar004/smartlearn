"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { getRole } from "@/lib/teacher-store";

export default function NavAuth() {
  const { userId } = useAuth();
  const teacher = Boolean(userId && getRole(userId) === "teacher");

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Show when="signed-out">
        <Link
          href="/login"
          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Sign In
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-500"
        >
          Get Started
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href={teacher ? "/teacher" : "/profile"}
          className="hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:inline"
        >
          {teacher ? "Teacher Hub" : "Profile"}
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-9 w-9",
            },
          }}
        />
      </Show>
    </div>
  );
}
