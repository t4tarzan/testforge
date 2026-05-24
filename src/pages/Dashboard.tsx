import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import CountUp from 'react-countup'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter,
} from 'recharts'
import {
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

/* ═══════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════ */

const executionTrendData = [
  { day: 'Mon', passed: 1840, failed: 42, total: 1882 },
  { day: 'Tue', passed: 1920, failed: 38, total: 1958 },
  { day: 'Wed', passed: 1750, failed: 55, total: 1805 },
  { day: 'Thu', passed: 2100, failed: 31, total: 2131 },
  { day: 'Fri', passed: 1980, failed: 29, total: 2009 },
  { day: 'Sat', passed: 1200, failed: 15, total: 1215 },
  { day: 'Sun', passed: 1150, failed: 12, total: 1162 },
]

const testDistributionData = [
  { name: 'Unit', value: 40, color: '#C1A3FF' },
  { name: 'Integration', value: 25, color: '#B48FFF' },
  { name: 'E2E', value: 15, color: '#C9B5FF' },
  { name: 'Other', value: 20, color: '#F0EAFF' },
]

const coverageByModuleData = [
  { module: 'Auth', coverage: 95 },
  { module: 'Payments', coverage: 88 },
  { module: 'Search', coverage: 72 },
  { module: 'Notifications', coverage: 81 },
  { module: 'API', coverage: 90 },
  { module: 'UI', coverage: 78 },
]

const pipelineStageData = [
  { stage: 'Build', duration: 45 },
  { stage: 'Lint', duration: 20 },
  { stage: 'Unit', duration: 120 },
  { stage: 'Integ', duration: 180 },
  { stage: 'E2E', duration: 240 },
  { stage: 'Visual', duration: 90 },
  { stage: 'A11y', duration: 60 },
  { stage: 'Perf', duration: 75 },
  { stage: 'Sec', duration: 110 },
  { stage: 'Smoke', duration: 55 },
  { stage: 'Load', duration: 130 },
  { stage: 'Deploy', duration: 35 },
]

const historicalData = [
  { month: 'Aug', testCount: 78, failureRate: 5.2, coverage: 72, quality: 72 },
  { month: 'Sep', testCount: 82, failureRate: 4.8, coverage: 76, quality: 76 },
  { month: 'Oct', testCount: 85, failureRate: 4.1, coverage: 79, quality: 79 },
  { month: 'Nov', testCount: 88, failureRate: 3.6, coverage: 83, quality: 83 },
  { month: 'Dec', testCount: 92, failureRate: 3.0, coverage: 86, quality: 86 },
  { month: 'Jan', testCount: 94, failureRate: 2.1, coverage: 89, quality: 89 },
]

const scoreTrendData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  score: 82 + Math.random() * 12 + (i / 30) * 8,
}))

const dimensionScores = [
  { name: 'Unit Tests', score: 96 },
  { name: 'Integration', score: 92 },
  { name: 'E2E Tests', score: 88 },
  { name: 'Visual Reg.', score: 85 },
  { name: 'Performance', score: 90 },
  { name: 'Security', score: 78 },
  { name: 'Accessibility', score: 82 },
  { name: 'Smoke Tests', score: 95 },
  { name: 'Load Tests', score: 87 },
  { name: 'Fuzz Tests', score: 73 },
  { name: 'Contract', score: 91 },
  { name: 'Mutation', score: 86 },
  { name: 'Benchmark', score: 89 },
]

const teamContributors = [
  { name: 'Sarah Chen', tests: 342, passRate: 98, initials: 'SC' },
  { name: 'Marcus Johnson', tests: 287, passRate: 96, initials: 'MJ' },
  { name: 'Elena Rodriguez', tests: 265, passRate: 94, initials: 'ER' },
  { name: 'David Kim', tests: 248, passRate: 97, initials: 'DK' },
  { name: 'Aisha Patel', tests: 231, passRate: 95, initials: 'AP' },
]

