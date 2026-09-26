import React, { useState } from 'react';
import { 
  Shuffle, 
  Play, 
  Users, 
  ShieldCheck, 
  Zap, 
  X
} from 'lucide-react';
import { MCQAssessment } from '../types';

interface LiveMCQModalProps {
  assessment: MCQAssessment;
  onClose: () => void;
  onConfirmStart: (config: {
    shuffleQuestions: boolean;
    startMode: 'immediate' | 'wait_for_students';
    proctoringEnabled: boolean;
  }) => void;
}

export const LiveMCQModal: React.FC<LiveMCQModalProps> = ({
  assessment,
  onClose,
  onConfirmStart,
}) => {
  // 1. Shuffle question order: Yes / No
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);

  // 2. Start mode: 'immediate' | 'wait_for_students'
  const [startMode, setStartMode] = useState<'immediate' | 'wait_for_students'>('wait_for_students');

  // 3. Proctoring features
  const [proctoringEnabled, setProctoringEnabled] = useState<boolean>(true);

  const handleStart = () => {
    onConfirmStart({
      shuffleQuestions,
      startMode,
      proctoringEnabled
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="effect-8d-card w-full max-w-md rounded-3xl p-5 sm:p-6 bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-slate-950/98 border-2 border-fuchsia-500/50 shadow-[0_0_50px_rgba(236,72,153,0.4)] relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-purple-950 hover:bg-rose-950 border border-purple-500/40 text-purple-300 hover:text-rose-300"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-400 p-[2px]">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-black bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent uppercase">
              START LIVE STREAMING
            </h2>
            <p className="text-[11px] font-black text-teal-300">
              {assessment.title} (PIN: {assessment.pin})
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
          {/* QUESTION 1: Shuffle question order or not */}
          <div className="p-3 rounded-xl bg-indigo-950/80 border border-cyan-500/40 space-y-1.5">
            <div className="flex items-center space-x-1.5">
              <Shuffle className="w-4 h-4 text-cyan-400" />
              <label className="text-[11px] font-black uppercase text-cyan-300">
                1. Shuffle Question Order?
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShuffleQuestions(true)}
                className={`btn-8d py-2 px-2 rounded-lg font-black text-xs uppercase border-2 flex items-center justify-center ${
                  shuffleQuestions
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-yellow-200 border-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                    : 'bg-indigo-900/60 text-cyan-300 border-indigo-700'
                }`}
              >
                <span>YES</span>
              </button>

              <button
                type="button"
                onClick={() => setShuffleQuestions(false)}
                className={`btn-8d py-2 px-2 rounded-lg font-black text-xs uppercase border-2 flex items-center justify-center ${
                  !shuffleQuestions
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 border-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                    : 'bg-indigo-900/60 text-pink-300 border-indigo-700'
                }`}
              >
                <span>NO</span>
              </button>
            </div>
          </div>

          {/* QUESTION 2: Start immediately or wait for at least one student */}
          <div className="p-3 rounded-xl bg-indigo-950/80 border border-pink-500/40 space-y-1.5">
            <div className="flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-pink-400" />
              <label className="text-[11px] font-black uppercase text-pink-300">
                2. Launch Mode
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStartMode('wait_for_students')}
                className={`btn-8d py-2 px-2 rounded-lg font-black text-xs uppercase border-2 text-center ${
                  startMode === 'wait_for_students'
                    ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-yellow-200 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'bg-indigo-900/60 text-amber-300 border-indigo-700'
                }`}
              >
                <span>WAIT FOR STUDENTS</span>
              </button>

              <button
                type="button"
                onClick={() => setStartMode('immediate')}
                className={`btn-8d py-2 px-2 rounded-lg font-black text-xs uppercase border-2 text-center ${
                  startMode === 'immediate'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-yellow-200 border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-indigo-900/60 text-emerald-300 border-indigo-700'
                }`}
              >
                <span>IMMEDIATE</span>
              </button>
            </div>
          </div>

          {/* QUESTION 3: Proctoring features */}
          <div className="p-3 rounded-xl bg-indigo-950/80 border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase text-amber-300">
                Anti-Cheating Proctoring
              </span>
            </div>

            <input
              type="checkbox"
              checked={proctoringEnabled}
              onChange={(e) => setProctoringEnabled(e.target.checked)}
              className="w-4 h-4 accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Confirm Launch Button */}
          <button
            onClick={handleStart}
            className="btn-8d w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 text-yellow-200 font-black text-xs uppercase tracking-widest border border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.5)] flex items-center justify-center space-x-1.5"
          >
            <Play className="w-4 h-4 fill-current text-yellow-300" />
            <span>LAUNCH LIVE SESSION</span>
          </button>
        </div>

      </div>
    </div>
  );
};
