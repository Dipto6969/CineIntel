"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Film, Mail, Lock, User, AlertTriangle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              username: email.split("@")[0],
            },
          },
        });

        if (error) throw error;

        // If email confirmation is enabled on Supabase, notify them.
        if (data.session) {
          router.push("/");
        } else {
          setSuccessMsg("Check your email to confirm your account!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : `Failed to sign in with ${provider}`);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#050608] overflow-hidden p-6 font-sans">
      {/* Decorative Neon Blurs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[oklch(0.70_0.16_195)]/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-[oklch(0.75_0.15_140)]/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        
        {/* Brand Logo & Title */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="p-3 bg-[oklch(0.18_0.02_250)] border border-white/10 rounded-2xl shadow-xl shadow-black/40 mb-3 animate-bounce-slow">
            <Film className="w-8 h-8 text-[oklch(0.70_0.16_195)]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Cine<span className="text-[oklch(0.70_0.16_195)]">Intel</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-xs">
            Your Personal Media Operating System
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="bg-[#12161c]/65 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl shadow-black/80">
          
          <h2 className="text-xl font-bold text-white mb-6">
            {isSignUp ? "Create your workspace" : "Welcome back"}
          </h2>

          {/* Form Actions */}
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[oklch(0.70_0.16_195)] focus:ring-1 focus:ring-[oklch(0.70_0.16_195)] transition-all duration-300 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[oklch(0.70_0.16_195)] focus:ring-1 focus:ring-[oklch(0.70_0.16_195)] transition-all duration-300 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <button type="button" className="text-xs text-[oklch(0.70_0.16_195)] hover:underline">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/[0.06] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[oklch(0.70_0.16_195)] focus:ring-1 focus:ring-[oklch(0.70_0.16_195)] transition-all duration-300 text-sm"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 animate-shake">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="flex items-center gap-2.5 p-3.5 bg-[oklch(0.75_0.15_140)]/10 border border-[oklch(0.75_0.15_140)]/20 rounded-xl text-xs text-emerald-300">
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[oklch(0.70_0.16_195)] hover:bg-[oklch(0.75_0.15_195)] disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-bold rounded-xl transition-all duration-300 shadow-lg shadow-[oklch(0.70_0.16_195)]/20 hover:shadow-[oklch(0.70_0.16_195)]/30 active:scale-[0.98] text-sm mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? "Initialize Account" : "Access Console"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Social login divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#12161c] px-3.5 text-zinc-500 font-semibold tracking-widest">Or connect via</span>
            </div>
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/[0.06] rounded-xl text-white text-xs font-semibold transition-all duration-300 active:scale-95"
            >
              {/* Simple Google SVG Icon */}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Google</span>
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              className="flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/[0.06] rounded-xl text-white text-xs font-semibold transition-all duration-300 active:scale-95"
            >
              <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span>GitHub</span>
            </button>
          </div>

          {/* Toggle View */}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {isSignUp ? (
                <>Already initialized? <span className="text-[oklch(0.70_0.16_195)] font-bold">Access Console</span></>
              ) : (
                <>New operator? <span className="text-[oklch(0.70_0.16_195)] font-bold">Initialize Workspace</span></>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
