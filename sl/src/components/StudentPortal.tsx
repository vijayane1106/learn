import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  KeyRound,
  User,
  GraduationCap,
  Mail,
  Clock,
  CheckCircle2,
  Maximize,
  AlertTriangle,
  Download,
  ArrowRight,
  ArrowLeft,
  Trophy,
  ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MCQAssessment, QuizQuestion, StudentQuizResult } from '../types';
import { exportToCSV } from '../utils/excelUtils';

interface StudentPortalProps {
  onBackToHome: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ onBackToHome }) => {
  // Navigation steps: 'pin' -> 'details' -> 'countdown' -> 'quiz' -> 'summary'
  const [step, setStep] = useState<'pin' | 'details' | 'countdown' | 'quiz' | 'summary'>('pin');

  // Step 1: PIN
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<MCQAssessment | null>(null);

  // Step 2: Student Details
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Step 3: Countdown (3, 2, 1)
  const [countdown, setCountdown] = useState(3);

  // Step 4: Live Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [timerActive, setTimerActive] = useState(false);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // Recorded answers map
  const [answersMap, setAnswersMap] = useState<Record<string, {
    selectedOptionId: string | null;
    isCorrect: boolean;
    pointsEarned: number;
    missed: boolean;
  }>>({});

  // Proctoring & Teacher Control
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);
  const [isPausedByTeacher, setIsPausedByTeacher] = useState(false);
  const [teacherEndAlert, setTeacherEndAlert] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);

  // Summary State
  const [quizResult, setQuizResult] = useState<StudentQuizResult | null>(null);

  // 1. PIN verification
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!pinInput.trim()) {
      setPinError('Enter 6-digit live PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/live/check/${pinInput.trim()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid PIN');
      }

      setAssessment(data.assessment);
      setStep('details');
    } catch (err: any) {
      setPinError(err.message || 'Invalid PIN. Check with teacher.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit student details
  const handleStartCountdown = (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError(null);
    if (!studentName.trim()) {
      setDetailsError('Student Name is required.');
      return;
    }

    initWebSocket();
    requestFullscreenMode();
    setStep('countdown');
    setCountdown(3);
  };

  // Countdown timer effect
  useEffect(() => {
    if (step === 'countdown') {
      if (countdown > 1) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else if (countdown === 1) {
        const timer = setTimeout(() => {
          setStep('quiz');
          startQuestion(0);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [step, countdown]);

  // Request fullscreen
  const requestFullscreenMode = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  };

  // WebSocket Connection
  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'student_join',
        pin: pinInput.trim(),
        student: {
          id: 'stud_' + Date.now(),
          name: studentName.trim(),
          schoolName: schoolName.trim(),
          email: studentEmail.trim()
        }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'joined_success') {
          if (data.assessment) {
            setAssessment(data.assessment);
          }
        } else if (data.type === 'quiz_paused_by_teacher') {
          setIsPausedByTeacher(true);
        } else if (data.type === 'quiz_resumed_by_teacher') {
          setIsPausedByTeacher(false);
        } else if (data.type === 'quiz_force_ended') {
          setTeacherEndAlert('meet your teacher');
          setTimerActive(false);
        }
      } catch (err) {
        console.error('Socket error parsing:', err);
      }
    };

    wsRef.current = socket;
  };

  // Proctoring listeners
  useEffect(() => {
    if (step !== 'quiz') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctorWarning('Tab Switch Detected!');
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'proctor_alert',
            reason: 'Tab Switch'
          }));
        }
        setTimeout(() => setProctorWarning(null), 4000);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && step === 'quiz') {
        setProctorWarning('Fullscreen exited!');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [step]);

  // Start question timer
  const startQuestion = (qIdx: number) => {
    if (!assessment || !assessment.questions[qIdx]) return;
    const q = assessment.questions[qIdx];
    setCurrentQuestionIndex(qIdx);
    setSelectedOptionId(answersMap[q.id]?.selectedOptionId as any || null);
    setTimeRemaining(q.timeSeconds || 30);
    setTimerActive(true);
    setIsAutoAdvancing(false);
  };

  // Per-question countdown ticker
  useEffect(() => {
    if (step !== 'quiz' || !timerActive || isPausedByTeacher || teacherEndAlert) return;

    if (timeRemaining > 0) {
      const ticker = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(ticker);
    } else if (timeRemaining === 0) {
      handleTimeExpired();
    }
  }, [step, timerActive, timeRemaining, isPausedByTeacher, teacherEndAlert]);

  // Handle question time expiry
  const handleTimeExpired = () => {
    if (!assessment) return;
    const currentQ = assessment.questions[currentQuestionIndex];
    if (!currentQ) return;

    if (!answersMap[currentQ.id]) {
      setAnswersMap(prev => ({
        ...prev,
        [currentQ.id]: {
          selectedOptionId: null,
          isCorrect: false,
          pointsEarned: 0,
          missed: true
        }
      }));

      // Report missed to teacher socket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'submit_answer',
          questionIndex: currentQuestionIndex,
          selectedOptionId: null,
          isCorrect: false,
          pointsEarned: 0
        }));
      }
    }

    moveToNextQuestion();
  };

  // Handle Option Click: move within 2 seconds
  const handleSelectOption = (optId: 'A' | 'B' | 'C' | 'D') => {
    if (!assessment || isAutoAdvancing || isPausedByTeacher || teacherEndAlert) return;
    const currentQ = assessment.questions[currentQuestionIndex];
    if (!currentQ) return;

    setSelectedOptionId(optId);
    const isCorrect = optId === currentQ.correctOptionId;
    const pointsEarned = isCorrect ? (currentQ.points || 5) : 0;

    // Record answer
    setAnswersMap(prev => ({
      ...prev,
      [currentQ.id]: {
        selectedOptionId: optId,
        isCorrect,
        pointsEarned,
        missed: false
      }
    }));

    // Instantly sync response across multi-places to teacher socket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'submit_answer',
        questionIndex: currentQuestionIndex,
        selectedOptionId: optId,
        isCorrect,
        pointsEarned
      }));
    }

    // Auto advance in 2 seconds
    setIsAutoAdvancing(true);
    setTimeout(() => {
      moveToNextQuestion();
    }, 2000);
  };

  // Move to next question or complete quiz
  const moveToNextQuestion = () => {
    if (!assessment) return;
    if (currentQuestionIndex < assessment.questions.length - 1) {
      startQuestion(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  // Finish quiz and generate summary
  const finishQuiz = async () => {
    if (!assessment) return;
    setTimerActive(false);

    let score = 0;
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let missedCount = 0;

    const detailedAnswers = assessment.questions.map(q => {
      const record = answersMap[q.id];
      totalScore += (q.points || 5);
      if (!record || record.missed || !record.selectedOptionId) {
        missedCount++;
        return {
          questionId: q.id,
          questionText: q.questionText,
          selectedOptionId: null,
          correctOptionId: q.correctOptionId,
          isCorrect: false,
          pointsEarned: 0
        };
      } else if (record.isCorrect) {
        correctCount++;
        score += record.pointsEarned;
        return {
          questionId: q.id,
          questionText: q.questionText,
          selectedOptionId: record.selectedOptionId,
          correctOptionId: q.correctOptionId,
          isCorrect: true,
          pointsEarned: record.pointsEarned
        };
      } else {
        wrongCount++;
        return {
          questionId: q.id,
          questionText: q.questionText,
          selectedOptionId: record.selectedOptionId,
          correctOptionId: q.correctOptionId,
          isCorrect: false,
          pointsEarned: 0
        };
      }
    });

    const result: StudentQuizResult = {
      id: 'rep_' + Date.now(),
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      pin: assessment.pin,
      studentId: 'stud_' + Date.now(),
      studentName: studentName.trim(),
      schoolName: schoolName.trim(),
      studentEmail: studentEmail.trim(),
      score,
      totalScore,
      correctCount,
      wrongCount,
      missedCount,
      totalQuestions: assessment.questions.length,
      completedAt: new Date().toISOString(),
      answers: detailedAnswers
    };

    setQuizResult(result);
    setStep('summary');

    try {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } catch (_) {}

    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
    } catch (err) {
      console.error('Failed to save student report:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!quizResult) return;
    const rows = quizResult.answers.map((a, i) => ({
      'Question Number': i + 1,
      'Question Text': a.questionText,
      'Student Answer': a.selectedOptionId || 'Missed',
      'Correct Answer': a.correctOptionId,
      'Status': a.isCorrect ? 'Correct' : a.selectedOptionId ? 'Wrong' : 'Missed',
      'Points Earned': a.pointsEarned
    }));
    exportToCSV(`Result_${studentName.replace(/\s+/g, '_')}`, rows);
  };

  return (
    <div className={`w-full flex-1 flex flex-col justify-center py-4 px-3 sm:px-6 ${
      step === 'quiz' ? 'fixed inset-0 z-50 bg-slate-950 overflow-y-auto' : ''
    }`}>
      
      {/* ===================== STEP 1: PIN ENTRY ===================== */}
      {step === 'pin' && (
        <div className="w-full max-w-sm mx-auto my-auto">
          <div className="effect-8d-card rounded-3xl p-6 bg-indigo-950/95 border-2 border-cyan-500/60 text-center space-y-4">
            
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-amber-300 p-[2px] mx-auto shadow-[0_0_20px_rgba(45,212,191,0.6)]">
              <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                <KeyRound className="w-7 h-7 text-cyan-300 animate-pulse" />
              </div>
            </div>

            <h1 className="text-xl font-black bg-gradient-to-r from-amber-300 via-cyan-300 to-pink-400 bg-clip-text text-transparent">
              JOIN LIVE MCQ
            </h1>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-300 text-xs font-black">
                {pinError}
              </div>
            )}

            <form onSubmit={handleVerifyPin} className="space-y-3">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="ENTER PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-8d w-full text-center tracking-[0.4em] text-3xl font-black py-3 rounded-2xl text-yellow-300 border-2 border-cyan-400 font-mono shadow-[0_0_20px_rgba(56,189,248,0.3)]"
              />

              <button
                type="submit"
                disabled={loading || pinInput.length < 4}
                className="btn-8d w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-600 text-yellow-200 font-black text-xs uppercase tracking-widest border-2 border-cyan-300 shadow-[0_0_25px_rgba(45,212,191,0.5)] flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'CONNECTING...' : 'ENTER'}</span>
                <ArrowRight className="w-4 h-4 text-yellow-300" />
              </button>
            </form>

            <button
              onClick={onBackToHome}
              className="text-xs font-extrabold text-teal-300 hover:text-yellow-300 underline"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* ===================== STEP 2: STUDENT DETAILS ===================== */}
      {step === 'details' && assessment && (
        <div className="w-full max-w-md mx-auto my-auto">
          <div className="effect-8d-card rounded-3xl p-6 bg-indigo-950/95 border-2 border-pink-500/60 space-y-4">
            
            <div className="text-center">
              <span className="px-2.5 py-0.5 rounded-lg bg-pink-950 text-pink-300 text-xs font-black uppercase border border-pink-400 inline-block mb-1">
                PIN: {assessment.pin}
              </span>
              <h2 className="text-lg font-black text-yellow-300 line-clamp-1">
                {assessment.title}
              </h2>
            </div>

            {detailsError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-300 text-xs font-black text-center">
                {detailsError}
              </div>
            )}

            <form onSubmit={handleStartCountdown} className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold uppercase text-cyan-300 mb-1">
                  Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-amber-400" />
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="input-8d w-full pl-10 pr-3 py-2.5 rounded-xl text-yellow-200 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-pink-300 mb-1">
                  School / College
                </label>
                <div className="relative">
                  <GraduationCap className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-pink-400" />
                  <input
                    type="text"
                    placeholder="Enter institution"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="input-8d w-full pl-10 pr-3 py-2.5 rounded-xl text-pink-200 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-emerald-300 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-emerald-400" />
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="input-8d w-full pl-10 pr-3 py-2.5 rounded-xl text-emerald-200 font-bold text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-8d w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-yellow-200 font-black text-xs uppercase tracking-widest border-2 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.5)] flex items-center justify-center space-x-2"
              >
                <span>PROCEED TO ARENA</span>
                <ArrowRight className="w-4 h-4 text-yellow-300" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================== STEP 3: 3, 2, 1 COUNTDOWN ===================== */}
      {step === 'countdown' && (
        <div className="flex flex-col items-center justify-center space-y-4 text-center my-auto animate-in zoom-in-50">
          <div className="relative flex items-center justify-center">
            <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 animate-spin blur-lg opacity-75" />
            <div className="absolute w-32 h-32 rounded-full bg-slate-950 border-4 border-yellow-300 flex items-center justify-center shadow-[0_0_40px_rgba(253,224,71,0.8)]">
              <span className="text-7xl font-black text-amber-300 font-mono animate-bounce">
                {countdown}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================== STEP 4: LIVE 50/50 QUIZ INTERFACE ===================== */}
      {step === 'quiz' && assessment && (
        <div className="w-full h-full flex flex-col justify-between max-w-7xl mx-auto px-2 sm:px-4 py-2">
          
          {/* Header Bar */}
          <div className="w-full bg-indigo-950/90 border-b-2 border-fuchsia-500/40 rounded-xl p-2.5 mb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black text-yellow-300 bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-400">
                Q {currentQuestionIndex + 1} / {assessment.questions.length}
              </span>
              <h2 className="hidden sm:block text-xs font-black text-cyan-300 truncate max-w-xs">
                {assessment.title}
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400 animate-spin" />
              <span className={`text-lg font-black font-mono tracking-widest ${
                timeRemaining <= 5 ? 'text-rose-400 animate-ping' : 'text-yellow-300'
              }`}>
                {timeRemaining}s
              </span>
            </div>

            <button
              onClick={requestFullscreenMode}
              className="p-1.5 rounded-lg bg-purple-950 text-cyan-300 border border-purple-400 btn-8d text-xs font-bold"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* Proctor Warnings */}
          {proctorWarning && (
            <div className="mb-2 p-2 rounded-lg bg-rose-950 border border-rose-500 text-rose-300 text-xs font-black text-center animate-bounce">
              {proctorWarning}
            </div>
          )}

          {/* Teacher Paused Alert */}
          {isPausedByTeacher && (
            <div className="mb-2 p-3 rounded-xl bg-amber-950 border-2 border-amber-400 text-amber-200 text-center font-black text-xs animate-pulse">
              Quiz paused by teacher.
            </div>
          )}

          {/* Teacher Ended Alert: "meet your teacher" */}
          {teacherEndAlert && (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="p-6 rounded-3xl bg-rose-950 border-2 border-rose-500 text-center space-y-3 max-w-sm shadow-[0_0_50px_rgba(244,63,94,0.8)]">
                <AlertTriangle className="w-12 h-12 text-yellow-300 mx-auto animate-bounce" />
                <h3 className="text-2xl font-black text-rose-300 uppercase tracking-widest">
                  {teacherEndAlert}
                </h3>
                <button
                  onClick={finishQuiz}
                  className="btn-8d px-4 py-2 rounded-xl bg-rose-700 text-yellow-200 font-black text-xs uppercase"
                >
                  View Score
                </button>
              </div>
            </div>
          )}

          {/* 50/50 Responsive Arena */}
          {assessment.questions[currentQuestionIndex] && (
            <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-[440px]">
              
              {/* Top/Left Half (50%): Question Text & Image */}
              <div className="w-full lg:w-1/2 flex flex-col justify-between p-5 rounded-3xl bg-indigo-950/90 border-2 border-cyan-500/50">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase text-pink-300">
                      QUESTION {currentQuestionIndex + 1}
                    </span>
                    <span className="text-xs font-black text-amber-300 bg-amber-950 px-2 py-0.5 rounded-lg border border-amber-500/40">
                      +{assessment.questions[currentQuestionIndex].points} Pts
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg md:text-xl font-black text-yellow-200 leading-snug mb-3">
                    {assessment.questions[currentQuestionIndex].questionText}
                  </h3>
                </div>

                {assessment.questions[currentQuestionIndex].questionImage && (
                  <div className="my-auto max-h-48 rounded-xl overflow-hidden border border-cyan-400">
                    <img
                      src={assessment.questions[currentQuestionIndex].questionImage}
                      alt=""
                      className="w-full h-full object-contain bg-slate-950"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-cyan-500/20">
                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-cyan-500/40">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / assessment.questions.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom/Right Half (50%): 4 Options Equally Partitioned */}
              <div className="w-full lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assessment.questions[currentQuestionIndex].options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      disabled={isAutoAdvancing || isPausedByTeacher || !!teacherEndAlert}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`btn-8d flex flex-col justify-between p-3.5 rounded-2xl border-2 text-left transition-all ${
                        isSelected
                          ? 'bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 border-yellow-300 shadow-[0_0_25px_rgba(253,224,71,0.6)] scale-[1.02]'
                          : 'bg-indigo-950/80 hover:bg-purple-950/90 border-purple-500/40 hover:border-cyan-400'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 mb-1.5">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border ${
                          isSelected
                            ? 'bg-yellow-300 text-slate-950 border-yellow-100'
                            : 'bg-indigo-900 text-cyan-300 border-cyan-400/50'
                        }`}>
                          {opt.id}
                        </span>
                        <span className={`text-sm font-black leading-snug ${
                          isSelected ? 'text-yellow-100' : 'text-cyan-200'
                        }`}>
                          {opt.text}
                        </span>
                      </div>

                      {opt.image && (
                        <div className="mt-1 w-full h-20 rounded-lg overflow-hidden border border-amber-400/40">
                          <img src={opt.image} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {isSelected && (
                        <div className="mt-1 text-[10px] font-black text-yellow-200 uppercase flex items-center space-x-1 animate-pulse">
                          <CheckCircle2 className="w-3.5 h-3.5 text-yellow-300" />
                          <span>Advancing in 2s...</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {/* Navigation Bar */}
          <div className="mt-2 p-2 rounded-xl bg-indigo-950/80 border border-fuchsia-500/40 flex items-center justify-between">
            <button
              onClick={() => {
                if (currentQuestionIndex > 0) startQuestion(currentQuestionIndex - 1);
              }}
              disabled={currentQuestionIndex === 0}
              className="btn-8d px-3 py-1.5 rounded-lg bg-purple-950 text-purple-300 hover:text-yellow-200 border border-purple-400 text-xs font-bold flex items-center space-x-1 disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>PREV</span>
            </button>

            <button
              onClick={() => moveToNextQuestion()}
              className="btn-8d px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 text-yellow-200 font-black text-xs uppercase border border-cyan-300 flex items-center space-x-1"
            >
              <span>{currentQuestionIndex === assessment.questions.length - 1 ? 'FINISH' : 'SKIP'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      )}

      {/* ===================== STEP 5: SUMMARY SCORE ===================== */}
      {step === 'summary' && quizResult && (
        <div className="w-full max-w-3xl mx-auto space-y-4 my-auto">
          <div className="effect-8d-card rounded-3xl p-6 bg-indigo-950/95 border-2 border-amber-400 text-center space-y-3">
            <Trophy className="w-12 h-12 text-yellow-300 mx-auto animate-bounce" />
            <h1 className="text-2xl font-black bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
              ASSESSMENT COMPLETED!
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-yellow-400">
                <span className="text-[10px] font-black uppercase text-amber-300 block">Score</span>
                <span className="text-xl font-black text-yellow-300">{quizResult.score} / {quizResult.totalScore}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400">
                <span className="text-[10px] font-black uppercase text-emerald-300 block">Correct</span>
                <span className="text-xl font-black text-emerald-300">{quizResult.correctCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500">
                <span className="text-[10px] font-black uppercase text-rose-300 block">Wrong</span>
                <span className="text-xl font-black text-rose-400">{quizResult.wrongCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-950/90 border border-purple-400">
                <span className="text-[10px] font-black uppercase text-purple-300 block">Missed</span>
                <span className="text-xl font-black text-amber-300">{quizResult.missedCount}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <button
                onClick={handleExportCSV}
                className="btn-8d px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-yellow-200 font-black text-xs uppercase border border-emerald-300 flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT CSV</span>
              </button>
              <button
                onClick={onBackToHome}
                className="btn-8d px-5 py-2.5 rounded-xl bg-indigo-900 text-cyan-300 hover:text-yellow-200 border border-cyan-400 text-xs font-black uppercase"
              >
                MAIN PORTAL
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
