"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ArrowRight, GithubLogo, GoogleLogo, Eye, EyeSlash } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { GlobalBackground } from "@/components/ui/global-background";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/utils/constants";

function LoginForm() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      const from = searchParams.get("from");
      router.replace(from || ROUTES.DASHBOARD);
    }
  }, [isAuthenticated, router, searchParams]);

  // Hide error after 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);

    try {
      // In a real app, this would validate credentials with the backend
      await login({
        id: crypto.randomUUID(),
        username: email.split("@")[0],
        email,
      });
    } catch (_err) {
      setError("Login failed. Please check your credentials and try again.");
    }
  };

  const handleOAuthLogin = async () => {
    try {
      await login({
        id: crypto.randomUUID(),
        username: "OAuth User",
        email: "oauth_user@example.com",
      });
    } catch (error) {
      console.error("OAuth login failed", error);
      setError("OAuth login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 text-[#0f172a] selection:bg-sky-500/20">
      <GlobalBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
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
            <div className="space-y-6">
              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleOAuthLogin}
                  type="button"
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm text-sm font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleLogo weight="bold" className="w-4 h-4" /> Google
                </button>
                <button
                  onClick={handleOAuthLogin}
                  type="button"
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm text-sm font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GithubLogo weight="fill" className="w-4 h-4" /> GitHub
                </button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#f8fafd] px-2 text-slate-400 font-semibold tracking-wider">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-3 text-sm font-medium"
                >
                  {error}
                </motion.div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-slate-700 font-medium">
                    Email address
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 bg-white/50 border-slate-200 focus-visible:ring-sky-500/50 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-slate-700 font-medium">
                      Password
                    </Label>
                    <Link
                      href="#"
                      className="text-xs font-semibold text-sky-600 hover:text-sky-500 hover:underline transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-12 bg-white/50 border-slate-200 focus-visible:ring-sky-500/50 rounded-xl pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeSlash weight="regular" className="w-5 h-5" />
                      ) : (
                        <Eye weight="regular" className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <MagneticButton
                  className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-[0_4px_12px_rgba(15,23,42,0.15)] flex justify-center items-center group transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign In{" "}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </MagneticButton>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Switch to Signup */}
        <p className="text-center text-slate-500 text-sm mt-8 font-medium">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-sky-600 font-bold hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-50">
          <span className="w-8 h-8 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
