/** Clerk email-OTP users often have empty fullName — fall back cleanly. */
export function displayName(user: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: { emailAddress?: string | null }[] | null;
} | null | undefined): string {
  if (!user) return "Student";
  const full = (user.fullName || "").trim();
  if (full) return full;
  const parts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  if (user.username) return String(user.username);
  const email =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress ||
    "";
  if (email.includes("@")) return email.split("@")[0] || email;
  if (email) return email;
  return "Student";
}
