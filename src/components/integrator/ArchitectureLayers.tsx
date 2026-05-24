import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Database, Cpu, GitBranch, ShieldCheck } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const layers = [
  {
    num: '01',
    title: 'State Ingestion',
    description: 'Collects test results, build states, dependency graphs, PR metadata, and git history from all connected systems.',
    tags: ['Git Status', 'Test Results', 'Build State', 'Dependencies'],
    icon: Database,
    borderColor: '#4A90D9',
    iconColor: '#4A90D9',
  },
  {
    num: '02',
    title: 'Analysis Engine',
    description: 'Cross-references all data points to identify conflicts, incompatibilities, and risks. Uses learned organizational patterns to predict integration outcomes.',
    tags: ['Conflict Detection', 'Risk Scoring', 'Pattern Matching', 'Impact Analysis'],
    icon: Cpu,
    borderColor: '#E8A838',
    iconColor: '#E8A838',
  },
  {
    num: '03',
    title: 'Action Engine',
    description: 'Generates ranked integration paths with success probability scores. Creates test-validated action plans with step-by-step migration guides.',
    tags: ['Path Ranking', 'Success Probability', 'Migration Plans', 'Auto-PR'],
    icon: GitBranch,
    borderColor: '#5A8F5E',
    iconColor: '#5A8F5E',
  },
  {
    num: '04',
    title: 'Validation Layer',
    description: 'Verifies each recommended action against the live codebase. Runs dry-run integrations and confirms no new conflicts are introduced.',
    tags: ['Dry-Run Tests', 'Conflict Verification', 'Rollback Plan', 'Sign-off'],
    icon: ShieldCheck,
    borderColor: '#5A8F5E',
    iconColor: '#7AAF7E',
  },
]

export default function ArchitectureLayers() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const pinContainerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current || !pinContainerRef.current) return

    const ctx = gsap.context(() => {
      // Create the pin
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=200%',
        pin: pinContainerRef.current,
        scrub: 1,
      })

      const layerCards = gsap.utils.toArray<HTMLElement>('.layer-card')
      const layerArrows = gsap.utils.toArray<HTMLElement>('.layer-arrow')

      // Initial state: all layers dimmed
      layerCards.forEach((card) => {
        gsap.set(card, {
          backgroundColor: 'rgba(42, 42, 42, 1)',
          borderLeftColor: '#3A3A3A',
          scale: 0.98,
          opacity: 0.6,
        })
      })

      // Create timeline for layer reveals
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=200%',
          scrub: 1,
        },
      })

      // Progress 0-25%: Layer 1 highlights
      tl.to(layerCards[0], {
        backgroundColor: 'rgba(90, 143, 94, 0.08)',
        borderLeftColor: layers[0].borderColor,
        scale: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
      }, 0)
      tl.fromTo(
        layerCards[0]?.querySelectorAll('.layer-tag') || [],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.02, duration: 0.15 },
        0.05
      )
      tl.to(layerArrows[0], { opacity: 1, duration: 0.05 }, 0.18)

      // Progress 25-50%: Layer 2 highlights
      tl.to(layerCards[1], {
        backgroundColor: 'rgba(90, 143, 94, 0.08)',
        borderLeftColor: layers[1].borderColor,
        scale: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
      }, 0.25)
      tl.fromTo(
        layerCards[1]?.querySelectorAll('.layer-tag') || [],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.02, duration: 0.15 },
        0.3
      )
      tl.to(layerArrows[1], { opacity: 1, duration: 0.05 }, 0.43)

      // Progress 50-75%: Layer 3 highlights
      tl.to(layerCards[2], {
        backgroundColor: 'rgba(90, 143, 94, 0.08)',
        borderLeftColor: layers[2].borderColor,
        scale: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
      }, 0.5)
      tl.fromTo(
        layerCards[2]?.querySelectorAll('.layer-tag') || [],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.02, duration: 0.15 },
        0.55
      )
      tl.to(layerArrows[2], { opacity: 1, duration: 0.05 }, 0.68)

      // Progress 75-100%: Layer 4 highlights
      tl.to(layerCards[3], {
        backgroundColor: 'rgba(90, 143, 94, 0.08)',
        borderLeftColor: layers[3].borderColor,
        scale: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'power2.out',
      }, 0.75)
      tl.fromTo(
        layerCards[3]?.querySelectorAll('.layer-tag') || [],
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.02, duration: 0.15 },
        0.8
      )

      // Brief glow on all layers at the end
      tl.to(layerCards, {
        boxShadow: '0 0 30px rgba(90, 143, 94, 0.2)',
        duration: 0.08,
      }, 0.92)
      tl.to(layerCards, {
        boxShadow: '0 0 0px rgba(90, 143, 94, 0)',
        duration: 0.08,
      }, 1)

      // Particle arrows animation
      const arrows = gsap.utils.toArray<HTMLElement>('.arrow-particles')
      arrows.forEach((arrow) => {
        const dot = arrow.querySelector('.flow-dot')
        if (dot) {
          gsap.to(dot, {
            y: 32,
            duration: 1.5,
            repeat: -1,
            ease: 'none',
          })
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, { scope: sectionRef })

  return (
    <div ref={sectionRef} className="relative" style={{ height: '300vh' }}>
      <div
        ref={pinContainerRef}
        className="min-h-[135dvh] flex flex-col items-center justify-center px-6 lg:px-16 py-32 bg-[#1A1A1A] relative"
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern-dark pointer-events-none" />

        <div className="relative z-10 w-full max-w-[1000px] mx-auto">
          {/* Label */}
          <div className="text-center mb-12">
            <p className="text-label-mono text-[#A3C9A5] mb-4">// ARCHITECTURE</p>
            <h2 className="text-display-lg text-white">
              Four layers. One <span className="text-[#5A8F5E]">intelligent</span> decision engine.
            </h2>
          </div>

          {/* Layer Stack */}
          <div className="flex flex-col gap-0">
            {layers.map((layer, idx) => {
              const IconComp = layer.icon
              return (
                <div key={layer.num} className="flex flex-col items-center">
                  {/* Layer Card */}
                  <div
                    className="layer-card w-full rounded-xl p-5 lg:p-6 border border-[#3A3A3A]"
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: layer.borderColor,
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${layer.iconColor}15` }}
                      >
                        <IconComp size={24} style={{ color: layer.iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-xs text-[#6B6B6B]">{layer.num} //</span>
                          <h3 className="text-heading-sm text-white">{layer.title}</h3>
                        </div>
                        <p className="text-body-md text-[#9A9A9A] mb-3">{layer.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {layer.tags.map((tag) => (
                            <span
                              key={tag}
                              className="layer-tag font-mono text-[11px] uppercase tracking-wider px-3 py-1 rounded border border-[#3A3A3A] text-[#A3C9A5]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow between layers */}
                  {idx < layers.length - 1 && (
                    <div
                      className="layer-arrow h-10 flex flex-col items-center justify-center opacity-30 my-1"
                    >
                      <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                        <line
                          x1="12" y1="0" x2="12" y2="24"
                          stroke="#5A8F5E"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                        <polygon
                          points="6,24 18,24 12,32"
                          fill="#5A8F5E"
                          opacity="0.6"
                        />
                      </svg>
                      <div className="arrow-particles absolute">
                        <div
                          className="flow-dot w-1.5 h-1.5 rounded-full bg-[#7AAF7E]"
                          style={{ opacity: 0.8 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
