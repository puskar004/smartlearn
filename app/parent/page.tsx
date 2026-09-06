"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Parent portal removed — redirect. */
export default function ParentRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="p-10 text-center text-sm text-slate-500">
      Parent portal removed. Redirecting…
    </div>
  );
}
