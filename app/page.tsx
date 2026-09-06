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
import HeroIllustration from "@/components/HeroIllustration";

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(ellipse_at_top,_#ede9fe_0%,_#eef2ff_35%,_#f8fafc_70%,_#ffffff_100%)]">
      {/* soft waves */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,_rgba(167,139,250,0.25),_transparent_70%)]" />
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-10 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-1/3 h-64 w-64 rounded-full bg-fuchsia-200/20 blur-3xl" />

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pb-10 lg:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-4">
          {/* Left copy */}
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-violet-200/80 bg-white/90 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-violet-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              YOUR AI-POWERED STUDY COMPANION
              <span className="mx-0.5 text-slate-300">|</span>
              <span className="font-semibold text-slate-600">
                CLASSES 10 – 12
              </span>
            </div>

            <h1 className="mt-6 text-[2.6rem] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem]">
              Learn Smarter.
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Your Way.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-600 sm:text-base">
              Master NCERT, practice PYQs, clear doubts with AI, and get a
              personalized study plan — all in one place.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/35 transition hover:bg-violet-500 hover:shadow-xl"
              >
                <Rocket className="h-4 w-4" />
                Get Started for Free →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-6 py-3.5 text-sm font-bold text-violet-700 shadow-sm backdrop-blur transition hover:bg-violet-50"
              >
                <Play className="h-4 w-4 fill-violet-600 text-violet-600" />
                Watch Demo
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-600">
                  ✓
                </span>
                No credit card required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[10px] text-rose-500">
                  ♥
                </span>
                Trusted by 50,000+ students
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] text-sky-600">
                  ✓
                </span>
                Safe &amp; Ad-free
              </span>
            </div>
          </div>

          {/* Right illustration */}
          <div className="relative z-10 lg:-mr-4">
            <HeroIllustration />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center text-slate-400 lg:mt-6">
          <span className="text-[11px] font-medium tracking-wide">
            Scroll to explore
          </span>
          <div className="mt-2 flex h-9 w-5 items-start justify-center rounded-full border-2 border-slate-300/80 pt-1.5">
            <div className="h-1.5 w-1 animate-bounce rounded-full bg-slate-400" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="explore"
        className="relative border-t border-violet-100/60 bg-white/60 py-16 backdrop-blur-sm"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">
            Everything for CBSE 10–12 — one tab
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feat
              href="/ncert"
              icon={<BookOpen className="h-5 w-5" />}
              title="NCERT Library"
              desc="In-app chapter PDFs"
              tone="bg-indigo-50 text-indigo-600"
            />
            <Feat
              href="/pyq"
              icon={<ClipboardList className="h-5 w-5" />}
              title="10-year PYQs"
              desc="PCM · PCB · all subjects"
              tone="bg-fuchsia-50 text-fuchsia-600"
            />
            <Feat
              href="/ai-tutor"
              icon={<Brain className="h-5 w-5" />}
              title="AI Tutor"
              desc="Gemini step-by-step help"
              tone="bg-violet-50 text-violet-600"
            />
            <Feat
              href="/test"
              icon={<Target className="h-5 w-5" />}
              title="Live Class Tests"
              desc="Teacher code · MCQ · timer"
              tone="bg-amber-50 text-amber-700"
            />
            <Feat
              href="/blueprint"
              icon={<LineChart className="h-5 w-5" />}
              title="Study Plan"
              desc="Your syllabus · auto plan"
              tone="bg-sky-50 text-sky-700"
            />
            <Feat
              href="/common-room"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Common Room"
              desc="Doubt wall with classmates"
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
