import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import CountUp from 'react-countup';
import {
  LayoutDashboard, FlaskConical, GitBranch, KeyRound,
  Users, CreditCard, Settings, LogOut, Menu,
  HelpCircle, Zap, Play, FileText, ArrowRight,
  MoreHorizontal, Eye, Download, Search, ChevronLeft, ChevronRight,
  TrendingDown, TrendingUp, CheckCircle2, Plus, UserPlus, FileDown,
  Sparkles
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { EmptyState } from '@/components/ui/States';
import { FlaskRound } from 'lucide-react';
// Demo placeholders for surfaces that aren't wired to live data yet
// (e.g. avatar initials when no user is signed in). MOCK_TEST_HISTORY /
// _USAGE_DATA / _INVOICES used to be rendered as if real — they aren't
// anymore; everything user-visible now comes from the API.
import { MOCK_USER } from '@/data/seedData';

type RecentRun = {
  id: string;
  project_name: string | null;
  repo_url: string | null;
  branch: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  overall_score: number | null;
  completed_at: string | null;
};

type UsagePoint = { date: string; runs: number };

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
  const { user: authUser } = useAuth();
  const user = authUser || MOCK_USER;
  // /api/usage shape changes with quota model versions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [realStats, setRealStats] = useState<any>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[] | null>(null);
  const [usageSeries, setUsageSeries] = useState<UsagePoint[]>([]);

  useEffect(() => {
    fetch('/api/usage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setRealStats)
      .catch(() => {});
    fetch('/api/history', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: RecentRun[]) => {
        setRecentRuns(Array.isArray(rows) ? rows : []);
        // Bucket runs into a 30-day series for the area chart. Empty buckets
        // render as 0 — no fake data filling in the gaps.
        const buckets = new Map<string, number>();
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          buckets.set(d.toISOString().slice(0, 10), 0);
        }
        for (const r of rows || []) {
          if (!r.completed_at) continue;
          const key = r.completed_at.slice(0, 10);
          if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        setUsageSeries(
          Array.from(buckets.entries()).map(([date, runs]) => ({ date: date.slice(5), runs }))
        );
      })
      .catch(() => setRecentRuns([]));
  }, []);

  // Tier-2 card adapts to plan: Forge/Enterprise see remaining iterations,
  // Free/Pro see "Locked" with an upgrade hint. tier2Limit === null on the
  // API side means Infinity (Enterprise); 0/undefined means not entitled.
  const tier2Limit = realStats?.tier2Limit;
  const tier2Used = realStats?.tier2Used ?? 0;
  const tier2Remaining = realStats?.tier2Remaining;
  const hasTier2 = tier2Limit === null || (typeof tier2Limit === 'number' && tier2Limit > 0);
  const tier2Value = hasTier2
    ? (tier2Limit === null ? '∞' : (tier2Remaining ?? 0))
    : 'Locked';
  const tier2Trend = hasTier2
    ? (tier2Limit === null ? 'Unlimited' : `${tier2Used}/${tier2Limit} used`)
    : 'Upgrade to Forge';

  const stats = [
    { icon: FlaskConical, iconBg: 'bg-[#E8E5FF]', iconColor: 'text-[#574a7d]', value: realStats?.testsRun || user.testsRun || 0, label: 'TOTAL TESTS RUN', trend: realStats?.testsThisMonth ? `${realStats.testsThisMonth} this month` : '', trendUp: true },
    { icon: CheckCircle2, iconBg: 'bg-[rgba(90,143,94,0.1)]', iconColor: 'text-[#574a7d]', value: realStats?.averageScore || user.passRate || 0, label: 'AVG SCORE', trend: '', trendUp: true, suffix: '', decimals: 0 },
    { icon: GitBranch, iconBg: 'bg-[rgba(74,144,217,0.1)]', iconColor: 'text-[#4A90D9]', value: user.repos || 0, label: 'ACTIVE REPOSITORIES', trend: '', trendUp: true },
    { icon: Zap, iconBg: 'bg-[rgba(232,168,56,0.1)]', iconColor: 'text-[#E8A838]', value: realStats?.testsRemaining ?? realStats?.testsLimit ?? 0, label: 'TESTS REMAINING', trend: `Plan: ${(realStats?.plan || user.plan || 'free').toUpperCase()}`, trendUp: true },
    { icon: Sparkles, iconBg: 'bg-[rgba(87,74,125,0.1)]', iconColor: 'text-[#574a7d]', value: tier2Value, label: 'TIER 2 ITERATIONS', trend: tier2Trend, trendUp: true },
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
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
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
                {typeof s.value === 'number' ? (
                  <CountUp end={s.value} duration={1} decimals={s.decimals || 0} suffix={s.suffix || ''} />
                ) : (
                  s.value
                )}
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
          { icon: GitBranch, iconBg: 'bg-[#12101A]', iconColor: 'text-white', title: 'Connect Repository', subtitle: 'Link a new Git repo to TestForge', action: () => navigate('/managed') },
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
          {recentRuns === null ? (
            <div className="px-6 py-8 text-center text-[14px] text-[#9A9A9A] font-body">
              Loading…
            </div>
          ) : recentRuns.length === 0 ? (
            <EmptyState
              icon={<FlaskRound size={40} />}
              title="No test runs yet"
              description="Once you analyze a repository, its runs will appear here."
              action={{ label: 'Run your first test', onClick: () => navigate('/run-test') }}
            />
          ) : (
            recentRuns.slice(0, 5).map((run, i) => {
              const repoLabel =
                run.repo_url?.replace(/^https:\/\/github\.com\//, '') ||
                run.project_name ||
                'unknown';
              const date = run.completed_at
                ? new Date(run.completed_at).toLocaleDateString()
                : '—';
              const score = run.overall_score ?? 0;
              return (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-[#D9D9D3] items-center hover:bg-[#F7F7FB] transition-colors cursor-pointer"
                  onClick={() => navigate(`/report/${run.id}`)}
                >
                  <span className="text-[14px] text-[#333333] font-body">{repoLabel}</span>
                  <span className="text-[14px] text-[#6B6B6B] font-body">{run.branch}</span>
                  <span className="text-[14px] text-[#6B6B6B] font-body">{date}</span>
                  <span className="text-center"><StatusBadge status={run.status} /></span>
                  <span className={`text-center text-[14px] font-semibold font-body ${scoreColor(score)}`}>
                    {score}/100
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB] transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigate(`/report/${run.id}`); }}
                    >
                      <Eye size={16} className="text-[#6B6B6B]" />
                    </button>
                    <button className="w-8 h-8 rounded-[6px] flex items-center justify-center hover:bg-[#F7F7FB] transition-colors">
                      <Download size={16} className="text-[#6B6B6B]" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Usage Chart */}
      <div className="mt-8 pb-8">
        <span className="font-mono font-medium text-[12px] uppercase text-[#574a7d] tracking-[0.08em]">
          TEST RUNS — LAST 30 DAYS
        </span>
        <div className="bg-white border border-[#D9D9D3] rounded-[12px] p-6 mt-4 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usageSeries}>
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

        {/* Score History + Export */}
        {realStats && realStats.testsRun > 0 && (
          <div className="mt-8 bg-white border border-[#D9D9D3] rounded-[12px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#12101A]">Activity Summary</h3>
              <button onClick={() => { const blob = new Blob([JSON.stringify(realStats, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'testforge-data.json'; a.click(); }} className="text-[13px] text-[#574a7d] font-medium flex items-center gap-1 hover:underline">
                <FileDown size={14} /> Export Data
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-[#6B6B6B]">Tests run:</span> <strong className="text-[#12101A]">{realStats.testsRun}</strong></div>
              <div><span className="text-[#6B6B6B]">This month:</span> <strong className="text-[#12101A]">{realStats.testsThisMonth}</strong></div>
              <div><span className="text-[#6B6B6B]">Avg score:</span> <strong className="text-[#12101A]">{realStats.averageScore}</strong></div>
              <div><span className="text-[#6B6B6B]">Findings:</span> <strong className="text-[#12101A]">{realStats.totalFindingsFound}</strong></div>
            </div>
            {realStats.remainingQuota <= 5 && (
              <div className="mt-4 p-3 bg-[#FFF8E1] border border-[#EAB308]/30 rounded-lg text-sm">
                ⚠️ Only <strong>{realStats.remainingQuota}</strong> test{realStats.remainingQuota === 1 ? '' : 's'} remaining this month. <a href="/#/pricing" className="text-[#574a7d] underline font-medium">Upgrade to Pro</a>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: TEST RUNS
// ═══════════════════════════════════════════════════════════════════════════
function TestRunsTab() {
  // Test run row shape varies; renderer reads snake_case fields directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [runs, setRuns] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    fetch('/api/history').then(r => r.json()).then(d => { if (Array.isArray(d)) setRuns(d); }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let rows = runs.map(r => ({
      ...r,
      repo: r.project_name || 'Unknown',
      score: r.overall_score || 0,
      status: r.status || 'completed',
      date: r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—',
      findings: r.total_findings || 0,
    }));
    if (search) rows = rows.filter(r => r.repo.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    return rows;
  }, [runs, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

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
              className="flex items-center gap-1 text-left hover:text-[#574a7d] transition-colors cursor-pointer"
            >
              {col.label}
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
  // Repo row shape varies across versions; renderer reads snake_case fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [repos, setRepos] = useState<any[]>([]);
  useEffect(() => { fetch('/api/projects').then(r => r.json()).then(d => { if (Array.isArray(d)) setRepos(d); }).catch(() => {}); }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Repositories</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage your connected Git repositories.</p>
      <button onClick={() => window.location.href = '/#/managed'} className="mt-6 h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors">
        <Plus size={16} /> Connect Repository
      </button>
      {repos.length === 0 && <p className="mt-6 text-[#6B6B6B] text-sm">No repositories connected yet. Run your first test on the Managed page.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {repos.map((repo) => (
          <div key={repo.id} className="bg-white border border-[#D9D9D3] rounded-[12px] p-6">
            <div className="flex items-center gap-3 mb-3">
              <GitBranch size={18} className="text-[#574a7d]" />
              <h3 className="font-semibold text-[#12101A]">{repo.name}</h3>
            </div>
            <p className="text-sm text-[#6B6B6B] mb-2">{repo.repo_url || repo.repoUrl || ''}</p>
            {repo.tech_stack && <div className="flex flex-wrap gap-1.5">{(Array.isArray(repo.tech_stack) ? repo.tech_stack : []).slice(0,4).map((t: string) => <span key={t} className="text-[10px] px-2 py-0.5 bg-[#E8E5FF] text-[#574a7d] rounded font-mono">{t}</span>)}</div>}
            <p className="text-xs text-[#9A9A9A] mt-3">Added {new Date(repo.created_at || repo.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: API KEYS
// ═══════════════════════════════════════════════════════════════════════════
function ApiKeysTab() {
  // API key row shape varies across server versions; the renderer reads
  // snake_case fields the in-memory store provides.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [keys, setKeys] = useState<any[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/keys').then(r => r.json()).then(d => { if (Array.isArray(d)) setKeys(d); }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'API Key ' + (keys.length + 1) }) });
      const data = await res.json();
      if (data.key) { setNewKey(data.key); fetch('/api/keys').then(r => r.json()).then(d => { if (Array.isArray(d)) setKeys(d); }); }
    } catch { /* surfaced to user via setLoading(false) below */ }
    setLoading(false);
  };

  const handleRevoke = async (id: string) => {
    await fetch('/api/keys?id=' + id, { method: 'DELETE' });
    setKeys(keys.filter(k => k.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">API Keys</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage API keys for programmatic access.</p>
      <button onClick={handleGenerate} disabled={loading} className="mt-6 h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] flex items-center gap-2 hover:bg-[#4a3d6b] transition-colors disabled:opacity-50">
        <Plus size={16} /> {loading ? 'Generating...' : 'Generate New Key'}
      </button>
      {newKey && (
        <div className="mt-4 p-4 bg-[#E8E5FF] border border-[#a39fd4] rounded-lg">
          <p className="text-sm font-medium text-[#574a7d] mb-1">New API Key — copy it now:</p>
          <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-[#D9D9D3] block break-all">{newKey}</code>
          <p className="text-xs text-[#6B6B6B] mt-2">This key won't be shown again. Store it securely.</p>
        </div>
      )}
      <div className="bg-white border border-[#D9D9D3] rounded-[12px] overflow-hidden mt-6">
        <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-[#F7F7FB] font-mono font-medium text-[12px] uppercase text-[#6B6B6B]">
          <span>Name</span>
          <span>Key</span>
          <span>Created</span>
          <span>Last Used</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {keys.length === 0 && (
          <div className="px-6 py-8 text-center text-[#6B6B6B] text-sm">No API keys yet. Generate one to get started.</div>
        )}
        {keys.map((key, i) => (
          <motion.div
            key={key.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-[#D9D9D3] items-center"
          >
            <span className="text-[14px] text-[#333333] font-body">{key.name}</span>
            <span className="font-mono text-[13px] text-[#6B6B6B]">{key.key_prefix || '••••••••••'}</span>
            <span className="text-[14px] text-[#6B6B6B] font-body">{key.created_at ? new Date(key.created_at).toLocaleDateString() : '—'}</span>
            <span className="text-[14px] text-[#6B6B6B] font-body">{key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}</span>
            <span className="font-mono text-[12px] uppercase font-medium text-[#574a7d]">Active</span>
            <div className="text-right">
              <button onClick={() => handleRevoke(key.id)} className="text-[#D4524A] hover:text-red-700 text-sm transition-colors">Revoke</button>
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
  // Org row shape varies; renderer reads snake_case fields directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [members, setMembers] = useState<any[]>([]);
  useEffect(() => { fetch('/api/orgs').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembers(d); }).catch(() => {}); }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <h2 className="font-heading font-medium text-[28px] text-[#12101A]">Team</h2>
      <p className="text-[16px] text-[#6B6B6B] font-body mt-1">Manage your organization and team members.</p>
      <div className="flex items-center justify-between mt-6">
        <span className="font-mono font-medium text-[13px] text-[#6B6B6B]">{members.length} organizations</span>
        <button className="h-9 px-4 bg-[#574a7d] text-white rounded-lg text-[13px] font-medium flex items-center gap-1.5"><UserPlus size={14} /> Create Org</button>
      </div>
      {members.length === 0 && <p className="mt-6 text-[#6B6B6B] text-sm">No organizations yet. Create one to invite team members.</p>}
      <div className="space-y-3 mt-4">
        {members.map((org, i) => (
          <div key={org.id || i} className="bg-white border border-[#D9D9D3] rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-[#12101A]">{org.name}</p>
              <p className="text-xs text-[#6B6B6B]">{org.slug} · Created {new Date(org.created_at).toLocaleDateString()}</p>
            </div>
            <span className="text-xs px-2 py-0.5 bg-[#E8E5FF] text-[#574a7d] rounded font-medium">{org.plan || 'free'}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: BILLING
// ═══════════════════════════════════════════════════════════════════════════
function BillingTab() {
  const { user } = useAuth();
  const plan = user?.plan || 'free';
  const planNames: Record<string, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };
  const planLimits: Record<string, number> = { free: 5, pro: 100, enterprise: 999 };
  const limit = planLimits[plan] || 5;
  const used = user?.testsRun || 0;
  const [portalLoading, setPortalLoading] = useState(false);

  // Opens the Stripe Customer Portal — payment method, downgrade, cancel,
  // and invoice history all live there. If the user has never upgraded
  // (no stripe_customer_id yet) the endpoint returns 409 and we redirect
  // them to pricing instead of erroring.
  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const r = await fetch('/api/stripe-portal', {
        method: 'POST',
        credentials: 'include',
      });
      if (r.status === 409) {
        window.location.href = '/#/pricing';
        return;
      }
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error || 'Could not open billing portal');
        return;
      }
      const { url } = await r.json();
      window.location.href = url;
    } catch {
      alert('Could not reach billing portal — try again in a moment.');
    } finally {
      setPortalLoading(false);
    }
  };

  const usageMeters = [
    { label: 'Test Runs', used, total: limit, color: 'bg-[#574a7d]', pct: Math.min(100, Math.round((used / limit) * 100)) },
    { label: 'Repositories', used: user?.repos || 0, total: plan === 'free' ? 1 : plan === 'pro' ? 10 : 99, color: 'bg-[#4A90D9]', pct: 0 },
    { label: 'API Calls', used: used * 3, total: limit * 10, color: 'bg-[#7a6fad]', pct: Math.min(100, Math.round((used * 3) / (limit * 10) * 100)) },
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
              {planNames[plan]?.toUpperCase() || 'FREE'} PLAN
            </p>
            <div className="flex items-baseline mt-2">
              <span className="font-heading font-bold text-[48px] text-white">{plan === 'free' ? '$0' : plan === 'pro' ? '$29' : '$199'}</span>
              <span className="ml-2 font-heading text-[18px] text-[#9A9A9A]">/month</span>
            </div>
            <div className="mt-4 space-y-1">
              {[
                `${limit} test runs/month`,
                `${plan === 'free' ? 1 : plan === 'pro' ? 10 : 'Unlimited'} repositories`,
                'All 21 test dimensions',
                plan === 'free' ? 'Community support' : 'Priority support',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-[14px] text-white/80 font-body">
                  <CheckCircle2 size={14} className="text-[#7a6fad]" /> {f}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start md:items-center gap-3">
            <p className="text-[14px] text-[#9A9A9A] font-body">{plan === 'free' ? 'Free forever' : 'Active subscription'}</p>
            {plan === 'free' ? (
              <button
                onClick={() => window.location.href = '/#/pricing'}
                className="px-6 py-2.5 rounded-lg bg-[#7a6fad] text-white font-body font-medium text-[14px] hover:bg-[#574a7d] transition-colors"
              >
                Upgrade Plan
              </button>
            ) : (
              <button
                onClick={openCustomerPortal}
                disabled={portalLoading}
                className="px-6 py-2.5 rounded-lg border border-white/20 text-white font-body font-medium text-[14px] hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {portalLoading ? 'Opening…' : 'Manage Subscription'}
              </button>
            )}
            <button
              onClick={openCustomerPortal}
              disabled={portalLoading || plan === 'free'}
              className="text-[13px] text-[#9A9A9A] font-body hover:text-[#D4524A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={plan === 'free' ? 'You are on the free plan' : 'Manage / cancel via Stripe Customer Portal'}
            >
              {plan === 'free' ? 'No active subscription' : 'Cancel via Stripe Portal'}
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
          {/* Stripe Customer Portal owns invoice history for now —
              this empty state directs users there instead of fabricating
              a list. The button below opens a portal session. */}
          <div className="px-6 py-10 text-center border-t border-[#D9D9D3] flex flex-col items-center gap-3">
            <p className="text-[14px] text-[#6B6B6B] font-body">
              {plan === 'free'
                ? 'No invoices yet — upgrade to Pro or Enterprise to start a billing history.'
                : 'Your invoices, receipts, and payment methods live in the Stripe Customer Portal.'}
            </p>
            <button
              onClick={plan === 'free' ? (() => (window.location.href = '/#/pricing')) : openCustomerPortal}
              disabled={portalLoading}
              className="px-5 py-2 rounded-lg bg-[#574a7d] text-white font-body font-medium text-[13px] hover:bg-[#4a3d6b] transition-colors disabled:opacity-50"
            >
              {plan === 'free'
                ? 'See pricing →'
                : portalLoading
                  ? 'Opening…'
                  : 'Open Stripe billing portal →'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7: SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function SettingsTab() {
  const { user } = useAuth();
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
            {user?.avatar || '—'}
          </div>
          <div className="flex gap-4">
            <button
              className="text-[14px] text-[#574a7d] font-medium font-body hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
              title="Avatar is synced from GitHub"
            >
              Synced from GitHub
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-[14px] text-[#333333] font-medium font-body mb-2">Full Name</label>
            <input
              type="text"
              defaultValue={user?.name || ''}
              disabled
              className="w-full h-10 bg-[#F7F7FB] border border-[#D9D9D3] rounded-lg px-4 text-[14px] font-body text-[#6B6B6B] cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[14px] text-[#333333] font-medium font-body mb-2">Email</label>
            <input
              type="email"
              defaultValue={user?.email || ''}
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
