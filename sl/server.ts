import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'smart_learn_db.json');

// Interface types
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
  passwordHash: string;
  phone: string;
  role: 'teacher' | 'superuser';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  category: 'signup' | 'login' | 'mcq_create' | 'mcq_update' | 'live_session' | 'student_proctor' | 'student_submit' | 'teacher_manage';
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

// Database initial structure
interface DatabaseSchema {
  users: UserAccount[];
  mcqs: MCQAssessment[];
  reports: StudentQuizResult[];
  auditLogs: AuditLog[];
}

// Clean Initial State: NO predefined demo MCQs, NO predefined demo students, NO predefined demo teachers.
// Only the remote-server Super User (vijay1 / vijay@12 / 9790425634)
function getInitialDBSchema(): DatabaseSchema {
  return {
    users: [
      {
        id: 'usr_superuser_1',
        name: 'Super User Admin',
        username: 'vijay1',
        passwordHash: 'vijay@12',
        phone: '9790425634',
        role: 'superuser',
        createdAt: new Date().toISOString()
      }
    ],
    mcqs: [],
    reports: [],
    auditLogs: []
  };
}

// Read / Write Database Helper
function readDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      // Ensure super user is always present
      if (!parsed.users || !parsed.users.some((u: UserAccount) => u.username === 'vijay1')) {
        parsed.users = parsed.users || [];
        parsed.users.push({
          id: 'usr_superuser_1',
          name: 'Super User Admin',
          username: 'vijay1',
          passwordHash: 'vijay@12',
          phone: '9790425634',
          role: 'superuser',
          createdAt: new Date().toISOString()
        });
        writeDB(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading DB, re-initializing clean database:', err);
  }

  const initial = getInitialDBSchema();
  writeDB(initial);
  return initial;
}

function writeDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Force wipe clean any previous mock data on initial start if requested
function purgeOldMockData() {
  const db = readDB();
  let modified = false;

  // Filter out any mock accounts other than super user
  const originalUserCount = db.users.length;
  db.users = db.users.filter(u => u.username === 'vijay1' || u.role === 'teacher' && u.id !== 'usr_teacher_demo');
  if (db.users.length !== originalUserCount) modified = true;

  // Remove mock MCQs
  const originalMcqCount = db.mcqs.length;
  db.mcqs = db.mcqs.filter(m => m.id !== 'mcq_demo_space');
  if (db.mcqs.length !== originalMcqCount) modified = true;

  // Remove mock reports
  const originalRepCount = db.reports.length;
  db.reports = db.reports.filter(r => r.id !== 'rep_1' && r.id !== 'rep_2');
  if (db.reports.length !== originalRepCount) modified = true;

  if (modified) {
    writeDB(db);
  }
}
purgeOldMockData();

function logAudit(category: AuditLog['category'], actor: string, details: string) {
  const db = readDB();
  const log: AuditLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    category,
    actor,
    details
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  writeDB(db);
}

// In-Memory Live Quiz Rooms Map (Redis-like cache)
interface LiveStudent {
  id: string;
  name: string;
  schoolName: string;
  email: string;
  joinedAt: string;
  score: number;
  currentQuestionIndex: number;
  answersCount: number;
  lastSelectedOption?: string;
  status: 'active' | 'paused' | 'ended';
  proctorAlertsCount: number;
  ws?: WebSocket;
}

interface LiveRoom {
  pin: string;
  assessment: MCQAssessment;
  teacherWs?: WebSocket;
  teacherId: string;
  shuffleQuestions: boolean;
  startMode: 'immediate' | 'wait_for_students';
  proctoringEnabled: boolean;
  status: 'lobby' | 'in_progress' | 'ended';
  startedAt?: string;
  students: Map<string, LiveStudent>;
}

const liveRooms = new Map<string, LiveRoom>();

// Temporary OTP Store (Key: phone number -> { otp, expiresAt, purpose })
const otpStore = new Map<string, { otp: string; expiresAt: number; purpose: string }>();

// Helper to generate 6-digit random PIN
function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ======================= API ROUTES ======================= //

