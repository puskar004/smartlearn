"use client";

import { FormEvent, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { HelpCircle, Loader2, Send } from "lucide-react";

export default function SupportPage() {
  const { isSignedIn, user } = useUser();
  const [subject, setSubject] = useState("Help with SmartLearn");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!isSignedIn) {
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
      setStatus(data.message || "Sent to SmartLearn support.");
      setMessage("");
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
        Message the SmartLearn team
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        This goes to the website handlers (support inbox), not the student
        common room. Use Common Room to ask classmates.
      </p>

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
    </div>
  );
}
