"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { MoveLeft, RefreshCw, HardDriveDownload, Trash2, Search, Zap, Code, ShieldCheck, Database, Terminal as TerminalIcon } from "lucide-react";

export default function AdminStatsPage() {
  const [stats, setStats] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Handle Hydration: Only render clock on client
  useEffect(() => {
    setIsMounted(true);
    const updateTime = () => {
      setCurrentTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const syncDatabase = async () => {
    if (!confirm("TRIGGER DATA CONSOLIDATION: Align Primary & Backup databases?")) return;
    setLoading(true);
    try {
      const res = await fetch("/admin/sync");
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      const text = await res.text();
      setStats(text);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [stats, loading]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/stats");
      if (!res.ok) throw new Error(`Status ${res.status}: ${res.statusText}`);
      const text = await res.text();
      setStats(text);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserReport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!spotifyId.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/admin/report/${spotifyId.trim()}`);
      if (!res.ok) throw new Error(`User not found or Server error (${res.status})`);
      const text = await res.text();
      setStats(text);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    if (!confirm("CONFIRMATION REQUIRED: Are you sure you want to FLUSH all Redis cache?")) return;

    setLoading(true);
    try {
      const res = await fetch("/admin/clear");
      if (!res.ok) throw new Error(`Failed to clear cache: ${res.status}`);
      const text = await res.text();
      setStats(text);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse and style the receipt text
  const formatReceipt = (text: string) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      // Highlight borders
      if (line.includes("*" ) || line.includes("=" )) {
        return <div key={i} className="text-zinc-600 select-none leading-none tracking-tighter opacity-80">{line}</div>;
      }
      // Highlight Titles
      if (line.includes("---" )) {
        return <div key={i} className="text-emerald-500 font-bold mt-6 mb-2">{line}</div>;
      }
      // Highlight Section Headers
      if (line.includes("Audit" ) || line.includes("REPORT" ) || line.includes("FLUSH" )) {
        return <div key={i} className="text-white font-black tracking-[0.4em] py-4 text-center border-y border-zinc-900 my-4 uppercase">{line.trim()}</div>;
      }
      // Highlight Success Status
      if (line.toLowerCase().includes("success" )) {
        return <div key={i} className="text-emerald-400 font-bold bg-emerald-500/20 px-3 py-1 rounded-sm inline-block my-2 border border-emerald-500/30">{line}</div>;
      }
      // Highlight Metric Keys
      if (line.includes("." )) {
        const parts = line.split(/\.+/);
        if (parts.length === 2) {
            return (
                <div key={i} className="flex justify-between border-b border-zinc-900/40 py-1.5 hover:bg-white/5 transition-colors group">
                    <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase tracking-tight">{parts[0].trim()}</span>
                    <span className="text-emerald-400 font-bold tabular-nums text-right">{parts[1].trim()}</span>
                </div>
            )
        }
      }
      
      return <div key={i} className="text-zinc-300 py-1">{line}</div>;
    });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-[#020202] text-white p-4 md:p-10 font-mono selection:bg-emerald-500 selection:text-black">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* TOP STATUS BAR */}
        <div className="flex items-center justify-between text-[10px] text-zinc-600 px-2 tracking-widest uppercase">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> SECURE_HOST: LIVE</span>
            <span className="hidden sm:inline">OS: PERSONALIFY_V4_SH</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">LATENCY: 12ms</span>
            <span className="tabular-nums">{currentTime || "SYNCING..."}</span>
          </div>
        </div>

        {/* HEADER AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end border-t border-zinc-900 pt-6">
          <div className="lg:col-span-5 space-y-2">
            <Link
              href="/"
              className="group flex items-center gap-2 text-zinc-500 hover:text-emerald-500 transition-colors duration-300 no-underline text-[10px] tracking-widest"
            >
              <MoveLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform duration-300" />
              <span>EXIT_GATEWAY</span>
            </Link>
            <h1 className="text-2xl font-black tracking-tighter text-white">CONTROL_CENTER</h1>
            <p className="text-[10px] text-zinc-600 tracking-widest">PERSONALIFY MASTER ADMINISTRATIVE INTERFACE</p>
          </div>

          <div className="lg:col-span-7 flex flex-wrap lg:justify-end gap-2">
             {/* Quick Actions Grid */}
             <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <form onSubmit={fetchUserReport} className="flex-1 lg:flex-none relative group">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                    type="text" 
                    placeholder="SPOTIFY_USER_ID" 
                    value={spotifyId}
                    onChange={(e) => setSpotifyId(e.target.value)}
                    className="bg-zinc-950 border border-zinc-900 rounded-lg pl-10 pr-4 py-3 text-[10px] w-full lg:w-48 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-800"
                    />
                </form>

                <button
                    onClick={syncDatabase}
                    disabled={loading}
                    className="p-3 rounded-lg border border-zinc-900 hover:border-emerald-500/50 transition-colors disabled:opacity-50 flex items-center gap-2 bg-[#080808] group"
                    title="BIDIRECTIONAL_DB_SYNC"
                >
                    <Database className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[9px] font-bold tracking-widest text-zinc-500 group-hover:text-white uppercase transition-colors">Sync</span>
                </button>

                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="p-3 rounded-lg border border-zinc-900 hover:border-zinc-700 transition-colors disabled:opacity-50 flex items-center gap-2 bg-[#080808] group"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-500 ${loading ? "animate-spin" : ""}`} />
                    <span className="text-[9px] font-bold tracking-widest text-zinc-500 group-hover:text-white uppercase transition-colors">Audit</span>
                </button>

                <button
                    onClick={clearCache}
                    disabled={loading}
                    className="p-3 rounded-lg border border-red-900/20 hover:border-red-500 transition-colors disabled:opacity-50 flex items-center gap-2 bg-[#080808] group"
                >
                    <Trash2 className="w-3.5 h-3.5 text-red-900/50 group-hover:text-red-500 transition-colors" />
                    <span className="text-[9px] font-bold tracking-widest text-red-900/50 group-hover:text-white uppercase transition-colors">Flush</span>
                </button>

                <Link
                    href="/admin/export"
                    className="p-3 rounded-lg border border-emerald-900/20 hover:border-emerald-500 transition-colors flex items-center gap-2 bg-[#080808] group"
                >
                    <HardDriveDownload className="w-3.5 h-3.5 text-emerald-900/50 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[9px] font-bold tracking-widest text-emerald-900/50 group-hover:text-white uppercase transition-colors">Export</span>
                </Link>
             </div>
          </div>
        </div>

        {/* MAIN CONSOLE DISPLAY */}
        <div className="relative group overflow-hidden rounded-2xl border border-zinc-900 bg-[#050505] shadow-[0_0_100px_-20px_rgba(16,185,129,0.05)]">
            
            {/* Top Frame Decor */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/50">
                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 animate-pulse" />
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 animate-pulse delay-75" />
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 animate-pulse delay-150" />
                    </div>
                    <div className="h-4 w-px bg-zinc-900 mx-2" />
                    <span className="text-[9px] font-bold text-zinc-600 tracking-[0.4em] pt-0.5">CONSOLE_OUTPUT_V04</span>
                </div>
                <div className="flex items-center gap-4 text-[9px] text-zinc-700 font-bold italic tracking-tighter">
                   PERSONALIFY // SYSTEM_CORE
                </div>
            </div>

            {/* Content Display */}
            <div className="min-h-[650px] p-6 md:p-12 overflow-auto bg-[url('/grid.svg')] bg-center relative scrollbar-hide">
                
                {loading ? (
                    <div className="h-[500px] flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                            <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin opacity-10" />
                            <RefreshCw className="w-12 h-12 text-emerald-500 animate-pulse absolute inset-0" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] tracking-[0.5em] text-emerald-500/50 animate-pulse">EXECUTING_STDOUT</span>
                            <div className="w-40 h-0.5 bg-zinc-900 overflow-hidden">
                                <div className="h-full bg-emerald-500 w-1/2 animate-[progress_1.5s_infinite_linear]" />
                            </div>
                        </div>
                    </div>
                ) : error ? (
                    <div className="h-[500px] flex flex-col items-center justify-center gap-6">
                        <Zap className="w-12 h-12 text-red-900/20" />
                        <div className="text-center space-y-4">
                            <div className="inline-block px-4 py-2 border border-red-900/50 bg-red-950/10 rounded">
                                <p className="text-[10px] font-bold text-red-900 uppercase tracking-tighter">FATAL_INTERFACE_CRASH</p>
                                <p className="text-[11px] text-red-500 mt-1 uppercase underline underline-offset-4">{error}</p>
                            </div>
                            <button 
                                onClick={fetchStats}
                                className="block w-full text-[9px] tracking-widest text-zinc-500 hover:text-white transition-colors uppercase py-2"
                            >
                                [ FORCE_REBOOT ]
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto font-mono">
                        <div className="receipt-content text-[11px] md:text-sm">
                          {formatReceipt(stats || "")}
                        </div>
                        <div ref={consoleEndRef} className="h-20" />
                    </div>
                )}
            </div>

            {/* Bottom Status Bar */}
            <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-950/50 flex flex-wrap justify-between items-center gap-4 text-[9px] tracking-[0.2em] font-bold">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <span className="text-zinc-600 uppercase">CMD_STATUS:</span>
                        <span className={loading ? "text-amber-600" : "text-emerald-600"}>{loading ? "PROCESSING" : "READY_IDLE"}</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <span className="text-zinc-600 uppercase">SERVER:</span>
                        <span className="text-zinc-400">VERCEL.STATION_NORTH</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-2 text-zinc-700">
                        <Code className="w-3 h-3" />
                        <span>NEXT15_HYBRID_CORE</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${loading ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`} />
                        <span className="text-zinc-400">ENCRYPTION_ACTIVE</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Console Footnotes */}
        <div className="flex justify-between items-center px-2 py-4 opacity-20 hover:opacity-100 transition-opacity duration-1000">
            <div className="flex gap-4 items-center">
                <TerminalIcon className="w-3 h-3 text-zinc-500" />
                <span className="text-[8px] tracking-[0.5em] text-zinc-500 uppercase">Restricted Gateway // Personalify Internal Audit</span>
            </div>
            <span className="text-[8px] tracking-[0.5em] text-zinc-500 uppercase">BUILD_HASH: FB88_2026</span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes progress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .receipt-content {
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.1);
        }
      `}</style>
    </div>
  );
}
