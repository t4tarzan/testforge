import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Database, Cpu, GitBranch, ShieldCheck, ArrowRight } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const layers = [
  {
    num: '01',
    title: 'State Ingestion',
    description: 'Collects test results, build states, dependency graphs, PR metadata, and git history from all connected systems.',
    tags: ['Git Status', 'Test Results', 'Build State', 'Dependencies'],
    icon: Database,
    color: '#4A90D9',
  },
  {
    num: '02',
    title: 'Analysis Engine',
    description: 'Cross-references all data points to identify conflicts, incompatibilities, and risks using learned organizational patterns.',
    tags: ['Conflict Detection', 'Risk Scoring', 'Pattern Matching', 'Impact Analysis'],
    icon: Cpu,
    color: '#E8A838',
  },
  {
    num: '03',
    title: 'Action Engine',
    description: 'Generates ranked integration paths with success probabilities and test-validated action plans.',
    tags: ['Path Ranking', 'Success Probability', 'Migration Plans', 'Auto-PR'],
    icon: GitBranch,
    color: '#5A8F5E',
  },
  {
    num: '04',
    title: 'Validation Layer',
    description: 'Verifies each recommended action. Runs dry-run integrations and confirms no new conflicts.',
    tags: ['Dry-Run Tests', 'Conflict Verification', 'Rollback Plan', 'Sign-off'],
    icon: ShieldCheck,
    color: '#7AAF7E',
  },
]

export default function ArchitectureLayers() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return

    const cards = gsap.utils.toArray<HTMLElement>('.layer-card-h')

    // Initial: all dimmed
    gsap.set(cards, { opacity: 0.5, y: 30, scale: 0.97 })

    // Staggered reveal on scroll
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
        end: 'bottom 30%',
        toggleActions: 'play none none reverse',
      },
    })

    // Animate connector lines
    const connectors = gsap.utils.toArray<HTMLElement>('.layer-connector')
    gsap.fromTo(connectors, 
      { scaleX: 0, opacity: 0 },
      {
        scaleX: 1,
        opacity: 1,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          end: 'bottom 30%',
          toggleActions: 'play none none reverse',
        },
      }
    )
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative px-6 lg:px-16 py-[120px] bg-[#1A1A1A] overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern-dark pointer-events-none" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[#5A8F5E] opacity-[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#4A90D9] opacity-[0.03] blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-[1280px] mx-auto">
        {/* Label */}
        <div className="text-center mb-16">
          <p className="text-label-mono text-[#A3C9A5] mb-4">// ARCHITECTURE</p>
          <h2 className="text-display-md lg:text-display-lg text-white max-w-[700px] mx-auto">
            Four layers. One{' '}
            <span className="text-[#5A8F5E]">intelligent</span> decision engine.
          </h2>
        </div>

        {/* Horizontal Layer Flow */}
        <div className="flex flex-col lg:flex-row items-stretch gap-0">
          {layers.map((layer, idx) => {
            const IconComp = layer.icon
            const isLast = idx === layers.length - 1

            return (
              <div key={layer.num} className="flex flex-row lg:flex-col items-stretch flex-1">
                {/* Card */}
                <div
                  className="layer-card-h flex-1 rounded-2xl p-5 lg:p-6 flex flex-col"
                  style={{
                    backgroundColor: 'rgba(42, 42, 42, 0.8)',
                    border: '1px solid #3A3A3A',
                    borderTop: `4px solid ${layer.color}`,
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {/* Step number */}
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm"
                      style={{ backgroundColor: `${layer.color}20`, color: layer.color }}
                    >
                      {layer.num}
                    </span>
                    <h3 className="text-heading-sm text-white">{layer.title}</h3>
                  </div>

                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${layer.color}15` }}
                  >
                    <IconComp size={24} style={{ color: layer.color }} />
                  </div>

                  {/* Description */}
                  <p className="text-body-md text-[#9A9A9A] mb-4 flex-1 leading-relaxed">
                    {layer.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {layer.tags.map((tag) => (
                      <span
                        key={tag}
                        className="layer-tag font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md border"
                        style={{ borderColor: '#3A3A3A', color: '#A3C9A5' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Connector arrow between cards (desktop: below, mobile: side) */}
                {!isLast && (
                  <>
                    {/* Horizontal connector for desktop */}
                    <div className="hidden lg:flex items-center justify-center w-full h-12 relative">
                      <div className="layer-connector absolute left-0 right-0 h-[2px] bg-gradient-to-r from-[#3A3A3A] via-[#5A8F5E] to-[#3A3A3A] origin-left" />
                      <div className="relative z-10 w-8 h-8 rounded-full bg-[#2A2A2A] border border-[#5A8F5E] flex items-center justify-center">
                        <ArrowRight size={14} className="text-[#5A8F5E]" />
                      </div>
                    </div>

                    {/* Vertical connector for mobile */}
                    <div className="flex lg:hidden items-center justify-center py-2">
                      <div className="w-[2px] h-10 bg-gradient-to-b from-[#3A3A3A] via-[#5A8F5E] to-[#3A3A3A]" />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Flow explanation */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#3A3A3A] bg-[#2A2A2A]/50">
            <div className="w-2 h-2 rounded-full bg-[#4A90D9] animate-pulse" />
            <span className="font-mono text-xs text-[#9A9A9A] uppercase tracking-wider">
              Data flows left to right through all four layers
            </span>
            <ArrowRight size={14} className="text-[#5A8F5E]" />
            <div className="w-2 h-2 rounded-full bg-[#5A8F5E] animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  )
}
