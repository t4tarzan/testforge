import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getAnalysisResults, type AnalysisResults } from '@/lib/analysisStore'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import {
  ChevronDown,
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Bug,
  FileText,
  Search,
  Layers,
} from 'lucide-react'
import CountUp from 'react-countup'

gsap.registerPlugin(ScrollTrigger)

/* ────────────────────────────────────────────
   Section Label
   ──────────────────────────────────────────── */
function SectionLabel({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <p className={`text-label-mono mb-4 ${light ? 'text-[#a39fd4]' : 'text-[#574a7d]'}`}>
      // {text}
    </p>
  )
}

/* ────────────────────────────────────────────
   Hero Section
   ──────────────────────────────────────────── */
function HeroSection({ analysisData }: { analysisData: AnalysisResults | null }) {
  const heroRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    const tl = gsap.timeline()
    tl.from('.prd-hero-label', { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' })
      .from('.prd-hero-headline span', { opacity: 0, y: 40, duration: 0.8, stagger: 0.02, ease: 'power3.out' }, '-=0.2')
      .from('.prd-hero-sub', { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out' }, '-=0.4')
      .from('.prd-hero-step', { opacity: 0, scale: 0, duration: 0.5, stagger: 0.1, ease: 'back.out(1.7)' }, '-=0.2')
      .from('.prd-hero-arrow', { opacity: 0, duration: 0.4, stagger: 0.15 }, '-=0.3')
  }, { scope: heroRef })

  const headlineWords = 'Turn failures into product requirements.'.split(' ')

  return (
    <section ref={heroRef} className="relative w-full bg-[#F7F7FB] overflow-hidden">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10 pt-[140px] pb-[80px] lg:pt-[160px] lg:pb-[100px]">
        <SectionLabel text="PRD GENERATOR" />
        <h1 className="text-display-xl text-[#333333] max-w-[800px] mb-6">
          {headlineWords.map((word, i) => {
            let color = 'text-[#333333]'
            if (word === 'failures') color = 'text-[#D4524A]'
            if (word === 'requirements.') color = 'text-[#574a7d]'
            return (
              <span key={i} className={`prd-hero-headline inline-block mr-[0.3em] ${color}`}>
                {word}
              </span>
            )
          })}
        </h1>
        <p className="prd-hero-sub text-body-lg text-[#6B6B6B] max-w-[640px] mb-14">
          When tests fail, TestForge doesn't just report the error — it analyzes the failure,
          identifies the root cause, and generates a phase-wise PRD with priority and severity
          classification. The only tool that turns bugs into product roadmaps.
        </p>

        {/* 4-step mini flow */}
        <div className="flex flex-wrap items-center gap-4">
          {[
            { label: 'Failed Test', icon: Bug, pulse: true },
            { label: 'Analyze', icon: Search, pulse: false },
            { label: 'Classify', icon: Layers, pulse: false },
            { label: 'PRD Output', icon: FileText, pulse: false, glow: true },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="prd-hero-step relative">
                {step.pulse && (
                  <span className="absolute inset-0 rounded-full border-2 border-[#D4524A] animate-ping opacity-50" />
                )}
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                    step.glow ? 'border-[#574a7d] shadow-[0_0_12px_rgba(90,143,94,0.4)]' : 'border-[#574a7d]'
                  }`}
                >
                  <step.icon size={18} className={step.glow ? 'text-[#574a7d]' : 'text-[#574a7d]'} />
                </div>
                <p className="text-label-mono text-[10px] mt-2 text-center text-[#6B6B6B]">{step.label}</p>
              </div>
              {i < 3 && (
                <ArrowRight size={18} className="prd-hero-arrow text-[#a39fd4] -mt-5" />
              )}
            </div>
          ))}
        </div>

        {analysisData && (
          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { label: 'Repo', value: analysisData.repo?.split('/').pop() },
              { label: 'Files', value: analysisData.codebase?.totalFiles },
              { label: 'Findings', value: analysisData.security?.findings },
              { label: 'Coverage', value: `${analysisData.unit?.coverage || 0}%` },
            ].map(s => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-[#D9D9D3] rounded-lg px-4 py-3">
                <div className="font-bold text-lg text-[#12101A]">{s.value}</div>
                <div className="text-xs text-[#6B6B6B]">{s.label}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   4-Phase Flow Section (Pinned Scroll)
   ──────────────────────────────────────────── */
function FlowSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const phases = [
    {
      number: '01',
      title: 'Ingest Failed Tests',
      description:
        'Every failing test is captured with full context — stack traces, environment state, input data, and execution timeline.',
      tags: ['Stack Trace', 'Environment', 'Inputs', 'Timeline'],
      visual: 'terminal',
    },
    {
      number: '02',
      title: 'Analyze Root Cause',
      description:
        'Our AI traces the failure through your codebase, identifying the exact component, configuration, or dependency responsible.',
      tags: ['Root cause found in 0.8s'],
      visual: 'analysis',
    },
    {
      number: '03',
      title: 'Classify Severity',
      description:
        'Each failure is classified by business impact, user reach, and technical risk. No more guessing what to fix first.',
      tags: ['Critical', 'High', 'Medium', 'Low'],
      visual: 'severity',
    },
    {
      number: '04',
      title: 'Generate PRD',
      description:
        'A complete, structured PRD with problem statement, affected components, proposed solution, migration path, and validation criteria.',
      tags: ['Problem Statement', 'Solution', 'Migration', 'Validation'],
      visual: 'prd',
    },
  ]

  const [activePhase, setActivePhase] = useState(0)

  useGSAP(() => {
    if (!sectionRef.current || !progressRef.current) return

    const scrollTriggers: ScrollTrigger[] = []

    phases.forEach((_, i) => {
      const st = ScrollTrigger.create({
        trigger: sectionRef.current!,
        start: () => `${(i / phases.length) * 100}% top`,
        end: () => `${((i + 1) / phases.length) * 100}% top`,
        onEnter: () => setActivePhase(i),
        onEnterBack: () => setActivePhase(i),
      })
      scrollTriggers.push(st)
    })

    return () => {
      scrollTriggers.forEach(st => st.kill())
    }
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#12101A]" style={{ minHeight: '250vh' }}>
      {/* Progress bar */}
      <div className="sticky top-0 z-30 w-full h-[2px] bg-[#3A3A3A]">
        <div
          ref={progressRef}
          className="h-full bg-[#574a7d] transition-all duration-500 ease-out"
          style={{ width: `${((activePhase + 1) / phases.length) * 100}%` }}
        />
      </div>

      <div className="container-tf relative z-10 py-20 lg:py-28">
        <SectionLabel text="THE CONVERSION FLOW" light />
        <h2 className="text-display-lg text-white mb-16">
          From <span className="text-[#D4524A]">red</span> tests to{' '}
          <span className="text-[#574a7d]">green</span> roadmaps.
        </h2>

        {/* Phase display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Visual */}
          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePhase}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="w-full"
              >
                {activePhase === 0 && <TerminalVisual />}
                {activePhase === 1 && <AnalysisVisual />}
                {activePhase === 2 && <SeverityVisual />}
                {activePhase === 3 && <PrdVisual />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: Text content */}
          <div className="lg:pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePhase}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              >
                <p className="step-number mb-2">
                  {phases[activePhase].number} //
                </p>
                <h3 className="text-heading-md text-white mb-4">
                  {phases[activePhase].title}
                </h3>
                <p className="text-body-md text-[#9A9A9A] mb-6">
                  {phases[activePhase].description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {phases[activePhase].tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded text-[11px] font-mono font-medium uppercase tracking-wider border border-[#3A3A3A] text-[#a39fd4]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Phase indicators */}
            <div className="flex gap-2 mt-10">
              {phases.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhase(i)}
                  aria-label={`Go to phase ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activePhase ? 'w-8 bg-[#574a7d]' : 'w-4 bg-[#3A3A3A] hover:bg-[#6B6B6B]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Visual sub-components for Flow ── */
function TerminalVisual() {
  return (
    <div className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3A3A3A] bg-[#12101A]">
        <div className="w-3 h-3 rounded-full bg-[#D4524A]" />
        <div className="w-3 h-3 rounded-full bg-[#E8A838]" />
        <div className="w-3 h-3 rounded-full bg-[#574a7d]" />
        <span className="ml-3 text-label-mono text-[10px] text-[#9A9A9A]">FAIL</span>
      </div>
      <div className="p-5 font-mono text-sm leading-relaxed overflow-x-auto">
        <p className="text-[#D4524A] font-medium mb-2">FAIL User Authentication Flow — Token Expiry</p>
        <p className="text-[#E87D3A] mb-1">AssertionError: Token refresh failed after 24h expiry</p>
        <p className="text-[#9A9A9A] text-xs mb-4">Duration: 2.4s | Suite: auth/integration</p>
        <div className="text-[#6B6B6B] text-xs space-y-1">
          <p>at TokenManager.refresh (src/auth/token-manager.ts:142)</p>
          <p>at SessionHandler.validate (src/session/handler.ts:89)</p>
          <p>at APIGateway.authenticate (src/gateway/middleware.ts:56)</p>
        </div>
      </div>
    </div>
  )
}

function AnalysisVisual() {
  return (
    <div className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-6 shadow-2xl">
      <p className="text-label-mono text-[10px] text-[#9A9A9A] mb-4">ROOT CAUSE ANALYSIS</p>
      <div className="flex flex-col items-center gap-4">
        <div className="px-4 py-2 rounded-lg border border-[#D4524A] bg-[rgba(212,82,74,0.1)] text-[#D4524A] font-mono text-sm">
          Token Refresh Failure
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
          {['Auth Service v2.3', 'Redis Cache TTL', 'JWT Config', 'Session Handler'].map((node, i) => (
            <div
              key={node}
              className={`px-3 py-2 rounded-lg border text-center text-xs font-mono ${
                i === 1
                  ? 'border-[#D4524A] bg-[rgba(212,82,74,0.1)] text-[#D4524A]'
                  : 'border-[#3A3A3A] text-[#9A9A9A]'
              }`}
            >
              {node}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#574a7d] animate-pulse" />
        <span className="text-[#574a7d] text-xs font-mono">Root cause found in 0.8s</span>
      </div>
    </div>
  )
}

function SeverityVisual() {
  const severities = [
    { label: 'CRITICAL', color: '#D4524A', desc: 'Complete outage' },
    { label: 'HIGH', color: '#E87D3A', desc: 'Major feature broken' },
    { label: 'MEDIUM', color: '#E8A838', desc: 'Partial impact' },
    { label: 'LOW', color: '#574a7d', desc: 'Minor issue' },
  ]

  return (
    <div className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-6 shadow-2xl">
      <p className="text-label-mono text-[10px] text-[#9A9A9A] mb-4">SEVERITY CLASSIFICATION</p>
      <div className="flex items-center gap-3 mb-5">
        <span
          className="px-3 py-1 rounded font-mono text-xs font-medium"
          style={{ backgroundColor: 'rgba(232,125,58,0.1)', color: '#E87D3A' }}
        >
          HIGH
        </span>
        <span className="text-[#E8A838] font-mono text-xs">P1 — Sprint Blocker</span>
      </div>
      <p className="text-sm text-[#9A9A9A] mb-2">
        Affected: <span className="text-white">Auth Service, User Sessions, API Gateway</span>
      </p>
      <p className="text-sm text-[#9A9A9A] mb-6">
        Impact: <span className="text-[#D4524A]">All users logged out after 24h, cannot re-authenticate</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {severities.map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-2 py-1.5 rounded border border-[#3A3A3A]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] font-mono" style={{ color: s.color }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrdVisual() {
  return (
    <div className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-[#3A3A3A] bg-[#12101A] flex items-center justify-between">
        <span className="font-mono text-xs text-[#9A9A9A]">PRD-2026-0842</span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[rgba(90,143,94,0.15)] text-[#574a7d]">
          Generated
        </span>
      </div>
      <div className="p-4 space-y-2">
        {['Problem Statement', 'Affected Components', 'Proposed Solution', 'Migration Path', 'Validation Criteria'].map(
          (section) => (
            <div key={section} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#3A3A3A]">
              <CheckMini />
              <span className="text-sm text-[#9A9A9A]">{section}</span>
              <ChevronDown size={14} className="text-[#6B6B6B] ml-auto" />
            </div>
          )
        )}
      </div>
      <div className="px-4 py-2 border-t border-[#3A3A3A]">
        <span className="text-[10px] font-mono text-[#574a7d]">Generated by TestForge</span>
      </div>
    </div>
  )
}

function CheckMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" stroke="#574a7d" strokeWidth="1" />
      <path d="M4 7L6 9L10 5" stroke="#574a7d" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ────────────────────────────────────────────
   Interactive PRD Preview Section
   ──────────────────────────────────────────── */
function PrdPreviewSection({ analysisData }: { analysisData: AnalysisResults | null }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [openSection, setOpenSection] = useState<number | null>(0)

  const prdSections = [
    {
      title: 'Problem Statement',
      content:
        'User authentication tokens expire after 24 hours without a proper refresh mechanism, causing forced re-authentication and session loss for all active users.',
    },
    {
      title: 'Affected Components',
      content: (
        <div className="space-y-2 font-mono text-sm">
          <p className="text-[#4A90D9]">auth-service/src/token-manager.ts</p>
          <p className="text-[#4A90D9]">api-gateway/middleware/auth.ts</p>
          <p className="text-[#4A90D9]">session-store/redis-config.yaml</p>
        </div>
      ),
    },
    {
      title: 'Proposed Solution',
      content:
        'Implement sliding window token refresh with configurable TTL. Add Redis-based session persistence with automatic expiry extension on active use.',
    },
    {
      title: 'Migration Path',
      content: (
        <div className="space-y-2 text-sm">
          <p><span className="text-[#574a7d] font-mono">Phase 1:</span> Deploy token refresh endpoint</p>
          <p><span className="text-[#574a7d] font-mono">Phase 2:</span> Update client SDK</p>
          <p><span className="text-[#574a7d] font-mono">Phase 3:</span> Enable Redis session store</p>
          <p><span className="text-[#574a7d] font-mono">Phase 4:</span> Gradual rollout with feature flag</p>
        </div>
      ),
    },
    {
      title: 'Validation Criteria',
      content: (
        <ul className="space-y-2 text-sm list-disc list-inside text-[#6B6B6B]">
          <li>Tokens refresh successfully up to 7 days of active use</li>
          <li>No session loss during migration</li>
          <li>p99 latency &lt; 50ms for refresh endpoint</li>
        </ul>
      ),
    },
  ]

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.prd-preview-card', {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
        once: true,
      },
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F7F7FB] py-24 lg:py-32">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10">
        <SectionLabel text="PRD STRUCTURE" />
        <h2 className="text-display-lg text-[#333333] mb-12">
          Every PRD follows a <span className="text-[#574a7d]">proven structure</span>.
        </h2>

        <div className="prd-preview-card max-w-[900px] mx-auto bg-white border border-[#D9D9D3] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#D9D9D3] flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-[#6B6B6B]">PRD-2026-0842</span>
            <span className="font-mono text-xs text-[#9A9A9A]">•</span>
            <span className="font-mono text-xs text-[#9A9A9A]">Jan 15, 2026</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#E8E5FF] text-[#574a7d]">
                Generated
              </span>
              <span
                className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium"
                style={{ backgroundColor: 'rgba(232,125,58,0.1)', color: '#E87D3A' }}
              >
                HIGH
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="px-6 py-4 border-b border-[#D9D9D3]">
            <h3 className="font-heading font-semibold text-lg text-[#12101A]">
              Token Refresh Mechanism Update
            </h3>
          </div>

          {/* Accordion */}
          <div className="divide-y divide-[#D9D9D3]">
            {prdSections.map((section, i) => (
              <div key={section.title} className="">
                <button
                  onClick={() => setOpenSection(openSection === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F7F7FB] transition-colors duration-200"
                >
                  <span className="font-medium text-[15px] text-[#333333]">{section.title}</span>
                  <motion.div
                    animate={{ rotate: openSection === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-[#6B6B6B]" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openSection === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 text-[#6B6B6B] leading-relaxed">
                        {section.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* Real findings from latest analysis */}
        {analysisData?.security?.items && analysisData.security.items.length > 0 && (
          <div className="mt-8 max-w-[900px] mx-auto">
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-3">
              // REAL FINDINGS FROM {analysisData.repo?.split('/').pop()?.toUpperCase()}
            </p>
            <div className="space-y-2">
              {analysisData.security.items.slice(0, 5).map((f, i) => (
                <div key={i} className="bg-white border border-[#D9D9D3] rounded-lg p-4 flex items-start gap-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium uppercase flex-shrink-0 ${
                    f.severity === 'critical' ? 'bg-[rgba(212,82,74,0.1)] text-[#D4524A]' :
                    f.severity === 'high' ? 'bg-[rgba(232,125,58,0.1)] text-[#E87D3A]' :
                    'bg-[rgba(232,168,56,0.1)] text-[#E8A838]'
                  }`}>{f.severity}</span>
                  <div>
                    <p className="text-sm font-medium text-[#12101A]">{f.title}</p>
                    {f.filePath && <p className="text-xs text-[#9A9A9A] font-mono mt-0.5">{f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}</p>}
                    {f.fixSuggestion && <p className="text-xs text-[#574a7d] mt-1">Fix: {f.fixSuggestion.slice(0, 120)}...</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   Severity Classification Section
   ──────────────────────────────────────────── */
function SeveritySection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  const severities = [
    {
      level: 'Critical',
      color: '#D4524A',
      icon: AlertOctagon,
      description: 'Complete system failure. No workaround. All users affected. Immediate action required.',
      example: 'Payment processing down. All transactions failing.',
    },
    {
      level: 'High',
      color: '#E87D3A',
      icon: AlertTriangle,
      description: 'Major feature broken. Limited workaround available. Significant user impact. Fix within 24h.',
      example: 'Auth tokens not refreshing. Users logged out every 24h.',
    },
    {
      level: 'Medium',
      color: '#E8A838',
      icon: AlertCircle,
      description: 'Partial functionality affected. Workaround exists. Moderate user impact. Fix within 1 week.',
      example: 'Search results pagination skips page 2 on mobile.',
    },
    {
      level: 'Low',
      color: '#574a7d',
      icon: Info,
      description: 'Minor issue. Easy workaround. Minimal user impact. Fix in next sprint.',
      example: 'Loading spinner not centered on 320px screens.',
    },
  ]

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.sev-card', {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
        once: true,
      },
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#ECEBF5] py-20 lg:py-24">
      <div className="container-tf">
        <SectionLabel text="SEVERITY CLASSIFICATION" />
        <h2 className="text-display-md text-[#333333] mb-10">
          <span className="text-[#574a7d]">Priority</span>, not panic.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-[1000px]">
          {severities.map((sev) => (
            <motion.div
              key={sev.level}
              className="sev-card bg-white rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300"
              whileHover={{ y: -4 }}
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: sev.color }} />
              <div className="p-6">
                <sev.icon size={24} style={{ color: sev.color }} className="mb-3" />
                <h3 className="font-heading font-semibold text-lg text-[#333333] mb-2">{sev.level}</h3>
                <p className="text-body-sm text-[#6B6B6B] mb-4">{sev.description}</p>
                <div className="pt-3 border-t border-[#D9D9D3]">
                  <p className="text-[11px] text-[#9A9A9A] font-mono uppercase tracking-wider mb-1">Example</p>
                  <p className="text-xs text-[#6B6B6B] italic">&ldquo;{sev.example}&rdquo;</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   Before/After Comparison Section
   ──────────────────────────────────────────── */
function ComparisonSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [countUpKey, setCountUpKey] = useState(0)

  useGSAP(() => {
    if (!sectionRef.current) return

    const st = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 70%',
      once: true,
      onEnter: () => setCountUpKey(prev => prev + 1),
    })

    gsap.from('.before-card', {
      x: -40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
        once: true,
      },
    })

    gsap.from('.after-card', {
      x: 40,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
        once: true,
      },
    })

    return () => { st.kill() }
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative w-full bg-[#12101A] py-20 lg:py-24">
      <div className="container-tf">
        <h2 className="text-display-md text-white text-center mb-14">
          From bug report to <span className="text-[#574a7d]">product roadmap</span>.
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[900px] mx-auto items-stretch">
          {/* Before */}
          <div className="before-card bg-[#1E1B2E] border border-[rgba(212,82,74,0.3)] rounded-xl p-6">
            <p className="text-label-mono text-[10px] text-[#9A9A9A] mb-3">TRADITIONAL BUG REPORT</p>
            <h3 className="font-heading font-semibold text-lg text-white mb-3">Bug #4821: Token refresh broken</h3>
            <p className="text-sm text-[#9A9A9A] mb-4">
              Vague title, no context, no priority, assigned to dev with no clear path forward.
            </p>
            <div className="mt-auto pt-4 border-t border-[#3A3A3A]">
              <span className="text-sm font-mono text-[#D4524A]">
                Time to resolution:{' '}
                {countUpKey > 0 ? <CountUp end={3.2} decimals={1} duration={1.5} /> : '3.2'} days avg
              </span>
            </div>
          </div>

          {/* Arrow indicator for larger screens */}
          <div className="hidden lg:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <motion.div
              animate={{ x: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-full bg-[#574a7d]/20 flex items-center justify-center"
            >
              <ArrowRight size={20} className="text-[#574a7d]" />
            </motion.div>
          </div>

          {/* After */}
          <div className="after-card bg-[#1E1B2E] border border-[rgba(90,143,94,0.3)] rounded-xl p-6">
            <p className="text-label-mono text-[10px] text-[#a39fd4] mb-3">TESTFORGE PRD OUTPUT</p>
            <h3 className="font-heading font-semibold text-lg text-white mb-3">
              PRD-2026-0842: Token Refresh Mechanism Update
            </h3>
            <p className="text-sm text-[#a39fd4] mb-4">
              Structured PRD with all 5 sections, severity HIGH, priority P1, migration path with phases, validation criteria.
            </p>
            <div className="mt-auto pt-4 border-t border-[#3A3A3A]">
              <span className="text-sm font-mono text-[#574a7d]">
                Time to resolution:{' '}
                {countUpKey > 0 ? <CountUp end={0.8} decimals={1} duration={1.5} /> : '0.8'} days avg
              </span>
            </div>
          </div>
        </div>

        {/* Benefit pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-14">
          {['Structured Requirements', 'Clear Priorities', 'Migration Paths', 'Faster Resolution'].map((pill) => (
            <span
              key={pill}
              className="px-5 py-2.5 rounded-lg border border-[#3A3A3A] text-[#a39fd4] text-[13px] font-mono font-medium"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   CTA Section
   ──────────────────────────────────────────── */
function CTASection() {
  const navigate = useNavigate()

  return (
    <section className="relative w-full bg-[#574a7d] py-20 lg:py-24">
      <div className="container-tf text-center">
        <h2 className="text-display-md text-white mb-8">
          Let failures write your roadmap.
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="px-7 py-[14px] rounded-lg bg-white text-[#574a7d] font-body font-medium text-base hover:bg-[#F7F7FB] hover:scale-[1.02] transition-all duration-200">
            Get Started Free
          </button>
          <button
            onClick={() => navigate('/pipeline')}
            className="px-7 py-[14px] rounded-lg border border-white text-white font-body font-medium text-base hover:bg-white/10 transition-all duration-200"
          >
            View the Pipeline
          </button>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────────────────────
   Main Page Component
   ──────────────────────────────────────────── */
export default function PrdGenerator() {
  const [analysisData, setAnalysisData] = useState<AnalysisResults | null>(null);

  useEffect(() => {
    setAnalysisData(getAnalysisResults());
  }, []);

  return (
    <div className="min-h-[100dvh]">
      {/* Real data banner */}
      {analysisData && (
        <div className="bg-[#E8E5FF] border-b border-[#a39fd4] px-4 py-2.5 text-center">
          <span className="font-mono text-xs text-[#574a7d]">
            📊 Real analysis loaded from <strong>{analysisData.repo}</strong> — {analysisData.codebase?.totalFiles || 0} files, {analysisData.security?.findings || 0} findings
          </span>
        </div>
      )}
      <HeroSection analysisData={analysisData} />
      <FlowSection />
      <PrdPreviewSection analysisData={analysisData} />
      <SeveritySection />
      <ComparisonSection />
      <CTASection />
    </div>
  )
}
