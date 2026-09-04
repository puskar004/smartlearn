import { SignUp } from "@clerk/nextjs";
import { smartLearnAppearance } from "@/lib/clerk-appearance";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-violet-50 px-4 py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-black text-white shadow-lg shadow-indigo-500/30">
          SL
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">SmartLearn</h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          Learning, Personalized
        </p>
      </div>
      <SignUp
        appearance={smartLearnAppearance}
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
      />
      <p className="mt-6 text-center text-xs text-slate-400">
        Create your free student account · SmartLearn
      </p>
    </div>
  );
}
