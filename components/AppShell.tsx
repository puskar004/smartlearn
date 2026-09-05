"use client";

import SiteHeader from "@/components/SiteHeader";
import FocusLock from "@/components/FocusLock";
import UserBootstrap from "@/components/UserBootstrap";
import FullscreenGate from "@/components/FullscreenGate";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <UserBootstrap />
      <FullscreenGate />
      <SiteHeader />
      <FocusLock />
      <main>{children}</main>
    </div>
  );
}
