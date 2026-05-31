"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Archive, Film, LogOut, User, Bookmark, Search as SearchIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { SearchSuggestInput } from "@/components/shared/SearchSuggestInput";

export function Navbar({
  initialSearchQuery = "",
  transparentOnTop = true,
  showSearch = true,
}: {
  initialSearchQuery?: string;
  transparentOnTop?: boolean;
  showSearch?: boolean;
}) {
  const [scrolled, setScrolled] = useState(!transparentOnTop);
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!transparentOnTop) return;
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [transparentOnTop]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 flex items-center ${
        scrolled || !transparentOnTop
          ? "h-16 bg-[#050608]/90 backdrop-blur-2xl border-b border-white/5 shadow-2xl"
          : "h-24 bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="max-w-[1600px] w-full mx-auto px-6 md:px-12 grid grid-cols-[auto_1fr_auto] items-center gap-8">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group w-max">
          <div className={`transition-all duration-300 ${scrolled || !transparentOnTop ? "p-1.5" : "p-2"} bg-[oklch(0.70_0.16_195)]/10 border border-[oklch(0.70_0.16_195)]/20 rounded-xl group-hover:scale-105`}>
            <Film className={`${scrolled || !transparentOnTop ? "w-4 h-4" : "w-5 h-5"} text-[oklch(0.70_0.16_195)]`} />
          </div>
          <span className={`font-extrabold tracking-tight hidden sm:block text-white transition-all duration-300 ${scrolled || !transparentOnTop ? "text-lg" : "text-xl"}`}>
            Cine<span className="text-[oklch(0.70_0.16_195)]">Intel</span>
          </span>
        </Link>

        {/* Search Engine - The Identity */}
        <div className="flex justify-center w-full max-w-2xl mx-auto">
          {showSearch ? (
            <SearchSuggestInput
              key={initialSearchQuery}
              initialQuery={initialSearchQuery}
              compact={scrolled || !transparentOnTop}
              shellClassName={`w-full flex items-center gap-3 transition-all duration-300 rounded-full group ${
                scrolled || !transparentOnTop
                  ? "bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2"
                  : "bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/20 px-5 py-3 shadow-[0_0_40px_rgba(0,0,0,0.3)] hover:border-white/40 hover:shadow-[0_0_50px_rgba(255,255,255,0.1)]"
              }`}
              inputClassName={`flex-1 min-w-0 bg-transparent border-none outline-none font-medium placeholder-zinc-500 focus:placeholder-zinc-300 transition-colors ${
                  scrolled || !transparentOnTop ? "text-sm text-zinc-100" : "text-base text-white"
              }`}
            />
          ) : null}
        </div>

        {/* User Operations */}
        <div className="flex items-center gap-4 justify-end">
          <Link
            className="hidden lg:flex items-center gap-2 font-semibold text-[13px] text-zinc-400 hover:text-white transition"
            href="/search"
          >
            <SearchIcon className="w-4 h-4" />
            Advanced Search
          </Link>
          <Link
            className="hidden lg:flex items-center gap-2 font-semibold text-[13px] text-zinc-400 hover:text-white transition"
            href="/watchlist"
          >
            <Bookmark className="w-4 h-4" /> Watchlist
          </Link>
          <Link
            className="hidden lg:flex items-center gap-2 font-semibold text-[13px] text-zinc-400 hover:text-white transition"
            href="/inventory"
          >
            Inventory
          </Link>
          <div className="h-4 w-px bg-white/10 hidden lg:block" />
          
          {user ? (
            <div className="group relative z-50">
              <button className={`flex items-center gap-2 p-1 pl-3 pr-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded-full transition-all duration-300 ${scrolled || !transparentOnTop ? "shadow-none" : "shadow-lg"}`}>
                <span className="text-xs font-semibold hidden md:block text-zinc-200">
                  {user?.email?.split("@")[0] || "User"}
                </span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[oklch(0.70_0.16_195)] to-blue-500 flex items-center justify-center shadow-inner">
                  <User className="w-3.5 h-3.5 text-black" />
                </div>
              </button>
              {/* Dropdown Profile Menu */}
              <div className="absolute right-0 top-full mt-3 w-56 bg-[#11131a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 overflow-hidden text-sm font-medium p-2">
                <div className="px-3 py-2">
                  <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
                <div className="h-px w-full bg-white/5 my-1" />
                <Link href="/watchlist" className="flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition">
                  <Bookmark className="w-4 h-4" /> Watchlist
                </Link>
                <Link href="/inventory" className="flex items-center gap-3 px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition">
                  <Archive className="w-4 h-4" /> Inventory
                </Link>
                <div className="h-px w-full bg-white/5 my-1" />
                <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className={`font-bold transition-all px-4 py-2 rounded-xl text-sm ${
                scrolled || !transparentOnTop
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-[oklch(0.70_0.16_195)] text-black hover:bg-[oklch(0.70_0.16_195)]/90"
              }`}
            >
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
