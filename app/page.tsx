import Link from "next/link";
import {
  BookOpen,
  Brain,
  ClipboardList,
  LineChart,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="overflow-hidden bg-gradient-to-b from-[#f5f3ff] via-[#eef2ff] to-white">
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
        <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-[11px] font-bold text-violet-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              YOUR AI-POWERED STUDY COMPANION
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">CLASSES 10 – 12</span>
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Learn Smarter.
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Your Way.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Master NCERT, practice PYQs, clear doubts with AI, and get a
              personalized study plan — all in one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500"
              >
                <Rocket className="h-4 w-4" />
                Get Started for Free →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-3.5 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-50"
              >
                <Play className="h-4 w-4" />
                Watch Demo
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span> No credit card
                required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-rose-500">♥</span> Trusted by students
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-sky-500">✓</span> Safe &amp; Ad-free
              </span>
            </div>
          </div>

          {/* Right illustration card */}
          <div className="relative">
            <div className="absolute -right-2 top-6 z-10 hidden rounded-2xl border border-white/80 bg-white p-3 shadow-xl sm:block">
              <div className="text-xs font-bold text-violet-700">AI Tutor</div>
              <div className="text-[10px] text-slate-500">
                Step-by-step explanations
              </div>
            </div>
            <div className="absolute -left-2 bottom-24 z-10 hidden rounded-2xl border border-white/80 bg-white p-3 shadow-xl sm:block">
              <div className="text-xs font-bold text-indigo-700">NCERT</div>
              <div className="text-[10px] text-slate-500">Complete chapters</div>
            </div>
            <div className="absolute right-8 top-28 z-10 hidden rounded-2xl border border-white/80 bg-white p-3 shadow-xl md:block">
              <div className="text-xs font-bold text-fuchsia-700">PYQs</div>
              <div className="text-[10px] text-slate-500">2016 – 2025</div>
            </div>
            <div className="absolute bottom-8 right-0 z-10 hidden rounded-2xl border border-white/80 bg-white p-3 shadow-xl sm:block">
              <div className="text-xs font-bold text-emerald-700">
                Parent Portal
              </div>
              <div className="text-[10px] text-slate-500">Stay informed</div>
            </div>

            <div className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-100 via-white to-sky-100 p-8 shadow-2xl shadow-violet-200/50">
              <div className="absolute right-6 top-6 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-3xl shadow-lg">
                🤖
              </div>
              <div className="mt-8 flex justify-center gap-4">
                <div className="flex h-28 w-24 flex-col items-center justify-end rounded-2xl bg-violet-500/90 pb-3 text-white shadow-lg">
                  <span className="text-4xl">👨‍🎓</span>
                </div>
                <div className="flex h-28 w-24 flex-col items-center justify-end rounded-2xl bg-fuchsia-400/90 pb-3 text-white shadow-lg">
                  <span className="text-4xl">👩‍🎓</span>
                </div>
              </div>
              <div className="mt-6 rounded-2xl bg-slate-900 p-4 text-center shadow-inner">
                <div className="text-2xl text-violet-300">🎓</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  SmartLearn desk
                </div>
                <div className="mt-2 flex justify-center gap-2">
                  <span className="rounded bg-indigo-500/30 px-2 py-0.5 text-[9px] font-bold text-indigo-200">
                    NCERT
                  </span>
                  <span className="rounded bg-fuchsia-500/30 px-2 py-0.5 text-[9px] font-bold text-fuchsia-200">
                    PYQs
                  </span>
                  <span className="rounded bg-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                    Quiz
                  </span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs font-semibold italic text-violet-700">
                Better Students · Brighter Futures
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center text-slate-400">
          <span className="text-[11px] font-medium">Scroll to explore</span>
          <div className="mt-2 h-8 w-5 rounded-full border-2 border-slate-300">
            <div className="mx-auto mt-1.5 h-1.5 w-1 animate-bounce rounded-full bg-slate-400" />
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-t border-violet-100/80 bg-white/70 py-16 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">
            Everything for CBSE 10–12 — one tab
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feat
              href="/ncert"
              icon={<BookOpen className="h-5 w-5" />}
              title="NCERT Library"
              desc="In-app chapter PDFs — no Chrome block"
              tone="bg-indigo-50 text-indigo-600"
            />
            <Feat
              href="/pyq"
              icon={<ClipboardList className="h-5 w-5" />}
              title="10-year PYQs"
              desc="PCM · PCB · all subjects with PDFs"
              tone="bg-fuchsia-50 text-fuchsia-600"
            />
            <Feat
              href="/ai-tutor"
              icon={<Brain className="h-5 w-5" />}
              title="AI Tutor"
              desc="Gemini step-by-step NCERT help"
              tone="bg-violet-50 text-violet-600"
            />
            <Feat
              href="/test"
              icon={<Target className="h-5 w-5" />}
              title="Live Class Tests"
              desc="Teacher code · MCQ · timer · scores"
              tone="bg-amber-50 text-amber-700"
            />
            <Feat
              href="/blueprint"
              icon={<LineChart className="h-5 w-5" />}
              title="Study Plan"
              desc="Pick your syllabus · auto day plan"
              tone="bg-sky-50 text-sky-700"
            />
            <Feat
              href="/parent"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Parent Portal"
              desc="Focus alerts on WhatsApp"
              tone="bg-emerald-50 text-emerald-700"
            />
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              href="/login"
              className="inline-flex rounded-full bg-violet-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Feat({
  href,
  icon,
  title,
  desc,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="sl-card flex gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:border-violet-200"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}
      >
        {icon}
      </div>
      <div>
        <div className="font-bold text-slate-900">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
      </div>
    </Link>
  );
}