const sprintQualityData = [
  { name: 'Pass', value: 78, color: '#C1A3FF' },
  { name: 'Flaky', value: 15, color: '#E8A838' },
  { name: 'Fail', value: 7, color: '#D4524A' },
]

const defectPredictionData = Array.from({ length: 14 }, (_, i) => ({
  day: i + 1,
  probability: 15 + Math.random() * 25 + Math.sin(i * 0.5) * 10,
}))

const testPrioritizationData = [
  { component: 'Auth', score: 92 },
  { component: 'Payments', score: 88 },
  { component: 'Search', score: 75 },
  { component: 'API', score: 70 },
  { component: 'UI', score: 62 },
]

const performanceRegressionData = Array.from({ length: 14 }, (_, i) => ({
  day: i + 1,
  expected: 120 + i * 2,
  actual: 125 + i * 3 + Math.random() * 20,
}))

/* ═══════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════ */

function SectionLabel({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <p className={`text-label-mono mb-4 ${light ? 'text-[#C9B5FF]' : 'text-[#C1A3FF]'}`}>
      // {text}
    </p>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-mono text-[#6B6B6B] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-medium" style={{ color: p.color || p.stroke || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════ */

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.from('.dash-hero-label', { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' })
    gsap.from('.dash-hero-headline', { opacity: 0, y: 40, duration: 0.8, ease: 'power3.out', delay: 0.1 })
    gsap.from('.dash-hero-sub', { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out', delay: 0.3 })
    gsap.from('.dash-stat-card', { opacity: 0, y: 30, duration: 0.5, stagger: 0.1, ease: 'power2.out', delay: 0.5 })
  }, { scope: heroRef })

  const stats = [
    { label: 'Overall Quality Score', value: 94, suffix: '', color: '#C1A3FF', badge: 'A+' },
    { label: 'Tests This Week', value: 12847, suffix: '', color: '#C1A3FF', trend: '+23%', trendUp: true },
    { label: 'Failure Rate', value: 2.1, suffix: '%', color: '#C1A3FF', trend: '-1.3pp', trendUp: true },
    { label: 'Avg Resolution', value: 4.2, suffix: 'h', color: '#C1A3FF', trend: '-2.1h', trendUp: true },
  ]

  return (
    <section ref={heroRef} className="relative w-full bg-[#1A1A1A] overflow-hidden">
      <div className="bg-grid-pattern-dark absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10 pt-[140px] pb-[60px] lg:pt-[160px]">
        <SectionLabel text="ANALYTICS & INSIGHTS" light />
        <h1 className="dash-hero-headline text-display-xl text-white max-w-[700px] mb-5">
          See what others <span className="text-[#C1A3FF]">can&apos;t</span>.
        </h1>
        <p className="dash-hero-sub text-body-lg text-[#9A9A9A] max-w-[600px] mb-12">
          Predictive models, quality scorecards, and real-time intelligence that turn testing data into engineering decisions.
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              className="dash-stat-card bg-[#2A2A2A] border border-[#3A3A3A] rounded-xl p-6"
              whileHover={{ y: -4, borderColor: 'rgba(90,143,94,0.3)' }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-label-mono text-[10px] text-[#9A9A9A] mb-3">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="font-heading font-bold text-[42px] lg:text-[48px]" style={{ color: stat.color }}>
                  {stat.suffix === 'h' || stat.suffix === '%' ? (
                    <CountUp end={stat.value} decimals={stat.value < 10 ? 1 : 0} duration={1.5} />
                  ) : (
                    <CountUp end={stat.value} duration={1.5} separator="," />
                  )}
                </span>
                {stat.suffix && <span className="text-body-md text-[#9A9A9A]">{stat.suffix}</span>}
                {stat.badge && (
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#F0EAFF] text-[#C1A3FF]">
                    {stat.badge}
                  </span>
                )}
              </div>
              {stat.trend && (
                <div className="flex items-center gap-1 mt-2">
                  {stat.trendUp ? (
                    <ArrowUpRight size={14} className="text-[#C1A3FF]" />
                  ) : (
                    <ArrowDownRight size={14} className="text-[#D4524A]" />
                  )}
                  <span className="font-mono text-xs text-[#C1A3FF]">{stat.trend} vs last week</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Quality Scorecard Section
   ═══════════════════════════════════════════ */

function ScoreRing({ score, size = 200, animated = false }: { score: number; size?: number; animated?: boolean }) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D9D9D3"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#lavenderGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? offset : circumference}
          className="transition-all duration-[1500ms] ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-bold text-[56px] lg:text-[64px] text-[#C1A3FF]">
          {animated ? <CountUp end={score} duration={1.5} /> : 0}
        </span>
        <span className="font-mono font-medium text-base text-[#6B6B6B]">A+</span>
      </div>
    </div>
  )
}

function QualityScorecardSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [ringAnimated, setRingAnimated] = useState(false)

  useGSAP(() => {
    if (!sectionRef.current) return

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 70%',
      once: true,
      onEnter: () => setRingAnimated(true),
    })

    gsap.from('.quality-bar', {
      width: 0,
      duration: 0.8,
      stagger: 0.05,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 60%',
        once: true,
      },
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F5F5F0] py-20 lg:py-24">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10">
        <SectionLabel text="QUALITY SCORECARD" />

        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-12">
          {/* Left: Score Circle + Sparkline */}
          <div className="flex flex-col items-center">
            <ScoreRing score={94} animated={ringAnimated} />
            <div className="mt-6 w-full max-w-[220px]">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={scoreTrendData}>
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="url(#lavenderGrad)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-body-sm text-[#9A9A9A] text-center mt-1">30-day trend</p>
            </div>
            <p className="text-body-sm text-[#9A9A9A] mt-3">Updated 2 minutes ago</p>
          </div>

          {/* Right: Dimension Score Bars */}
          <div>
            <h3 className="font-heading font-medium text-lg text-[#333333] mb-6">Testing Dimensions</h3>
            <div className="space-y-3">
              {dimensionScores.map((dim) => {
                let barColor = '#C1A3FF'
                if (dim.score < 50) barColor = '#D4524A'
                else if (dim.score < 80) barColor = '#E8A838'

                return (
                  <div key={dim.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#333333] w-[120px] truncate">{dim.name}</span>
                    <div className="flex-1 h-2 bg-[#D9D9D3] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: barColor }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${dim.score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                      />
                    </div>
                    <span className="font-mono font-semibold text-sm text-[#333333] w-8 text-right">
                      {dim.score}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Predictive Models Section
   ═══════════════════════════════════════════ */

function PredictiveModelsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.model-card', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  const models = [
    {
      title: 'Defect Prediction',
      accuracy: '87%',
      description: 'ML model predicts which components will fail based on code complexity, change frequency, and historical patterns.',
      metric: '12 high-risk files identified',
      chart: (
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={defectPredictionData}>
            <defs>
              <linearGradient id="defectGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C1A3FF" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#C1A3FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="probability" stroke="#C1A3FF" fill="url(#defectGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Test Prioritization',
      accuracy: '92%',
      description: 'Intelligent test ordering ensures the most likely-to-fail tests run first — catching issues earlier in the pipeline.',
      metric: '41% faster failure detection',
      chart: (
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={testPrioritizationData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="component" type="category" hide />
            <Bar dataKey="score" fill="url(#lavenderBar)" radius={[0, 4, 4, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      title: 'Performance Regression',
      accuracy: '89%',
      description: 'Predicts performance degradation before it impacts users by analyzing commit patterns and load test trends.',
      metric: '3 regressions caught pre-deploy',
      chart: (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={performanceRegressionData}>
            <Line type="monotone" dataKey="expected" stroke="#4A90D9" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="actual" stroke="#E8A838" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
  ]

  return (
    <section ref={sectionRef} className="relative w-full bg-[#EBEBE5] py-20 lg:py-24">
      <div className="container-tf">
        <SectionLabel text="PREDICTIVE MODELS" />
        <h2 className="text-display-lg text-[#333333] mb-10">
          <span className="text-[#C1A3FF]">Predict</span> failures before they happen.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 max-w-[1200px]">
          {models.map((model) => (
            <motion.div
              key={model.title}
              className="model-card bg-white border border-[#D9D9D3] rounded-xl p-6 lg:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
              whileHover={{ y: -4 }}
            >
              <div className="mb-4">{model.chart}</div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-heading-sm text-[#333333]">{model.title}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F0EAFF] text-[#C1A3FF]">
                  {model.accuracy} accuracy
                </span>
              </div>
              <p className="text-body-sm text-[#6B6B6B] mb-4">{model.description}</p>
              <p className="font-mono text-[13px] text-[#C1A3FF]">{model.metric}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Real-Time Metrics Section
   ═══════════════════════════════════════════ */

function RealTimeMetricsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.metrics-card', {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F5F5F0] py-20 lg:py-24">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10">
        <SectionLabel text="REAL-TIME METRICS" />
        <h2 className="text-display-md text-[#333333] mb-10">Live pipeline intelligence.</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[1200px]">
          {/* Test Execution Trend */}
          <div className="metrics-card bg-white border border-[#D9D9D3] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-[#333333]">Test Execution Trend</h3>
              <span className="text-body-sm text-[#9A9A9A]">Last 7 days</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={executionTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDD0FF" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="passed" name="Passed" stroke="url(#lavenderGrad)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="failed" name="Failed" stroke="#D4524A" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Test Distribution */}
          <div className="metrics-card bg-white border border-[#D9D9D3] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-[#333333]">Test Distribution</h3>
              <span className="text-body-sm text-[#9A9A9A]">By type</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={testDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {testDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Pipeline Stage Duration */}
          <div className="metrics-card bg-white border border-[#D9D9D3] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-[#333333]">Pipeline Stage Duration</h3>
              <span className="text-body-sm text-[#9A9A9A]">Avg seconds</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pipelineStageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#DDD0FF" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: '#6B6B6B' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="duration" fill="url(#lavenderBar)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Coverage by Module */}
          <div className="metrics-card bg-white border border-[#D9D9D3] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-[#333333]">Coverage by Module</h3>
              <span className="text-body-sm text-[#9A9A9A]">Current</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={coverageByModuleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDD0FF" />
                <XAxis dataKey="module" tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="coverage" fill="url(#lavenderBar)" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Team Insights Section
   ═══════════════════════════════════════════ */

function TeamInsightsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.insights-card', {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#EBEBE5] py-20 lg:py-24">
      <div className="container-tf">
        <SectionLabel text="TEAM INSIGHTS" />
        <h2 className="text-display-md text-[#333333] mb-10">Engineering intelligence for teams.</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1000px]">
          {/* Sprint Quality Score */}
          <div className="insights-card bg-white border border-[#D9D9D3] rounded-xl p-6">
            <h3 className="font-semibold text-sm text-[#333333] mb-4">Sprint Quality Score</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={sprintQualityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sprintQualityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute">
                <span className="font-heading font-bold text-2xl text-[#333333]">B+</span>
              </div>
            </div>
            <p className="text-body-sm text-[#C1A3FF] text-center mt-2">
              Sprint 24 quality trend: +8% vs Sprint 23
            </p>
          </div>

          {/* Top Contributors */}
          <div className="insights-card bg-white border border-[#D9D9D3] rounded-xl p-6">
            <h3 className="font-semibold text-sm text-[#333333] mb-4">Top Contributors</h3>
            <div className="space-y-3">
              {teamContributors.map((person) => (
                <div key={person.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F0EAFF] flex items-center justify-center">
                    <span className="text-[10px] font-mono font-medium text-[#C1A3FF]">{person.initials}</span>
                  </div>
                  <span className="text-sm font-medium text-[#333333] flex-1">{person.name}</span>
                  <span className="text-xs font-mono text-[#9A9A9A]">{person.tests} tests</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#F0EAFF] text-[#C1A3FF]">
                    {person.passRate}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Velocity vs Quality */}
          <div className="insights-card bg-white border border-[#D9D9D3] rounded-xl p-6">
            <h3 className="font-semibold text-sm text-[#333333] mb-4">Velocity vs Quality</h3>
            <ResponsiveContainer width="100%" height={180}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#DDD0FF" />
                <XAxis type="number" dataKey="velocity" name="Velocity" tick={{ fontSize: 11, fill: '#6B6B6B' }} axisLine={false} tickLine={false} label={{ value: 'Commits/week', position: 'bottom', fontSize: 10, fill: '#9A9A9A' }} />
                <YAxis type="number" dataKey="quality" name="Quality" tick={{ fontSize: 11, fill: '#6B6B6B' }} axisLine={false} tickLine={false} label={{ value: 'Score', angle: -90, position: 'left', fontSize: 10, fill: '#9A9A9A' }} />
                <Scatter
                  data={[
                    { velocity: 15, quality: 72 },
                    { velocity: 22, quality: 78 },
                    { velocity: 28, quality: 82 },
                    { velocity: 35, quality: 85 },
                    { velocity: 42, quality: 88 },
                    { velocity: 48, quality: 86 },
                    { velocity: 55, quality: 90 },
                    { velocity: 38, quality: 84 },
                  ]}
                  fill="url(#lavenderBar)"
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-body-sm text-[#C1A3FF] mt-1 text-center">
              Higher velocity correlates with +12% quality
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Historical Analysis Section
   ═══════════════════════════════════════════ */

function HistoricalAnalysisSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.history-chart-container', {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F5F5F0] py-20 lg:py-24">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10">
        <SectionLabel text="HISTORICAL ANALYSIS" />
        <h2 className="text-display-md text-[#333333] mb-10">Learn from every test run.</h2>

        <div className="history-chart-container bg-white border border-[#D9D9D3] rounded-xl p-6">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDD0FF" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="testCount" name="Test Count" stroke="url(#lavenderGrad)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="failureRate" name="Failure Rate" stroke="#D4524A" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="coverage" name="Coverage %" stroke="#4A90D9" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="quality" name="Quality Score" stroke="#E87D3A" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   CTA Section
   ═══════════════════════════════════════════ */

function CTASection() {
  return (
    <section className="relative w-full bg-[#C1A3FF] py-20 lg:py-24">
      <div className="container-tf text-center">
        <h2 className="text-display-md text-white mb-8">Data-driven testing starts here.</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="px-7 py-[14px] rounded-lg bg-white text-[#C1A3FF] font-body font-medium text-base hover:bg-[#F5F5F0] hover:scale-[1.02] transition-all duration-200">
            Get Started Free
          </button>
          <button className="px-7 py-[14px] rounded-lg border border-white text-white font-body font-medium text-base hover:bg-white/10 transition-all duration-200">
            Explore the Pipeline
          </button>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════ */

export default function Dashboard() {
  return (
    <div className="min-h-[100dvh]">
      {/* SVG Gradient Definitions */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="lavenderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C1A3FF" />
            <stop offset="100%" stopColor="#7E54BB" />
          </linearGradient>
          <linearGradient id="lavenderLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C1A3FF" />
            <stop offset="100%" stopColor="#B48FFF" />
          </linearGradient>
          <linearGradient id="lavenderArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C1A3FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C1A3FF" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lavenderDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A07BDD" />
            <stop offset="100%" stopColor="#3A0677" />
          </linearGradient>
          <linearGradient id="lavenderBar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C9B5FF" />
            <stop offset="100%" stopColor="#C1A3FF" />
          </linearGradient>
        </defs>
      </svg>
      <HeroSection />
      <QualityScorecardSection />
      <PredictiveModelsSection />
      <RealTimeMetricsSection />
      <TeamInsightsSection />
      <HistoricalAnalysisSection />
      <CTASection />
    </div>
  )
}
