import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import {
  Mail, Lock, Eye, EyeOff, User,
  AlertCircle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ── Floating Particles (isolated micro-component) ──────────────────────────
const FloatingParticles = () => {
  const particles = [
    { size: 12, left: '10%', top: '20%', delay: 0, duration: 8 },
    { size: 16, left: '30%', top: '60%', delay: 2, duration: 10 },
    { size: 10, left: '70%', top: '30%', delay: 4, duration: 7 },
    { size: 14, left: '85%', top: '75%', delay: 1, duration: 9 },
    { size: 8, left: '50%', top: '45%', delay: 3, duration: 6 },
    { size: 12, left: '20%', top: '85%', delay: 5, duration: 8 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-[#574a7d]"
          style={{
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            opacity: 0.1,
          }}
          animate={{ y: [-10, 10, -10] }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
};

// ── Geometric Watermark SVG ────────────────────────────────────────────────
const NodeWatermark = () => (
  <svg
    viewBox="0 0 200 200"
    className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-[0.03] pointer-events-none"
    style={{ transform: 'translate(30%, 30%)' }}
  >
    <circle cx="50" cy="50" r="8" stroke="#574a7d" strokeWidth="1.5" fill="none" />
    <circle cx="150" cy="50" r="8" stroke="#574a7d" strokeWidth="1.5" fill="none" />
    <circle cx="50" cy="150" r="8" stroke="#574a7d" strokeWidth="1.5" fill="none" />
    <circle cx="150" cy="150" r="8" stroke="#574a7d" strokeWidth="1.5" fill="none" />
    <circle cx="100" cy="100" r="6" stroke="#574a7d" strokeWidth="1.5" fill="none" />
    <line x1="58" y1="50" x2="142" y2="50" stroke="#574a7d" strokeWidth="1" />
    <line x1="50" y1="58" x2="50" y2="142" stroke="#574a7d" strokeWidth="1" />
    <line x1="58" y1="150" x2="142" y2="150" stroke="#574a7d" strokeWidth="1" />
    <line x1="150" y1="58" x2="150" y2="142" stroke="#574a7d" strokeWidth="1" />
    <line x1="57" y1="57" x2="93" y2="93" stroke="#574a7d" strokeWidth="1" />
    <line x1="143" y1="57" x2="107" y2="93" stroke="#574a7d" strokeWidth="1" />
    <line x1="57" y1="143" x2="93" y2="107" stroke="#574a7d" strokeWidth="1" />
    <line x1="143" y1="143" x2="107" y2="107" stroke="#574a7d" strokeWidth="1" />
  </svg>
);

// ── Logo ───────────────────────────────────────────────────────────────────
const LogoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="8" cy="8" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <circle cx="24" cy="8" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <circle cx="8" cy="24" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <circle cx="24" cy="24" r="3" stroke="#574a7d" strokeWidth="2" fill="none" />
    <line x1="11" y1="8" x2="21" y2="8" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="8" y1="11" x2="8" y2="21" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="11" y1="24" x2="21" y2="24" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="24" y1="11" x2="24" y2="21" stroke="#574a7d" strokeWidth="1.5" />
    <line x1="10.1" y1="10.1" x2="21.9" y2="21.9" stroke="#574a7d" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="2" fill="#574a7d" />
  </svg>
);

// ── Auth Input Component ───────────────────────────────────────────────────
interface AuthInputProps {
  label: string;
  type?: string;
  placeholder: string;
  icon: React.ReactNode;
  rightIcon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onToggleVisibility?: () => void;
  error?: string;
  delay?: number;
}

const AuthInput = ({
  label, type = 'text', placeholder, icon, rightIcon,
  value, onChange, error, delay = 0
}: AuthInputProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3, ease: easeOutExpo }}
    className="mt-5"
  >
    <label className="block font-body font-medium text-[14px] text-[#333333] mb-2">
      {label}
    </label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9A9A]">
        {icon}
      </div>
      <input
        type={type}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-12 bg-white border rounded-[10px] pl-12 pr-12 font-body text-[15px] text-[#12101A] placeholder:text-[#9A9A9A] transition-all duration-200 focus:outline-none ${
          error
            ? 'border-[#D4524A] focus:border-[#D4524A] focus:shadow-[0_0_0_3px_rgba(212,82,74,0.1)]'
            : 'border-[#D9D9D3] focus:border-[#574a7d] focus:shadow-[0_0_0_3px_rgba(90,143,94,0.1)]'
        }`}
      />
      {rightIcon && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9A9A9A] cursor-pointer">
          {rightIcon}
        </div>
      )}
    </div>
    {error && (
      <p className="mt-1.5 text-[13px] text-[#D4524A] font-body flex items-center gap-1">
        <AlertCircle size={14} /> {error}
      </p>
    )}
  </motion.div>
);

// ── Password Strength Indicator ────────────────────────────────────────────
const PasswordStrength = ({ password }: { password: string }) => {
  const getStrength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strength = getStrength(password);
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#D4524A', '#E8A838', '#4A90D9', '#574a7d'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= strength ? colors[strength - 1] : '#ECEBF5',
            }}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] font-mono font-medium uppercase" style={{ color: colors[strength - 1] }}>
        {labels[strength - 1]}
      </p>
    </div>
  );
};

// ── Toast notification ─────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }: { message: string; type: 'error' | 'success'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-[14px] font-body ${
        type === 'error'
          ? 'bg-[rgba(212,82,74,0.08)] border-[rgba(212,82,74,0.2)] text-[#D4524A]'
          : 'bg-[rgba(90,143,94,0.08)] border-[rgba(90,143,94,0.2)] text-[#574a7d]'
      }`}
    >
      <AlertCircle size={16} />
      {message}
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN AUTH PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Auth() {
  const navigate = useNavigate();
  const { loginWithGitHub, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/account');
    }
  }, [isAuthenticated, navigate]);

  const validateEmail = (val: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  };

  // Email/password sign-in isn't shipped yet — only GitHub OAuth works today.
  // The form validates inputs so users see helpful feedback, but submission
  // surfaces a clear "use GitHub" message instead of pretending to work.
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!email || !validateEmail(email)) newErrors.signinEmail = 'Please enter a valid email address';
    if (!password || password.length < 6) newErrors.signinPassword = 'Password must be at least 6 characters';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setToast({
      message: 'Email sign-in is coming soon. Continue with GitHub for now.',
      type: 'error',
    });
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email || !validateEmail(email)) newErrors.signupEmail = 'Please enter a valid email address';
    if (!password || password.length < 8) newErrors.signupPassword = 'Password must be at least 8 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!agreedToTerms) {
      setToast({ message: 'Please agree to the Terms of Service and Privacy Policy.', type: 'error' });
      return;
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setToast({
      message: 'Email sign-up is coming soon. Continue with GitHub for now.',
      type: 'error',
    });
  };

  // ── Left Panel ───────────────────────────────────────────────────────────
  const LeftPanel = () => (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: easeOutExpo }}
      className="hidden sm:flex w-[45%] lg:w-[45%] md:w-[40%] h-screen bg-[#12101A] relative flex-col justify-between p-12 overflow-hidden"
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(90,143,94,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(90,143,94,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <FloatingParticles />
      <NodeWatermark />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Link to="/" className="flex items-center gap-3 relative z-10">
          <LogoIcon />
          <span className="font-heading font-semibold text-[22px] text-white">TestForge</span>
        </Link>
      </motion.div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center -mt-8">
        <motion.h2
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: easeOutExpo }}
          className="font-heading font-semibold text-[36px] text-white leading-[1.2] tracking-[-0.015em]"
        >
          Ship code with<br />total confidence.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-4 text-[16px] text-[#9A9A9A] font-body max-w-[360px]"
        >
          Join 2,500+ teams who test smarter, not harder.
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease: easeOutExpo }}
          className="flex gap-10 mt-12"
        >
          {[
            { value: 100, suffix: 'K+', label: 'Tests Run' },
            { value: 99.2, suffix: '%', label: 'Accuracy', decimals: 1 },
            { value: 2, prefix: '< ', suffix: 'min', label: 'Avg Setup' },
          ].map((stat, i) => (
            <div key={i}>
              <div className="font-heading font-bold text-[28px] text-[#7a6fad]">
                {stat.prefix || ''}
                <CountUp end={stat.value} duration={1.5} decimals={stat.decimals || 0} />
                {stat.suffix}
              </div>
              <div className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A] tracking-[0.08em] mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Testimonial */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="mt-12 max-w-[380px]"
        >
          <p className="text-[15px] text-white/70 font-body italic leading-[1.65]">
            &ldquo;TestForge caught a critical SQL injection in our checkout flow that somehow made it through 3 code reviews. Absolutely essential tool.&rdquo;
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#574a7d] to-[#7a6fad] flex items-center justify-center text-white text-[13px] font-semibold">
              MC
            </div>
            <div>
              <p className="text-[14px] text-white font-medium font-body">Marcus Chen</p>
              <p className="text-[13px] text-[#9A9A9A] font-body">CTO, CommerceStack</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.4 }}
        className="relative z-10 text-[13px] text-[#9A9A9A] font-body"
      >
        &copy; 2026 TestForge. All rights reserved.
      </motion.p>
    </motion.div>
  );

  // ── Right Panel ──────────────────────────────────────────────────────────
  const RightPanel = () => (
    <div className="flex-1 h-screen bg-white flex flex-col justify-center px-6 sm:px-12 overflow-y-auto">
      <div className="max-w-[440px] mx-auto w-full py-12">
        {/* Mobile logo */}
        <div className="sm:hidden flex items-center gap-3 mb-6">
          <LogoIcon />
          <span className="font-heading font-semibold text-[18px] text-[#12101A]">TestForge</span>
        </div>

        {/* Tab Switcher */}
        <div className="flex">
          {(['signin', 'signup'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setErrors({});
                setToast(null);
              }}
              className={`flex-1 pb-3 text-center font-body font-medium text-[15px] border-b-2 transition-all duration-200 ${
                tab === t
                  ? 'text-[#574a7d] border-[#574a7d]'
                  : 'text-[#9A9A9A] border-transparent hover:text-[#333333] hover:border-[#D9D9D3]'
              }`}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <div className="mt-4">
              <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            </div>
          )}
        </AnimatePresence>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {tab === 'signin' ? (
            <motion.form
              key="signin"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              onSubmit={handleSignIn}
              className="mt-6"
            >
              <AuthInput
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                icon={<Mail size={18} />}
                value={email}
                onChange={setEmail}
                error={errors.signinEmail}
                delay={0}
              />
              <AuthInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                icon={<Lock size={18} />}
                rightIcon={
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                value={password}
                onChange={setPassword}
                error={errors.signinPassword}
                delay={0.05}
              />

              {/* Remember me + forgot */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="flex items-center justify-between mt-5"
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setRememberMe(!rememberMe)}
                    role="checkbox"
                    aria-checked={rememberMe}
                    aria-label="Remember me"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRememberMe(!rememberMe); } }}
                    className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      rememberMe
                        ? 'bg-[#574a7d] border-[#574a7d]'
                        : 'border-[#D9D9D3] bg-white'
                    }`}
                  >
                    {rememberMe && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <span className="text-[14px] text-[#6B6B6B] font-body">Remember me</span>
                </label>
                <button type="button" className="text-[13px] text-[#574a7d] font-medium font-body hover:underline">
                  Forgot password?
                </button>
              </motion.div>

              {/* Submit */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] mt-6 bg-[#574a7d] text-white font-body font-medium text-[16px] rounded-[10px] hover:bg-[#4a3d6b] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-80 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </motion.button>

              {/* Divider */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="flex items-center gap-4 mt-6"
              >
                <div className="flex-1 h-px bg-[#D9D9D3]" />
                <span className="text-[13px] text-[#9A9A9A] font-body">or continue with</span>
                <div className="flex-1 h-px bg-[#D9D9D3]" />
              </motion.div>

              {/* GitHub */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                type="button"
                className="w-full h-12 mt-4 bg-white border border-[#D9D9D3] rounded-[10px] flex items-center justify-center gap-3 text-[#333333] font-body font-medium text-[15px] hover:bg-[#F7F7FB] hover:border-[#a39fd4] active:scale-[0.99] transition-all duration-200"
                onClick={loginWithGitHub}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Continue with GitHub
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              onSubmit={handleSignUp}
              className="mt-6"
            >
              <AuthInput
                label="Full Name"
                placeholder="Jane Smith"
                icon={<User size={18} />}
                value={name}
                onChange={setName}
                error={errors.name}
                delay={0}
              />
              <AuthInput
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                icon={<Mail size={18} />}
                value={email}
                onChange={setEmail}
                error={errors.signupEmail}
                delay={0.05}
              />
              <AuthInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                icon={<Lock size={18} />}
                rightIcon={
                  <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                value={password}
                onChange={setPassword}
                error={errors.signupPassword}
                delay={0.1}
              />
              <PasswordStrength password={password} />
              <AuthInput
                label="Confirm Password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                icon={<Lock size={18} />}
                rightIcon={
                  <button type="button" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                value={confirmPassword}
                onChange={setConfirmPassword}
                error={errors.confirmPassword}
                delay={0.15}
              />
              {confirmPassword && password === confirmPassword && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 mt-1 text-[#574a7d] text-[13px] font-body"
                >
                  <CheckCircle2 size={14} /> Passwords match
                </motion.div>
              )}

              {/* Terms */}
              <motion.label
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="flex items-center gap-3 mt-5 cursor-pointer"
              >
                <div
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  role="checkbox"
                  aria-checked={agreedToTerms}
                  aria-label="I agree to the Terms of Service and Privacy Policy"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAgreedToTerms(!agreedToTerms); } }}
                  className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all duration-200 cursor-pointer flex-shrink-0 ${
                    agreedToTerms
                      ? 'bg-[#574a7d] border-[#574a7d]'
                      : 'border-[#D9D9D3] bg-white'
                  }`}
                >
                  {agreedToTerms && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className="text-[14px] text-[#6B6B6B] font-body">
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[#574a7d] hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#574a7d] hover:underline">Privacy Policy</Link>
                </span>
              </motion.label>

              {/* Submit */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] mt-6 bg-[#574a7d] text-white font-body font-medium text-[16px] rounded-[10px] hover:bg-[#4a3d6b] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-80 flex items-center justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Create Account'
                )}
              </motion.button>

              {/* Divider */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="flex items-center gap-4 mt-6"
              >
                <div className="flex-1 h-px bg-[#D9D9D3]" />
                <span className="text-[13px] text-[#9A9A9A] font-body">or continue with</span>
                <div className="flex-1 h-px bg-[#D9D9D3]" />
              </motion.div>

              {/* GitHub */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.3 }}
                type="button"
                className="w-full h-12 mt-4 bg-white border border-[#D9D9D3] rounded-[10px] flex items-center justify-center gap-3 text-[#333333] font-body font-medium text-[15px] hover:bg-[#F7F7FB] hover:border-[#a39fd4] active:scale-[0.99] transition-all duration-200"
                onClick={loginWithGitHub}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Continue with GitHub
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full">
      <LeftPanel />
      <RightPanel />
    </div>
  );
}
