import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { UserAccount } from '../types';

interface TeacherAuthModalProps {
  onSuccess: (user: UserAccount) => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>('login');

  // Form Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Forgot password new password
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any = null;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // 1. Request OTP (Signup)
  const handleRequestSignupOtp = async () => {
    resetMessages();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setErrorMsg('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/teacher/signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'signup' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch OTP');
      }

      setOtpSent(true);
      setOtpTimer(60);
      setSuccessMsg(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'OTP dispatch network error.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Signup with OTP
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!otpSent || !otp.trim()) {
      setErrorMsg('Please request and enter the OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/teacher/verify-otp-and-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, phone, otp: otp.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Signup failed');
      }

      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        setTab('login');
        setOtpSent(false);
        setOtp('');
        resetMessages();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // 3. Teacher / Super User Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      onSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Request Forgot Password OTP
  const handleRequestForgotOtp = async () => {
    resetMessages();
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setErrorMsg('Enter your 10-digit registered Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/teacher/forgot-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch OTP');
      }

      setOtpSent(true);
      setOtpTimer(60);
      setSuccessMsg(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not verify registered phone.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Submit Forgot Password Reset
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!otp.trim() || !newPassword) {
      setErrorMsg('Please enter OTP and new password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/teacher/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otp.trim(), newPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Password reset failed');
      }

      setSuccessMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        setTab('login');
        setOtpSent(false);
        setOtp('');
        setPassword('');
        resetMessages();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Password update failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-auto py-6 px-4">
      <div className="effect-8d-card rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-indigo-950/95 via-purple-950/95 to-slate-950/95 border-2 border-fuchsia-500/60 shadow-[0_0_50px_rgba(217,70,239,0.35)]">
        
        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-[2px] mx-auto mb-3 shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-yellow-300" />
            </div>
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
            SMART LEARN PORTAL
          </h1>
        </div>

        {/* Tab Switcher: Login / Signup */}
        {tab !== 'forgot' && (
          <div className="flex rounded-2xl p-1 bg-indigo-950/80 border-2 border-purple-500/40 mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); resetMessages(); }}
              className={`btn-8d flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-yellow-200 border-2 border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                  : 'text-cyan-300 hover:text-yellow-200'
              }`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); resetMessages(); }}
              className={`btn-8d flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                tab === 'signup'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-yellow-200 border-2 border-cyan-400 shadow-[0_0_15px_rgba(45,212,191,0.5)]'
                  : 'text-pink-300 hover:text-yellow-200'
              }`}
            >
              SIGN UP
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-300 text-xs font-black flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-950/90 border-2 border-emerald-400 text-emerald-300 text-xs font-black flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ===================== TAB: LOGIN ===================== */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-cyan-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-amber-400" />
                <input
                  type="text"
                  required
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-8d w-full pl-11 pr-4 py-3.5 rounded-2xl text-yellow-200 font-bold text-sm placeholder-purple-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-pink-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-pink-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-8d w-full pl-11 pr-12 py-3.5 rounded-2xl text-pink-200 font-bold text-sm placeholder-purple-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3.5 my-auto text-cyan-300 hover:text-yellow-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => { setTab('forgot'); resetMessages(); }}
                className="text-xs font-extrabold text-amber-300 hover:text-yellow-200 underline"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-8d w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-yellow-200 font-black text-sm uppercase tracking-widest border-2 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.5)] flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'AUTHENTICATING...' : 'ENTER PORTAL'}</span>
              <ArrowRight className="w-5 h-5 text-yellow-300" />
            </button>
          </form>
        )}

        {/* ===================== TAB: SIGNUP ===================== */}
        {tab === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-cyan-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-cyan-400" />
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-8d w-full pl-11 pr-4 py-3 rounded-2xl text-cyan-200 font-bold text-sm placeholder-purple-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1.5">
                Unique Username
              </label>
              <div className="relative">
                <User className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-amber-400" />
                <input
                  type="text"
                  required
                  placeholder="Create unique username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="input-8d w-full pl-11 pr-4 py-3 rounded-2xl text-amber-200 font-bold text-sm placeholder-purple-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-pink-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-pink-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Create strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-8d w-full pl-11 pr-12 py-3 rounded-2xl text-pink-200 font-bold text-sm placeholder-purple-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3.5 my-auto text-cyan-300 hover:text-yellow-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-emerald-300 mb-1.5">
                Mobile Number (10 Digits)
              </label>
              <div className="relative">
                <Phone className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-emerald-400" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input-8d w-full pl-11 pr-4 py-3 rounded-2xl text-emerald-200 font-bold text-sm placeholder-purple-400 font-mono"
                />
              </div>

              {phone.length === 10 && !otpSent && (
                <button
                  type="button"
                  onClick={handleRequestSignupOtp}
                  disabled={loading}
                  className="btn-8d mt-2.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-yellow-300 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
                >
                  {loading ? 'DISPATCHING...' : 'GET OTP VIA TELECOM'}
                </button>
              )}
            </div>

            {otpSent && (
              <div className="p-3.5 rounded-2xl bg-indigo-950/80 border-2 border-cyan-400 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-cyan-300">
                    Enter Received OTP
                  </label>
                  {otpTimer > 0 ? (
                    <span className="text-[11px] font-mono font-black text-amber-300">
                      Resend in {otpTimer}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestSignupOtp}
                      className="text-[11px] font-black text-pink-300 hover:text-yellow-200 flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Resend OTP</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="6-DIGIT OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-8d w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-2 rounded-xl text-yellow-300 border-2 border-cyan-400"
                />

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn-8d w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-yellow-200 font-black text-xs uppercase tracking-widest border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                >
                  {loading ? 'VERIFYING...' : 'SUBMIT & COMPLETE REGISTRATION'}
                </button>
              </div>
            )}
          </form>
        )}

        {/* ===================== TAB: FORGOT PASSWORD ===================== */}
        {tab === 'forgot' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-amber-300 mb-1.5">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-amber-400" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="Enter 10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="input-8d w-full pl-11 pr-4 py-3 rounded-2xl text-amber-200 font-bold text-sm placeholder-purple-400 font-mono"
                />
              </div>

              {phone.length === 10 && !otpSent && (
                <button
                  type="button"
                  onClick={handleRequestForgotOtp}
                  disabled={loading}
                  className="btn-8d mt-2.5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider border-2 border-amber-300"
                >
                  {loading ? 'SENDING...' : 'GET RECOVERY OTP'}
                </button>
              )}
            </div>

            {otpSent && (
              <>
                <div>
                  <label className="block text-xs font-extrabold uppercase text-cyan-300 mb-1.5">
                    Recovery OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="ENTER 6-DIGIT OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-8d w-full text-center tracking-[0.4em] font-mono text-2xl font-black py-2 rounded-xl text-yellow-300 border-2 border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-pink-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute inset-y-0 left-3.5 my-auto w-5 h-5 text-pink-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-8d w-full pl-11 pr-12 py-3 rounded-2xl text-pink-200 font-bold text-sm placeholder-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-3.5 my-auto text-cyan-300 hover:text-yellow-300 focus:outline-none"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || !newPassword}
                  className="btn-8d w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-yellow-200 font-black text-xs uppercase tracking-widest border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                >
                  {loading ? 'UPDATING...' : 'RESET PASSWORD & LOGIN'}
                </button>
              </>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setTab('login'); resetMessages(); }}
                className="text-xs font-bold text-teal-300 hover:text-yellow-300 underline"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
