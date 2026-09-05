/** Broadcast role / class changes so sidebar & shell re-render immediately */

export const ROLE_EVENT = "sl-role-changed";

export function emitRoleChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROLE_EVENT));
}
