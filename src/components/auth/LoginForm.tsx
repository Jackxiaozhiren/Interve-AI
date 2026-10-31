"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/utils/constants";
import { safeInternalPath } from "@/utils/redirect";
import { OAuthProviderButtons } from "@/components/auth/oauth-buttons";
import { consumeProviderCallbackFailure } from "@/lib/auth";

export function LoginForm() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);

  // A provider handoff that came back failed is reported once, here, and it stays
  // on screen: it is not something the visitor just did to the form, so it does
  // not share the 5 s auto-clear below. In an effect rather than during render
  // because it reads and rewrites the address bar.
  //
  // Only a read that found something writes the state. The consumer clears the
  // fragment as it reports, so a second pass — a remount, a refresh of this
  // subtree — finds nothing left and would erase the very reason it is showing.
  useEffect(() => {
    // Deferred one turn rather than suppressed: `react-hooks/set-state-in-effect`
    // is there to stop an effect cascading renders, and this read can only happen
    // after hydration at all. One extra render either way, and the rule keeps
    // policing every other effect in the tree. Same resolution the sibling app used
    // for its loader (apps/dsa-web/app/datasets/page.tsx).
    void Promise.resolve().then(() => {
      const message = consumeProviderCallbackFailure(window.location, {
        replace: (next) => window.history.replaceState(window.history.state, "", next),
      });
      if (message) setProviderNotice(message);
    });
  }, []);

  // Auto redirect if already logged in.
  //
  // `?from=` is written by src/proxy.ts from a path, but it arrives through the
  // URL, so a visitor can be handed a link that completes sign-in and then leaves
  // with them: `/login?from=https://evil.example` navigated an authenticated
  // session off-site (measured against the running app). Only a path on this
  // origin is honoured; anything else goes to the dashboard.
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(safeInternalPath(searchParams.get("from"), ROUTES.DASHBOARD));
    }
  }, [isAuthenticated, router, searchParams]);

  // Hide error after 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-md relative z-10"
    >
      {/* Brand Logo */}
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-serif font-semibold tracking-tight text-slate-900 group"
        >
          <div className="relative w-4 h-4">
            <div className="absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-60" />
            <div className="absolute inset-[2px] rounded-full bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.8)]" />
          </div>
          Interve AI
        </Link>
      </div>

      {/* Login Card */}
      <Card className="bg-white/70 border border-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-2xl rounded-[32px] overflow-hidden">
        <CardHeader className="pb-6 text-center">
          <CardTitle className="text-2xl font-serif text-slate-900">Welcome back</CardTitle>
          <CardDescription className="text-slate-500 text-[15px]">
            Sign in to continue your interview journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* One door. The email + password form that used to sit below this
                collected a password no code read, and since the session endpoint
                began requiring a verified token (§15.2 = a) it could not succeed
                anyway. Keeping it would be a credential the product pretends to
                check, so it is gone rather than disabled. */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">
                用 Google 或 GitHub 登录
              </p>
              <p className="text-[13px] text-slate-500 mb-3 leading-relaxed">
                账号由 Google 或 GitHub 验证。本站不接收、也不校验你为这里单独设置的密码。
              </p>
              <OAuthProviderButtons onResult={setError} />
              {providerNotice && (
                <p role="status" className="mt-3 text-sm font-medium text-rose-600">
                  {providerNotice}
                </p>
              )}
            </div>

            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-3 text-sm font-medium"
              >
                {error}
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Switch to Signup */}
      <p className="text-center text-slate-500 text-sm mt-8 font-medium">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-sky-700 font-bold hover:underline">
          Sign up
        </Link>
      </p>
    </motion.div>
  );
}
