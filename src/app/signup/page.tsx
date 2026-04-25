"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ArrowRight, GithubLogo, GoogleLogo } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { GlobalBackground } from "@/components/ui/global-background";
import { useAuth } from "@/context/AuthContext";

export default function SignupPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    try {
      // In a real app, this would be an API call to register
      // For now, we'll just log them in to mock the flow
      await login({ id: crypto.randomUUID(), username: name || email.split('@')[0], email });
    } catch (error) {
      console.error("Signup failed", error);
    }
  };

  const handleOAuthSignup = async () => {
    try {
      await login({ id: crypto.randomUUID(), username: 'OAuth User', email: 'oauth_user@example.com' });
    } catch (error) {
      console.error("OAuth signup failed", error);
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
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleOAuthSignup}
                  type="button"
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm text-sm font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleLogo weight="bold" className="w-4 h-4" /> Google
                </button>
                <button 
                  onClick={handleOAuthSignup}
                  type="button"
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:shadow-sm text-sm font-semibold text-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GithubLogo weight="fill" className="w-4 h-4" /> GitHub
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#f8fafd] px-2 text-slate-400 font-semibold tracking-wider">Or register with</span>
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
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
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
          <Link href="/login" className="text-sky-600 font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
