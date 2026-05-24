import { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { stages, type StageStatus } from './stagesData';

/* ------------------------------------------------------------------ */
/*  Animated particle field (CSS-based, no WebGL)                     */
/* ------------------------------------------------------------------ */

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let animId = 0;
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      w = rect.width;
      h = rect.height;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const init = () => {
      particles.length = 0;
      const count = Math.min(180, Math.floor((w * h) / 8000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.2 - Math.random() * 0.4,
          r: 1.5 + Math.random() * 1.5,
        });
      }
    };

    let mouseX = -999;
    let mouseY = -999;

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150 * 0.8;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(90,143,94,0.15)';
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    init();
    draw();
    window.addEventListener('resize', () => { resize(); init(); });
    canvas.addEventListener('mousemove', handleMouse);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Hero headline character animation                                 */
/* ------------------------------------------------------------------ */

function AnimatedHeadline({ text, highlightWord }: { text: string; highlightWord: string }) {
  const words = text.split(' ');

  return (
    <h1 className="font-heading font-semibold text-[40px] sm:text-[52px] lg:text-[64px] leading-[1.1] tracking-[-0.03em] text-white text-center">
      {words.map((word, wi) => (
        <span key={wi} className="inline-block mr-[0.3em]">
          {word === highlightWord ? (
            <span className="text-[#574a7d]">
              {word.split('').map((char, ci) => (
                <motion.span
                  key={ci}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.3 + wi * 0.08 + ci * 0.02,
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                  }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
            </span>
          ) : (
            word.split('').map((char, ci) => (
              <motion.span
                key={ci}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3 + wi * 0.08 + ci * 0.02,
                  duration: 0.8,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                }}
                className="inline-block"
              >
                {char}
              </motion.span>
            ))
          )}
        </span>
      ))}
    </h1>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini pipeline pills                                               */
/* ------------------------------------------------------------------ */

function PipelinePills() {
  const [pillStates, setPillStates] = useState<StageStatus[]>(
    () => stages.map((s) => s.status)
  );

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    stages.forEach((_, i) => {
      const t1 = setTimeout(() => {
        setPillStates((prev) => {
          const next = [...prev];
          next[i] = 'running';
          return next;
        });
        const t2 = setTimeout(() => {
          setPillStates((prev) => {
            const next = [...prev];
            next[i] = 'passed';
            return next;
          });
        }, 800);
        timeouts.push(t2);
      }, 1200 + i * 400);
      timeouts.push(t1);
    });
    return () => timeouts.forEach(clearTimeout);
  }, []);

  const statusClasses: Record<StageStatus, string> = {
    pending: 'bg-[#1E1B2E] text-[#9A9A9A]',
    running: 'bg-[rgba(232,168,56,0.15)] text-[#E8A838] animate-pulse',
    passed: 'bg-[rgba(90,143,94,0.15)] text-[#574a7d]',
    failed: 'bg-[rgba(212,82,74,0.15)] text-[#D4524A]',
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-[900px] mx-auto">
      {stages.map((stage, i) => (
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.6 + i * 0.04,
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
          }}
          className={`font-mono font-medium text-[11px] uppercase tracking-[0.08em] px-[14px] py-[6px] rounded transition-colors duration-300 ${statusClasses[pillStates[i]]}`}
        >
          {stage.name}
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Hero Component                                               */
/* ------------------------------------------------------------------ */

export default function PipelineHero({ onStartRun }: { onStartRun: () => void }) {
  const scrollToPipeline = useCallback(() => {
    const el = document.getElementById('pipeline-viz');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <section className="relative min-h-[85dvh] flex flex-col items-center justify-center bg-[#12101A] overflow-hidden px-6 sm:px-12 lg:px-16 pt-[72px] pb-20">
      {/* Background image fallback */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: 'url(/hero-pipeline-abstract.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#12101A]/60 via-[#12101A]/80 to-[#12101A]" />

      {/* Particle field */}
      <div className="absolute inset-0 z-[2]">
        <ParticleField />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-[900px] mx-auto">
        {/* Label */}
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#7a6fad] mb-6"
        >
          // THE PIPELINE
        </motion.span>

        {/* Headline */}
        <AnimatedHeadline text="Watch your code face every test" highlightWord="every" />
        <span className="hidden">test</span>{/* ensure word exists for search */}

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-body text-[18px] leading-[1.65] text-[#9A9A9A] text-center max-w-[680px] mt-6"
        >
          Thirteen autonomous testing dimensions execute in parallel — from scope analysis to chaos engineering. Real-time progress. Intelligent failure detection. No blind spots.
        </motion.p>

        {/* Pipeline pills */}
        <div className="mt-14 w-full">
          <PipelinePills />
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10"
        >
          <button
            onClick={onStartRun}
            className="px-7 py-[14px] rounded-lg bg-[#574a7d] text-white font-body font-medium text-[16px] hover:bg-[#4a3d6b] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 group"
          >
            <Play size={16} />
            Start a Test Run
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <button
            onClick={scrollToPipeline}
            className="px-7 py-[14px] rounded-lg border border-[#3A3A3A] text-white font-body font-medium text-[16px] hover:bg-[#1E1B2E] hover:border-[#574a7d] transition-all duration-200"
          >
            Explore Pipeline
          </button>
        </motion.div>
      </div>
    </section>
  );
}
