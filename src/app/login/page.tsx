"use client";

import { Suspense } from "react";
import { GlobalBackground } from "@/components/ui/global-background";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 text-[#0f172a] selection:bg-sky-500/20">
      <GlobalBackground />
      <Suspense
        fallback={
          <div className="flex items-center justify-center">
            <span className="w-8 h-8 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
