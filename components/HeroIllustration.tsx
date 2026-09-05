import {
  BookOpen,
  Brain,
  ClipboardList,
  LineChart,
  ShieldCheck,
  Target,
} from "lucide-react";

/** Right-side hero matching the 3D students + floating feature cards layout. */
export default function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] select-none">
      {/* floating cards */}
      <div className="absolute left-0 top-[8%] z-20 hidden animate-[float_5s_ease-in-out_infinite] sm:block">
        <Card
          icon={<BookOpen className="h-4 w-4 text-indigo-500" />}
          title="NCERT"
          sub="Complete Chapters"
          tone="bg-white"
        />
      </div>
      <div className="absolute left-2 top-[28%] z-20 hidden animate-[float_6s_ease-in-out_infinite_0.4s] sm:block">
        <Card
          icon={<ClipboardList className="h-4 w-4 text-violet-500" />}
          title="PYQs"
          sub="2019 – 2025"
          tone="bg-white"
        />
      </div>
      <div className="absolute left-4 top-[48%] z-20 hidden animate-[float_5.5s_ease-in-out_infinite_0.8s] sm:block">
        <Card
          icon={<Target className="h-4 w-4 text-rose-500" />}
          title="Smart Quiz"
          sub="Adaptive Practice"
          tone="bg-white"
        />
      </div>

      <div className="absolute right-0 top-[6%] z-20 hidden animate-[float_5.2s_ease-in-out_infinite_0.2s] md:block">
        <Card
          icon={<Brain className="h-4 w-4 text-fuchsia-500" />}
          title="AI Tutor"
          sub="Step-by-step explanations"
          tone="bg-white"
        />
      </div>
      <div className="absolute right-1 top-[28%] z-20 hidden animate-[float_6.2s_ease-in-out_infinite_0.6s] md:block">
        <Card
          icon={<LineChart className="h-4 w-4 text-sky-500" />}
          title="Personalized Plan"
          sub="Based on your goals"
          tone="bg-white"
        />
      </div>
      <div className="absolute right-2 top-[50%] z-20 hidden animate-[float_5.8s_ease-in-out_infinite_1s] md:block">
        <Card
          icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />}
          title="Parent Portal"
          sub="Stay informed"
          tone="bg-white"
        />
      </div>

      {/* speech bubble */}
      <div className="absolute right-[12%] top-0 z-30 hidden rounded-2xl border border-violet-100 bg-white px-3 py-2 text-[11px] font-semibold leading-snug text-slate-700 shadow-lg sm:block">
        Have a doubt?
        <br />
        I&apos;m here to help!
        <span className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 border-b border-r border-violet-100 bg-white" />
      </div>

      {/* main art */}
      <div className="relative z-10 px-2 pt-8 sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-students.svg"
          alt="Students learning with SmartLearn AI companion"
          className="mx-auto w-full drop-shadow-2xl"
          draggable={false}
        />
      </div>

      {/* tagline */}
      <p className="pointer-events-none absolute bottom-2 right-2 z-20 rotate-[-8deg] text-sm font-bold italic leading-tight text-violet-600/90 sm:bottom-6 sm:right-0 sm:text-base">
        Better
        <br />
        Students
        <br />
        Brighter
        <br />
        Futures
      </p>
      <svg
        className="pointer-events-none absolute bottom-8 right-16 hidden h-10 w-16 text-violet-400 sm:block"
        viewBox="0 0 80 40"
        fill="none"
      >
        <path
          d="M5 30 C30 5 55 5 75 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d="M68 14 L75 20 L67 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Card({
  icon,
  title,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border border-white/90 ${tone} px-3 py-2.5 shadow-lg shadow-violet-200/40 backdrop-blur`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-xs font-bold text-slate-800">{title}</div>
        <div className="text-[10px] text-slate-500">{sub}</div>
      </div>
    </div>
  );
}
