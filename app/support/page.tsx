"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { HelpCircle, Loader2, Send, Inbox } from "lucide-react";
import { pushNotification } from "@/lib/notifications";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  at: number;
};

export default function SupportPage() {
  const { isSignedIn, user } = useUser();
  const { userId } = useAuth();
  const [subject, setSubject] = useState("Help with SmartLearn");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<Ticket[]>([]);

  const loadMine = async () => {
    try {
      const res = await fetch("/api/support");
      const data = await res.json();
      if (data.tickets) setMine(data.tickets);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isSignedIn) void loadMine();
  }, [isSignedIn]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!isSignedIn || !userId) {
      setError("Please sign in to contact support.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send");
        return;
      }
      setStatus(
        data.message ||
          "Saved for SmartLearn site handlers. Check notifications."
      );
      pushNotification(userId, {
        title: "Support ticket sent",
        body: `“${subject}” was delivered to the website support inbox.`,
        href: "/support",
      });
      setMessage("");
      void loadMine();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
        <HelpCircle className="h-3.5 w-3.5" /> Help &amp; Support
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Message the website team
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Messages go to the <strong>SmartLearn site handler inbox</strong> (stored
        on server
        {process.env.NEXT_PUBLIC_SUPPORT_HINT
          ? ` · ${process.env.NEXT_PUBLIC_SUPPORT_HINT}`
          : ""}
        ). This is <em>not</em> the student Common Room.
      </p>
      <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <Inbox className="mr-1 inline h-3.5 w-3.5" />
        Handlers can read tickets via server logs /{" "}
        <code className="rounded bg-white px-1">SUPPORT_EMAIL</code> if configured
        on Vercel. You also get an in-app notification confirmation.
      </div>

      <form
        onSubmit={(e) => void submit(e)}
        className="mt-8 space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="text-xs text-slate-500">
          From:{" "}
          <strong>
            {user?.fullName || "Student"}{" "}
            {user?.primaryEmailAddress?.emailAddress
              ? `(${user.primaryEmailAddress.emailAddress})`
              : ""}
          </strong>
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="Subject"
          required
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="Describe the issue or feedback…"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send to site support
        </button>
        {status && (
          <p className="text-center text-xs font-semibold text-emerald-700">
            {status}
          </p>
        )}
        {error && (
          <p className="text-center text-xs font-semibold text-rose-600">
            {error}
          </p>
        )}
      </form>

      {mine.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-slate-800">Your recent tickets</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <div className="font-semibold text-slate-800">{t.subject}</div>
                <div className="text-slate-500">
                  {new Date(t.at).toLocaleString()}
                </div>
                <div className="mt-1 text-slate-600">{t.message.slice(0, 120)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
