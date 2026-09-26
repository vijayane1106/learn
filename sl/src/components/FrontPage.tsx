import React, { useState } from 'react';
import { 
  Zap, 
  GraduationCap, 
  Users, 
  ShieldCheck, 
  Sparkles, 
  FileSpreadsheet, 
  ArrowRight,
  KeyRound,
  Play
} from 'lucide-react';

interface FrontPageProps {
  onSelectTeacher: () => void;
  onSelectStudent: () => void;
}

export const FrontPage: React.FC<FrontPageProps> = ({
  onSelectTeacher,
  onSelectStudent
}) => {
  return (
    <div className="w-full flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      
      {/* 8D Hero Section */}
      <div className="effect-8d-card rounded-3xl p-6 sm:p-12 bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-slate-950/95 border-2 border-fuchsia-500/50 shadow-[0_0_60px_rgba(236,72,153,0.35)] text-center relative overflow-hidden">
        
        {/* Luminous Glow Elements */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-pink-600/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-cyan-600/25 blur-3xl pointer-events-none" />

        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-fuchsia-950/80 border border-fuchsia-400 text-fuchsia-300 text-[11px] font-black uppercase tracking-widest mb-3 shadow-[0_0_15px_rgba(217,70,239,0.5)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
          <span>8D INTERACTIVE ASSESSMENT ARENA</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight">
          <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_4px_25px_rgba(244,63,94,0.6)]">
            SMART LEARN
          </span>
        </h1>

        {/* Portals Access Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSelectStudent}
            className="btn-8d w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-600 text-yellow-200 font-black text-sm uppercase tracking-wider border-2 border-cyan-300 shadow-[0_0_30px_rgba(45,212,191,0.6)] flex items-center justify-center space-x-3"
          >
            <GraduationCap className="w-6 h-6 text-amber-300" />
            <span>STUDENT ARENA</span>
            <ArrowRight className="w-5 h-5 text-yellow-300" />
          </button>

          <button
            onClick={onSelectTeacher}
            className="btn-8d w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-amber-200 font-black text-sm uppercase tracking-wider border-2 border-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.6)] flex items-center justify-center space-x-3"
          >
            <Users className="w-6 h-6 text-yellow-300" />
            <span>TEACHER PORTAL</span>
            <ArrowRight className="w-5 h-5 text-yellow-300" />
          </button>
        </div>

      </div>

      {/* 8D Feature Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-cyan-500/40 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-400 flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 text-cyan-300 fill-current" />
          </div>
          <div>
            <h3 className="text-xs font-black text-yellow-300 uppercase">
              Real-Time Live Streaming
            </h3>
            <span className="text-[11px] font-bold text-teal-300">
              PIN broadcast & instant responses
            </span>
          </div>
        </div>

        <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-fuchsia-500/40 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-950 border border-fuchsia-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-pink-300" />
          </div>
          <div>
            <h3 className="text-xs font-black text-pink-300 uppercase">
              Live Proctoring & Control
            </h3>
            <span className="text-[11px] font-bold text-teal-300">
              Anti-cheating & remote alerts
            </span>
          </div>
        </div>

        <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-emerald-500/40 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-xs font-black text-emerald-300 uppercase">
              Excel Import & Export
            </h3>
            <span className="text-[11px] font-bold text-teal-300">
              Auto-validation & CSV reports
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
