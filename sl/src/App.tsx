import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FrontPage } from './components/FrontPage';
import { TeacherAuthModal } from './components/TeacherAuthModal';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentPortal } from './components/StudentPortal';
import { LiveMCQModal } from './components/LiveMCQModal';
import { UserAccount, MCQAssessment } from './types';

export default function App() {
  const [activePortal, setActivePortal] = useState<'front' | 'teacher' | 'student'>('front');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  
  // Live Streaming state
  const [liveConfigAssessment, setLiveConfigAssessment] = useState<MCQAssessment | null>(null);
  const [activeLivePin, setActiveLivePin] = useState<string | null>(null);

  // Disable right-click everywhere including textboxes as requested
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  // Restore user session if present
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('smart_learn_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    } catch (_) {}
  }, []);

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    sessionStorage.setItem('smart_learn_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('smart_learn_user');
    setActivePortal('front');
  };

  // Trigger Live MCQ Modal
  const handleOpenLiveModal = (mcq: MCQAssessment) => {
    setLiveConfigAssessment(mcq);
  };

  // Confirm and start live session on server
  const handleConfirmLiveStart = async (config: {
    shuffleQuestions: boolean;
    startMode: 'immediate' | 'wait_for_students';
    proctoringEnabled: boolean;
  }) => {
    if (!liveConfigAssessment) return;
    try {
      const res = await fetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: liveConfigAssessment.id,
          shuffleQuestions: config.shuffleQuestions,
          startMode: config.startMode,
          proctoringEnabled: config.proctoringEnabled,
          teacherId: currentUser?.id
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveLivePin(data.room.pin);
        setLiveConfigAssessment(null);
      }
    } catch (err) {
      console.error('Failed to start live session:', err);
    }
  };

  // End live session
  const handleEndLiveSession = async (pin: string) => {
    try {
      await fetch(`/api/live/${pin}/end`, { method: 'POST' });
      setActiveLivePin(null);
    } catch (err) {
      console.error('Failed to end live session:', err);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-8d-multiverse flex flex-col text-slate-100 overflow-x-hidden selection:bg-pink-500 selection:text-yellow-200">
      
      {/* Top Navigation */}
      <Navbar
        activePortal={activePortal}
        setActivePortal={setActivePortal}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area: Responsive to mobile viewports (100dvh) and monitor screens */}
      <main className="flex-1 flex flex-col w-full max-w-[1920px] mx-auto">
        {activePortal === 'front' && (
          <FrontPage
            onSelectTeacher={() => setActivePortal('teacher')}
            onSelectStudent={() => setActivePortal('student')}
          />
        )}

        {activePortal === 'teacher' && (
          <>
            {!currentUser ? (
              <TeacherAuthModal onSuccess={handleLoginSuccess} />
            ) : (
              <TeacherDashboard
                currentUser={currentUser}
                onStartLiveSession={handleOpenLiveModal}
                activeLivePin={activeLivePin}
                onEndLiveSession={handleEndLiveSession}
              />
            )}
          </>
        )}

        {activePortal === 'student' && (
          <StudentPortal
            onBackToHome={() => setActivePortal('front')}
          />
        )}
      </main>

      {/* Live MCQ Configuration Modal */}
      {liveConfigAssessment && (
        <LiveMCQModal
          assessment={liveConfigAssessment}
          onClose={() => setLiveConfigAssessment(null)}
          onConfirmStart={handleConfirmLiveStart}
        />
      )}

      {/* Clean Footer without unwanted descriptions */}
      <footer className="py-2.5 px-4 border-t-2 border-fuchsia-500/20 bg-indigo-950/90 text-center shrink-0">
        <p className="text-[11px] font-black tracking-widest text-teal-300">
          SMART LEARN • 8D REAL-TIME INTERACTIVE PORTAL
        </p>
      </footer>

    </div>
  );
}
