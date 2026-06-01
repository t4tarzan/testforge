import { useState, useRef, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import {
  Check,
  Minus,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Zap,
  Building2,
  Shield,
  FlaskConical,
  Gauge,
  TrendingUp,
  Network,
  Trash2,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

/* ═══════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════ */

function SectionLabel({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <p className={`text-label-mono mb-4 ${light ? 'text-[#a39fd4]' : 'text-[#574a7d]'}`}>
      // {text}
    </p>
  )
}

/* ═══════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════ */

function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.from('.pricing-hero-label', { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' })
    gsap.from('.pricing-hero-headline', { opacity: 0, y: 40, duration: 0.8, ease: 'power3.out', delay: 0.1 })
    gsap.from('.pricing-hero-sub', { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out', delay: 0.3 })
    gsap.from('.pricing-toggle', { opacity: 0, y: 20, duration: 0.5, ease: 'power2.out', delay: 0.5 })
  }, { scope: heroRef })

  return (
    <section ref={heroRef} className="relative w-full bg-[#F7F7FB] overflow-hidden">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10 pt-[140px] pb-[60px] lg:pt-[160px] text-center">
        <SectionLabel text="PRICING" />
        <h1 className="pricing-hero-headline text-display-xl text-[#333333] max-w-[800px] mx-auto mb-5">
          Simple pricing, <span className="text-[#574a7d]">serious testing</span>.
        </h1>
        <p className="pricing-hero-sub text-body-lg text-[#6B6B6B] max-w-[560px] mx-auto mb-10">
          Start free. Scale as your testing needs grow. Every plan includes access to the multi-dimensional pipeline — because partial testing is broken testing.
        </p>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Pricing Cards Section
   ═══════════════════════════════════════════ */

function PricingCardsSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [isYearly, setIsYearly] = useState(false)

  const handleUpgrade = async (plan: string) => {
    if (plan === 'free') { window.location.href = '/#/managed'; return; }
    if (plan === 'enterprise') { window.location.href = 'mailto:sales@testforge.run'; return; }
    try {
      const res = await fetch('/api/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email: '' }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e) {
      console.error('Stripe error:', e);
    }
  };

  // Entrance animation removed — ScrollTrigger was occasionally leaving the
  // Pro / Enterprise cards stuck near opacity:0 (especially on hash-route
  // navigation to /#/pricing where the scroller hadn't recalculated yet).
  // The cards are visible from the start now; hover still animates via
  // framer-motion's whileHover.

  const tiers = [
    {
      name: 'Free',
      icon: Sparkles,
      monthlyPrice: 0,
      yearlyPrice: 0,
      yearlyDiscount: '',
      description: 'Open source. Runs on your machine with `npx`. Your code never leaves your laptop.',
      cta: 'Get the OSS MCP',
      ctaStyle: 'secondary' as const,
      features: [
        'OSS (MIT) · npx @whitenoisenpm/testforge-mcp@latest',
        'All 21 Tier-1 dimensions, unlimited',
        'Tier 2 — Generate & Run, BYOK OpenRouter',
        'Code never leaves your machine',
        'Local SQLite history',
        'MCP IDE integration (Cursor / Windsurf / Claude Code)',
        'Community support (GitHub issues)',
      ],
      badge: { text: 'Self-host · MIT', bg: '#a39fd4', color: '#12101A' },
      borderColor: '#D9D9D3',
      recommended: false,
    },
    {
      name: 'Pro',
      icon: Zap,
      monthlyPrice: 49,
      yearlyPrice: 39,
      yearlyDiscount: '20% savings',
      description: 'Managed — we host everything: the Tier-2 LLM keys, sandbox infra, and Simulate runtime clusters. For solo devs and small teams.',
      cta: 'Upgrade to Pro',
      ctaStyle: 'primary' as const,
      features: [
        'Everything in Free, plus:',
        '100 Tier-1 tests/mo · 10 repositories',
        'Private repo support',
        '20 Tier-2 iterations/mo (managed AI keys)',
        'Simulate (managed): runtime load · stress · chaos on a live cluster',
        'Cross-machine history dashboard',
        'CI/CD webhook + Slack/Discord notifications',
        'Priority email support',
      ],
      badge: { text: 'Most popular', bg: '#574a7d', color: '#FFFFFF' },
      borderColor: '#574a7d',
      recommended: true,
    },
    {
      name: 'Team',
      icon: FlaskConical,
      monthlyPrice: 199,
      yearlyPrice: 159,
      yearlyDiscount: '20% savings',
      description: 'For teams shipping AI-generated tests on every PR. Heavy Tier-2 use + multi-user.',
      cta: 'Upgrade to Team',
      ctaStyle: 'secondary' as const,
      features: [
        'Everything in Pro, plus:',
        '500 Tier-1 tests/mo · 50 repositories',
        '200 Tier-2 iterations/mo',
        'Simulate: runtime load/stress/chaos + live policy-enforcement audit',
        'Iterative test → fix → re-test loop',
        'Multi-user / org accounts',
        'Shared history + audit trail',
        'Custom rules persistence',
        'Higher API rate limits',
        'Dedicated support',
      ],
      badge: null,
      borderColor: '#D9D9D3',
      recommended: false,
    },
    {
      name: 'Enterprise',
      icon: Building2,
      monthlyPrice: null,
      yearlyPrice: null,
      yearlyDiscount: '',
      description: 'Custom contracts for organizations with compliance, SSO, or on-prem requirements.',
      cta: 'Contact Sales',
      ctaStyle: 'ghost' as const,
      features: [
        'Everything in Team, plus:',
        'Unlimited Tier-1 + Tier-2 runs',
        'Unlimited repositories',
        'Custom AI model selection',
        'On-premise / VPC deployment',
        'SSO & SAML authentication',
        'API access',
        'Dedicated account manager',
        'SLA guarantees',
      ],
      badge: null,
      borderColor: '#12101A',
      recommended: false,
      dark: true,
    },
  ]

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F7F7FB] py-10 lg:py-16">
      <div className="container-tf">
        {/* Billing Toggle */}
        <div className="pricing-toggle flex justify-center mb-12">
          <div className="inline-flex items-center bg-[#ECEBF5] border border-[#D9D9D3] rounded-lg p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                !isYearly
                  ? 'bg-white text-[#333333] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-[#6B6B6B]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                isYearly
                  ? 'bg-white text-[#333333] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                  : 'text-[#6B6B6B]'
              }`}
            >
              Yearly
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#E8E5FF] text-[#574a7d]">
                30% savings
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-[1280px] mx-auto">
          {tiers.map((tier) => (
            <motion.div
              key={tier.name}
              className={`pricing-card relative rounded-2xl p-6 lg:p-8 transition-all duration-300 ${
                tier.dark
                  ? 'bg-[#12101A] border border-[#12101A] text-white'
                  : tier.recommended
                  ? 'bg-white border-2 border-[#574a7d] shadow-[0_12px_32px_rgba(90,143,94,0.1)]'
                  : 'bg-white border border-[#D9D9D3] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
              }`}
              whileHover={{ y: -4 }}
            >
              {/* Badge */}
              {tier.badge && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded text-[11px] font-mono font-medium"
                  style={{ backgroundColor: tier.badge.bg, color: tier.badge.color }}
                >
                  {tier.badge.text}
                </span>
              )}

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <tier.icon
                    size={20}
                    className={tier.dark ? 'text-[#a39fd4]' : 'text-[#574a7d]'}
                  />
                  <h2 className={`font-heading font-semibold text-2xl ${tier.dark ? 'text-white' : 'text-[#333333]'}`}>
                    {tier.name}
                  </h2>
                </div>

                {/* Price */}
                <div className="mb-2">
                  {tier.monthlyPrice !== null ? (
                    <div className="flex items-baseline gap-1">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={isYearly ? 'yearly' : 'monthly'}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.2 }}
                          className={`font-heading font-bold text-[42px] lg:text-[48px] ${
                            tier.dark ? 'text-white' : 'text-[#333333]'
                          }`}
                        >
                          ${isYearly ? tier.yearlyPrice : tier.monthlyPrice}
                        </motion.span>
                      </AnimatePresence>
                      <span className={`text-body-md ${tier.dark ? 'text-[#9A9A9A]' : 'text-[#6B6B6B]'}`}>
                        /month
                      </span>
                    </div>
                  ) : (
                    <span className={`font-heading font-bold text-[42px] lg:text-[48px] ${
                      tier.dark ? 'text-white' : 'text-[#333333]'
                    }`}>
                      Custom
                    </span>
                  )}
                </div>

                {/* Yearly info */}
                {tier.yearlyDiscount && isYearly && (
                  <p className="text-body-sm text-[#574a7d]">{tier.yearlyDiscount}</p>
                )}
                {!isYearly && tier.monthlyPrice !== null && tier.monthlyPrice > 0 && (
                  <p className="text-body-sm text-[#9A9A9A]">
                    ${tier.yearlyPrice}/month billed yearly
                  </p>
                )}

                <p className={`text-body-sm mt-3 ${tier.dark ? 'text-[#9A9A9A]' : 'text-[#6B6B6B]'}`}>
                  {tier.description}
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => {
                  if (tier.name === 'Free') { window.location.href = '/#/mcp'; return; }
                  if (tier.name === 'Enterprise') { window.location.href = 'mailto:sales@testforge.run'; return; }
                  handleUpgrade(tier.name.toLowerCase());
                }}
                className={`w-full py-3 rounded-lg font-body font-medium text-base mb-6 transition-all duration-200 ${
                  tier.ctaStyle === 'primary'
                    ? 'bg-[#574a7d] text-white hover:bg-[#4a3d6b] hover:scale-[1.02] active:scale-[0.98]'
                    : tier.ctaStyle === 'secondary'
                    ? 'bg-[#12101A] text-white hover:bg-[#333333] hover:scale-[1.02]'
                    : tier.dark
                    ? 'border border-[#3A3A3A] text-white hover:bg-white/10'
                    : 'border border-[#D9D9D3] text-[#333333] hover:bg-[#E8E5FF] hover:border-[#a39fd4]'
                }`}
              >
                {tier.name === 'Free' ? tier.cta : tier.name === 'Enterprise' ? 'Contact Sales' : tier.cta}
              </button>

              {/* Features */}
              <ul className="space-y-2.5">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    {feature.startsWith('Everything') ? (
                      <span className={`text-body-sm font-medium mt-0.5 ${
                        tier.dark ? 'text-[#a39fd4]' : 'text-[#574a7d]'
                      }`}>
                        {feature}
                      </span>
                    ) : (
                      <>
                        <Check
                          size={16}
                          className={`mt-0.5 flex-shrink-0 ${
                            tier.dark ? 'text-[#7a6fad]' : 'text-[#574a7d]'
                          }`}
                        />
                        <span className={`text-body-sm ${
                          tier.dark ? 'text-[#9A9A9A]' : 'text-[#333333]'
                        }`}>
                          {feature}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Feature Comparison Table
   ═══════════════════════════════════════════ */

function ComparisonTableSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.comparison-table', {
      y: 30,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  // Free column reflects the OSS self-host story: most Tier-1 limits go
  // away when the analyzer runs on your own machine. Constraints are about
  // what's hosted/managed for you (history dashboard, multi-user, etc.).
  const categories = [
    {
      name: 'Testing Pipeline',
      features: [
        { name: 'Test runs/month', free: 'Unlimited (local)', pro: '100', team: '500', enterprise: 'Unlimited' },
        { name: 'All 21 Tier-1 dimensions', free: true, pro: true, team: true, enterprise: true },
        { name: 'Repositories', free: 'Unlimited (local)', pro: '10', team: '50', enterprise: 'Unlimited' },
        { name: 'Private repos', free: 'Local only', pro: true, team: true, enterprise: true },
      ],
    },
    {
      name: 'Tier 2 — AI Tests (Generate & Run)',
      features: [
        { name: 'LLM-generated Vitest files', free: 'BYOK', pro: true, team: true, enterprise: true },
        { name: 'Iterations / month', free: 'Unlimited (you pay OpenRouter)', pro: '20', team: '200', enterprise: 'Unlimited' },
        { name: 'Sandboxed execution', free: 'Local Docker', pro: 'We host', team: 'We host', enterprise: 'We host' },
        { name: 'Iterative test → fix → re-test', free: false, pro: false, team: true, enterprise: true },
        { name: 'Managed AI keys (no setup)', free: false, pro: true, team: true, enterprise: true },
        { name: 'Generation history dashboard', free: 'Local SQLite', pro: true, team: 'Shared', enterprise: 'Shared' },
        { name: 'Custom AI model selection', free: 'Edit code', pro: false, team: false, enterprise: true },
      ],
    },
    {
      name: 'Tier 2 — Simulate (Runtime: Load · Stress · Chaos)',
      features: [
        { name: 'Managed runtime simulation (we run the cluster)', free: false, pro: true, team: true, enterprise: true },
        { name: 'Load ramp — rps ceiling + p50/p99 latency', free: false, pro: true, team: true, enterprise: true },
        { name: 'Stress / concurrency sweep', free: false, pro: true, team: true, enterprise: true },
        { name: 'Chaos — pod-kill outage window + MTTR', free: false, pro: true, team: true, enterprise: true },
        { name: 'Live dependency + ingress/egress audit', free: false, pro: true, team: true, enterprise: true },
        { name: 'Policy-enforcement verification (static → runtime)', free: false, pro: false, team: true, enterprise: true },
        { name: 'Full Kubernetes platform / appstore simulation', free: false, pro: false, team: true, enterprise: true },
      ],
    },
    {
      name: 'The Integrator',
      features: [
        { name: 'Basic recommendations', free: true, pro: true, team: true, enterprise: true },
        { name: 'Full intelligence', free: true, pro: true, team: true, enterprise: true },
        { name: 'Custom rules', free: 'Local file', pro: false, team: true, enterprise: true },
      ],
    },
    {
      name: 'PRD Generator',
      features: [
        { name: 'PRDs/month', free: 'Unlimited (local)', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
        { name: 'Severity classification', free: 'Full', pro: 'Full', team: 'Full', enterprise: 'Full' },
        { name: 'Migration paths', free: true, pro: true, team: true, enterprise: true },
      ],
    },
    {
      name: 'Analytics',
      features: [
        { name: 'Cross-machine dashboard', free: false, pro: true, team: true, enterprise: true },
        { name: 'Predictive models', free: true, pro: true, team: true, enterprise: true },
        { name: 'Historical data retention', free: 'Local SQLite', pro: '90 days', team: '1 year', enterprise: 'Unlimited' },
      ],
    },
    {
      name: 'Security',
      features: [
        { name: 'SAST (Babel AST)', free: true, pro: true, team: true, enterprise: true },
        { name: 'Taint-flow analysis', free: true, pro: true, team: true, enterprise: true },
        { name: 'OWASP Top 10 coverage map', free: true, pro: true, team: true, enterprise: true },
        { name: 'Secret / credential detection', free: true, pro: true, team: true, enterprise: true },
        { name: 'Supply-chain (CVE-aware)', free: true, pro: true, team: true, enterprise: true },
      ],
    },
    {
      name: 'Visual & A11y',
      features: [
        { name: 'Visual regression', free: true, pro: true, team: true, enterprise: true },
        { name: 'Accessibility testing', free: true, pro: true, team: true, enterprise: true },
      ],
    },
    {
      name: 'Platform',
      features: [
        { name: 'CI/CD webhook + Slack/Discord', free: false, pro: true, team: true, enterprise: true },
        { name: 'Team members', free: 'You', pro: 'You', team: 'Multi-user', enterprise: 'Unlimited' },
        { name: 'API access', free: 'Run your own', pro: false, team: true, enterprise: true },
        { name: 'SSO/SAML', free: false, pro: false, team: false, enterprise: true },
        { name: 'On-prem / VPC', free: 'You install', pro: false, team: false, enterprise: true },
      ],
    },
    {
      name: 'Support',
      features: [
        { name: 'Community (GitHub issues)', free: true, pro: true, team: true, enterprise: true },
        { name: 'Priority email support', free: false, pro: true, team: true, enterprise: true },
        { name: 'Dedicated support', free: false, pro: false, team: true, enterprise: true },
        { name: 'SLA guarantee', free: false, pro: false, team: false, enterprise: true },
      ],
    },
  ]

  const renderCell = (value: boolean | string) => {
    if (value === true) {
      return <Check size={18} className="text-[#574a7d] mx-auto" />
    }
    if (value === false) {
      return <Minus size={18} className="text-[#D9D9D3] mx-auto" />
    }
    return <span className="font-mono text-[13px] text-[#333333]">{value}</span>
  }

  return (
    <section ref={sectionRef} className="relative w-full bg-[#ECEBF5] py-20 lg:py-24">
      <div className="container-tf">
        <SectionLabel text="FULL COMPARISON" />
        <h2 className="text-display-md text-[#333333] mb-10">
          Compare <span className="text-[#574a7d]">every feature</span>.
        </h2>

        <div className="comparison-table bg-white border border-[#D9D9D3] rounded-xl overflow-x-auto max-w-[1200px] mx-auto">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-[#D9D9D3]">
                <th className="text-left px-5 py-4 font-semibold text-sm text-[#333333] w-[34%]">Feature</th>
                <th className="text-center px-3 py-4 font-semibold text-sm text-[#333333]">Free<br/><span className="font-mono text-[10px] text-[#9A9A9A] uppercase">Self-host · OSS</span></th>
                <th className="text-center px-3 py-4 font-semibold text-sm text-[#574a7d]">Pro<br/><span className="font-mono text-[10px] text-[#9A9A9A] uppercase">$49 / mo</span></th>
                <th className="text-center px-3 py-4 font-semibold text-sm text-[#333333]">Team<br/><span className="font-mono text-[10px] text-[#9A9A9A] uppercase">$199 / mo</span></th>
                <th className="text-center px-3 py-4 font-semibold text-sm text-[#333333]">Enterprise<br/><span className="font-mono text-[10px] text-[#9A9A9A] uppercase">Contact sales</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <Fragment key={cat.name}>
                  <tr className="bg-[#F7F7FB]">
                    <td colSpan={5} className="px-5 py-2.5 font-semibold text-sm text-[#333333]">
                      {cat.name}
                    </td>
                  </tr>
                  {cat.features.map((feat) => (
                    <tr key={feat.name} className="border-b border-[#F7F7FB]">
                      <td className="px-5 py-3.5 text-sm text-[#6B6B6B]">{feat.name}</td>
                      <td className="text-center px-3 py-3.5">{renderCell(feat.free)}</td>
                      <td className="text-center px-3 py-3.5 bg-[rgba(87,74,125,0.06)]">{renderCell(feat.pro)}</td>
                      <td className="text-center px-3 py-3.5">{renderCell(feat.team)}</td>
                      <td className="text-center px-3 py-3.5">{renderCell(feat.enterprise)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   FAQ Accordion Section
   ═══════════════════════════════════════════ */

function FAQSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.faq-item', {
      y: 20,
      opacity: 0,
      duration: 0.4,
      stagger: 0.06,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  const faqs = [
    {
      q: "What's included in the Free plan?",
      a: "All 21 testing dimensions, 5 test runs per month, 1 repository, basic JSON/Markdown reports, and the MCP IDE integration. Public repos only. Perfect for individual developers exploring AI-powered testing.",
    },
    {
      q: 'What do I get on Pro?',
      a: "Everything in Free plus 100 test runs/month, 10 repositories, private repo support, full 21-dimension reports, CI/CD webhook integration, Slack/Discord notifications, README badge generator, and priority email support.",
    },
    {
      q: 'Can I switch plans anytime?',
      a: "Yes — upgrade or downgrade at any time. When upgrading, you'll be prorated for the remainder of your billing cycle. When downgrading, changes take effect at the next billing period.",
    },
    {
      q: 'What happens when I exceed my test run limit?',
      a: "You'll receive a notification at 80% and 95% usage. After reaching your limit, you can wait for the next cycle or upgrade instantly. The MCP and CLI continue to run locally on your machine regardless of plan.",
    },
    {
      q: 'Is there an Enterprise trial?',
      a: 'Yes — we offer a 30-day Enterprise trial with full feature access. Email sales@testforge.run to set it up. We\'ll also provide onboarding support during your trial.',
    },
    {
      q: 'What integrations are supported?',
      a: 'GitHub, GitLab, and Bitbucket on all plans. Custom CI/CD webhooks (GitHub Actions, CircleCI, Jenkins, etc.) on Pro and above. Full API access and on-premise deployment on Enterprise.',
    },
    {
      q: 'Does my source code ever leave my machine?',
      a: "When you use the MCP server or the CLI, no. Analysis runs entirely locally and TestForge never sees your code. The Managed flow on testforge.run does clone the repo URL you submit, run analysis ephemerally, and store only the report (not the code). See our Privacy Policy for details.",
    },
    {
      q: 'How is my account data secured?',
      a: 'Data in transit uses TLS 1.3. Account passwords are hashed with bcrypt. Payment data is handled by Stripe — we never see card numbers. We do not currently hold a SOC 2 report; we will update the pricing page when that changes.',
    },
  ]

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F7F7FB] py-20 lg:py-24">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10">
        <div className="max-w-[800px] mx-auto">
          <SectionLabel text="FAQ" />
          <h2 className="text-display-md text-[#333333] mb-10">Questions? Answers.</h2>

          <div className="divide-y divide-[#D9D9D3]">
            {faqs.map((faq, i) => (
              <div key={i} className="faq-item">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full py-5 flex items-center justify-between text-left hover:bg-[#F7F7FB]/50 transition-colors duration-200"
                >
                  <span className="font-medium text-base text-[#333333] pr-4">{faq.q}</span>
                  <motion.div
                    animate={{ rotate: openIndex === i ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown size={20} className="text-[#6B6B6B]" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-body-md text-[#6B6B6B] leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Bottom CTA Section
   ═══════════════════════════════════════════ */

function CTASection() {
  return (
    <section className="relative w-full bg-[#574a7d] py-20 lg:py-24">
      <div className="container-tf text-center">
        <h2 className="text-display-md text-white mb-4">Ready to test without limits?</h2>
        <p className="text-body-lg text-white/80 mb-8 max-w-[500px] mx-auto">
          Join 100,000+ developers who ship with confidence.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button className="px-7 py-[14px] rounded-lg bg-white text-[#574a7d] font-body font-medium text-base hover:bg-[#F7F7FB] hover:scale-[1.02] transition-all duration-200 flex items-center gap-2 group">
            Get Started Free
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <button className="px-7 py-[14px] rounded-lg border border-white text-white font-body font-medium text-base hover:bg-white/10 transition-all duration-200">
            Contact Sales
          </button>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Alternative Stack ROI Section
   Frames TestForge against the cost of assembling
   equivalent coverage from point tools.
   ═══════════════════════════════════════════ */

function AlternativeStackSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.stack-row', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.07,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', once: true },
    })
  }, { scope: sectionRef })

  // Public list prices, sampled May 2026. We list the cheapest credible
  // team-tier option for each capability and round monthly costs to the
  // nearest $10. Setup time is for a 5-engineer team integrating from zero.
  const stackRows = [
    {
      icon: Shield,
      capability: 'SAST + dependency vulnerability',
      tools: 'Snyk Team or SonarCloud Team',
      monthly: '$160–490 / mo',
      setup: '1–2 weeks',
      tfDelivers: 'Babel AST + taint tracking, OWASP map, supply-chain audit',
    },
    {
      icon: FlaskConical,
      capability: 'Mutation testing + test quality',
      tools: 'Stryker / Pitest (OSS) + CI integration',
      monthly: '$0 SaaS',
      setup: '2–3 weeks',
      tfDelivers: 'Mutation-score estimate + test-quality heuristics',
    },
    {
      icon: Gauge,
      capability: 'Accessibility + visual regression',
      tools: 'axe DevTools Pro + Percy',
      monthly: '$200–350 / mo',
      setup: '1 week',
      tfDelivers: 'WCAG static checks + visual signal scan',
    },
    {
      icon: Network,
      capability: 'Contract + load + resilience patterns',
      tools: 'PactFlow + k6 Cloud + manual chaos review',
      monthly: '$350–600 / mo',
      setup: '4–6 weeks',
      tfDelivers: 'Static pattern detection across all three',
    },
    {
      icon: TrendingUp,
      capability: 'DORA metrics + stack health',
      tools: 'LinearB / Sleuth / Faros',
      monthly: '$100–250 / mo',
      setup: '1 week',
      tfDelivers: 'DORA capability classification + stack signals',
    },
    {
      icon: Trash2,
      capability: 'Dead-code, N+1, license audit',
      tools: 'Knip + manual ORM review + license-checker',
      monthly: '$0–100 / mo',
      setup: '1–2 weeks',
      tfDelivers: 'AST cross-file dead-code, loop+sink N+1, SPDX audit',
    },
  ]

  return (
    <section ref={sectionRef} className="relative w-full bg-[#F7F7FB] py-20 lg:py-24">
      <div className="bg-grid-pattern absolute inset-0 pointer-events-none" />
      <div className="container-tf relative z-10 max-w-[1100px]">
        <SectionLabel text="THE OTHERWISE COST" />
        <h2 className="text-display-md text-[#333333] mb-3">
          Assembling this elsewhere takes <span className="text-[#574a7d]">months and ~$1K/mo</span>.
        </h2>
        <p className="text-body-lg text-[#6B6B6B] max-w-[720px] mb-12">
          TestForge is a static-analysis layer — not a replacement for live security scanners or load runners.
          But the pre-merge signals it surfaces would otherwise require a stack of point tools, weeks of
          integration, and ongoing vendor fees. Here&apos;s a sober estimate for a five-engineer team:
        </p>

        <div className="bg-white border border-[#D9D9D3] rounded-xl overflow-hidden mb-8">
          <div className="hidden md:grid md:grid-cols-[1.3fr_1.5fr_0.9fr_0.7fr_1.5fr] gap-4 px-6 py-4 bg-[#1E1B2E] text-white">
            <div className="font-mono text-[11px] uppercase tracking-wider">Capability</div>
            <div className="font-mono text-[11px] uppercase tracking-wider">Typical tools</div>
            <div className="font-mono text-[11px] uppercase tracking-wider">Monthly</div>
            <div className="font-mono text-[11px] uppercase tracking-wider">Setup</div>
            <div className="font-mono text-[11px] uppercase tracking-wider">What TestForge delivers</div>
          </div>
          {stackRows.map((row) => {
            const Icon = row.icon
            return (
              <div
                key={row.capability}
                className="stack-row grid grid-cols-1 md:grid-cols-[1.3fr_1.5fr_0.9fr_0.7fr_1.5fr] gap-2 md:gap-4 px-6 py-5 border-b border-[#F0F0F5] last:border-b-0 hover:bg-[#FAFAFC] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E8E5FF] flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-[#574a7d]" />
                  </div>
                  <span className="text-[14px] font-medium text-[#333333]">{row.capability}</span>
                </div>
                <div className="text-[13px] text-[#6B6B6B] md:self-center">{row.tools}</div>
                <div className="text-[13px] font-mono text-[#333333] md:self-center">{row.monthly}</div>
                <div className="text-[13px] font-mono text-[#333333] md:self-center">{row.setup}</div>
                <div className="text-[13px] text-[#574a7d] md:self-center">{row.tfDelivers}</div>
              </div>
            )
          })}
        </div>

        <div className="bg-[#1E1B2E] rounded-xl p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#a39fd4] mb-2">// THE BUNDLED ALTERNATIVE</p>
            <p className="text-white text-[20px] leading-snug mb-3">
              Roughly <strong className="text-[#a99bff]">$810–1,790/mo in SaaS subscriptions</strong> + <strong className="text-[#a99bff]">10–15 engineer-weeks</strong> of integration to get the same pre-merge signal.
            </p>
            <p className="text-[#9A9A9A] text-[13px] leading-relaxed">
              That doesn&apos;t replace the runtime tools you should still run in CI and production. It does buy back
              the time + cost of catching these issues at code-review speed instead of after they ship.
            </p>
          </div>
          <div className="text-center lg:text-right">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#a39fd4] mb-1">// TESTFORGE PRO</p>
            <p className="font-heading text-[48px] text-white leading-none mb-1">$29</p>
            <p className="text-[#9A9A9A] text-sm">/ month · 21 dimensions in one tool</p>
          </div>
        </div>

        <p className="text-[12px] text-[#9A9A9A] mt-6 italic">
          Pricing references list public May 2026 list prices for Snyk Team, SonarCloud Team, axe DevTools Pro,
          Percy by BrowserStack, PactFlow Foundation, k6 Cloud Team, LinearB, Sleuth, Faros. Your actual stack
          and vendors will differ.
        </p>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════ */

export default function Pricing() {
  return (
    <div className="min-h-[100dvh]">
      <HeroSection />
      <PricingCardsSection />
      <ComparisonTableSection />
      <AlternativeStackSection />
      <FAQSection />
      <CTASection />
    </div>
  )
}