// 1. Teacher & Super User Auth: Request OTP
app.post('/api/auth/teacher/signup-otp', (req, res) => {
  const { phone, purpose = 'signup' } = req.body;
  
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please enter a valid 10-digit Indian mobile number.' 
    });
  }

  const db = readDB();
  if (purpose === 'signup') {
    const existing = db.users.find(u => u.phone === phone);
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'This mobile number is already registered.' 
      });
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    purpose
  });

  logAudit('signup', phone, `OTP generated for mobile: ${phone} (${purpose})`);

  return res.json({
    success: true,
    message: `OTP dispatched to +91 ${phone} successfully!`,
    otpCode: otp,
    expiresInSeconds: 300
  });
});

// 2. Signup Teacher with OTP verification
app.post('/api/auth/teacher/verify-otp-and-signup', (req, res) => {
  const { name, username, password, phone, otp } = req.body;

  if (!name || !username || !password || !phone || !otp) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const record = otpStore.get(phone);
  if (!record || record.otp !== otp.trim() || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
  }

  const db = readDB();
  if (db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Username is already taken.' });
  }
  if (db.users.some(u => u.phone === phone.trim())) {
    return res.status(400).json({ success: false, message: 'Phone number is already registered.' });
  }

  const newUser: UserAccount = {
    id: 'usr_' + Date.now(),
    name: name.trim(),
    username: username.trim(),
    passwordHash: password,
    phone: phone.trim(),
    role: 'teacher',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);
  otpStore.delete(phone);

  logAudit('signup', username, `New Teacher registered: ${name} (${phone})`);

  return res.json({
    success: true,
    message: 'Teacher account created successfully!',
    user: { id: newUser.id, name: newUser.name, username: newUser.username, role: newUser.role }
  });
});

// 3. Teacher / Super User Login
app.post('/api/auth/teacher/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const db = readDB();
  const user = db.users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase() && u.passwordHash === password
  );

  if (!user) {
    logAudit('login', username, 'Failed login attempt');
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  }

  logAudit('login', user.username, `Successful login by ${user.name} [Role: ${user.role}]`);

  return res.json({
    success: true,
    message: `Welcome, ${user.name}!`,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      phone: user.phone,
      role: user.role
    },
    token: 'jwt_mock_' + user.id + '_' + Date.now()
  });
});

// 4. Forgot Password - Request Recovery OTP
app.post('/api/auth/teacher/forgot-password-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.phone === phone.trim());

  if (!user) {
    return res.status(404).json({ success: false, message: 'No registered user found with this mobile number.' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    purpose: 'forgot-password'
  });

  logAudit('login', phone, `Password recovery OTP dispatched for mobile: ${phone}`);

  return res.json({
    success: true,
    message: `Recovery OTP sent to +91 ${phone}!`,
    otpCode: otp
  });
});

// 5. Reset Password with OTP
app.post('/api/auth/teacher/reset-password', (req, res) => {
  const { phone, otp, newPassword } = req.body;

  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Phone, OTP, and new password are required.' });
  }

  const record = otpStore.get(phone);
  if (!record || record.otp !== otp.trim() || Date.now() > record.expiresAt) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.phone === phone.trim());
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  user.passwordHash = newPassword;
  writeDB(db);
  otpStore.delete(phone);

  logAudit('login', user.username, `Password reset via OTP for ${user.name}`);

  return res.json({
    success: true,
    message: 'Password reset successfully!'
  });
});

// ======================= SUPER USER: TEACHER MANAGEMENT ======================= //

// List all teachers
app.get('/api/superuser/teachers', (req, res) => {
  const db = readDB();
  const teachers = db.users
    .filter(u => u.role === 'teacher')
    .map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      phone: u.phone,
      createdAt: u.createdAt
    }));
  return res.json({ success: true, teachers });
});

// Add new teacher directly by Super User
app.post('/api/superuser/teachers', (req, res) => {
  const { name, username, password, phone } = req.body;

  if (!name || !username || !password || !phone) {
    return res.status(400).json({ success: false, message: 'All fields (Name, Username, Password, Phone) are required.' });
  }

  const db = readDB();
  if (db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Username is already taken.' });
  }
  if (db.users.some(u => u.phone === phone.trim())) {
    return res.status(400).json({ success: false, message: 'Phone number is already registered.' });
  }

  const newTeacher: UserAccount = {
    id: 'usr_' + Date.now(),
    name: name.trim(),
    username: username.trim(),
    passwordHash: password,
    phone: phone.trim(),
    role: 'teacher',
    createdAt: new Date().toISOString()
  };

  db.users.push(newTeacher);
  writeDB(db);

  logAudit('teacher_manage', 'Super User', `Added Teacher: ${name} (${username})`);

  return res.json({
    success: true,
    message: 'Teacher added successfully!',
    teacher: { id: newTeacher.id, name: newTeacher.name, username: newTeacher.username, phone: newTeacher.phone, createdAt: newTeacher.createdAt }
  });
});

