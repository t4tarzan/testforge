import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import {
  LayoutDashboard, FlaskConical, GitBranch, KeyRound,
  Users, CreditCard, Settings, LogOut, Menu,
  HelpCircle, Zap, Play, FileText, ArrowRight,
  MoreHorizontal, Eye, Download, Search, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Plus, Copy,
  Check, UserPlus, FileDown, TrendingUp,
  TrendingDown, CheckCircle2
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import {
  MOCK_USER, MOCK_TEST_HISTORY, MOCK_API_KEYS,
  MOCK_TEAM_MEMBERS, MOCK_USAGE_DATA, MOCK_INVOICES, MOCK_REPOS,
} from '@/data/seedData';

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ── Logo ───────────────────────────────────────────────────────────────────
const LogoIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
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

// ── Status Badge ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-[#E8E5FF]', text: 'text-[#574a7d]', label: 'PASS' },
    passed: { bg: 'bg-[#E8E5FF]', text: 'text-[#574a7d]', label: 'PASS' },
    failed: { bg: 'bg-[rgba(212,82,74,0.1)]', text: 'text-[#D4524A]', label: 'FAIL' },
    warning: { bg: 'bg-[rgba(232,168,56,0.1)]', text: 'text-[#E8A838]', label: 'WARN' },
    active: { bg: 'bg-[#E8E5FF]', text: 'text-[#574a7d]', label: 'ACTIVE' },
    inactive: { bg: 'bg-[#F7F7FB]', text: 'text-[#9A9A9A]', label: 'INACTIVE' },
    running: { bg: 'bg-[rgba(232,168,56,0.1)]', text: 'text-[#E8A838]', label: 'RUNNING' },
    pending: { bg: 'bg-[rgba(154,154,154,0.1)]', text: 'text-[#9A9A9A]', label: 'PENDING' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-[4px] font-mono font-medium text-[12px] uppercase ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ── Score Color ────────────────────────────────────────────────────────────
const scoreColor = (s: number) => {
  if (s >= 80) return 'text-[#574a7d]';
  if (s >= 50) return 'text-[#E8A838]';
  return 'text-[#D4524A]';
};

// ── Sidebar nav items ──────────────────────────────────────────────────────
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'test-runs', label: 'Test Runs', icon: FlaskConical },
  { id: 'repos', label: 'Repositories', icon: GitBranch },
  { id: 'api-keys', label: 'API Keys', icon: KeyRound },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = typeof navItems[number]['id'];

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function DashboardTab() {
  const navigate = useNavigate();
  const user = MOCK_USER;

  const stats = [
    { icon: FlaskConical, iconBg: 'bg-[#E8E5FF]', iconColor: 'text-[#574a7d]', value: 2847, label: 'TOTAL TESTS RUN', trend: '+12.5%', trendUp: true },
    { icon: CheckCircle2, iconBg: 'bg-[rgba(90,143,94,0.1)]', iconColor: 'text-[#574a7d]', value: 87.3, label: 'PASS RATE', trend: '+3.2%', trendUp: true, suffix: '%', decimals: 1 },
    { icon: GitBranch, iconBg: 'bg-[rgba(74,144,217,0.1)]', iconColor: 'text-[#4A90D9]', value: 12, label: 'ACTIVE REPOSITORIES', trend: '+2', trendUp: true },
    { icon: Zap, iconBg: 'bg-[rgba(232,168,56,0.1)]', iconColor: 'text-[#E8A838]', value: 1250, label: 'CREDITS REMAINING', trend: '-18%', trendUp: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: easeOutExpo }}
    >
      {/* Welcome Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-heading font-medium text-[28px] text-[#12101A] tracking-[-0.01em]">
            Welcome back, {user.name.split(' ')[0]}
          </h2>
          <p className="text-[16px] text-[#6B6B6B] font-body mt-1">
            Here&apos;s what&apos;s happening with your testing infrastructure.
          </p>
        </div>
        <p className="hidden md:block font-mono text-[13px] text-[#9A9A9A]">
          January 15, 2026
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: easeOutExpo }}
            className="bg-white border border-[#D9D9D3] rounded-[12px] p-6 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-[10px] ${s.iconBg} flex items-center justify-center`}>
                <s.icon size={20} className={s.iconColor} />
              </div>
              <MoreHorizontal size={16} className="text-[#9A9A9A] cursor-pointer" />
            </div>
            <div className="mt-4">
              <div className="font-heading font-bold text-[32px] text-[#12101A]">
                <CountUp end={s.value} duration={1} decimals={s.decimals || 0} suffix={s.suffix || ''} />
              </div>
              <div className="font-mono font-medium text-[12px] uppercase text-[#6B6B6B] tracking-[0.08em] mt-1">
                {s.label}
              </div>
              <div className="flex items-center gap-1 mt-2">
                {s.trendUp ? <TrendingUp size={14} className="text-[#574a7d]" /> : <TrendingDown size={14} className="text-[#E8A838]" />}
                <span className={`text-[13px] font-medium font-body ${s.trendUp ? 'text-[#574a7d]' : 'text-[#E8A838]'}`}>
                  {s.trend}
                </span>
                <span className="text-[12px] text-[#9A9A9A] font-body">vs last month</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {[
          { icon: Play, iconBg: 'bg-[#574a7d]', iconColor: 'text-white', title: 'Start New Test', subtitle: 'Run a full test suite on any repository', action: () => navigate('/run-test') },
          { icon: GitBranch, iconBg: 'bg-[#12101A]', iconColor: 'text-white', title: 'Connect Repository', subtitle: 'Link a new Git repo to TestForge', action: () => {} },
          { icon: FileText, iconBg: 'bg-[rgba(74,144,217,0.1)]', iconColor: 'text-[#4A90D9]', title: 'View Reports', subtitle: 'Browse and export past test reports', action: () => navigate('/account?tab=test-runs') },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.3, ease: easeOutExpo }}
            onClick={card.action}
            className="bg-white border border-[#D9D9D3] rounded-[12px] p-5 flex items-center gap-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-[#a39fd4] transition-all duration-300"
          >
            <div className={`w-11 h-11 rounded-[12px] ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
              <card.icon size={20} className={card.iconColor} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-[15px] text-[#333333] font-body">{card.title}</p>
              <p className="text-[13px] text-[#6B6B6B] font-body">{card.subtitle}</p>
            </div>
            <ArrowRight size={16} className="text-[#9A9A9A]" />
          </motion.div>
        ))}
      </div>

      {/* Recent Test Runs */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono font-medium text-[12px] uppercase text-[#574a7d] tracking-[0.08em]">
            RECENT TEST RUNS
          </span>
          <button
            onClick={() => navigate('/account?tab=test-runs')}
            className="text-[14px] text-[#574a7d] font-medium font-body hover:underline"
          >
            View All →
          </button>
        </div>
        <div className="bg-white border border-[#D9D9D3] rounded-[12px] overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-[#F7F7FB] font-mono font-medium text-[12px] uppercase text-[#6B6B6B]">
            <span>Repository</span>
            <span>Branch</span>
            <span>Date</span>
            <span className="text-center">Status</span>
            <span className="text-center">Score</span>
            <span className="text-right">Actions</span>
          </div>
          {MOCK_TEST_HISTORY.slice(0, 5).map((run, i) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-[#D9D9D3] items-center hover:bg-[#F7F7FB] transition-colors"
            >
              <span className="text-[14px] text-[#333333] font-body">{run.repo}</span>
              <span className="text-[14px] text-[#6B6B6B] font-body">{run.branch}</span>
              <span className="text-[14px] text-[#6B6B6B] font-body">{run.date}</span>
              <span className="text-center"><StatusBadge status={run.status} /></span>
              <span className={`text-center text-[14px] font-semibold font-body ${scoreColor(run.score)}`}>
                {run.score}/100
              </span>
              <div className="flex items-center justify-end gap-2">
                <button className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB] transition-colors">
                  <Eye size={16} className="text-[#6B6B6B]" />
                </button>
                <button className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB] transition-colors">
                  <Download size={16} className="text-[#6B6B6B]" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Usage Chart */}
      <div className="mt-8 pb-8">
        <span className="font-mono font-medium text-[12px] uppercase text-[#574a7d] tracking-[0.08em]">
          TEST RUNS — LAST 30 DAYS
        </span>
        <div className="bg-white border border-[#D9D9D3] rounded-[12px] p-6 mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={MOCK_USAGE_DATA}>
              <defs>
                <linearGradient id="sageArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#574a7d" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#574a7d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5DF" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#9A9A9A' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#9A9A9A' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #D9D9D3',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'Inter',
                }}
              />
              <Area
                type="monotone"
                dataKey="runs"
                stroke="#574a7d"
                strokeWidth={2}
                fill="url(#sageArea)"
                dot={{ r: 3, fill: '#574a7d' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: TEST RUNS
// ═══════════════════════════════════════════════════════════════════════════
function TestRunsTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = useMemo(() => {
    let rows = [...MOCK_TEST_HISTORY, ...MOCK_TEST_HISTORY.map((r, i) => ({ ...r, id: r.id + '-dup' + i }))].slice(0, 20);
    rows = rows.map((r, i) => ({
      ...r,
      duration: `${Math.floor(Math.random() * 8) + 1}m ${String(Math.floor(Math.random() * 59)).padStart(2, '0')}s`,
      score: r.score - (i % 3) * 5,
    }));
    if (search) rows = rows.filter((r) => r.repo.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);
    if (sortCol) {
      rows.sort((a, b) => {
        const av = (a as unknown as Record<string, string | number>)[sortCol];
        const bv = (b as unknown as Record<string, string | number>)[sortCol];
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    return rows;
  }, [search, statusFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Test Runs</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">View and manage all your test executions.</p>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[300px] h-10 bg-white border border-[#D9D9D3] rounded-lg pl-10 pr-4 text-[14px] font-body text-[#12101A] placeholder:text-[#9A9A9A] focus:outline-none focus:border-[#574a7d] transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 bg-white border border-[#D9D9D3] rounded-lg px-3 text-[14px] font-body text-[#12101A] focus:outline-none focus:border-[#574a7d] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Pass</option>
          <option value="warning">Warn</option>
          <option value="failed">Fail</option>
        </select>
        <button className="ml-auto h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors">
          <Play size={16} /> Run New Test
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D9D9D3] rounded-[12px] overflow-hidden mt-6">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-[#F7F7FB] font-mono font-medium text-[12px] uppercase text-[#6B6B6B]">
          {[
            { key: 'repo', label: 'Repository' },
            { key: 'branch', label: 'Branch' },
            { key: 'date', label: 'Date' },
            { key: 'duration', label: 'Duration' },
            { key: 'status', label: 'Status' },
            { key: 'score', label: 'Score' },
          ].map((col) => (
            <button
              key={col.key}
              onClick={() => handleSort(col.key)}
              className="flex items-center gap-1 text-left hover:text-[#574a7d] transition-colors"
            >
              {col.label}
              {sortCol === col.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
            </button>
          ))}
          <span className="text-right">Actions</span>
        </div>
        {paged.map((run, i) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-[#D9D9D3] items-center hover:bg-[#F7F7FB] transition-colors"
          >
            <span className="text-[14px] text-[#333333] font-body">{run.repo}</span>
            <span className="text-[14px] text-[#6B6B6B] font-body">{run.branch}</span>
            <span className="text-[14px] text-[#6B6B6B] font-body">{run.date}</span>
            <span className="text-[14px] text-[#6B6B6B] font-body">{(run as unknown as Record<string, string>).duration}</span>
            <span><StatusBadge status={run.status} /></span>
            <span className={`text-[14px] font-semibold font-body ${scoreColor(run.score)}`}>{run.score}/100</span>
            <div className="flex items-center justify-end gap-2">
              <button className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB]"><Eye size={16} className="text-[#6B6B6B]" /></button>
              <button className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB]"><Download size={16} className="text-[#6B6B6B]" /></button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-[13px] text-[#6B6B6B] font-body">
          Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F7F7FB] disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-9 h-9 rounded-lg font-body text-[14px] transition-colors ${
                page === n ? 'bg-[#574a7d] text-white' : 'text-[#6B6B6B] hover:bg-[#F7F7FB]'
              }`}
            >
              {n}
            </button>
          ))}
          {totalPages > 5 && <span className="text-[#9A9A9A] px-1">...</span>}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F7F7FB] disabled:opacity-30 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: REPOSITORIES
// ═══════════════════════════════════════════════════════════════════════════
function ReposTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Repositories</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage your connected Git repositories.</p>
      <button className="mt-6 h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors">
        <Plus size={16} /> Connect Repository
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {MOCK_REPOS.map((repo, i) => (
          <motion.div
            key={repo.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="bg-white border border-[#D9D9D3] rounded-[12px] p-6 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch size={18} className="text-[#574a7d]" />
                <span className="font-body font-semibold text-[16px] text-[#12101A]">{repo.owner}/{repo.name}</span>
              </div>
              <StatusBadge status={repo.status} />
            </div>
            <div className="flex gap-8 mt-4">
              {[
                { value: `${repo.branches}`, label: 'branches' },
                { value: `${repo.runs}`, label: 'runs' },
                { value: `Last: ${repo.lastRun}`, label: '' },
              ].map((s) => (
                <div key={s.label || s.value}>
                  <span className="font-body font-semibold text-[18px] text-[#12101A]">{s.value}</span>
                  {s.label && <span className="ml-1 font-mono font-medium text-[11px] uppercase text-[#6B6B6B]">{s.label}</span>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-[#6B6B6B] font-body">{repo.branchList}</p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#D9D9D3]">
              <button className="text-[14px] text-[#574a7d] font-medium font-body hover:underline">Run Test</button>
              <button className="text-[14px] text-[#6B6B6B] font-body hover:text-[#333333]">Settings</button>
              <button className="text-[14px] text-[#D4524A] font-body hover:underline">Disconnect</button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: API KEYS
// ═══════════════════════════════════════════════════════════════════════════
function ApiKeysTab() {
  const [keys, setKeys] = useState(MOCK_API_KEYS);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">API Keys</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage API keys for programmatic access.</p>
      <button className="mt-6 h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors">
        <Plus size={16} /> Generate New Key
      </button>
      <div className="bg-white border border-[#D9D9D3] rounded-[12px] overflow-hidden mt-6">
        <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-[#F7F7FB] font-mono font-medium text-[12px] uppercase text-[#6B6B6B]">
          <span>Name</span>
          <span>Key</span>
          <span>Created</span>
          <span>Last Used</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {keys.map((key, i) => (
          <motion.div
            key={key.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className={`grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-[#D9D9D3] items-center ${
              key.status === 'revoked' ? 'opacity-50' : ''
            }`}
          >
            <span className="text-[14px] text-[#333333] font-body">{key.name}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-[#6B6B6B]">{key.key}</span>
              <button onClick={() => handleCopy(key.id)} className="text-[#574a7d] hover:text-[#4a3d6b] transition-colors">
                {copiedId === key.id ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <span className="text-[14px] text-[#6B6B6B] font-body">{key.createdAt}</span>
            <span className="text-[14px] text-[#6B6B6B] font-body">{key.lastUsed}</span>
            <span className={`font-mono text-[12px] uppercase font-medium ${key.status === 'active' ? 'text-[#574a7d]' : 'text-[#9A9A9A]'}`}>
              {key.status}
            </span>
            <div className="text-right">
              {key.status === 'active' && (
                <button
                  onClick={() => setKeys((prev) => prev.map((k) => k.id === key.id ? { ...k, status: 'revoked' as const } : k))}
                  className="text-[14px] text-[#D4524A] font-body hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: TEAM
// ═══════════════════════════════════════════════════════════════════════════
function TeamTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Team Members</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage access for your organization.</p>
      <div className="flex items-center justify-between mt-6">
        <span className="font-mono font-medium text-[13px] text-[#6B6B6B]">{MOCK_TEAM_MEMBERS.length} members</span>
        <button className="h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors">
          <UserPlus size={16} /> Invite Member
        </button>
      </div>
      <div className="bg-white border border-[#D9D9D3] rounded-[12px] overflow-hidden mt-6">
        {MOCK_TEAM_MEMBERS.map((member, i) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center px-6 py-4 border-t border-[#D9D9D3] first:border-t-0"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#574a7d] to-[#7a6fad] flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0">
              {member.status === 'pending' ? '--' : member.avatar}
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-[15px] text-[#333333] font-medium font-body">{member.name}</p>
              <p className="text-[13px] text-[#6B6B6B] font-body">{member.email}</p>
            </div>
            <span className={`font-mono font-medium text-[11px] uppercase px-2.5 py-1 rounded-[4px] ${
              member.role === 'Owner'
                ? 'bg-[#E8E5FF] text-[#574a7d]'
                : member.role === 'Admin'
                ? 'bg-[#F7F7FB] text-[#333333]'
                : 'bg-transparent border border-[#D9D9D3] text-[#6B6B6B]'
            }`}>
              {member.role.toUpperCase()}
            </span>
            {member.role !== 'Owner' && (
              <button className="ml-4 w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB] transition-colors">
                <MoreHorizontal size={16} className="text-[#9A9A9A]" />
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: BILLING
// ═══════════════════════════════════════════════════════════════════════════
function BillingTab() {
  const usageMeters = [
    { label: 'Test Runs', used: 2847, total: 5000, color: 'bg-[#574a7d]', pct: 57 },
    { label: 'Repositories', used: 12, total: 50, color: 'bg-[#4A90D9]', pct: 24 },
    { label: 'Team Members', used: 5, total: 10, color: 'bg-[#7a6fad]', pct: 50 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Billing</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage your subscription and payment details.</p>

      {/* Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mt-6 bg-gradient-to-br from-[#12101A] to-[#1E1B2E] rounded-[16px] p-8 text-white"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="font-mono font-medium text-[12px] uppercase text-[#7a6fad] tracking-[0.08em]">
              PROFESSIONAL PLAN
            </p>
            <div className="flex items-baseline mt-2">
              <span className="font-heading font-bold text-[48px] text-white">$149</span>
              <span className="ml-2 font-heading text-[18px] text-[#9A9A9A]">/month</span>
            </div>
            <div className="mt-4 space-y-1">
              {['Unlimited test runs', '50 concurrent repositories', 'All 20 test dimensions', 'Priority support'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-[14px] text-white/80 font-body">
                  <CheckCircle2 size={14} className="text-[#7a6fad]" /> {f}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start md:items-center gap-3">
            <p className="text-[14px] text-[#9A9A9A] font-body">Renews on Feb 15, 2026</p>
            <button className="px-6 py-2.5 rounded-lg border border-white/20 text-white font-body font-medium text-[14px] hover:bg-white/5 transition-colors">
              Change Plan
            </button>
            <button className="text-[13px] text-[#9A9A9A] font-body hover:text-[#D4524A] transition-colors">
              Cancel Subscription
            </button>
          </div>
        </div>
      </motion.div>

      {/* Usage Meter */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="mt-8 bg-white border border-[#D9D9D3] rounded-[12px] p-6"
      >
        <h3 className="font-body font-semibold text-[16px] text-[#12101A]">Monthly Usage</h3>
        <div className="mt-4 space-y-5">
          {usageMeters.map((meter) => (
            <div key={meter.label}>
              <div className="flex justify-between mb-2">
                <span className="text-[14px] text-[#333333] font-medium font-body">{meter.label}</span>
                <span className="text-[14px] text-[#6B6B6B] font-body">
                  {meter.used.toLocaleString()} / {meter.total.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-[#ECEBF5] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${meter.pct}%` }}
                  transition={{ duration: 1, ease: easeOutExpo, delay: 0.3 }}
                  className={`h-full ${meter.color} rounded-full`}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Invoice History */}
      <div className="mt-8">
        <span className="font-mono font-medium text-[12px] uppercase text-[#574a7d] tracking-[0.08em]">INVOICE HISTORY</span>
        <div className="bg-white border border-[#D9D9D3] rounded-[12px] overflow-hidden mt-4">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-[#F7F7FB] font-mono font-medium text-[12px] uppercase text-[#6B6B6B]">
            <span>Date</span>
            <span>Amount</span>
            <span>Status</span>
            <span className="text-right">PDF</span>
          </div>
          {MOCK_INVOICES.map((inv, i) => (
            <motion.div
              key={inv.date}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-[#D9D9D3] items-center"
            >
              <span className="text-[14px] text-[#333333] font-body">{inv.date}</span>
              <span className="text-[14px] text-[#333333] font-body">{inv.amount}</span>
              <span className="font-mono text-[12px] uppercase text-[#574a7d] font-medium bg-[#E8E5FF] px-3 py-1 rounded-[4px] w-fit">
                {inv.status}
              </span>
              <div className="text-right">
                <button className="text-[#574a7d] hover:text-[#4a3d6b] transition-colors">
                  <FileDown size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7: SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function SettingsTab() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    'test-run-completed': true,
    'critical-vuln': true,
    'weekly-summary': true,
    'billing-notifications': true,
    'product-updates': false,
    'marketing-emails': false,
  });

  const toggle = (key: string) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleItems = [
    { key: 'test-run-completed', label: 'Test run completed', desc: 'Get notified when a test run finishes' },
    { key: 'critical-vuln', label: 'Critical vulnerability found', desc: 'Immediate alert for critical security issues' },
    { key: 'weekly-summary', label: 'Weekly summary', desc: 'Weekly digest of test activity' },
    { key: 'billing-notifications', label: 'Billing notifications', desc: 'Invoices, payment confirmations, plan changes' },
    { key: 'product-updates', label: 'Product updates', desc: 'New features, improvements, and changelog' },
    { key: 'marketing-emails', label: 'Marketing emails', desc: 'Tips, case studies, and promotional content' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Settings</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage your account preferences.</p>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white border border-[#D9D9D3] rounded-[12px] p-6 mt-6">
        <h3 className="font-body font-semibold text-[16px] text-[#12101A]">Profile</h3>
        <div className="flex items-center gap-4 mt-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#574a7d] to-[#7a6fad] flex items-center justify-center text-white text-[20px] font-semibold">
            {MOCK_USER.avatar}
          </div>
          <div className="flex gap-4">
            <button className="text-[14px] text-[#574a7d] font-medium font-body hover:underline">Change Avatar</button>
            <button className="text-[14px] text-[#D4524A] font-body hover:underline">Remove</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-[14px] text-[#333333] font-medium font-body mb-2">Full Name</label>
            <input
              type="text"
              defaultValue={MOCK_USER.name}
              className="w-full h-10 bg-white border border-[#D9D9D3] rounded-lg px-4 text-[14px] font-body text-[#12101A] focus:outline-none focus:border-[#574a7d] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[14px] text-[#333333] font-medium font-body mb-2">Email</label>
            <input
              type="email"
              defaultValue={MOCK_USER.email}
              disabled
              className="w-full h-10 bg-[#F7F7FB] border border-[#D9D9D3] rounded-lg px-4 text-[14px] font-body text-[#6B6B6B] cursor-not-allowed"
            />
          </div>
        </div>
        <button className="mt-4 h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] hover:bg-[#4a3d6b] transition-colors">
          Save Changes
        </button>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white border border-[#D9D9D3] rounded-[12px] p-6 mt-6">
        <h3 className="font-body font-semibold text-[16px] text-[#12101A]">Notifications</h3>
        <div className="mt-4 space-y-4">
          {toggleItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-[14px] text-[#333333] font-medium font-body">{item.label}</p>
                <p className="text-[13px] text-[#6B6B6B] font-body">{item.desc}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                  toggles[item.key] ? 'bg-[#574a7d]' : 'bg-[#D9D9D3]'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    toggles[item.key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white border border-[rgba(212,82,74,0.2)] rounded-[12px] p-6 mt-6 mb-8">
        <h3 className="font-body font-semibold text-[16px] text-[#D4524A]">Danger Zone</h3>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-[#333333] font-medium font-body">Delete all test history</p>
              <p className="text-[13px] text-[#6B6B6B] font-body">This will permanently delete all your test runs and reports.</p>
            </div>
            <button className="h-9 px-4 border border-[#D4524A] text-[#D4524A] rounded-lg font-body text-[14px] hover:bg-[rgba(212,82,74,0.05)] transition-colors">
              Delete History
            </button>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-[#D9D9D3]">
            <div>
              <p className="text-[14px] text-[#333333] font-medium font-body">Delete account</p>
              <p className="text-[13px] text-[#6B6B6B] font-body">Permanently delete your account and all data.</p>
            </div>
            <button className="h-9 px-4 bg-[#D4524A] text-white rounded-lg font-body text-[14px] hover:bg-[#c0453e] transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ACCOUNT PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Account() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to auth if not logged in
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F7F7FB]">
        <div className="w-8 h-8 border-3 border-[#574a7d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  const tabs: Record<TabId, React.ReactNode> = {
    dashboard: <DashboardTab />,
    'test-runs': <TestRunsTab />,
    repos: <ReposTab />,
    'api-keys': <ApiKeysTab />,
    team: <TeamTab />,
    billing: <BillingTab />,
    settings: <SettingsTab />,
  };

  return (
    <div className="h-screen w-full flex bg-[#F7F7FB] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#12101A]/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen || window.innerWidth >= 1024 ? 0 : -260 }}
        transition={{ duration: 0.3, ease: easeOutExpo }}
        className={`fixed lg:static left-0 top-0 h-screen w-[260px] bg-[#141414] border-r border-[#3A3A3A] flex flex-col z-40 flex-shrink-0`}
      >
        <div className="px-4 pt-6 pb-6 border-b border-[#3A3A3A]">
          <Link to="/account" className="flex items-center gap-3">
            <LogoIcon />
            <span className="font-heading font-semibold text-[18px] text-white">TestForge</span>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 mt-6 px-2 space-y-1">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'bg-[rgba(90,143,94,0.12)] text-white'
                    : 'text-[#9A9A9A] hover:bg-[#1E1E1E] hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#574a7d] rounded-r-full"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={18} className={isActive ? 'text-[#574a7d]' : ''} />
                <span className="font-body font-medium text-[14px]">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="mt-auto px-4 pt-4 pb-6 border-t border-[#3A3A3A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#574a7d] to-[#7a6fad] flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0">
              {user?.avatar || MOCK_USER.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-white font-medium font-body truncate">{user?.name || MOCK_USER.name}</p>
              <p className="text-[12px] text-[#9A9A9A] font-body truncate">{user?.email || MOCK_USER.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-[#9A9A9A] hover:text-[#D4524A] transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-[#D9D9D3] flex items-center justify-between px-4 lg:px-8 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#333333]"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-body font-semibold text-[18px] text-[#333333] capitalize">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/docs"
              className="hidden sm:flex text-[#333333] hover:text-[#574a7d] transition-colors"
            >
              <HelpCircle size={20} />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 bg-[#E8E5FF] border border-[#a39fd4] rounded-full px-3.5 py-1.5">
              <Zap size={14} className="text-[#574a7d]" />
              <span className="font-mono font-medium text-[13px] text-[#574a7d]">
                {(user?.creditsTotal ?? MOCK_USER.creditsTotal) - (user?.creditsUsed ?? MOCK_USER.creditsUsed)} credits
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {tabs[activeTab]}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
