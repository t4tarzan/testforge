import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CountUp from 'react-countup';
import TabNavigator from '../components/testing/TabNavigator';
import DimensionSection from '../components/testing/DimensionSection';
import ComparisonTable from '../components/testing/ComparisonTable';
import { dimensions } from '../components/testing/data';

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section
      ref={ref}
      className="w-full min-h-[70vh] bg-[#F7F7FB] pt-[120px] pb-20 lg:pb-24 relative overflow-hidden"
    >
      {/* Grid pattern background */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(163,201,165,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(163,201,165,0.15)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="container-tf relative z-10">
        <div className="max-w-[800px]">
          {/* Label */}
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d] mb-6 block"
          >
            // TESTING DIMENSIONS
          </motion.span>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.1 }}
            className="font-heading font-semibold text-[64px] leading-[1.1] tracking-[-0.03em] text-[#333333] mb-6"
          >
            Twenty ways to{' '}
            <span className="text-[#574a7d]">break</span> your code.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.25 }}
            className="text-[18px] leading-[1.65] text-[#6B6B6B] max-w-[640px] mb-10"
          >
            Every dimension probes a different weakness. Together, they ensure your
            application is stable, secure, accessible, and production-ready.
          </motion.p>

          {/* Dimension Count Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.4 }}
            className="flex items-center gap-6"
          >
            <div className="relative">
              {/* Progress ring SVG */}
              <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#E8E5FF"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#a39fd4"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 54}
                  initial={{ strokeDashoffset: 2 * Math.PI * 54 }}
                  animate={isInView ? { strokeDashoffset: 0 } : {}}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.3 }}
                />
              </svg>
              {/* Count */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading font-bold text-[48px] leading-none text-[#574a7d]">
                  {isInView ? <CountUp end={20} duration={1} delay={0.5} /> : '0'}
                </span>
              </div>
            </div>
            <div>
              <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#6B6B6B]">
                TESTING DIMENSIONS
              </p>
              <p className="text-[15px] text-[#9A9A9A] mt-1">
                Comprehensive coverage, always on.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Live 20-Dimension Grid Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          className="mt-12 lg:mt-16"
        >
          <div className="bg-[#12101A] rounded-2xl border border-[#3A3A3A] overflow-hidden p-6 lg:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <p className="font-mono text-xs text-[#a99bff] uppercase tracking-[0.15em] mb-3">// LIVE DIMENSION MAP</p>
              <h3 className="text-white text-2xl font-semibold">20 Analysis Dimensions</h3>
              <p className="text-[#6B6B6B] text-sm mt-2">Every commit. Every angle. Every vulnerability.</p>
            </div>

            {/* Dimension Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                { name: 'Security', score: 92, color: '#EF4444', cat: 'Code' },
                { name: 'Unit Tests', score: 67, color: '#F97316', cat: 'Quality' },
                { name: 'Load Testing', score: 78, color: '#EAB308', cat: 'Scale' },
                { name: 'Accessibility', score: 85, color: '#22C55E', cat: 'Compliance' },
                { name: 'Vision & Goals', score: 72, color: '#3B82F6', cat: 'Strategy' },
                { name: 'Scope Coverage', score: 55, color: '#8B5CF6', cat: 'Strategy' },
                { name: 'Stack Analysis', score: 88, color: '#574a7d', cat: 'Architecture' },
                { name: 'Contract Testing', score: 70, color: '#EC4899', cat: 'API' },
                { name: 'Visual Regression', score: 80, color: '#06B6D4', cat: 'UI' },
                { name: 'Edge Cases', score: 65, color: '#F59E0B', cat: 'Boundary' },
                { name: 'Property-Based', score: 45, color: '#10B981', cat: 'Logic' },
                { name: 'Chaos Engineering', score: 90, color: '#6366F1', cat: 'Resilience' },
                { name: 'Mutation Testing', score: 55, color: '#D946EF', cat: 'Quality' },
                { name: 'Predictive Model', score: 82, color: '#F43F5E', cat: 'Risk' },
                { name: 'Supply Chain', score: 75, color: '#DC2626', cat: 'Security' },
                { name: 'N+1 Detection', score: 85, color: '#EA580C', cat: 'Performance' },
                { name: 'Dead Code', score: 60, color: '#64748B', cat: 'Cleanup' },
                { name: 'License Check', score: 90, color: '#0EA5E9', cat: 'Compliance' },
                { name: 'DORA Metrics', score: 70, color: '#14B8A6', cat: 'DevOps' },
                { name: 'OWASP Coverage', score: 65, color: '#7C3AED', cat: 'Standards' },
              ].map((d, i) => (
                <motion.div
                  key={d.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.6 + i * 0.02, duration: 0.3 }}
                  className="relative bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-4 hover:border-[#574a7d] transition-all group overflow-hidden"
                >
                  {/* Score bar background */}
                  <div className="absolute bottom-0 left-0 h-1 transition-all duration-700" style={{ width: `${d.score}%`, backgroundColor: d.color, opacity: 0.4 }} />
                  
                  {/* Content */}
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-white text-sm font-medium group-hover:text-[#a99bff] transition-colors">{d.name}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: d.color }}>{d.score}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-[#6B6B6B] font-mono uppercase">{d.cat}</span>
                  </div>

                  {/* Mini progress bar */}
                  <div className="mt-2 h-1 bg-[#3A3A3A] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: d.color }}
                      initial={{ width: 0 }}
                      animate={isInView ? { width: `${d.score}%` } : {}}
                      transition={{ delay: 0.8 + i * 0.03, duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-8 pt-6 border-t border-[#3A3A3A]">
              {[
                { label: 'Code Quality', color: '#574a7d' },
                { label: 'Security', color: '#EF4444' },
                { label: 'Performance', color: '#EAB308' },
                { label: 'Compliance', color: '#22C55E' },
                { label: 'DevOps', color: '#3B82F6' },
                { label: 'Strategy', color: '#8B5CF6' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2 text-xs text-[#9A9A9A]">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom CTA                                                         */
/* ------------------------------------------------------------------ */

function BottomCTA() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      ref={ref}
      className="w-full bg-[#574a7d] py-24 lg:py-28 relative overflow-hidden"
    >
      {/* Decorative grid */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="container-tf relative z-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-heading font-medium text-[42px] leading-[1.15] tracking-[-0.02em] text-white mb-10"
        >
          Twenty dimensions. One pipeline. Zero blind spots.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.15 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/"
            className="px-7 py-[14px] rounded-lg bg-white text-[#574a7d] font-body font-medium text-[16px] hover:bg-[#F7F7FB] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
          >
            Start Testing Free
            <ArrowRight size={16} />
          </a>
          <a
            href="#/pipeline"
            className="px-7 py-[14px] rounded-lg border border-white/60 text-white font-body font-medium text-[16px] hover:bg-white/10 hover:border-white transition-all duration-200 flex items-center gap-2"
          >
            Explore the Pipeline
            <ArrowRight size={16} />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Testing() {
  const [activeTab, setActiveTab] = useState(dimensions[0].id);

  /* Scroll spy — update active tab based on which section is in view */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    dimensions.forEach((dim) => {
      const el = document.getElementById(dim.id);
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveTab(dim.id);
            }
          });
        },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  /* Smooth scroll to section on tab click */
  const handleTabClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -132; // navbar (72px) + tab bar (60px) approx
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  return (
    <main className="min-h-[100dvh]">
      {/* Hero */}
      <Hero />

      {/* Sticky Tab Navigator */}
      <TabNavigator activeTab={activeTab} onTabClick={handleTabClick} />

      {/* 20 Dimension Sections */}
      {dimensions.map((dim, index) => (
        <DimensionSection key={dim.id} dimension={dim} index={index} />
      ))}

      {/* Comparison Table */}
      <ComparisonTable />

      {/* Bottom CTA */}
      <BottomCTA />
    </main>
  );
}
