// /simulations — the "shown" objective: REAL load / agent / chaos simulations
// run by the MCP /simulate engine against known public repos. Each app is booted
// in an isolated, resource-capped sandbox and driven with live traffic; these
// are measurements, not heuristics.
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { simulationShowcase } from '@/data/simulationShowcase';
import LiveSimRunner from '@/components/simulation/LiveSimRunner';
import NewsletterSignup from '@/components/NewsletterSignup';

export default function Simulations() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-[#F7F7FB]">
      {/* hero */}
      <div className="bg-[#12101A] text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/60 mb-3">Real simulations</div>
          <h1 className="font-heading font-bold text-[40px] leading-tight tracking-tight mb-4">
            We boot the app and hit it for real.
          </h1>
          <p className="font-mono text-[14px] text-white/70 max-w-2xl leading-relaxed">
            Load, agent-traffic and chaos here aren't static guesses — TestForge builds each repo, boots it in an
            isolated sandbox, and drives live traffic with autocannon: ramping concurrency to find the breaking point,
            scaling a fleet of think-time agents, and crashing the app mid-load to measure recovery. Every number below
            is a measurement — and you can <span className="text-white">run any of them live</span> right now.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {simulationShowcase.length === 0 ? (
          <p className="font-mono text-[13px] text-[#6B6B6B]">No simulation runs published yet.</p>
        ) : (
          simulationShowcase.map((sim, i) => (
            <motion.div
              key={sim.slug}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <LiveSimRunner sim={sim} />
            </motion.div>
          ))
        )}

        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6">
          <p className="font-mono text-[12px] text-[#6B6B6B] leading-relaxed">
            <span className="font-bold text-[#12101A]">How it works:</span> a runnable repo (Dockerfile or
            docker-compose) is built and booted on a throwaway, resource-capped network with no host access. A sibling
            load generator drives traffic against it; we record latency percentiles, throughput, the breaking-point
            concurrency, the sustainable agent fleet size, and the error-spike + recovery time when the app is restarted
            mid-load. Repos that can't be auto-booted fall back to static analysis, labelled honestly.
          </p>
        </div>

        <NewsletterSignup />
      </div>
    </div>
  );
}
