export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
  image?: string;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  questionImage?: string;
  options: QuestionOption[];
  correctOptionId: 'A' | 'B' | 'C' | 'D';
  points: number;
  timeSeconds: number;
}

export interface MCQAssessment {
  id: string;
  title: string;
  pin: string;
  teacherId: string;
  teacherName: string;
  questions: QuizQuestion[];
  status: 'draft' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: 'teacher' | 'superuser';
}

export interface LiveStudent {
  id: string;
  name: string;
  schoolName: string;
  email: string;
  score: number;
  currentQuestionIndex: number;
  answersCount: number;
  status: 'active' | 'paused' | 'ended';
  proctorAlertsCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  category: 'signup' | 'login' | 'mcq_create' | 'mcq_update' | 'live_session' | 'student_proctor' | 'student_submit';
  actor: string;
  details: string;
}

export interface StudentQuizResult {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  pin: string;
  studentId: string;
  studentName: string;
  schoolName: string;
  studentEmail: string;
  score: number;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  missedCount: number;
  totalQuestions: number;
  completedAt: string;
  answers: {
    questionId: string;
    questionText: string;
    selectedOptionId: string | null;
    correctOptionId: string;
    isCorrect: boolean;
    pointsEarned: number;
  }[];
}
