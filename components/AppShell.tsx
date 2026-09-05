"use client";

import { usePathname } from "next/navigation";
import FocusLock from "@/components/FocusLock";
import UserBootstrap from "@/components/UserBootstrap";
import FullscreenGate from "@/components/FullscreenGate";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";
import SiteHeader from "@/components/SiteHeader";

const MARKETING = new Set(["/", "/sign-in", "/sign-up"]);

function isMarketing(path: string) {
  if (MARKETING.has(path)) return true;
  if (path.startsWith("/sign-in") || path.startsWith("/sign-up")) return true;
  return false;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const marketing = isMarketing(path);

  return (
    <div className="min-h-screen bg-[#f4f6ff] text-slate-900">
      <UserBootstrap />
      <FullscreenGate />
      <FocusLock />

      {marketing ? (
        <>
          <SiteHeader />
          <main>{children}</main>
        </>
      ) : (
        <div className="min-h-screen">
          <AppSidebar />
          <div className="pl-[72px] lg:pl-[260px]">
            <AppTopBar />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          </div>
        </div>
      )}
    </div>
  );
}