// Update teacher details
app.put('/api/superuser/teachers/:id', (req, res) => {
  const { id } = req.params;
  const { name, username, password, phone } = req.body;

  const db = readDB();
  const teacher = db.users.find(u => u.id === id && u.role === 'teacher');
  if (!teacher) {
    return res.status(404).json({ success: false, message: 'Teacher not found.' });
  }

  if (username && username.trim().toLowerCase() !== teacher.username.toLowerCase()) {
    if (db.users.some(u => u.id !== id && u.username.toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Username is already in use.' });
    }
    teacher.username = username.trim();
  }

  if (phone && phone.trim() !== teacher.phone) {
    if (db.users.some(u => u.id !== id && u.phone === phone.trim())) {
      return res.status(400).json({ success: false, message: 'Phone is already registered by another user.' });
    }
    teacher.phone = phone.trim();
  }

  if (name) teacher.name = name.trim();
  if (password) teacher.passwordHash = password;

  writeDB(db);
  logAudit('teacher_manage', 'Super User', `Updated Teacher: ${teacher.name} (${teacher.username})`);

  return res.json({
    success: true,
    message: 'Teacher details updated successfully!',
    teacher: { id: teacher.id, name: teacher.name, username: teacher.username, phone: teacher.phone }
  });
});

// Remove / Delete teacher
app.delete('/api/superuser/teachers/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const idx = db.users.findIndex(u => u.id === id && u.role === 'teacher');
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Teacher not found.' });
  }

  const removed = db.users.splice(idx, 1)[0];
  writeDB(db);

  logAudit('teacher_manage', 'Super User', `Removed Teacher: ${removed.name} (${removed.username})`);

  return res.json({ success: true, message: `Teacher ${removed.name} removed successfully.` });
});

// Super User Monitoring & Audit Logs
app.get('/api/superuser/audit-logs', (req, res) => {
  const db = readDB();
  const teachersCount = db.users.filter(u => u.role === 'teacher').length;
  return res.json({
    success: true,
    logs: db.auditLogs,
    stats: {
      totalTeachers: teachersCount,
      totalMCQs: db.mcqs.length,
      totalCompletedQuizzes: db.reports.length,
      activeLiveRooms: liveRooms.size
    }
  });
});

// ======================= MCQ & LIVE ROUTES ======================= //

// Get MCQs (Teachers view own, Super User views all)
app.get('/api/mcqs', (req, res) => {
  const teacherId = req.query.teacherId as string;
  const isSuperUser = req.query.role === 'superuser';
  const db = readDB();

  if (isSuperUser) {
    return res.json({ success: true, mcqs: db.mcqs });
  }

  const mcqs = teacherId ? db.mcqs.filter(m => m.teacherId === teacherId) : db.mcqs;
  return res.json({ success: true, mcqs });
});

// Create or Update MCQ
app.post('/api/mcqs', (req, res) => {
  const { id, title, pin, teacherId, teacherName, questions, status } = req.body;

  if (!title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ success: false, message: 'Title and questions are required.' });
  }

  const db = readDB();
  let mcq: MCQAssessment;

  if (id) {
    const index = db.mcqs.findIndex(m => m.id === id);
    if (index !== -1) {
      mcq = {
        ...db.mcqs[index],
        title,
        pin: pin || db.mcqs[index].pin || generatePin(),
        questions,
        status: status || 'completed',
        updatedAt: new Date().toISOString()
      };
      db.mcqs[index] = mcq;
      logAudit('mcq_update', teacherName || 'Teacher', `Updated MCQ: "${title}" (${questions.length} questions)`);
    } else {
      mcq = {
        id,
        title,
        pin: pin || generatePin(),
        teacherId: teacherId || 'usr_teacher',
        teacherName: teacherName || 'Teacher',
        questions,
        status: status || 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.mcqs.push(mcq);
      logAudit('mcq_create', teacherName || 'Teacher', `Created MCQ: "${title}"`);
    }
  } else {
    mcq = {
      id: 'mcq_' + Date.now(),
      title,
      pin: pin || generatePin(),
      teacherId: teacherId || 'usr_teacher',
      teacherName: teacherName || 'Teacher',
      questions,
      status: status || 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.mcqs.push(mcq);
    logAudit('mcq_create', teacherName || 'Teacher', `Created MCQ: "${title}" (PIN: ${mcq.pin})`);
  }

  writeDB(db);
  return res.json({ success: true, mcq, message: 'Assessment saved!' });
});

