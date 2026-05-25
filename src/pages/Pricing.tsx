import { useState, useRef } from 'react'
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
    if (plan === 'enterprise') { window.location.href = 'mailto:sales@testforge.dev'; return; }
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

  useGSAP(() => {
    if (!sectionRef.current) return
    gsap.from('.pricing-card', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', once: true },
    })
  }, { scope: sectionRef })

  const tiers = [
    {
      name: 'Free',
      icon: Sparkles,
      monthlyPrice: 0,
      yearlyPrice: 0,
      yearlyDiscount: '25% savings',
      description: 'For individual developers exploring AI-powered testing.',
      cta: 'Get Started',
      ctaStyle: 'secondary' as const,
      features: [
        'All 21 testing dimensions',
        '5 test runs/month',
        '1 repository',
        'Basic reports (JSON/Markdown)',
        'Community support',
        'Public repos only',
        'MCP IDE integration',
      ],
      badge: null,
      borderColor: '#D9D9D3',
      recommended: false,
    },
    {
      name: 'Pro',
      icon: Zap,
      monthlyPrice: 29,
      yearlyPrice: 19,
      yearlyDiscount: '30% savings',
      description: 'For growing teams with active CI/CD pipelines.',
      cta: 'Upgrade to Pro',
      ctaStyle: 'primary' as const,
      features: [
        'Everything in Free, plus:',
        '100 test runs/month',
        '10 repositories',
        'Private repo support',
        'Full 21-dimension reports',
        'Priority email support',
        'CI/CD webhook integration',
        'Slack/Discord notifications',
        'README badge generator',
      ],
      badge: { text: 'Most Popular', bg: '#574a7d', color: '#FFFFFF' },
      borderColor: '#D9D9D3',
      recommended: false,
    },
    {
      name: 'Enterprise',
      icon: Building2,
      monthlyPrice: 199,
      yearlyPrice: 149,
      yearlyDiscount: '25% savings',
      description: 'For organizations with complex testing requirements.',
      cta: 'Contact Sales',
      ctaStyle: 'ghost' as const,
      features: [
        'Everything in Standard, plus:',
        'Unlimited everything',
        'Custom AI model training',
        'On-premise deployment',
        'SSO & SAML authentication',
        'API access',
        'Dedicated account manager',
        '24/7 phone support',
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-[1200px] mx-auto">
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
                  <h3 className={`font-heading font-semibold text-2xl ${tier.dark ? 'text-white' : 'text-[#333333]'}`}>
                    {tier.name}
                  </h3>
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
                  if (tier.name === 'Free') { window.location.href = '/#/managed'; return; }
                  if (tier.name === 'Enterprise') { window.location.href = 'mailto:sales@testforge.dev'; return; }
                  handleUpgrade('pro');
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
                {tier.name === 'Free' ? 'Start Testing Free' : tier.name === 'Enterprise' ? 'Contact Sales' : tier.cta}
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

  const categories = [
    {
      name: 'Testing Pipeline',
      features: [
        { name: 'Test runs/month', free: '50', starter: '500', standard: 'Unlimited', enterprise: 'Unlimited' },
        { name: 'Testing dimensions', free: true, starter: true, standard: true, enterprise: true },
        { name: 'Repositories', free: '1', starter: '3', standard: '10', enterprise: 'Unlimited' },
      ],
    },
    {
      name: 'The Integrator',
      features: [
        { name: 'Basic recommendations', free: false, starter: true, standard: true, enterprise: true },
        { name: 'Full intelligence', free: false, starter: false, standard: true, enterprise: true },
        { name: 'Custom rules', free: false, starter: false, standard: false, enterprise: true },
      ],
    },
    {
      name: 'PRD Generator',
      features: [
        { name: 'PRDs/month', free: '5', starter: 'Unlimited', standard: 'Unlimited', enterprise: 'Unlimited' },
        { name: 'Severity classification', free: 'Basic', starter: 'Full', standard: 'Full', enterprise: 'Full' },
        { name: 'Migration paths', free: false, starter: true, standard: true, enterprise: true },
      ],
    },
    {
      name: 'Analytics',
      features: [
        { name: 'Dashboard', free: false, starter: false, standard: true, enterprise: true },
        { name: 'Predictive models', free: false, starter: false, standard: true, enterprise: true },
        { name: 'Historical data', free: '7 days', starter: '30 days', standard: '90 days', enterprise: 'Unlimited' },
      ],
    },
    {
      name: 'Security',
      features: [
        { name: 'SAST', free: true, starter: true, standard: true, enterprise: true },
        { name: 'DAST', free: false, starter: false, standard: true, enterprise: true },
        { name: 'AI fuzzing', free: false, starter: false, standard: true, enterprise: true },
        { name: 'Secret detection', free: true, starter: true, standard: true, enterprise: true },
      ],
    },
    {
      name: 'Visual & A11y',
      features: [
        { name: 'Visual regression', free: false, starter: false, standard: true, enterprise: true },
        { name: 'Accessibility testing', free: false, starter: false, standard: true, enterprise: true },
      ],
    },
    {
      name: 'Platform',
      features: [
        { name: 'Data retention', free: '7 days', starter: '30 days', standard: '90 days', enterprise: 'Unlimited' },
        { name: 'Team members', free: '1', starter: '3', standard: '10', enterprise: 'Unlimited' },
        { name: 'API access', free: false, starter: false, standard: false, enterprise: true },
        { name: 'SSO/SAML', free: false, starter: false, standard: false, enterprise: true },
      ],
    },
    {
      name: 'Support',
      features: [
        { name: 'Community', free: true, starter: true, standard: true, enterprise: true },
        { name: 'Email support', free: false, starter: true, standard: true, enterprise: true },
        { name: 'Dedicated support', free: false, starter: false, standard: true, enterprise: true },
        { name: '24/7 phone', free: false, starter: false, standard: false, enterprise: true },
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
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#D9D9D3]">
                <th className="text-left px-5 py-4 font-semibold text-sm text-[#333333] w-[35%]">Feature</th>
                <th className="text-center px-4 py-4 font-semibold text-sm text-[#333333]">Free</th>
                <th className="text-center px-4 py-4 font-semibold text-sm text-[#333333]">Starter</th>
                <th className="text-center px-4 py-4 font-semibold text-sm text-[#574a7d]">Standard</th>
                <th className="text-center px-4 py-4 font-semibold text-sm text-[#333333]">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <>
                  <tr key={cat.name} className="bg-[#F7F7FB]">
                    <td colSpan={5} className="px-5 py-2.5 font-semibold text-sm text-[#333333]">
                      {cat.name}
                    </td>
                  </tr>
                  {cat.features.map((feat) => (
                    <tr key={feat.name} className="border-b border-[#F7F7FB]">
                      <td className="px-5 py-3.5 text-sm text-[#6B6B6B]">{feat.name}</td>
                      <td className="text-center px-4 py-3.5">{renderCell(feat.free)}</td>
                      <td className="text-center px-4 py-3.5">{renderCell(feat.starter)}</td>
                      <td className="text-center px-4 py-3.5 bg-[rgba(90,143,94,0.03)]">{renderCell(feat.standard)}</td>
                      <td className="text-center px-4 py-3.5">{renderCell(feat.enterprise)}</td>
                    </tr>
                  ))}
                </>
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
      a: "The Free plan includes access to all 21 testing dimensions, 50 test runs per month, 1 repository, and basic PRD generation for up to 5 failed tests. It's perfect for individual developers and small side projects.",
    },
    {
      q: 'How does The Integrator work?',
      a: "The Integrator is available on Starter (basic) and Standard+ (full). It analyzes your test results, build state, and dependencies to recommend the safest integration path. On Standard, you get merge conflict prediction, dependency analysis, and intelligent path ranking with probability scores.",
    },
    {
      q: 'Can I switch plans anytime?',
      a: "Yes — upgrade or downgrade at any time. When upgrading, you'll be prorated for the remainder of your billing cycle. When downgrading, changes take effect at the next billing period.",
    },
    {
      q: 'What happens when I exceed my test run limit?',
      a: "You'll receive a notification at 80% and 95% usage. After reaching your limit, you can either wait for the next cycle or upgrade instantly. We never stop critical security tests — those always run.",
    },
    {
      q: 'Is there an enterprise trial?',
      a: 'Yes — we offer a 30-day Enterprise trial with full feature access. Contact our sales team to set it up. We\'ll also provide onboarding support during your trial.',
    },
    {
      q: 'What integrations are supported?',
      a: 'GitHub, GitLab, and Bitbucket on all plans. Custom CI/CD integrations (Jenkins, CircleCI, GitHub Actions, etc.) on Standard and above. Full API access on Enterprise.',
    },
    {
      q: 'How is my data secured?',
      a: 'All code and test data is encrypted at rest (AES-256) and in transit (TLS 1.3). We never store your source code — only test metadata and results. Enterprise plans include SOC 2 compliance and custom security audits.',
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
   Main Page Component
   ═══════════════════════════════════════════ */

export default function Pricing() {
  return (
    <div className="min-h-[100dvh]">
      <HeroSection />
      <PricingCardsSection />
      <ComparisonTableSection />
      <FAQSection />
      <CTASection />
    </div>
  )
}
