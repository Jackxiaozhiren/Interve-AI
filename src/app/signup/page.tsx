"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion } from "framer-motion";
import { GlobalBackground } from "@/components/ui/global-background";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/utils/constants";
import { OAuthProviderButtons } from "@/components/auth/oauth-buttons";

export default function SignupPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  // One surface for anything the door refused, exactly as /login does it: the
  // provider press lifecycle reports here, and so does a failed demo submit,
  // which used to be a console.error and nothing else.
  const [error, setError] = useState<string | null>(null);

  // An account that is already signed in is not being asked to create another
  // one. /login has done this since it existed; /signup did not, so the page a
  // signed-in visitor can reach from the footer offered a *new* demo identity and
  // replaced the one the UI shows them with a random uuid on submit. No `?from=`
  // is honoured here because nothing produces one: src/proxy.ts sends
  // unauthenticated visitors to /login, so there is no saved destination to
  // re-judge — and no redirect target to validate either.
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // This used to be a fake: both buttons called login() with a hardcoded
  // `oauth_user@example.com` identity and never touched Supabase, so the page
  // advertised Google/GitHub while creating a throwaway demo account that
  // shared one email with every other "OAuth" signup. Real provider redirect now,
  // the same door LoginForm uses, and the account lands on /login where the
  // AuthContext bridge converts it into an app session.

  return (
    <main className="min-h-screen relative flex items-center justify-center p-6 text-[#0f172a] selection:bg-sky-500/20">
      <GlobalBackground />
      
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-serif font-semibold tracking-tight text-slate-900 group">
            <div className="relative w-4 h-4">
               <div className="absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-60" />
               <div className="absolute inset-[2px] rounded-full bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.8)]" />
            </div>
            Interve AI
          </Link>
        </div>

        <Card className="bg-white/70 border border-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,1)] backdrop-blur-2xl rounded-[32px] overflow-hidden">
          <CardHeader className="pb-6 text-center">
            <CardTitle className="text-2xl font-serif text-slate-900">Create an account</CardTitle>
            <CardDescription className="text-slate-500 text-[15px]">
              Start your journey to interview mastery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {/* One door, same as /login. The name + email form that used to sit
                  here created a local identity with `crypto.randomUUID()` — an
                  account nobody owned — and after §15.2 = a it could not produce a
                  session at all. */}
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  用 Google 或 GitHub 注册
                </p>
                <p className="text-[13px] text-slate-500 mb-3 leading-relaxed">
                  首次用这两个账号之一登录时会自动创建账号。你不需要为本站单独设置密码。
                </p>
                <OAuthProviderButtons onResult={setError} />
                {error && (
                  <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-8 font-medium">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-700 font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
