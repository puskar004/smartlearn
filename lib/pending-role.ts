const KEY = "sl_pending_role";
const TEACHER_LOGIN_FLAG = "sl_teacher_fresh_login";

export type AppRole = "student" | "teacher";

export function setPendingRole(role: AppRole) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, role);
  // Every time user chooses Teacher at login → new class code after OTP
  if (role === "teacher") {
    sessionStorage.setItem(TEACHER_LOGIN_FLAG, "1");
  } else {
    sessionStorage.removeItem(TEACHER_LOGIN_FLAG);
  }
}

export function getPendingRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const r = sessionStorage.getItem(KEY);
  return r === "teacher" || r === "student" ? r : null;
}

export function clearPendingRole() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}

export function consumeTeacherFreshLogin(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(TEACHER_LOGIN_FLAG);
  if (v) {
    sessionStorage.removeItem(TEACHER_LOGIN_FLAG);
    return true;
  }
  return false;
}

export function markTeacherFreshLogin() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TEACHER_LOGIN_FLAG, "1");
}
