import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { useInView } from 'framer-motion'
import {
  ArrowRight,
  PlayCircle,
  Check,
  Target,
  Eye,
  Grid3x3,
  TrendingUp,
  Brain,
  Shield,
  Camera,
  Accessibility,
  Zap,
  ChevronRight,
  Download,
  GitBranch,
  ShieldCheck,
} from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger)

/* ──────────────────────── AnimatedCounter (Framer Motion isolated) ──────────────────────── */
function AnimatedCounter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <span ref={ref}>
      {isInView ? (
        <CountUp end={end} duration={1.5} suffix={suffix} prefix={prefix} />
      ) : (
        `${prefix}0${suffix}`
      )}
    </span>
  )
}

/* ──────────────────────── Section wrapper with scroll reveal ──────────────────────── */
function ScrollReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ──────────────────────── Floating Badge Component ──────────────────────── */
function FloatingBadge({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={`absolute ${className}`}
      style={{
        animation: `float 3s ease-in-out ${delay}s infinite`,
      }}
    >
      {children}
    </div>
  )
}

/* ──────────────────────── Feature Card ──────────────────────── */
function FeatureCard({ icon, title, description, badge }: { icon: React.ReactNode; title: string; description: string; badge: string }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="bg-white border border-[#D9D9D3] rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300 group"
    >
      <div className="mb-4 text-[#574a7d] group-hover:scale-105 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="font-heading font-medium text-[22px] text-[#333333] mb-2">{title}</h3>
      <p className="text-[#6B6B6B] text-sm leading-relaxed mb-4">{description}</p>
      <span className="inline-block font-mono text-xs font-medium uppercase tracking-wider text-[#574a7d] bg-[#E8E5FF] px-3 py-1 rounded">
        {badge}
      </span>
    </motion.div>
  )
}

/* ──────────────────────── Testimonial Card ──────────────────────── */
function TestimonialCard({ quote, name, title, image }: { quote: string; name: string; title: string; image: string }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-8 relative"
    >
      <span className="absolute top-4 left-6 text-[48px] leading-none text-[#574a7d] opacity-20 font-heading">
        &ldquo;
      </span>
      <p className="text-white text-base leading-relaxed italic pt-8 mb-6">{quote}</p>
      <div className="flex items-center gap-3">
        <img src={image} alt={name} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="text-white font-medium text-[15px]">{name}</p>
          <p className="text-[#9A9A9A] text-sm">{title}</p>
        </div>
      </div>
    </motion.div>
  )
}

