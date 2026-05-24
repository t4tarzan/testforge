import { useCallback, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

import PipelineHero from '@/components/pipeline/PipelineHero';
import PipelineViz from '@/components/pipeline/PipelineViz';
import PipelineFeatures from '@/components/pipeline/PipelineFeatures';
import DemoVideo from '@/components/pipeline/DemoVideo';
import IntegrationCTA from '@/components/pipeline/IntegrationCTA';
import StatsBar from '@/components/pipeline/StatsBar';

/* Register GSAP plugins */
gsap.registerPlugin(ScrollTrigger);

export default function Pipeline() {
  const containerRef = useRef<HTMLDivElement>(null);

  /* Scroll-triggered animations for section entrance */
  useGSAP(() => {
    if (!containerRef.current) return;

    // Animate each section as it comes into view
    const sections = containerRef.current.querySelectorAll('.animate-section');
    sections.forEach((section) => {
      gsap.fromTo(
        section,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            once: true,
          },
        }
      );
    });
  }, { scope: containerRef });

  const handleStartRun = useCallback(() => {
    const el = document.getElementById('pipeline-viz');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Give time to scroll, then trigger play
      setTimeout(() => {
        const playBtn = el.querySelector('button');
        if (playBtn && playBtn.textContent?.includes('Run All')) {
          playBtn.click();
        }
      }, 800);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Hero — particle background + animated headline */}
      <PipelineHero onStartRun={handleStartRun} />

      {/* Stats bar */}
      <div className="animate-section">
        <StatsBar />
      </div>

      {/* Core interactive pipeline visualization */}
      <PipelineViz />

      {/* Features deep dive */}
      <div className="animate-section">
        <PipelineFeatures />
      </div>

      {/* Demo video section */}
      <div className="animate-section">
        <DemoVideo />
      </div>

      {/* Integration CTA */}
      <div className="animate-section">
        <IntegrationCTA />
      </div>
    </div>
  );
}
