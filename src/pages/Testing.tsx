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
            Thirteen ways to{' '}
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
                  {isInView ? <CountUp end={13} duration={1} delay={0.5} /> : '0'}
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

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.5 }}
          className="mt-12 lg:mt-16 rounded-2xl overflow-hidden border border-[#D9D9D3] shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
        >
          <img
            src="/testing-dimensions-grid.jpg"
            alt="Grid of all 13 testing dimensions"
            className="w-full h-auto object-cover"
            loading="eager"
          />
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
          Thirteen dimensions. One pipeline. Zero blind spots.
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

      {/* 13 Dimension Sections */}
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