// Generate Random PIN
app.post('/api/mcqs/:id/generate-pin', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const mcq = db.mcqs.find(m => m.id === id);

  if (!mcq) {
    return res.status(404).json({ success: false, message: 'Assessment not found.' });
  }

  const newPin = generatePin();
  mcq.pin = newPin;
  mcq.updatedAt = new Date().toISOString();
  writeDB(db);

  logAudit('mcq_update', mcq.teacherName, `Generated PIN ${newPin} for "${mcq.title}"`);

  return res.json({ success: true, pin: newPin, message: `New PIN: ${newPin}` });
});

// Copy & Edit (Duplicate)
app.post('/api/mcqs/:id/duplicate', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const original = db.mcqs.find(m => m.id === id);

  if (!original) {
    return res.status(404).json({ success: false, message: 'Assessment not found.' });
  }

  const copy: MCQAssessment = {
    ...JSON.parse(JSON.stringify(original)),
    id: 'mcq_' + Date.now(),
    title: `${original.title} (Copy)`,
    pin: generatePin(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.mcqs.push(copy);
  writeDB(db);

  logAudit('mcq_create', copy.teacherName, `Duplicated "${original.title}"`);

  return res.json({ success: true, mcq: copy, message: 'Duplicated successfully!' });
});

// Delete MCQ
app.delete('/api/mcqs/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.mcqs.findIndex(m => m.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Assessment not found.' });
  }

  const deleted = db.mcqs.splice(index, 1)[0];
  writeDB(db);

  logAudit('mcq_update', deleted.teacherName, `Deleted MCQ: "${deleted.title}"`);

  return res.json({ success: true, message: 'Deleted successfully.' });
});

// Reports API
app.get('/api/reports', (req, res) => {
  const db = readDB();
  return res.json({ success: true, reports: db.reports });
});

// Save Student Completed Quiz Result
app.post('/api/reports', (req, res) => {
  const result: StudentQuizResult = req.body;
  if (!result || !result.assessmentId || !result.studentName) {
    return res.status(400).json({ success: false, message: 'Invalid result.' });
  }

  result.id = result.id || 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  result.completedAt = result.completedAt || new Date().toISOString();

  const db = readDB();
  db.reports.unshift(result);
  writeDB(db);

  logAudit('student_submit', result.studentName, `Completed "${result.assessmentTitle}" - ${result.score}/${result.totalScore}`);

  return res.json({ success: true, report: result });
});

// Live Room Check
app.get('/api/live/check/:pin', (req, res) => {
  const { pin } = req.params;
  const room = liveRooms.get(pin);
  const db = readDB();
  const mcq = db.mcqs.find(m => m.pin === pin);

  if (!room && !mcq) {
    return res.status(404).json({ 
      success: false, 
      message: 'Invalid Live PIN. Verify PIN with teacher.' 
    });
  }

  const assessment = room ? room.assessment : mcq!;
  return res.json({
    success: true,
    isLive: !!room,
    assessment: {
      id: assessment.id,
      title: assessment.title,
      pin: assessment.pin,
      totalQuestions: assessment.questions.length,
      proctoringEnabled: room ? room.proctoringEnabled : true
    }
  });
});

