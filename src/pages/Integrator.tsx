import { useRef, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import CountUp from 'react-countup'
import {
  GitMerge,
  Package,
  EyeOff,
  Layers,
  Map,
  Workflow,
  Network,
  Check,
  X,
  Minus,
  ArrowRight,
} from 'lucide-react'
import NeuralNetworkCanvas from '../components/integrator/NeuralNetworkCanvas'
import ArchitectureLayers from '../components/integrator/ArchitectureLayers'

/* ──────────────────────── animations ──────────────────────── */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardReveal = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
}

/* ──────────────────────── Problem Cards Data ──────────────────────── */
const problemCards = [
  {
    icon: GitMerge,
    iconColor: '#D4524A',
    title: 'Merge Conflicts',
    description: 'You fix a test, but the fix conflicts with another developer\'s branch. Hours lost in rebase hell.',
    stat: 67,
    statSuffix: '%',
    statLabel: 'of teams',
    statColor: '#D4524A',
  },
  {
    icon: Package,
    iconColor: '#E8A838',
    title: 'Dependency Conflicts',
    description: 'Updating one package breaks three others. The test passes locally but fails in CI due to version mismatches.',
    stat: 3.2,
    statSuffix: ' hours',
    statLabel: 'avg',
    statColor: '#E8A838',
    isFloat: true,
  },
  {
    icon: EyeOff,
    iconColor: '#6B6B6B',
    title: 'No Unified View',
    description: 'Test tools, build systems, and dependency managers don\'t talk to each other. You\'re flying blind when integrating.',
    stat: 4,
    statSuffix: '+',
    statLabel: 'tools needed',
    statColor: '#6B6B6B',
  },
]

/* ──────────────────────── Decision Flow Steps ──────────────────────── */
const decisionSteps = [
  { num: '01', title: 'Ingest', desc: 'All test results, build states, and dependencies are collected in real-time.' },
  { num: '02', title: 'Analyze', desc: 'Conflicts and risks are identified using ML pattern matching across your organization\'s history.' },
  { num: '03', title: 'Recommend', desc: 'Ranked paths with probability scores — choose the safest route forward.' },
  { num: '04', title: 'Validate', desc: 'Dry-run the integration, confirm zero new conflicts, ship with confidence.' },
]

/* ──────────────────────── Key Features Data ──────────────────────── */
const keyFeatures = [
  {
    icon: Layers,
    title: 'Stack Compatibility Analysis',
    description: 'Maps your entire technology stack — frameworks, libraries, tools — and checks compatibility across versions before integration.',
  },
  {
    icon: Package,
    title: 'Dependency Conflict Detection',
    description: 'Identifies version conflicts, deprecated dependencies, and circular references before they break your build.',
  },
  {
    icon: GitMerge,
    title: 'Merge Conflict Prediction',
    description: 'Predicts merge conflicts before they happen by analyzing branch divergence, overlapping changes, and file contention.',
  },
  {
    icon: Map,
    title: 'Intelligent Path Recommendation',
    description: 'Generates multiple integration paths ranked by success probability, time estimate, and risk level. You choose.',
  },
  {
    icon: Workflow,
    title: 'Autonomous Multi-Step Paths',
    description: 'Complex integrations are broken into atomic steps. Each step is validated before the next executes automatically.',
  },
  {
    icon: Network,
    title: 'Integration Knowledge Graph',
    description: 'A living map of your organization\'s integration patterns. Learns from every decision to improve future recommendations.',
  },
]

/* ──────────────────────── Comparison Table Data ──────────────────────── */
const comparisonRows = [
  { capability: 'Test Result Analysis', testforge: 'check', traditional: 'x', testsprite: 'check' },
  { capability: 'Merge Conflict Detection', testforge: 'check', traditional: 'x', testsprite: 'x' },
  { capability: 'Dependency Conflict Detection', testforge: 'check', traditional: 'partial', testsprite: 'x' },
  { capability: 'Build State Integration', testforge: 'check', traditional: 'check', testsprite: 'x' },
  { capability: 'Intelligent Path Ranking', testforge: 'check', traditional: 'x', testsprite: 'x' },
  { capability: 'Knowledge Graph Learning', testforge: 'check', traditional: 'x', testsprite: 'x' },
  { capability: 'Autonomous Execution', testforge: 'check', traditional: 'x', testsprite: 'x' },
]

