import React from 'react';
import { Sparkles, GraduationCap, Users, LogOut, ShieldCheck, Zap } from 'lucide-react';
import { UserAccount } from '../types';

interface NavbarProps {
  activePortal: 'front' | 'teacher' | 'student';
  setActivePortal: (portal: 'front' | 'teacher' | 'student') => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePortal,
  setActivePortal,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-indigo-950/85 border-b-2 border-fuchsia-500/40 shadow-[0_8px_30px_rgb(236,72,153,0.25)] shrink-0">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div 
          onClick={() => setActivePortal('front')}
          className="flex items-center space-x-2.5 cursor-pointer group select-none"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 p-[2px] shadow-[0_0_15px_rgba(251,191,36,0.6)] group-hover:scale-105 transition-transform duration-200">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-xl sm:text-2xl tracking-wider bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(244,63,94,0.7)]">
              SMART LEARN
            </span>
            <span className="px-2 py-0.5 text-[10px] font-black tracking-widest rounded-full bg-fuchsia-950 border border-fuchsia-400 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.5)]">
              8D
            </span>
          </div>
        </div>

        {/* Portals Switcher */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => setActivePortal('student')}
            className={`btn-8d flex items-center space-x-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all border-2 ${
              activePortal === 'student'
                ? 'bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-600 text-yellow-200 border-cyan-300 shadow-[0_0_15px_rgba(45,212,191,0.6)]'
                : 'bg-indigo-900/60 hover:bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
            }`}
          >
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            <span>STUDENT</span>
          </button>

          <button
            onClick={() => setActivePortal('teacher')}
            className={`btn-8d flex items-center space-x-1.5 px-3 py-2 sm:px-4 sm:py-2 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all border-2 ${
              activePortal === 'teacher'
                ? 'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 text-amber-200 border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.6)]'
                : 'bg-indigo-900/60 hover:bg-purple-950/80 text-pink-300 border-pink-500/40'
            }`}
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />
            <span>TEACHER</span>
          </button>

          {currentUser ? (
            <div className="flex items-center space-x-2 pl-2 border-l-2 border-fuchsia-500/30">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-black tracking-wide text-amber-300 flex items-center space-x-1">
                  {currentUser.role === 'superuser' && (
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-400 inline" />
                  )}
                  <span>{currentUser.name}</span>
                </span>
                <span className="text-[10px] font-black uppercase text-cyan-300">
                  {currentUser.role === 'superuser' ? 'Super User' : 'Teacher'}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Log Out"
                className="p-2 rounded-xl bg-rose-950 border border-rose-500 text-rose-300 hover:text-amber-200 transition-all btn-8d"
              >
                <LogOut className="w-4 h-4 text-rose-300" />
              </button>
            </div>
          ) : null}
        </div>

      </div>
    </header>
  );
};