/* ──────────────────────── Pipeline Stage Card ──────────────────────── */
function PipelineStageCard({ number, name, progress, status }: { number: string; name: string; progress: number; status: 'complete' | 'running' | 'pending' }) {
  const statusColors = {
    complete: 'bg-[#574a7d]',
    running: 'bg-[#E8A838]',
    pending: 'bg-[#9A9A9A]',
  }
  const statusIcon = {
    complete: <Check size={14} className="text-white" />,
    running: <span className="w-2 h-2 bg-white rounded-full animate-pulse" />,
    pending: <span className="w-2 h-2 bg-white/50 rounded-full" />,
  }

  return (
    <div className="flex items-center gap-4 bg-white rounded-lg p-4 border-l-4 border-[#574a7d] shadow-sm">
      <span className="font-mono text-xs text-[#574a7d] w-8">{number}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm text-[#333333]">{name}</span>
          <div className={`w-6 h-6 rounded-full ${statusColors[status]} flex items-center justify-center`}>
            {statusIcon[status]}
          </div>
        </div>
        <div className="w-full h-1.5 bg-[#E8E5FF] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${progress}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="h-full bg-[#574a7d] rounded-full"
          />
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── Step Visual Components ──────────────────────── */
function Step01Visual() {
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 shadow-lg">
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 border border-[#D9D9D3] rounded-lg hover:border-[#574a7d] hover:bg-[#E8E5FF] transition-all cursor-pointer">
          <div className="w-8 h-8 bg-[#12101A] rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </div>
          <span className="font-medium text-sm">GitHub</span>
        </div>
        <div className="flex items-center gap-3 p-3 border border-[#D9D9D3] rounded-lg hover:border-[#574a7d] hover:bg-[#E8E5FF] transition-all cursor-pointer">
          <div className="w-8 h-8 bg-[#FC6D26] rounded-full flex items-center justify-center text-white font-bold text-xs">GL</div>
          <span className="font-medium text-sm">GitLab</span>
        </div>
        <div className="flex items-center gap-3 p-3 border border-[#D9D9D3] rounded-lg hover:border-[#574a7d] hover:bg-[#E8E5FF] transition-all cursor-pointer">
          <div className="w-8 h-8 bg-[#FCA121] rounded-full flex items-center justify-center text-white font-bold text-xs">BB</div>
          <span className="font-medium text-sm">Bitbucket</span>
        </div>
        <div className="mt-4 p-3 bg-[#E8E5FF] rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Check size={14} className="text-[#574a7d]" />
            <span className="text-xs text-[#333333]">Repository detected</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-[#574a7d]" />
            <span className="text-xs text-[#333333]">Auto-configuration ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step02Visual() {
  const stages = [
    { name: 'Scope', active: true },
    { name: 'Security', active: true },
    { name: 'Load', active: true },
    { name: 'Visual', active: false },
  ]
  return (
    <div className="bg-[#12101A] border border-[#3A3A3A] rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono ${
              stage.active ? 'bg-[#574a7d] text-white' : 'bg-[#3A3A3A] text-[#9A9A9A]'
            }`}>
              {stage.active ? <Check size={14} /> : (i + 1)}
            </div>
            {i < stages.length - 1 && (
              <div className={`w-8 h-0.5 ${stage.active ? 'bg-[#574a7d]' : 'bg-[#3A3A3A]'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.name} className={`flex items-center justify-between p-2 rounded ${
            stage.active ? 'bg-[#1E1B2E]' : ''
          }`}>
            <span className={`text-xs ${stage.active ? 'text-white' : 'text-[#9A9A9A]'}`}>{stage.name} Test</span>
            {stage.active && <span className="text-[10px] font-mono text-[#574a7d]">PASSING</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Step03Visual() {
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 shadow-lg">
      <div className="bg-[#12101A] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-[#D4524A]" />
          <span className="text-white text-xs font-mono">Failed: API Auth Test</span>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#D4524A] bg-[#D4524A]/10 px-2 py-0.5 rounded">CRITICAL</span>
          </div>
          <p className="text-[#9A9A9A] text-xs">Token refresh returns 401 on expired sessions</p>
        </div>
        <div className="border-t border-[#3A3A3A] pt-3">
          <p className="text-[#574a7d] text-[10px] font-mono uppercase mb-2">Generated PRD</p>
          <div className="bg-[#1E1B2E] rounded p-2">
            <p className="text-white text-xs">Implement sliding window token refresh with 5min buffer</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)

  /* ── GSAP Hero Animation ── */
  useGSAP(() => {
    if (!headlineRef.current) return

    const chars = headlineRef.current.querySelectorAll('.hero-char')
    gsap.fromTo(chars,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.02,
        delay: 0.3,
      }
    )

    gsap.fromTo('.hero-subheadline',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out', delay: 0.9 }
    )

    gsap.fromTo('.hero-cta',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out', stagger: 0.1, delay: 1.1 }
    )

    gsap.fromTo('.hero-stats',
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power2.out', delay: 1.5 }
    )

    gsap.fromTo('.hero-media',
      { scale: 0.92, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1, ease: 'expo.out', delay: 0.4 }
    )
  }, { scope: heroRef })

  /* ── Problem Section: Animated Bars ── */
  const problemRef = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!problemRef.current) return
    gsap.fromTo('.problem-bar-left',
      { scaleY: 0 },
      {
        scaleY: 1,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: problemRef.current, start: 'top 70%' },
      }
    )
    gsap.fromTo('.problem-bar-right',
      { scaleY: 0 },
      {
        scaleY: 1,
        duration: 1.2,
        ease: 'expo.out',
        delay: 0.2,
        scrollTrigger: { trigger: problemRef.current, start: 'top 70%' },
      }
    )
  }, { scope: problemRef })

  /* ── Split headline text into characters ── */
  const renderAnimatedHeadline = () => {
    const lines = [
      ['Harden your codebase,', '#333333'],
      ['Ship with certainty.', '#574a7d'],
      ['AI-native testing', '#333333'],
      ['Your code never leaves', '#574a7d'],
      ['your machine.', '#333333'],
    ]
    let charIndex = 0
    return lines.map(([text, color], li) => (
      <span key={li} style={{ color, display: 'block' }}>
        {text.split('').map((char) => {
          const el = (
            <span key={charIndex} className="hero-char inline-block" style={{ opacity: 0 }}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          )
          charIndex++
          return el
        })}
      </span>
    ))
  }

  /* ── Pipeline Preview State ── */
  const [activeStage, setActiveStage] = useState(0)
  const pipelineStages = [
    { num: '01', name: 'Code Ingestion', progress: 100, status: 'complete' as const },
    { num: '02', name: 'Scope Analysis', progress: 100, status: 'complete' as const },
    { num: '03', name: 'Security Scan', progress: 75, status: 'running' as const },
    { num: '04', name: 'Load Test', progress: 40, status: 'running' as const },
    { num: '05', name: 'Visual Regression', progress: 0, status: 'pending' as const },
    { num: '06', name: 'Report', progress: 0, status: 'pending' as const },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % pipelineStages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const testimonials = [
    {
      quote: "Agentic coding systems accelerate development but are also unreliable. Agentic testing — where AI writes tests and checks your code against them — is the missing piece.",
      name: 'Andrew K.',
      title: 'VP Engineering at DeepFlow',
      image: '/testimonial-1.jpg',
    },
    {
      quote: "Don't tell AI what to do, give it success criteria and watch it go. Get it to write tests first, then pass them. TestForge makes this loop autonomous.",
      name: 'Sarah L.',
      title: 'AI Researcher',
      image: '/testimonial-2.jpg',
    },
    {
      quote: "The most important thing for AI code quality — give it a feedback loop. TestForge provides that verification layer and it 3x'd our production stability.",
      name: 'Marcus T.',
      title: 'CTO at BuildScale',
      image: '/testimonial-3.jpg',
    },
  ]

  const dimensionCards = [
    { icon: <Target size={48} />, title: 'Scope Testing', description: 'Requirements coverage & boundary validation', badge: '98% coverage' },
    { icon: <Eye size={48} />, title: 'Vision & Goal Testing', description: 'Business goal alignment & outcome prediction', badge: '94% alignment' },
    { icon: <Grid3x3 size={48} />, title: 'Feature Matrix Testing', description: 'Traceability matrices & impact analysis', badge: 'Auto-gen' },
    { icon: <TrendingUp size={48} />, title: 'Load & Scale Testing', description: 'Distributed load & predictive performance', badge: '10K+ RPS' },
    { icon: <Brain size={48} />, title: 'Predictive Testing', description: 'ML defect prediction & risk scoring', badge: '87% accuracy' },
    { icon: <Shield size={48} />, title: 'Security Testing', description: 'SAST, DAST, AI fuzzing', badge: '4x coverage' },
    { icon: <Camera size={48} />, title: 'Visual Regression', description: 'AI computer vision comparison', badge: 'Pixel-perfect' },
    { icon: <Accessibility size={48} />, title: 'Accessibility Testing', description: 'WCAG compliance validation', badge: '57% auto' },
    { icon: <Zap size={48} />, title: 'Chaos Engineering', description: 'RL-driven fault injection', badge: '+26.5% detection' },
  ]

  return (
    <div ref={heroRef}>
      {/* ═══════════════════════════════════════════
          SECTION 2: HERO
          ═══════════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] pt-[72px] overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />

        <div className="container-tf relative z-10 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[52%_48%] gap-12 lg:gap-8 items-center">
            {/* Left: Text */}
            <div>
              <p className="section-label mb-4">// PRIVACY-FIRST AUTONOMOUS TESTING ENGINE</p>
              <h1 ref={headlineRef} className="text-display-lg mb-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                {renderAnimatedHeadline()}
              </h1>
              <p className="hero-subheadline text-body-lg text-[#6B6B6B] max-w-[480px] mb-8" style={{ opacity: 0 }}>
                Don&apos;t let AI-generated code ship untested. TestForge runs on your machine, finds vulnerabilities, and gives you a battle plan — your code never leaves your system.
              </p>

              {/* CTA Group */}
              <div className="flex flex-wrap gap-4 mb-12">
                <Link to="/mcp" className="hero-cta px-7 py-[14px] rounded-lg bg-[#574a7d] text-white font-body font-medium text-base hover:bg-[#453a68] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 group" style={{ opacity: 0 }}>
                  Install MCP
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link to="/managed" className="hero-cta px-7 py-[14px] rounded-lg border border-[#D9D9D3] text-[#333333] font-body font-medium text-base hover:bg-[#E8E5FF] hover:border-[#a99bff] transition-all duration-200 flex items-center gap-2" style={{ opacity: 0 }}>
                  <PlayCircle size={16} />
                  Triage Demo
                </Link>
              </div>

              {/* Stats Row */}
              <div className="hero-stats flex flex-wrap items-center gap-x-6 gap-y-2" style={{ opacity: 0 }}>
                <span className="font-mono text-[13px] text-[#6B6B6B]">Local-first</span>
                <span className="text-[#D9D9D3]">·</span>
                <span className="font-mono text-[13px] text-[#6B6B6B]">13 test dimensions</span>
                <span className="text-[#D9D9D3]">·</span>
                <span className="font-mono text-[13px] text-[#574a7d] font-medium">Your code never uploads</span>
              </div>
            </div>

            {/* Right: Hero Media */}
            <div className="hero-media relative" style={{ opacity: 0 }}>
              <div className="relative rounded-xl border-2 border-[#E8E5FF] shadow-xl overflow-hidden bg-white p-1.5">
                <img
                  src="/hero-dashboard.jpg"
                  alt="TestForge Dashboard"
                  className="w-full h-auto rounded-lg"
                />
              </div>

              {/* Floating badges */}
              <FloatingBadge className="-top-4 -right-4" delay={0}>
                <div className="bg-[#574a7d] text-white text-xs font-mono px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
                  <Check size={14} />
                  All Tests Passing
                </div>
              </FloatingBadge>
              <FloatingBadge className="-bottom-4 -left-4" delay={1.5}>
                <div className="bg-white border border-[#D9D9D3] text-[#333333] text-xs font-mono px-3 py-2 rounded-lg shadow-lg">
                  <span className="text-[#574a7d] font-bold">94%</span> Coverage
                </div>
              </FloatingBadge>
              <FloatingBadge className="top-1/2 -right-8" delay={0.75}>
                <div className="w-10 h-10 bg-[#E8E5FF] border border-[#a39fd4] rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-3 h-3 bg-[#574a7d] rounded-full animate-pulse" />
                </div>
              </FloatingBadge>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 3: TRUSTED BY / LOGO STRIP
          ═══════════════════════════════════════════ */}
      <section className="bg-cream-dark py-8">
        <div className="container-tf">
          <ScrollReveal>
            <p className="section-label text-center mb-6">// Trusted by engineering teams that take testing seriously</p>
          </ScrollReveal>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            {['GitHub', 'Vercel', 'Stripe', 'Linear', 'Figma', 'Supabase', 'Railway'].map((name, i) => (
              <ScrollReveal key={name} delay={i * 0.06}>
                <div className="text-[#9A9A9A] font-heading font-semibold text-lg lg:text-xl opacity-50 hover:opacity-100 transition-opacity duration-300 cursor-default select-none">
                  {name}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4: PROBLEM STATEMENT
          ═══════════════════════════════════════════ */}
      <section ref={problemRef} className="bg-[#12101A] py-24 lg:py-32">
        <div className="container-tf max-w-[900px] text-center">
          <ScrollReveal>
            <p className="section-label-light mb-6">// THE REALITY CHECK</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h2 className="text-display-lg mb-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              <span className="text-[#574a7d]">50-55%</span>
              <span className="text-white"> of AI-generated code fails in production</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-[#9A9A9A] max-w-[640px] mx-auto mb-16">
              When AI builds your app, traditional testing catches barely half the issues. TestForge closes the gap with 13 autonomous testing dimensions — so your code ships with confidence.
            </p>
          </ScrollReveal>

          {/* Comparison Bars */}
          <ScrollReveal delay={0.3}>
            <div className="flex items-end justify-center gap-16 lg:gap-24 h-[300px]">
              <div className="flex flex-col items-center gap-3">
                <span className="text-[#D4524A] font-heading font-bold text-2xl">
                  <AnimatedCounter end={55} suffix="%" />
                </span>
                <div className="relative w-24 lg:w-32 h-[200px] bg-[#1E1B2E] rounded-t-lg overflow-hidden">
                  <div
                    className="problem-bar-left absolute bottom-0 left-0 right-0 bg-[#D4524A]/60 rounded-t-lg origin-bottom"
                    style={{ height: '55%' }}
                  />
                </div>
                <span className="text-[#9A9A9A] text-sm font-body">Traditional Testing</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <span className="text-[#574a7d] font-heading font-bold text-2xl">
                  <AnimatedCounter end={94} suffix="%" />
                </span>
                <div className="relative w-24 lg:w-32 h-[200px] bg-[#1E1B2E] rounded-t-lg overflow-hidden">
                  <div
                    className="problem-bar-right absolute bottom-0 left-0 right-0 bg-[#574a7d] rounded-t-lg origin-bottom"
                    style={{ height: '94%' }}
                  />
                </div>
                <span className="text-[#9A9A9A] text-sm font-body">TestForge</span>
              </div>
            </div>
            <p className="text-[#9A9A9A] text-sm mt-6 font-mono uppercase tracking-wider">Features Delivered</p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5: PIPELINE OVERVIEW
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />
        <div className="container-tf relative z-10">
          <div className="grid lg:grid-cols-[40%_60%] gap-12 lg:gap-16">
            {/* Left */}
            <div>
              <ScrollReveal>
                <p className="section-label mb-4">// MULTI-DIMENSIONAL PIPELINE</p>
                <h2 className="text-display-lg mb-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                  <span className="text-[#333333]">One pipeline. </span>
                  <span className="text-[#574a7d]">Thirteen</span>
                  <span className="text-[#333333]"> testing dimensions.</span>
                </h2>
              </ScrollReveal>
              <ScrollReveal delay={0.1}>
                <p className="text-body-lg text-[#6B6B6B] max-w-[440px] mb-8">
                  From scope analysis to chaos engineering — every test runs autonomously, in parallel, with real-time progress tracking and intelligent failure analysis.
                </p>
              </ScrollReveal>
              <div className="space-y-4 mb-8">
                {[
                  'Scope, Vision & Goal Testing',
                  'Load, Scale & Predictive Testing',
                  'Security, Visual & Accessibility Testing',
                  'Chaos, Mutation & Edge Case Generation',
                ].map((item, i) => (
                  <ScrollReveal key={item} delay={0.15 + i * 0.08}>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#E8E5FF] flex items-center justify-center">
                        <Check size={12} className="text-[#574a7d]" />
                      </div>
                      <span className="text-[#333333] text-sm">{item}</span>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
              <ScrollReveal delay={0.5}>
                <Link
                  to="/pipeline"
                  className="inline-flex items-center gap-2 px-7 py-[14px] rounded-lg bg-[#12101A] text-white font-body font-medium text-base hover:bg-[#333333] hover:scale-[1.02] transition-all duration-200 group"
                >
                  Explore the Pipeline
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </ScrollReveal>
            </div>

            {/* Right: Pipeline Preview */}
            <ScrollReveal delay={0.2}>
              <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 lg:p-8 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-heading font-medium text-lg text-[#333333]">Pipeline Preview</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#574a7d] animate-pulse" />
                    <span className="font-mono text-xs text-[#6B6B6B]">Running</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {pipelineStages.map((stage, i) => (
                    <div key={stage.num} className={`transition-opacity duration-300 ${i === activeStage ? 'opacity-100' : 'opacity-70'}`}>
                      <PipelineStageCard
                        number={stage.num}
                        name={stage.name}
                        progress={stage.progress}
                        status={i < activeStage ? 'complete' : i === activeStage ? 'running' : 'pending'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 6: THE INTEGRATOR
          ═══════════════════════════════════════════ */}
      <section className="bg-[#12101A] py-24 lg:py-32">
        <div className="container-tf">
          <div className="max-w-[800px] mx-auto text-center mb-16">
            <ScrollReveal>
              <p className="section-label-light mb-6">// THE INTEGRATOR</p>
              <h2 className="text-display-lg mb-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                <span className="text-white">Smart integration decisions, powered by </span>
                <span className="text-[#574a7d]">intelligence.</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <p className="text-body-lg text-[#9A9A9A] max-w-[640px] mx-auto">
                The Integrator takes every test result, action plan, and dependency graph — then wisely recommends the best path forward. No more merge conflicts. No more dependency nightmares.
              </p>
            </ScrollReveal>
          </div>

          {/* Integrator Card */}
          <ScrollReveal delay={0.2}>
            <div className="max-w-[800px] mx-auto bg-[#1E1B2E] border border-[#3A3A3A] rounded-[20px] p-8 lg:p-12 mb-10">
              {/* 4-Layer Architecture */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { icon: <Download size={24} />, title: 'State Ingestion', subtitle: 'Collect & Parse' },
                  { icon: <Brain size={24} />, title: 'Analysis Engine', subtitle: 'Evaluate & Score' },
                  { icon: <GitBranch size={24} />, title: 'Action Engine', subtitle: 'Plan & Execute' },
                  { icon: <ShieldCheck size={24} />, title: 'Validation Layer', subtitle: 'Verify & Report' },
                ].map((layer, i) => (
                  <motion.div
                    key={layer.title}
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                    className="text-center"
                  >
                    <div className="bg-[#12101A] border border-[#3A3A3A] rounded-xl p-4 mb-2 hover:border-[#574a7d]/30 transition-colors duration-300">
                      <div className="text-[#574a7d] mb-3 flex justify-center">{layer.icon}</div>
                      <p className="text-white font-mono text-sm mb-1">{layer.title}</p>
                      <p className="text-[#9A9A9A] text-xs">{layer.subtitle}</p>
                    </div>
                    {i < 3 && (
                      <div className="hidden lg:flex items-center justify-center mt-2">
                        <ChevronRight size={16} className="text-[#574a7d]" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-[#7a6fad] text-sm italic">
                No existing tool combines merge conflicts + dependency conflicts + test failures + build state into unified recommendations.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <div className="text-center">
              <Link
                to="/integrator"
                className="inline-flex items-center gap-2 px-7 py-[14px] rounded-lg bg-[#574a7d] text-white font-body font-medium text-base hover:bg-[#4a3d6b] hover:scale-[1.02] transition-all duration-200 group"
              >
                Discover The Integrator
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 7: TESTING DIMENSIONS PREVIEW
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />
        <div className="container-tf relative z-10">
          <div className="max-w-[640px] mb-16">
            <ScrollReveal>
              <p className="section-label mb-4">// TESTING DIMENSIONS</p>
              <h2 className="text-display-lg mb-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                <span className="text-[#333333]">Every angle. </span>
                <span className="text-[#574a7d]">Every edge case.</span>
                <span className="text-[#333333]"> Every time.</span>
              </h2>
              <p className="text-body-lg text-[#6B6B6B]">
                Our autonomous agents don&apos;t just test — they probe, stress, and challenge your code from 13 independent dimensions.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1200px]">
            {dimensionCards.map((card, i) => (
              <ScrollReveal key={card.title} delay={i * 0.08}>
                <FeatureCard
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  badge={card.badge}
                />
              </ScrollReveal>
            ))}
            {/* +4 More Tile */}
            <ScrollReveal delay={dimensionCards.length * 0.08}>
              <Link to="/testing-dimensions" className="block h-full">
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="h-full border-2 border-dashed border-[#D9D9D3] rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-[#574a7d] hover:bg-[#E8E5FF]/50 transition-all duration-300 group"
                >
                  <span className="text-[#574a7d] font-heading font-semibold text-2xl mb-2 group-hover:scale-110 transition-transform">+4</span>
                  <span className="text-[#6B6B6B] text-sm mb-1">More Dimensions</span>
                  <span className="text-[#574a7d] text-xs font-mono uppercase tracking-wider flex items-center gap-1">
                    View All <ChevronRight size={14} />
                  </span>
                </motion.div>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 8: STATS & SOCIAL PROOF
          ═══════════════════════════════════════════ */}
      <section className="bg-cream-dark py-20">
        <div className="container-tf max-w-[1200px]">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {[
              { value: 100000, suffix: '+', label: 'community members' },
              { value: 13, suffix: '', label: 'testing dimensions' },
              { value: 94, suffix: '%', label: 'average feature delivery' },
              { value: 4, suffix: 'x', label: 'security coverage improvement' },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-8 text-center shadow-card">
                  <p className="font-heading font-bold text-[48px] text-[#574a7d] leading-none mb-2">
                    {stat.suffix === 'x' ? (
                      <><AnimatedCounter end={stat.value} />x</>
                    ) : stat.value >= 1000 ? (
                      <><AnimatedCounter end={stat.value / 1000} suffix="" />K{stat.suffix}</>
                    ) : (
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    )}
                  </p>
                  <p className="font-mono text-[13px] font-medium uppercase tracking-wider text-[#6B6B6B]">{stat.label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-[#D9D9D3] mb-16" />

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 0.15}>
                <TestimonialCard quote={t.quote} name={t.name} title={t.title} image={t.image} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 9: HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none" />
        <div className="container-tf relative z-10">
          <ScrollReveal>
            <p className="section-label mb-4">// HOW IT WORKS</p>
            <h2 className="text-display-lg mb-16" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              <span className="text-[#333333]">Three steps to </span>
              <span className="text-[#574a7d]">testing autonomy.</span>
            </h2>
          </ScrollReveal>

          {/* Step 01 */}
          <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center mb-20">
            <div>
              <ScrollReveal>
                <span className="step-number block mb-3">01 //</span>
                <h3 className="text-heading-lg text-[#333333] mb-4">Connect Your Codebase</h3>
                <p className="text-body-lg text-[#6B6B6B]">
                  Link your Git repository in seconds. TestForge ingests your codebase, PRDs, and architecture — no configuration required.
                </p>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.2}>
              <Step01Visual />
            </ScrollReveal>
          </div>

          {/* Step 02 */}
          <div className="grid lg:grid-cols-[45%_55%] gap-12 items-center mb-20">
            <ScrollReveal>
              <Step02Visual />
            </ScrollReveal>
            <div>
              <ScrollReveal delay={0.2}>
                <span className="step-number block mb-3">02 //</span>
                <h3 className="text-heading-lg text-[#333333] mb-4">Autonomous Multi-Dimensional Testing</h3>
                <p className="text-body-lg text-[#6B6B6B]">
                  All 13 testing dimensions execute in parallel — from scope validation to chaos engineering. Watch real-time progress, live logs, and failure analysis as tests run.
                </p>
              </ScrollReveal>
            </div>
          </div>

          {/* Step 03 */}
          <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center">
            <div>
              <ScrollReveal>
                <span className="step-number block mb-3">03 //</span>
                <h3 className="text-heading-lg text-[#333333] mb-4">Intelligent Integration with The Integrator</h3>
                <p className="text-body-lg text-[#6B6B6B]">
                  TestForge doesn&apos;t just report failures — it converts them into prioritized PRDs and uses The Integrator to recommend the safest integration path. Merge with confidence.
                </p>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={0.2}>
              <Step03Visual />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 10: FINAL CTA
          ═══════════════════════════════════════════ */}
      <section className="relative bg-[#574a7d] py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
          }} />
        </div>
        <div className="container-tf relative z-10 text-center">
          <ScrollReveal>
            <h2 className="text-display-lg text-white mb-6" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              Ship with <span className="font-bold">confidence</span>. Automate your testing with AI.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <p className="text-body-lg text-white/80 max-w-[640px] mx-auto mb-10">
              Join 100,000+ developers who trust TestForge to verify their AI-generated code.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <button className="px-7 py-[14px] rounded-lg bg-white text-[#574a7d] font-body font-medium text-base hover:bg-[#F7F7FB] transition-all duration-200 flex items-center gap-2 group">
                Get Started Free
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <button className="px-7 py-[14px] rounded-lg border border-white text-white font-body font-medium text-base hover:bg-white/10 transition-all duration-200">
                Schedule a Call
              </button>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <a href="#" className="text-white/70 text-sm hover:text-white hover:underline transition-colors duration-200">Join Discord</a>
              <a href="#" className="text-white/70 text-sm hover:text-white hover:underline transition-colors duration-200">Read Docs</a>
              <Link to="/pricing" className="text-white/70 text-sm hover:text-white hover:underline transition-colors duration-200">View Pricing</Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ 20 DIMENSIONS SHOWCASE ═══ */}
      <section className="px-6 lg:px-16 py-[100px] bg-[#F7F7FB]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-[0.15em] mb-4">// 20 DIMENSIONS</p>
            <h2 className="text-display-md text-[#12101A] mb-4">Every angle of your codebase, analyzed.</h2>
            <p className="text-[#6B6B6B] max-w-[600px] mx-auto">From security to DORA metrics, N+1 queries to supply chain — we cover what competitors don&apos;t.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              { name: 'Security', cat: 'SAST' },
              { name: 'Unit Tests', cat: 'Coverage' },
              { name: 'Load/Perf', cat: 'Scale' },
              { name: 'Accessibility', cat: 'WCAG' },
              { name: 'Vision & Goals', cat: 'Strategy' },
              { name: 'Scope Coverage', cat: 'Traceability' },
              { name: 'Stack Analysis', cat: 'Architecture' },
              { name: 'Contract Testing', cat: 'API' },
              { name: 'Visual Regression', cat: 'UI' },
              { name: 'Edge Cases', cat: 'Boundary' },
              { name: 'Property-Based', cat: 'Invariants' },
              { name: 'Chaos Engineering', cat: 'Resilience' },
              { name: 'Mutation Testing', cat: 'Quality' },
              { name: 'Predictive Model', cat: 'Risk' },
              { name: 'Supply Chain', cat: 'CVEs' },
              { name: 'N+1 Queries', cat: 'Performance' },
              { name: 'Dead Code', cat: 'Cleanup' },
              { name: 'License Check', cat: 'Compliance' },
              { name: 'DORA Metrics', cat: 'DevOps' },
              { name: 'OWASP Top 10', cat: 'Standards' },
            ].map(d => (
              <div key={d.name} className="bg-white border border-[#D9D9D3] rounded-lg p-3 hover:border-[#a99bff] hover:shadow-sm transition-all">
                <div className="text-sm font-medium text-[#12101A]">{d.name}</div>
                <div className="text-[10px] text-[#9A9A9A] font-mono uppercase mt-0.5">{d.cat}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTEGRATIONS STRIP ═══ */}
      <section className="px-6 lg:px-16 py-[60px] bg-[#12101A]">
        <div className="max-w-[1280px] mx-auto text-center">
          <p className="font-mono text-xs text-[#a99bff] uppercase tracking-[0.15em] mb-6">// PLUGS INTO YOUR STACK</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {['GitHub','Slack','Discord','CLI','Vercel','Fly.io','Cursor','VS Code','Neon'].map(i => (
              <div key={i} className="text-white/80 hover:text-white text-sm font-medium transition-colors">{i}</div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