/* ──────────────────────── Sub-components ──────────────────────── */
function AnimatedStat({ value, suffix, isFloat }: { value: number; suffix: string; isFloat?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <span ref={ref}>
      {inView ? (
        <CountUp
          end={value}
          decimals={isFloat ? 1 : 0}
          duration={1.5}
          suffix={suffix}
          useEasing
        />
      ) : (
        `0${suffix}`
      )}
    </span>
  )
}

function ComparisonIcon({ type }: { type: string }) {
  if (type === 'check') return <Check size={18} className="text-[#574a7d]" />
  if (type === 'x') return <X size={18} className="text-[#D4524A] opacity-50" />
  return <Minus size={18} className="text-[#E8A838]" />
}

/* ──────────────────────── Section: Hero ──────────────────────── */
function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center px-6 lg:px-16 pt-[140px] pb-[100px] overflow-hidden bg-[#12101A]">
      <NeuralNetworkCanvas />

      <div className="relative z-10 max-w-[1280px] mx-auto w-full">
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-label-mono text-[#a39fd4] mb-6"
        >
          // THE INTEGRATOR
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-display-lg lg:text-display-xl text-white max-w-[800px] mb-6"
        >
          The <span className="text-[#574a7d]">brain</span> between testing and shipping.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-body-lg text-[#9A9A9A] max-w-[640px] mb-10"
        >
          No existing tool combines test failures, merge conflicts, dependency graphs, and build state into unified integration recommendations. The Integrator does.
        </motion.p>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-wrap gap-3 mb-12"
        >
          {['Merge Conflict Detection', 'Dependency Analysis', 'Stack Compatibility', 'Intelligent Path Selection'].map((badge, i) => (
            <motion.span
              key={badge}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
              className="font-mono text-[12px] uppercase tracking-wider px-4 py-2 rounded border border-[#3A3A3A] text-[#a39fd4]"
            >
              {badge}
            </motion.span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="px-7 py-[14px] rounded-lg bg-[#574a7d] text-white font-body font-medium text-base hover:bg-[#4a3d6b] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 group"
          onClick={() => {
            const el = document.getElementById('architecture')
            el?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          See How It Works
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
        </motion.button>
      </div>
    </section>
  )
}

/* ──────────────────────── Section: Problem ──────────────────────── */
function ProblemSection() {
  return (
    <section className="relative px-6 lg:px-16 py-[120px] bg-[#F7F7FB] overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-label-mono text-[#574a7d] mb-4"
        >
          // THE PROBLEM
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-display-lg text-[#333333] mb-16"
        >
          Integration is where code goes to <span className="text-[#D4524A]">die</span>.
        </motion.h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {problemCards.map((card) => {
            const IconComp = card.icon
            return (
              <motion.div
                key={card.title}
                variants={cardReveal}
                whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl border border-[#D9D9D3] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${card.iconColor}12` }}
                >
                  <IconComp size={24} style={{ color: card.iconColor }} />
                </motion.div>

                <h3 className="text-heading-sm text-[#333333] mb-3">{card.title}</h3>
                <p className="text-body-md text-[#6B6B6B] mb-6">{card.description}</p>

                <p className="font-mono font-bold text-[28px]" style={{ color: card.statColor }}>
                  <AnimatedStat value={card.stat} suffix={card.statSuffix} isFloat={card.isFloat} />
                  <span className="font-mono font-medium text-[13px] text-[#9A9A9A] ml-2 uppercase tracking-wider">
                    {card.statLabel}
                  </span>
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ──────────────────────── Section: Decision Flow ──────────────────────── */
function DecisionFlowSection() {
  return (
    <section className="relative px-6 lg:px-16 py-[120px] bg-[#F7F7FB] overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-label-mono text-[#574a7d] mb-4"
        >
          // DECISION FLOW
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-display-lg text-[#333333] mb-16"
        >
          From chaos to <span className="text-[#574a7d]">clarity</span> in four steps.
        </motion.h2>

        {/* Steps Row */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {decisionSteps.map((step, idx) => (
            <motion.div
              key={step.num}
              variants={{
                hidden: { opacity: 0, scale: 0 },
                visible: {
                  opacity: 1, scale: 1,
                  transition: { delay: idx * 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] },
                },
              }}
              className="flex flex-col items-center text-center"
            >
              {/* Circle */}
              <div className="w-16 h-16 rounded-full border-2 border-[#574a7d] flex items-center justify-center mb-4 bg-[#574a7d]">
                <span className="font-mono font-semibold text-[20px] text-white">{step.num}</span>
              </div>
              {/* Arrow (except last) */}
              {idx < decisionSteps.length - 1 && (
                <div className="hidden lg:block absolute right-[-28px] top-8">
                  <ArrowRight size={20} className="text-[#a39fd4]" />
                </div>
              )}
              <h4 className="text-heading-sm text-[#333333] mb-2">{step.title}</h4>
              <p className="text-body-sm text-[#6B6B6B]">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Connecting arrows for desktop */}
        <div className="hidden lg:flex justify-center mb-12">
          <svg width="800" height="24" viewBox="0 0 800 24" className="opacity-40">
            {[200, 400, 600].map((x) => (
              <g key={x}>
                <line x1={x - 60} y1="12" x2={x + 60} y2="12" stroke="#a39fd4" strokeWidth="2" />
                <polygon points={`${x + 60},8 ${x + 60},16 ${x + 72},12`} fill="#a39fd4" />
              </g>
            ))}
          </svg>
        </div>

        {/* Recommendation Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="max-w-[700px] mx-auto bg-white rounded-2xl border border-[#D9D9D3] p-8 lg:p-10"
        >
          <h3 className="text-heading-md text-[#333333] mb-6">Recommended Integration Path</h3>

          {/* Path Timeline */}
          <div className="flex items-center justify-between mb-8 px-2">
            {['Current', 'Step 1', 'Step 2', 'Merged'].map((node, i) => (
              <div key={node} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-mono font-bold"
                    style={{
                      backgroundColor: i === 0 ? '#9A9A9A' : '#574a7d',
                    }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-body-sm text-[#6B6B6B] mt-2 whitespace-nowrap">{node}</span>
                </div>
                {i < 3 && (
                  <div className="flex-1 h-[2px] bg-[#574a7d] mx-3 mt-[-20px]" />
                )}
              </div>
            ))}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-3 mb-6">
            <span className="font-mono text-[12px] uppercase tracking-wider px-4 py-2 rounded bg-[#E8E5FF] text-[#574a7d]">
              87% success probability
            </span>
            <span className="font-mono text-[12px] uppercase tracking-wider px-4 py-2 rounded bg-[#E8E5FF] text-[#4A90D9]">
              Estimated time: 23 min
            </span>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            <button className="px-6 py-3 rounded-lg bg-[#574a7d] text-white font-body font-medium text-sm hover:bg-[#4a3d6b] transition-all duration-200">
              Accept & Execute
            </button>
            <button className="px-6 py-3 rounded-lg border border-[#D9D9D3] text-[#333333] font-body font-medium text-sm hover:bg-[#E8E5FF] hover:border-[#a39fd4] transition-all duration-200">
              View Alternatives
            </button>
            <button className="px-6 py-3 rounded-lg text-[#9A9A9A] font-body font-medium text-sm hover:text-[#6B6B6B] transition-all duration-200">
              Reject
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ──────────────────────── Section: Key Features ──────────────────────── */
function KeyFeaturesSection() {
  return (
    <section className="relative px-6 lg:px-16 py-[120px] bg-[#ECEBF5] overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <motion.p
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-label-mono text-[#574a7d] mb-4"
        >
          // KEY CAPABILITIES
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-display-lg text-[#333333] mb-16"
        >
          Intelligence that <span className="text-[#574a7d]">learns</span> your stack.
        </motion.h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7"
        >
          {keyFeatures.map((feat) => {
            const IconComp = feat.icon
            return (
              <motion.div
                key={feat.title}
                variants={cardReveal}
                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(90,143,94,0.1)', borderColor: '#a39fd4' }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl border border-[#D9D9D3] p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5 bg-[#E8E5FF]">
                  <IconComp size={22} className="text-[#574a7d]" />
                </div>
                <h3 className="text-heading-sm text-[#333333] mb-3">{feat.title}</h3>
                <p className="text-body-md text-[#6B6B6B]">{feat.description}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/* ──────────────────────── Section: Comparison Table ──────────────────────── */
function ComparisonSection() {
  return (
    <section className="relative px-6 lg:px-16 py-[100px] bg-[#12101A]">
      <div className="absolute inset-0 bg-grid-pattern-dark pointer-events-none" />

      <div className="relative z-10 max-w-[800px] mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-display-md text-white mb-4"
        >
          No other tool does <span className="text-[#574a7d]">this</span>.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-body-lg text-[#9A9A9A] max-w-[600px] mx-auto mb-14"
        >
          The Integrator is the only system that unifies test results, build state, dependency graphs, and merge analysis into a single recommendation engine.
        </motion.p>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.8 }}
          className="rounded-xl border border-[#3A3A3A] overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#3A3A3A]">
                <th className="text-left px-5 py-4 font-body font-semibold text-[14px] text-white bg-[#1E1B2E]">Capability</th>
                <th className="px-4 py-4 font-body font-semibold text-[14px] text-white bg-[#574a7d]/10">TestForge</th>
                <th className="px-4 py-4 font-body font-semibold text-[14px] text-white bg-[#1E1B2E]">Traditional CI/CD</th>
                <th className="px-4 py-4 font-body font-semibold text-[14px] text-white bg-[#1E1B2E]">TestSprite</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <motion.tr
                  key={row.capability}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="border-b border-[#3A3A3A] last:border-b-0"
                >
                  <td className="text-left px-5 py-4 font-body text-[14px] text-[#9A9A9A]">{row.capability}</td>
                  <td className="px-4 py-4 bg-[#574a7d]/5">
                    <div className="flex justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                      >
                        <ComparisonIcon type={row.testforge} />
                      </motion.div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + i * 0.06, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                      >
                        <ComparisonIcon type={row.traditional} />
                      </motion.div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.06, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                      >
                        <ComparisonIcon type={row.testsprite} />
                      </motion.div>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  )
}

/* ──────────────────────── Section: CTA ──────────────────────── */
function CTASection() {
  return (
    <section className="relative px-6 lg:px-16 py-[100px] bg-[#574a7d] text-center overflow-hidden">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cta-dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-dots)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="relative z-10 max-w-[700px] mx-auto"
      >
        <h2 className="text-display-md text-white mb-8">
          Stop guessing. Start integrating with intelligence.
        </h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-4"
        >
          <motion.button
            variants={cardReveal}
            className="px-8 py-[14px] rounded-lg bg-white text-[#574a7d] font-body font-medium text-base hover:bg-[#F7F7FB] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 group"
          >
            Get Started Free
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </motion.button>

          <motion.button
            variants={cardReveal}
            className="px-8 py-[14px] rounded-lg border border-white text-white font-body font-medium text-base hover:bg-white/10 transition-all duration-200"
            onClick={() => {
              window.location.hash = '/testing-dimensions'
            }}
          >
            Explore Testing Dimensions
          </motion.button>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ──────────────────────── Main Page ──────────────────────── */
export default function Integrator() {
  return (
    <div>
      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      <HeroSection />
      <ProblemSection />

      {/* Pinned Architecture Section */}
      <div id="architecture">
        <ArchitectureLayers />
      </div>

      <DecisionFlowSection />
      <KeyFeaturesSection />
      <ComparisonSection />
      <CTASection />
    </div>
  )
}

/* ──────────────────────── Scroll Progress Bar ──────────────────────── */
function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onScroll() {
      if (!barRef.current) return
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      barRef.current.style.width = `${progress}%`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-transparent">
      <div
        ref={barRef}
        className="h-full bg-[#574a7d]"
        style={{ width: '0%', transition: 'width 0.1s linear' }}
      />
    </div>
  )
}
