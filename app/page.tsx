import Link from "next/link";
import {
  BookOpen,
  Brain,
  GraduationCap,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.35),_transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-100 backdrop-blur">
            <GraduationCap className="h-3.5 w-3.5" />
            Class 10–12 CBSE Exhaustive Curriculum
          </div>

          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                In-App Safe Search, Gemini AI Tutor &amp; Complete NCERT Mastery.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-indigo-100/85 sm:text-lg">
                Never switch tabs. Search education lectures, solve NCERT
                exemplar problems with Gemini AI, play chapter-level rapid
                quizzes, and study with high retention — while parents stay
                informed on WhatsApp.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/safe-search"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-400"
                >
                  <Sparkles className="h-4 w-4" />
                  Open In-App Safe Search &amp; Gemini
                </Link>
                <Link
                  href="/quiz"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 hover:bg-amber-300"
                >
                  <Trophy className="h-4 w-4" />
                  Play Chapter Levels (+20 XP)
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md">
                <Row label="Class Selected:" value="CLASS 10 · 11 · 12" valueClass="text-amber-300" />
                <div className="my-3 border-t border-white/10" />
                <Row label="Official NCERT & PYQs:" value="100% In-App Enabled" valueClass="text-emerald-300" />
                <div className="my-3 border-t border-white/10" />
                <Row label="Parent updates on:" value="WhatsApp Monitored" valueClass="text-emerald-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parent card */}
      <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                Parent Accountability &amp; Sync
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">
                Parent Weekly Performance Card
              </h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Real-time breakdown of study hours, quiz accuracy, and AI
                identified weaknesses — ready for WhatsApp.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <MessageCircle className="h-4 w-4" />
              Login as Student or Teacher
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Stat
              label="Focus Study Time (This Week)"
              value="Your real hours"
              hint="Starts at 0 for every new login — no sample data"
            />
            <Stat
              label="Average Quiz Accuracy"
              value="Live from quizzes"
              valueClass="text-indigo-600"
              hint="Only after the student attempts chapter drills"
            />
            <Stat
              label="Parent updates on WhatsApp"
              value="When number is set"
              valueClass="text-emerald-600"
              hint="Configure in Parent Portal / Profile"
            />
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
          Everything a serious CBSE student needs — inside one tab
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            href="/ncert"
            icon={<BookOpen className="h-5 w-5" />}
            title="NCERT + All Chapters"
            desc="Class 10–12 subjects with chapter maps, official NCERT links, and PYQ year banks."
            color="bg-indigo-50 text-indigo-600"
          />
          <Feature
            href="/ai-tutor"
            icon={<Brain className="h-5 w-5" />}
            title="Gemini AI Tutor"
            desc="Ask any doubt. Get calm, step-by-step solutions aligned to NCERT language."
            color="bg-violet-50 text-violet-600"
          />
          <Feature
            href="/safe-search"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Educational YouTube Only"
            desc="In-app search locked to CBSE/NCERT education queries — no random distractions."
            color="bg-emerald-50 text-emerald-600"
          />
          <Feature
            href="/quiz"
            icon={<Trophy className="h-5 w-5" />}
            title="Rapid Revision Quizzes"
            desc="Chapter quizzes designed for 10-minute high-yield board revision loops."
            color="bg-amber-50 text-amber-700"
          />
          <Feature
            href="/common-room"
            icon={<MessageCircle className="h-5 w-5" />}
            title="Common Room + Timer"
            desc="Discuss doubts with classmates. Posting cooldown stops spam."
            color="bg-sky-50 text-sky-600"
          />
          <Feature
            href="/extreme"
            icon={<Sparkles className="h-5 w-5" />}
            title="Extreme Focus Mode"
            desc="Paid lock-in: no back navigation until the timer ends. Deep work only."
            color="bg-rose-50 text-rose-600"
          />
          <Feature
            href="/mistakes"
            icon={<Trophy className="h-5 w-5" />}
            title="Mistake Vault"
            desc="Only YOUR wrong answers. New login = empty vault. Relearn what you miss."
            color="bg-rose-50 text-rose-700"
          />
          <Feature
            href="/feynman"
            icon={<Brain className="h-5 w-5" />}
            title="Feynman Mode"
            desc="Explain a concept in plain words — AI grades clarity. Mastery, not mugging."
            color="bg-violet-50 text-violet-700"
          />
          <Feature
            href="/blueprint"
            icon={<GraduationCap className="h-5 w-5" />}
            title="Board Blueprint"
            desc="Exam countdown + daily missions built from your weakness heat map."
            color="bg-blue-50 text-blue-700"
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} SmartLearn · CBSE Class 10–12 · Focus-first learning
      </footer>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-indigo-100/80">{label}</span>
      <span className={`font-bold ${valueClass || "text-white"}`}>{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-extrabold text-slate-900 ${valueClass || ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function Feature({
  href,
  icon,
  title,
  desc,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className={`inline-flex rounded-xl p-2.5 ${color}`}>{icon}</div>
      <h3 className="mt-3 text-base font-bold text-slate-900 group-hover:text-indigo-700">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{desc}</p>
    </Link>
  );
}
