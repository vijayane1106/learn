import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  Play, 
  Square, 
  Edit3, 
  Copy, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  Users, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  KeyRound, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  Eye, 
  EyeOff, 
  FileText, 
  AlertTriangle,
  Flame,
  Zap,
  UserPlus
} from 'lucide-react';
import { 
  UserAccount, 
  MCQAssessment, 
  QuizQuestion, 
  StudentQuizResult, 
  AuditLog 
} from '../types';
import { exportMCQToExcel, exportToCSV, downloadMCQTemplate, parseMCQExcel } from '../utils/excelUtils';

interface TeacherDashboardProps {
  currentUser: UserAccount;
  onStartLiveSession: (mcq: MCQAssessment) => void;
  activeLivePin: string | null;
  onEndLiveSession: (pin: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
  onStartLiveSession,
  activeLivePin,
  onEndLiveSession
}) => {
  const isSuperUser = currentUser.role === 'superuser';

  // Navigation Tabs: 'mcq_list' | 'make_mcq' | 'excel_mcq' | 'reports' | 'teachers' (superuser) | 'audit' (superuser)
  const [activeTab, setActiveTab] = useState<'mcq_list' | 'make_mcq' | 'excel_mcq' | 'reports' | 'teachers' | 'audit'>('mcq_list');

  // MCQ List State
  const [mcqs, setMcqs] = useState<MCQAssessment[]>([]);
  const [loadingMcqs, setLoadingMcqs] = useState(false);

  // Super User: Teacher Management State
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState<'add' | 'edit' | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [teacherFormName, setTeacherFormName] = useState('');
  const [teacherFormUsername, setTeacherFormUsername] = useState('');
  const [teacherFormPassword, setTeacherFormPassword] = useState('');
  const [teacherFormPhone, setTeacherFormPhone] = useState('');
  const [showTeacherFormPass, setShowTeacherFormPass] = useState(false);
  const [teacherActionError, setTeacherActionError] = useState<string | null>(null);

  // Manual MCQ Builder State
  const [editMcqId, setEditMcqId] = useState<string | null>(null);
  const [mcqTitle, setMcqTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Excel MCQ Generator State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelValidation, setExcelValidation] = useState<{ isValid: boolean; errors: string[]; questions: QuizQuestion[] } | null>(null);
  const [excelAssessmentTitle, setExcelAssessmentTitle] = useState('');

  // Reports & Live Monitoring State
  const [reports, setReports] = useState<StudentQuizResult[]>([]);
  const [liveStudents, setLiveStudents] = useState<any[]>([]);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);

  // Super User Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);

  // WebSocket reference for live response streaming
  const wsRef = useRef<WebSocket | null>(null);

  // Load MCQs
  const fetchMCQs = async () => {
    setLoadingMcqs(true);
    try {
      const url = isSuperUser ? '/api/mcqs?role=superuser' : `/api/mcqs?teacherId=${currentUser.id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMcqs(data.mcqs || []);
      }
    } catch (err) {
      console.error('Failed to load MCQs:', err);
    } finally {
      setLoadingMcqs(false);
    }
  };

  // Load Teachers (Super User)
  const fetchTeachers = async () => {
    if (!isSuperUser) return;
    setLoadingTeachers(true);
    try {
      const res = await fetch('/api/superuser/teachers');
      const data = await res.json();
      if (data.success) {
        setTeachers(data.teachers || []);
      }
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Load Reports
  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  // Load Audit Logs (Super User)
  const fetchAuditLogs = async () => {
    if (!isSuperUser) return;
    try {
      const res = await fetch('/api/superuser/audit-logs');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs || []);
        setAuditStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    fetchMCQs();
    fetchReports();
    if (isSuperUser) {
      fetchTeachers();
      fetchAuditLogs();
    }
  }, [isSuperUser]);

  // Connect WebSocket for Live Room Updates & Multi-Place Student Responses
  useEffect(() => {
    if (!activeLivePin) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'teacher_join',
        pin: activeLivePin
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Instant broadcast of room leaderboard
        if (data.type === 'room_update') {
          setLiveStudents(data.leaderboard || []);
        }

        // Real-time student live response broadcast from any device/location
        else if (data.type === 'student_live_response') {
          setLiveFeed(prev => [
            {
              id: Date.now() + Math.random(),
              studentName: data.studentName,
              schoolName: data.schoolName,
              questionIndex: data.questionIndex,
              selectedOptionId: data.selectedOptionId,
              isCorrect: data.isCorrect,
              pointsEarned: data.pointsEarned,
              totalScore: data.totalScore,
              time: new Date().toLocaleTimeString()
            },
            ...prev.slice(0, 40)
          ]);
        }
      } catch (err) {
        console.error('Teacher WS message error:', err);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [activeLivePin]);

  // Generate Random PIN for MCQ
  const handleGeneratePin = async (id: string) => {
    try {
      const res = await fetch(`/api/mcqs/${id}/generate-pin`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMcqs(prev => prev.map(m => m.id === id ? { ...m, pin: data.pin } : m));
      }
    } catch (err) {
      console.error('Failed to generate PIN:', err);
    }
  };

  // Duplicate (Copy & Edit)
  const handleDuplicateMcq = async (id: string) => {
    try {
      const res = await fetch(`/api/mcqs/${id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMcqs(prev => [data.mcq, ...prev]);
        handleEditMcq(data.mcq);
      }
    } catch (err) {
      console.error('Failed to duplicate MCQ:', err);
    }
  };

  // Delete MCQ
  const handleDeleteMcq = async (id: string) => {
    if (!window.confirm('Delete this assessment?')) return;
    try {
      await fetch(`/api/mcqs/${id}`, { method: 'DELETE' });
      setMcqs(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Failed to delete MCQ:', err);
    }
  };

  // Download MCQ as CSV
  const handleDownloadCSV = (mcq: MCQAssessment) => {
    const rows = mcq.questions.map((q, idx) => ({
      'Question Number': idx + 1,
      'Question Text': q.questionText,
      'Option A': q.options.find(o => o.id === 'A')?.text || '',
      'Option B': q.options.find(o => o.id === 'B')?.text || '',
      'Option C': q.options.find(o => o.id === 'C')?.text || '',
      'Option D': q.options.find(o => o.id === 'D')?.text || '',
      'Correct Option': q.correctOptionId,
      'Points': q.points,
      'Time (Seconds)': q.timeSeconds
    }));
    exportToCSV(`${mcq.title.replace(/\s+/g, '_')}_MCQ`, rows);
  };

  // Switch to Manual Edit Mode
  const handleEditMcq = (mcq: MCQAssessment) => {
    setEditMcqId(mcq.id);
    setMcqTitle(mcq.title);
    setQuestions(JSON.parse(JSON.stringify(mcq.questions)));
    setActiveTab('make_mcq');
  };

  // Add Question in Builder
  const handleAddQuestion = () => {
    const newQ: QuizQuestion = {
      id: 'q_' + Date.now(),
      questionText: '',
      questionImage: '',
      options: [
        { id: 'A', text: '', image: '' },
        { id: 'B', text: '', image: '' },
        { id: 'C', text: '', image: '' },
        { id: 'D', text: '', image: '' }
      ],
      correctOptionId: 'A',
      points: 5,
      timeSeconds: 30
    };
    setQuestions(prev => [...prev, newQ]);
  };

  // Save Manual MCQ
  const handleSaveMcq = async (status: 'draft' | 'completed') => {
    if (!mcqTitle.trim()) {
      alert('Please provide an Assessment Title.');
      return;
    }
    if (questions.length === 0) {
      alert('Please add at least one question.');
      return;
    }

    try {
      const res = await fetch('/api/mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editMcqId,
          title: mcqTitle.trim(),
          teacherId: currentUser.id,
          teacherName: currentUser.name,
          questions,
          status
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchMCQs();
        setActiveTab('mcq_list');
        setEditMcqId(null);
        setMcqTitle('');
        setQuestions([]);
      }
    } catch (err) {
      console.error('Failed to save MCQ:', err);
    }
  };

  // Excel Upload & Validation
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

    try {
      const res = await parseMCQExcel(file);
      setExcelValidation(res);
      if (res.isValid && !excelAssessmentTitle) {
        setExcelAssessmentTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err: any) {
      setExcelValidation({
        isValid: false,
        errors: [err.message || 'Error parsing Excel spreadsheet'],
        questions: []
      });
    }
  };

  // Generate MCQ from Excel
  const handleGenerateFromExcel = async () => {
    if (!excelValidation || !excelValidation.isValid || excelValidation.questions.length === 0) return;
    const title = excelAssessmentTitle.trim() || 'Excel Imported Assessment';

    try {
      const res = await fetch('/api/mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          teacherId: currentUser.id,
          teacherName: currentUser.name,
          questions: excelValidation.questions,
          status: 'completed'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchMCQs();
        setExcelFile(null);
        setExcelValidation(null);
        setExcelAssessmentTitle('');
        setActiveTab('mcq_list');
      }
    } catch (err) {
      console.error('Failed to generate from Excel:', err);
    }
  };

  // Teacher Management Handlers (Super User)
  const openAddTeacherModal = () => {
    setTeacherActionError(null);
    setTeacherFormName('');
    setTeacherFormUsername('');
    setTeacherFormPassword('');
    setTeacherFormPhone('');
    setEditingTeacher(null);
    setShowTeacherModal('add');
  };

  const openEditTeacherModal = (teacher: any) => {
    setTeacherActionError(null);
    setEditingTeacher(teacher);
    setTeacherFormName(teacher.name);
    setTeacherFormUsername(teacher.username);
    setTeacherFormPassword('');
    setTeacherFormPhone(teacher.phone);
    setShowTeacherModal('edit');
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherActionError(null);

    try {
      if (showTeacherModal === 'add') {
        const res = await fetch('/api/superuser/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: teacherFormName,
            username: teacherFormUsername,
            password: teacherFormPassword,
            phone: teacherFormPhone
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to add teacher');
        fetchTeachers();
        setShowTeacherModal(null);
      } else if (showTeacherModal === 'edit' && editingTeacher) {
        const res = await fetch(`/api/superuser/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: teacherFormName,
            username: teacherFormUsername,
            password: teacherFormPassword || undefined,
            phone: teacherFormPhone
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update teacher');
        fetchTeachers();
        setShowTeacherModal(null);
      }
    } catch (err: any) {
      setTeacherActionError(err.message || 'Action failed.');
    }
  };

  const handleDeleteTeacher = async (id: string, name: string) => {
    if (!window.confirm(`Delete teacher "${name}" permanently?`)) return;
    try {
      await fetch(`/api/superuser/teachers/${id}`, { method: 'DELETE' });
      fetchTeachers();
    } catch (err) {
      console.error('Failed to remove teacher:', err);
    }
  };

  // Remote Proctor Actions
  const handleTeacherStudentControl = (studentId: string, action: 'pause' | 'resume' | 'end_quiz') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'teacher_student_control',
        targetStudentId: studentId,
        action
      }));
    }
  };

  return (
    <div className="w-full h-full flex flex-col px-3 sm:px-6 lg:px-8 py-4 space-y-4 max-w-[1920px] mx-auto">
      
      {/* Top Header & Tab Controls */}
      <div className="effect-8d-card rounded-2xl p-4 bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-slate-950/95 border-2 border-fuchsia-500/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-cyan-400 p-[2px]">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent uppercase">
              {isSuperUser ? 'SUPER USER COMMAND' : 'TEACHER COMMAND'}
            </h1>
            <span className="text-[11px] font-black text-teal-300">
              {currentUser.name} • {currentUser.phone}
            </span>
          </div>
        </div>

        {/* Dynamic Responsive Tab Bar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-indigo-950/80 border border-purple-500/40">
          <button
            onClick={() => setActiveTab('mcq_list')}
            className={`btn-8d px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
              activeTab === 'mcq_list'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 border border-pink-400'
                : 'text-cyan-300 hover:text-yellow-200'
            }`}
          >
            MCQ LIST
          </button>

          <button
            onClick={() => {
              setEditMcqId(null);
              setMcqTitle('');
              setQuestions([]);
              handleAddQuestion();
              setActiveTab('make_mcq');
            }}
            className={`btn-8d px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
              activeTab === 'make_mcq'
                ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-yellow-200 border border-cyan-400'
                : 'text-pink-300 hover:text-yellow-200'
            }`}
          >
            MAKE MCQ
          </button>

          <button
            onClick={() => setActiveTab('excel_mcq')}
            className={`btn-8d px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
              activeTab === 'excel_mcq'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-yellow-200 border border-emerald-400'
                : 'text-emerald-300 hover:text-yellow-200'
            }`}
          >
            EXCEL MCQ
          </button>

          <button
            onClick={() => { fetchReports(); setActiveTab('reports'); }}
            className={`btn-8d px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
              activeTab === 'reports'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-yellow-200 border border-amber-400'
                : 'text-amber-300 hover:text-yellow-200'
            }`}
          >
            STUDENTS REPORT
          </button>

          {isSuperUser && (
            <>
              <button
                onClick={() => { fetchTeachers(); setActiveTab('teachers'); }}
                className={`btn-8d px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
                  activeTab === 'teachers'
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-yellow-200 border border-fuchsia-400'
                    : 'text-fuchsia-300 hover:text-yellow-200'
                }`}
              >
                TEACHER MGMT
              </button>

              <button
                onClick={() => { fetchAuditLogs(); setActiveTab('audit'); }}
                className={`btn-8d px-3 py-1.5 rounded-lg text-xs font-black uppercase ${
                  activeTab === 'audit'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-yellow-200 border border-rose-400'
                    : 'text-rose-300 hover:text-yellow-200'
                }`}
              >
                SURVEILLANCE
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===================== ACTIVE TAB 1: MCQ LIST ===================== */}
      {activeTab === 'mcq_list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-yellow-300 uppercase tracking-wide flex items-center space-x-2">
              <span>MCQ ASSESSMENTS</span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-cyan-300 text-xs border border-purple-400">
                {mcqs.length}
              </span>
            </h2>

            <button
              onClick={() => {
                setEditMcqId(null);
                setMcqTitle('');
                setQuestions([]);
                handleAddQuestion();
                setActiveTab('make_mcq');
              }}
              className="btn-8d px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 font-black text-xs uppercase flex items-center space-x-1.5 border border-pink-400"
            >
              <PlusCircle className="w-4 h-4" />
              <span>CREATE NEW MCQ</span>
            </button>
          </div>

          {loadingMcqs ? (
            <div className="p-8 text-center text-teal-300 font-black text-sm animate-pulse">
              LOADING ASSESSMENTS...
            </div>
          ) : mcqs.length === 0 ? (
            <div className="p-12 text-center effect-8d-card rounded-2xl bg-indigo-950/80 border-2 border-purple-500/40">
              <FileText className="w-12 h-12 text-pink-400 mx-auto mb-3 animate-bounce" />
              <p className="text-sm font-black text-yellow-300">
                NO ASSESSMENTS CREATED YET
              </p>
              <button
                onClick={() => {
                  setEditMcqId(null);
                  setMcqTitle('');
                  setQuestions([]);
                  handleAddQuestion();
                  setActiveTab('make_mcq');
                }}
                className="btn-8d mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 text-yellow-200 font-black text-xs uppercase border border-cyan-300"
              >
                CREATE YOUR FIRST MCQ
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mcqs.map((mcq) => {
                const isLive = activeLivePin === mcq.pin;
                return (
                  <div
                    key={mcq.id}
                    className={`effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 transition-all flex flex-col justify-between ${
                      isLive 
                        ? 'border-yellow-300 shadow-[0_0_30px_rgba(253,224,71,0.5)]' 
                        : 'border-purple-500/40 hover:border-cyan-400'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-900 border border-cyan-400 text-cyan-300 text-xs font-mono font-black">
                            PIN: {mcq.pin}
                          </span>
                          <button
                            title="Generate Random PIN"
                            onClick={() => handleGeneratePin(mcq.id)}
                            className="btn-8d p-1 rounded-lg bg-purple-900/80 text-amber-300 hover:text-yellow-200 border border-amber-400/50"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isLive && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500 text-rose-300 text-[10px] font-black uppercase flex items-center space-x-1 animate-pulse">
                            <Flame className="w-3 h-3 text-yellow-300" />
                            <span>LIVE ACTIVE</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-yellow-200 leading-snug line-clamp-2 mb-2">
                        {mcq.title}
                      </h3>

                      <div className="flex items-center space-x-3 text-xs font-bold text-teal-300 mb-4">
                        <span>{mcq.questions.length} Questions</span>
                        <span>•</span>
                        <span>{mcq.questions.reduce((sum, q) => sum + (q.points || 5), 0)} Total Points</span>
                      </div>
                    </div>

                    {/* Action Buttons: Edit, Copy & Edit, Generate PIN, Delete, Download Excel, Download CSV, Live */}
                    <div className="pt-3 border-t border-purple-500/30 space-y-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          title="Edit Assessment"
                          onClick={() => handleEditMcq(mcq)}
                          className="btn-8d py-2 rounded-lg bg-indigo-900 text-cyan-300 hover:text-yellow-200 border border-cyan-400 text-[11px] font-black flex items-center justify-center space-x-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>EDIT</span>
                        </button>

                        <button
                          title="Copy and Edit"
                          onClick={() => handleDuplicateMcq(mcq.id)}
                          className="btn-8d py-2 rounded-lg bg-indigo-900 text-pink-300 hover:text-yellow-200 border border-pink-400 text-[11px] font-black flex items-center justify-center space-x-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>COPY</span>
                        </button>

                        <button
                          title="Download as Excel"
                          onClick={() => exportMCQToExcel(mcq)}
                          className="btn-8d py-2 rounded-lg bg-emerald-950 text-emerald-300 hover:text-yellow-200 border border-emerald-400 text-[11px] font-black flex items-center justify-center space-x-1"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>XLSX</span>
                        </button>

                        <button
                          title="Download as CSV"
                          onClick={() => handleDownloadCSV(mcq)}
                          className="btn-8d py-2 rounded-lg bg-teal-950 text-teal-300 hover:text-yellow-200 border border-teal-400 text-[11px] font-black flex items-center justify-center space-x-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          title="Generate Random PIN"
                          onClick={() => handleGeneratePin(mcq.id)}
                          className="btn-8d py-2 rounded-lg bg-purple-950 text-amber-300 hover:text-yellow-200 border border-amber-400 text-[11px] font-black flex items-center justify-center space-x-1"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>NEW PIN</span>
                        </button>

                        <button
                          title="Delete Assessment"
                          onClick={() => handleDeleteMcq(mcq.id)}
                          className="btn-8d py-2 rounded-lg bg-rose-950 text-rose-300 hover:text-yellow-200 border border-rose-500 text-[11px] font-black flex items-center justify-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>DELETE</span>
                        </button>

                        {isLive ? (
                          <button
                            onClick={() => onEndLiveSession(mcq.pin)}
                            className="btn-8d py-2 rounded-lg bg-rose-700 text-yellow-200 border border-rose-400 text-[11px] font-black flex items-center justify-center space-x-1"
                          >
                            <Square className="w-3.5 h-3.5 fill-current text-yellow-300" />
                            <span>END LIVE</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onStartLiveSession(mcq)}
                            className="btn-8d py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 border border-pink-400 text-[11px] font-black flex items-center justify-center space-x-1 shadow-[0_0_12px_rgba(236,72,153,0.5)]"
                          >
                            <Play className="w-3.5 h-3.5 fill-current text-yellow-300" />
                            <span>GO LIVE</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== ACTIVE TAB 2: MAKE MCQ (MANUAL BUILDER) ===================== */}
      {activeTab === 'make_mcq' && (
        <div className="space-y-4">
          <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-cyan-500/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-black text-cyan-300 uppercase tracking-wide">
                {editMcqId ? 'EDIT ASSESSMENT' : 'CREATE NEW ASSESSMENT'}
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSaveMcq('draft')}
                  className="btn-8d px-4 py-2 rounded-xl bg-indigo-900 text-purple-200 border border-purple-400 text-xs font-black uppercase"
                >
                  SAVE AS DRAFT
                </button>
                <button
                  onClick={() => handleSaveMcq('completed')}
                  className="btn-8d px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 border border-pink-400 text-xs font-black uppercase shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                >
                  SAVE AND COMPLETE
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-pink-300 mb-1">
                Assessment Title
              </label>
              <input
                type="text"
                required
                placeholder="Enter title"
                value={mcqTitle}
                onChange={(e) => setMcqTitle(e.target.value)}
                className="input-8d w-full px-4 py-3 rounded-xl text-yellow-200 font-black text-base placeholder-purple-400"
              />
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <div
                key={q.id}
                className="effect-8d-card rounded-2xl p-4 sm:p-5 bg-indigo-950/90 border-2 border-purple-500/40 space-y-4"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-yellow-300 uppercase">
                    QUESTION {qIndex + 1}
                  </span>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-extrabold text-teal-300 uppercase">Points:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={q.points}
                        onChange={(e) => {
                          const pts = parseInt(e.target.value) || 1;
                          setQuestions(prev => prev.map((item, i) => i === qIndex ? { ...item, points: pts } : item));
                        }}
                        className="input-8d w-14 px-2 py-1 rounded-lg text-center font-bold text-xs text-yellow-300"
                      />
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-pink-400" />
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={q.timeSeconds}
                        onChange={(e) => {
                          const sec = parseInt(e.target.value) || 30;
                          setQuestions(prev => prev.map((item, i) => i === qIndex ? { ...item, timeSeconds: sec } : item));
                        }}
                        className="input-8d w-16 px-2 py-1 rounded-lg text-center font-bold text-xs text-pink-300"
                      />
                      <span className="text-[10px] font-bold text-pink-300">s</span>
                    </div>
                    {questions.length > 1 && (
                      <button
                        onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qIndex))}
                        className="p-1 rounded-lg bg-rose-950 text-rose-400 hover:text-yellow-200 border border-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Text & Image */}
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Enter question text"
                    value={q.questionText}
                    onChange={(e) => {
                      const text = e.target.value;
                      setQuestions(prev => prev.map((item, i) => i === qIndex ? { ...item, questionText: text } : item));
                    }}
                    className="input-8d w-full px-3.5 py-2.5 rounded-xl text-yellow-100 font-bold text-sm placeholder-purple-400"
                  />

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Optional Question Image URL"
                      value={q.questionImage || ''}
                      onChange={(e) => {
                        const img = e.target.value;
                        setQuestions(prev => prev.map((item, i) => i === qIndex ? { ...item, questionImage: img } : item));
                      }}
                      className="input-8d flex-1 px-3 py-1.5 rounded-lg text-xs text-cyan-300 placeholder-purple-400"
                    />
                    <label className="btn-8d px-3 py-1.5 rounded-lg bg-purple-900 text-cyan-300 border border-cyan-400 text-xs font-black uppercase cursor-pointer">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (re) => {
                              const b64 = re.target?.result as string;
                              setQuestions(prev => prev.map((item, i) => i === qIndex ? { ...item, questionImage: b64 } : item));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* 4 Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`p-3 rounded-xl border-2 space-y-2 ${
                        q.correctOptionId === opt.id
                          ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                          : 'bg-indigo-950/70 border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-lg bg-indigo-900 text-cyan-300 font-mono font-black text-xs flex items-center justify-center border border-cyan-400">
                          {opt.id}
                        </span>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`correct_${q.id}`}
                            checked={q.correctOptionId === opt.id}
                            onChange={() => {
                              setQuestions(prev => prev.map((item, i) => i === qIndex ? { ...item, correctOptionId: opt.id } : item));
                            }}
                            className="w-4 h-4 accent-emerald-400 cursor-pointer"
                          />
                          <span className={`text-xs font-black uppercase ${
                            q.correctOptionId === opt.id ? 'text-emerald-300' : 'text-teal-300'
                          }`}>
                            Correct Answer
                          </span>
                        </label>
                      </div>

                      <input
                        type="text"
                        placeholder={`Option ${opt.id} text`}
                        value={opt.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions(prev => prev.map((item, i) => i === qIndex ? {
                            ...item,
                            options: item.options.map(o => o.id === opt.id ? { ...o, text: val } : o)
                          } : item));
                        }}
                        className="input-8d w-full px-3 py-1.5 rounded-lg text-yellow-200 font-bold text-xs placeholder-purple-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleAddQuestion}
              className="btn-8d w-full py-3.5 rounded-2xl bg-indigo-900/90 text-cyan-300 hover:text-yellow-200 border-2 border-dashed border-cyan-400 font-black text-xs uppercase flex items-center justify-center space-x-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span>ADD ONE MORE QUESTION</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================== ACTIVE TAB 3: EXCEL BASED MCQ ===================== */}
      {activeTab === 'excel_mcq' && (
        <div className="space-y-4">
          <div className="effect-8d-card rounded-2xl p-6 bg-indigo-950/90 border-2 border-emerald-500/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-black text-emerald-300 uppercase tracking-wide">
                EXCEL SPREADSHEET MCQ GENERATOR
              </h2>
              <button
                onClick={downloadMCQTemplate}
                className="btn-8d px-4 py-2 rounded-xl bg-emerald-950 text-emerald-300 hover:text-yellow-200 border border-emerald-400 text-xs font-black uppercase flex items-center space-x-1.5"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD TEMPLATE</span>
              </button>
            </div>

            {/* Drag & Drop / Upload Area */}
            <div className="border-2 border-dashed border-emerald-400/60 rounded-2xl p-6 sm:p-8 text-center bg-indigo-950/50 hover:bg-indigo-950/80 transition-all">
              <FileSpreadsheet className="w-12 h-12 text-emerald-400 mx-auto mb-2 animate-bounce" />
              <p className="text-sm font-black text-yellow-200 mb-2">
                DRAG & DROP OR BROWSE FILLED MCQ EXCEL FILE (.XLSX)
              </p>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
                className="hidden"
                id="excel_upload_input"
              />
              <label
                htmlFor="excel_upload_input"
                className="btn-8d inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-yellow-200 font-black text-xs uppercase cursor-pointer border border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                <span>CHOOSE EXCEL FILE</span>
              </label>

              {excelFile && (
                <p className="mt-2 text-xs font-bold text-teal-300">
                  Selected: {excelFile.name}
                </p>
              )}
            </div>

            {/* Validation Feedback */}
            {excelValidation && (
              <div className="space-y-3">
                {excelValidation.isValid ? (
                  <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-400 space-y-3">
                    <div className="flex items-center space-x-2 text-emerald-300 font-black text-xs uppercase">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Validation Successful! {excelValidation.questions.length} Questions Ready.</span>
                    </div>

                    <input
                      type="text"
                      placeholder="Assessment Title"
                      value={excelAssessmentTitle}
                      onChange={(e) => setExcelAssessmentTitle(e.target.value)}
                      className="input-8d w-full px-3.5 py-2.5 rounded-xl text-yellow-200 font-black text-sm"
                    />

                    <button
                      onClick={handleGenerateFromExcel}
                      className="btn-8d w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-yellow-200 font-black text-xs uppercase tracking-wider border border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                    >
                      GENERATE AND PUBLISH MCQ
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-950/90 border border-rose-500 space-y-2">
                    <span className="text-xs font-black text-rose-300 uppercase block">Validation Errors:</span>
                    <ul className="text-xs font-bold text-rose-300 space-y-1 list-disc list-inside">
                      {excelValidation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ACTIVE TAB 4: STUDENTS REPORT & LIVE MONITOR ===================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          
          {/* Live Streaming Active Monitor */}
          {activeLivePin && (
            <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/95 border-2 border-yellow-300 space-y-3 shadow-[0_0_30px_rgba(253,224,71,0.3)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-sm font-black text-yellow-300 uppercase">
                    LIVE ACTIVE SESSION MONITOR (PIN: {activeLivePin})
                  </h3>
                </div>
                <button
                  onClick={() => onEndLiveSession(activeLivePin)}
                  className="btn-8d px-3 py-1 rounded-lg bg-rose-700 text-yellow-200 text-xs font-black uppercase border border-rose-400"
                >
                  END SESSION
                </button>
              </div>

              {/* Real-Time Live Feed of Student Responses */}
              {liveFeed.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-cyan-400/40 max-h-32 overflow-y-auto space-y-1">
                  {liveFeed.map((item) => (
                    <div key={item.id} className="text-[11px] font-bold text-teal-300 flex items-center justify-between">
                      <span>⚡ <strong className="text-yellow-300">{item.studentName}</strong> answered Q{item.questionIndex + 1}: Option <strong className="text-pink-300">{item.selectedOptionId}</strong> ({item.isCorrect ? '+pts' : '0'})</span>
                      <span className="text-[10px] font-mono text-cyan-400">{item.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Connected Students List */}
              <div className="space-y-2">
                <span className="text-xs font-black text-cyan-300 uppercase">
                  Connected Students ({liveStudents.length}):
                </span>
                {liveStudents.length === 0 ? (
                  <p className="text-xs font-bold text-purple-300">Waiting for students to join...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {liveStudents.map((st) => (
                      <div key={st.id} className="p-2.5 rounded-xl bg-indigo-900/80 border border-purple-400/40 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-yellow-200 block">{st.name}</span>
                          <span className="text-[10px] font-bold text-teal-300">Score: {st.score} | Q{st.currentQuestionIndex}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {st.status === 'paused' ? (
                            <button
                              onClick={() => handleTeacherStudentControl(st.id, 'resume')}
                              className="btn-8d px-2 py-1 rounded bg-emerald-700 text-[10px] font-black text-yellow-200"
                            >
                              RESUME
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTeacherStudentControl(st.id, 'pause')}
                              className="btn-8d px-2 py-1 rounded bg-amber-700 text-[10px] font-black text-yellow-200"
                            >
                              PAUSE
                            </button>
                          )}
                          <button
                            onClick={() => handleTeacherStudentControl(st.id, 'end_quiz')}
                            className="btn-8d px-2 py-1 rounded bg-rose-700 text-[10px] font-black text-yellow-200"
                          >
                            END
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Completed Reports List */}
          <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-purple-500/40 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-yellow-300 uppercase">
                COMPLETED STUDENT REPORTS
              </h2>
              {reports.length > 0 && (
                <button
                  onClick={() => {
                    const rows = reports.map((r, i) => ({
                      'Rank': i + 1,
                      'Student Name': r.studentName,
                      'School Name': r.schoolName,
                      'Email': r.studentEmail,
                      'Assessment': r.assessmentTitle,
                      'PIN': r.pin,
                      'Score': r.score,
                      'Total Score': r.totalScore,
                      'Correct': r.correctCount,
                      'Wrong': r.wrongCount,
                      'Missed': r.missedCount,
                      'Date': new Date(r.completedAt).toLocaleString()
                    }));
                    exportToCSV('SMART_LEARN_Student_Reports', rows);
                  }}
                  className="btn-8d px-4 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-400 text-xs font-black uppercase flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>EXPORT CSV</span>
                </button>
              )}
            </div>

            {reports.length === 0 ? (
              <p className="text-xs font-bold text-teal-300 text-center py-8">
                No completed quiz submissions recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-purple-500/40 text-cyan-300 uppercase font-black">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">School</th>
                      <th className="py-2.5 px-3">Assessment</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Breakdown</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/20 font-bold text-teal-200">
                    {reports.map((rep) => (
                      <tr key={rep.id} className="hover:bg-purple-950/30">
                        <td className="py-2.5 px-3 text-yellow-200 font-black">{rep.studentName}</td>
                        <td className="py-2.5 px-3 text-pink-300">{rep.schoolName || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-cyan-300">{rep.assessmentTitle}</td>
                        <td className="py-2.5 px-3 text-amber-300 font-black">{rep.score} / {rep.totalScore}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-emerald-400">✓{rep.correctCount}</span>{' '}
                          <span className="text-rose-400">✗{rep.wrongCount}</span>{' '}
                          <span className="text-amber-400">⚠{rep.missedCount}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-purple-300">{new Date(rep.completedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ACTIVE TAB 5: SUPER USER - TEACHER MANAGEMENT ===================== */}
      {isSuperUser && activeTab === 'teachers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-fuchsia-300 uppercase flex items-center space-x-2">
              <span>TEACHER DIRECTORY & ACCOUNTS</span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-cyan-300 text-xs border border-purple-400">
                {teachers.length}
              </span>
            </h2>

            <button
              onClick={openAddTeacherModal}
              className="btn-8d px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-yellow-200 font-black text-xs uppercase flex items-center space-x-1.5 border border-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.5)]"
            >
              <UserPlus className="w-4 h-4" />
              <span>ADD NEW TEACHER</span>
            </button>
          </div>

          {loadingTeachers ? (
            <div className="p-8 text-center text-teal-300 font-black text-sm animate-pulse">
              LOADING TEACHERS...
            </div>
          ) : teachers.length === 0 ? (
            <div className="p-12 text-center effect-8d-card rounded-2xl bg-indigo-950/80 border-2 border-purple-500/40">
              <Users className="w-12 h-12 text-pink-400 mx-auto mb-3" />
              <p className="text-sm font-black text-yellow-300">
                NO REGISTERED TEACHERS YET
              </p>
              <button
                onClick={openAddTeacherModal}
                className="btn-8d mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 font-black text-xs uppercase border border-pink-400"
              >
                ADD FIRST TEACHER
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((t) => (
                <div
                  key={t.id}
                  className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-fuchsia-500/40 flex flex-col justify-between"
                >
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-purple-900 border border-purple-400 text-[10px] font-black text-yellow-300 uppercase">
                        TEACHER
                      </span>
                      <span className="text-[10px] font-mono text-teal-300">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-yellow-200">
                      {t.name}
                    </h3>

                    <div className="text-xs font-bold space-y-1">
                      <p className="text-cyan-300">Username: <strong className="text-yellow-300">{t.username}</strong></p>
                      <p className="text-emerald-300">Phone: <strong className="text-emerald-200 font-mono">+91 {t.phone}</strong></p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-purple-500/30 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => openEditTeacherModal(t)}
                      className="btn-8d px-3 py-1.5 rounded-lg bg-indigo-900 text-cyan-300 hover:text-yellow-200 border border-cyan-400 text-xs font-black flex items-center space-x-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>EDIT</span>
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(t.id, t.name)}
                      className="btn-8d px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 hover:text-yellow-200 border border-rose-500 text-xs font-black flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>DELETE</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== ACTIVE TAB 6: SUPER USER - AUDIT & SURVEILLANCE ===================== */}
      {isSuperUser && activeTab === 'audit' && (
        <div className="space-y-4">
          {auditStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="effect-8d-card p-3.5 rounded-xl bg-indigo-950/90 border border-cyan-400">
                <span className="text-[10px] font-black uppercase text-cyan-300 block">Teachers</span>
                <span className="text-xl font-black text-yellow-300">{auditStats.totalTeachers}</span>
              </div>
              <div className="effect-8d-card p-3.5 rounded-xl bg-indigo-950/90 border border-pink-400">
                <span className="text-[10px] font-black uppercase text-pink-300 block">Assessments</span>
                <span className="text-xl font-black text-pink-300">{auditStats.totalMCQs}</span>
              </div>
              <div className="effect-8d-card p-3.5 rounded-xl bg-indigo-950/90 border border-emerald-400">
                <span className="text-[10px] font-black uppercase text-emerald-300 block">Submissions</span>
                <span className="text-xl font-black text-emerald-300">{auditStats.totalCompletedQuizzes}</span>
              </div>
              <div className="effect-8d-card p-3.5 rounded-xl bg-indigo-950/90 border border-amber-400">
                <span className="text-[10px] font-black uppercase text-amber-300 block">Active Rooms</span>
                <span className="text-xl font-black text-amber-300">{auditStats.activeLiveRooms}</span>
              </div>
            </div>
          )}

          <div className="effect-8d-card rounded-2xl p-4 bg-indigo-950/90 border-2 border-rose-500/40 space-y-3">
            <h2 className="text-base font-black text-rose-300 uppercase">
              SECURITY AUDIT & ACTIVITY LOGS
            </h2>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-rose-500/40 text-yellow-300 uppercase font-black">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Actor</th>
                    <th className="py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/20 font-bold text-teal-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-purple-950/30">
                      <td className="py-2 px-3 font-mono text-[10px] text-purple-300">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-900 border border-purple-400 text-[10px] font-black uppercase text-cyan-300">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-pink-300 font-black">{log.actor}</td>
                      <td className="py-2 px-3 text-yellow-200">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADD / EDIT TEACHER (SUPER USER) ===================== */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="effect-8d-card w-full max-w-md rounded-3xl p-6 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 border-2 border-fuchsia-500 shadow-[0_0_50px_rgba(217,70,239,0.5)]">
            <h3 className="text-lg font-black text-yellow-300 uppercase mb-4">
              {showTeacherModal === 'add' ? 'ADD NEW TEACHER' : 'UPDATE TEACHER DETAILS'}
            </h3>

            {teacherActionError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-950 border border-rose-500 text-rose-300 text-xs font-black">
                {teacherActionError}
              </div>
            )}

            <form onSubmit={handleSaveTeacher} className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold uppercase text-cyan-300 mb-1">
                  Teacher Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={teacherFormName}
                  onChange={(e) => setTeacherFormName(e.target.value)}
                  className="input-8d w-full px-3.5 py-2.5 rounded-xl text-yellow-200 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="Unique Username"
                  value={teacherFormUsername}
                  onChange={(e) => setTeacherFormUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="input-8d w-full px-3.5 py-2.5 rounded-xl text-amber-200 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-pink-300 mb-1">
                  Password {showTeacherModal === 'edit' && '(Leave blank to keep unchanged)'}
                </label>
                <div className="relative">
                  <input
                    type={showTeacherFormPass ? 'text' : 'password'}
                    required={showTeacherModal === 'add'}
                    placeholder="Enter password"
                    value={teacherFormPassword}
                    onChange={(e) => setTeacherFormPassword(e.target.value)}
                    className="input-8d w-full px-3.5 py-2.5 pr-10 rounded-xl text-pink-200 font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherFormPass(!showTeacherFormPass)}
                    className="absolute inset-y-0 right-3 my-auto text-cyan-300 hover:text-yellow-300"
                  >
                    {showTeacherFormPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-emerald-300 mb-1">
                  Mobile Number (10 Digits)
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={teacherFormPhone}
                  onChange={(e) => setTeacherFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input-8d w-full px-3.5 py-2.5 rounded-xl text-emerald-200 font-mono font-bold text-xs"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(null)}
                  className="btn-8d flex-1 py-2.5 rounded-xl bg-indigo-900 text-cyan-300 font-black text-xs uppercase border border-purple-500"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-8d flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-yellow-200 font-black text-xs uppercase border border-pink-400 shadow-[0_0_15px_rgba(217,70,239,0.5)]"
                >
                  SAVE TEACHER
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