// Start Live Streaming
app.post('/api/live/start', (req, res) => {
  const { assessmentId, shuffleQuestions, startMode, proctoringEnabled, teacherId } = req.body;
  const db = readDB();
  const mcq = db.mcqs.find(m => m.id === assessmentId);

  if (!mcq) {
    return res.status(404).json({ success: false, message: 'Assessment not found.' });
  }

  let finalQuestions = [...mcq.questions];
  if (shuffleQuestions) {
    for (let i = finalQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
    }
  }

  const room: LiveRoom = {
    pin: mcq.pin,
    assessment: {
      ...mcq,
      questions: finalQuestions
    },
    teacherId: teacherId || mcq.teacherId,
    shuffleQuestions: !!shuffleQuestions,
    startMode: startMode || 'immediate',
    proctoringEnabled: proctoringEnabled !== false,
    status: startMode === 'wait_for_students' ? 'lobby' : 'in_progress',
    startedAt: new Date().toISOString(),
    students: new Map()
  };

  liveRooms.set(mcq.pin, room);

  logAudit('live_session', mcq.teacherName, `Live Started PIN: ${mcq.pin}`);

  return res.json({
    success: true,
    room: {
      pin: room.pin,
      title: room.assessment.title,
      shuffleQuestions: room.shuffleQuestions,
      startMode: room.startMode,
      proctoringEnabled: room.proctoringEnabled,
      status: room.status,
      totalQuestions: room.assessment.questions.length
    }
  });
});

// End Live Streaming
app.post('/api/live/:pin/end', (req, res) => {
  const { pin } = req.params;
  const room = liveRooms.get(pin);

  if (room) {
    room.students.forEach(student => {
      if (student.ws && student.ws.readyState === WebSocket.OPEN) {
        student.ws.send(JSON.stringify({
          type: 'live_ended',
          message: 'Teacher concluded live session.'
        }));
      }
    });
    liveRooms.delete(pin);
    logAudit('live_session', 'Teacher', `Ended Live PIN: ${pin}`);
  }

  return res.json({ success: true, message: 'Live session ended.' });
});

// ======================= REAL-TIME WEBSOCKET SERVER ======================= //

