"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { GlobalBackground } from "@/components/ui/global-background";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/utils/constants";
import { OAuthProviderButtons } from "@/components/auth/oauth-buttons";

export default function SignupPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError(null);
    try {
      // In a real app, this would be an API call to register
      // For now, we'll just log them in to mock the flow
      await login();
    } catch (err) {
      console.error("Signup failed", err);
      setError("Sign up failed. Please try again.");
    }
  };

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
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  用账号注册 · 面试记录、报告与回放都会保存
                </p>
                <OAuthProviderButtons onResult={setError} />
                {error && (
                  <p role="alert" className="mt-3 text-sm font-medium text-rose-600">
                    {error}
                  </p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#f8fafd] px-2 text-slate-600 font-semibold tracking-wider">或用演示账号(不保存数据)</span>
                </div>
              </div>

              <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-12 bg-white/50 border-slate-200 focus-visible:ring-sky-500/50 rounded-xl"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-white/50 border-slate-200 focus-visible:ring-sky-500/50 rounded-xl"
                  />
                </div>
                
                <MagneticButton
                  className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-[0_4px_12px_rgba(15,23,42,0.15)] flex justify-center items-center group transition-all"
                  disabled={isLoading}
                  aria-label="Sign Up"
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <span aria-hidden="true" className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <>Sign Up <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </MagneticButton>
              </form>
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