wss.on('connection', (ws: WebSocket) => {
  let userPin: string | null = null;
  let userType: 'teacher' | 'student' | null = null;
  let studentId: string | null = null;

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      // 1. Teacher Connect
      if (data.type === 'teacher_join') {
        userType = 'teacher';
        userPin = data.pin;
        let room = liveRooms.get(data.pin);
        if (room) {
          room.teacherWs = ws;
          broadcastRoomState(room);
        }
      }

      // 2. Student Join from any location/device
      else if (data.type === 'student_join') {
        userType = 'student';
        userPin = data.pin;
        const currentStudentId: string = data.student.id || 'stud_' + Date.now();
        studentId = currentStudentId;
        
        let room = liveRooms.get(data.pin);
        if (!room) {
          const db = readDB();
          const mcq = db.mcqs.find(m => m.pin === data.pin);
          if (mcq) {
            room = {
              pin: mcq.pin,
              assessment: mcq,
              teacherId: mcq.teacherId,
              shuffleQuestions: false,
              startMode: 'immediate',
              proctoringEnabled: true,
              status: 'in_progress',
              students: new Map()
            };
            liveRooms.set(data.pin, room);
          }
        }

        if (room) {
          const liveStudent: LiveStudent = {
            id: currentStudentId,
            name: data.student.name,
            schoolName: data.student.schoolName || '',
            email: data.student.email || '',
            joinedAt: new Date().toISOString(),
            score: 0,
            currentQuestionIndex: 0,
            answersCount: 0,
            status: 'active',
            proctorAlertsCount: 0,
            ws
          };
          room.students.set(currentStudentId, liveStudent);

          ws.send(JSON.stringify({
            type: 'joined_success',
            assessment: room.assessment,
            proctoringEnabled: room.proctoringEnabled,
            roomStatus: room.status
          }));

          logAudit('live_session', data.student.name, `Student joined PIN: ${data.pin}`);
          broadcastRoomState(room);
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Live session not found.'
          }));
        }
      }

      // 3. Teacher Start Quiz
      else if (data.type === 'teacher_start_quiz') {
        if (userPin && liveRooms.has(userPin)) {
          const room = liveRooms.get(userPin)!;
          room.status = 'in_progress';
          broadcastRoomState(room);
        }
      }

      // 4. Student Live Answer Responds - Instantly Syncs to Teacher
      else if (data.type === 'submit_answer') {
        if (userPin && studentId && liveRooms.has(userPin)) {
          const room = liveRooms.get(userPin)!;
          const student = room.students.get(studentId);
          if (student) {
            const { pointsEarned, questionIndex, selectedOptionId, isCorrect } = data;
            student.score += (pointsEarned || 0);
            student.answersCount += 1;
            student.lastSelectedOption = selectedOptionId;
            student.currentQuestionIndex = (questionIndex ?? student.currentQuestionIndex) + 1;
            
            // Instantly notify teacher with detailed live response
            if (room.teacherWs && room.teacherWs.readyState === WebSocket.OPEN) {
              room.teacherWs.send(JSON.stringify({
                type: 'student_live_response',
                studentId: student.id,
                studentName: student.name,
                schoolName: student.schoolName,
                questionIndex: questionIndex ?? 0,
                selectedOptionId,
                isCorrect: !!isCorrect,
                pointsEarned: pointsEarned || 0,
                totalScore: student.score,
                timestamp: new Date().toISOString()
              }));
            }

            broadcastRoomState(room);
          }
        }
      }

      // 5. Proctor Alert
      else if (data.type === 'proctor_alert') {
        if (userPin && studentId && liveRooms.has(userPin)) {
          const room = liveRooms.get(userPin)!;
          const student = room.students.get(studentId);
          if (student) {
            student.proctorAlertsCount += 1;
            logAudit('student_proctor', student.name, `Proctor Alert (${data.reason}) in PIN: ${userPin}`);
            
            if (room.teacherWs && room.teacherWs.readyState === WebSocket.OPEN) {
              room.teacherWs.send(JSON.stringify({
                type: 'student_proctor_warning',
                studentId: student.id,
                studentName: student.name,
                reason: data.reason,
                count: student.proctorAlertsCount
              }));
            }
          }
        }
      }

      // 6. Teacher Remote Action: Pause, Resume, or End Quiz with "meet your teacher"
      else if (data.type === 'teacher_student_control') {
        const { targetStudentId, action } = data;
        if (userPin && liveRooms.has(userPin)) {
          const room = liveRooms.get(userPin)!;
          const student = room.students.get(targetStudentId);
          if (student && student.ws && student.ws.readyState === WebSocket.OPEN) {
            if (action === 'pause') {
              student.status = 'paused';
              student.ws.send(JSON.stringify({
                type: 'quiz_paused_by_teacher',
                message: 'Quiz paused by teacher.'
              }));
            } else if (action === 'resume') {
              student.status = 'active';
              student.ws.send(JSON.stringify({
                type: 'quiz_resumed_by_teacher',
                message: 'Quiz resumed by teacher.'
              }));
            } else if (action === 'end_quiz') {
              student.status = 'ended';
              student.ws.send(JSON.stringify({
                type: 'quiz_force_ended',
                message: 'meet your teacher'
              }));
            }
            broadcastRoomState(room);
          }
        }
      }

    } catch (err) {
      console.error('WebSocket parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (userPin && userType === 'student' && studentId && liveRooms.has(userPin)) {
      const room = liveRooms.get(userPin)!;
      broadcastRoomState(room);
    }
  });
});

function broadcastRoomState(room: LiveRoom) {
  const studentList = Array.from(room.students.values()).map(s => ({
    id: s.id,
    name: s.name,
    schoolName: s.schoolName,
    email: s.email,
    score: s.score,
    currentQuestionIndex: s.currentQuestionIndex,
    answersCount: s.answersCount,
    lastSelectedOption: s.lastSelectedOption,
    status: s.status,
    proctorAlertsCount: s.proctorAlertsCount
  })).sort((a, b) => b.score - a.score);

  const payload = JSON.stringify({
    type: 'room_update',
    pin: room.pin,
    status: room.status,
    totalQuestions: room.assessment.questions.length,
    studentsCount: studentList.length,
    leaderboard: studentList
  });

  if (room.teacherWs && room.teacherWs.readyState === WebSocket.OPEN) {
    room.teacherWs.send(payload);
  }

  room.students.forEach(s => {
    if (s.ws && s.ws.readyState === WebSocket.OPEN) {
      s.ws.send(payload);
    }
  });
}

// Start Server
async function startServer() {
  const PORT = process.env.PORT || 3000;

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, () => {
    console.log(`SMART LEARN active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
