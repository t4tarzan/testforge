export default function Press() {
  const copy = (text: string) => { navigator.clipboard.writeText(text); alert('Copied!'); };

  return (
    <div className="min-h-[100dvh] bg-[#F7F7FB] pt-32 pb-20 px-6">
      <div className="max-w-[800px] mx-auto space-y-12">
        <div>
          <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-2">// PRESS KIT</p>
          <h1 className="text-display-lg text-[#12101A] mb-2">TestForge Press Kit</h1>
          <p className="text-[#6B6B6B]">Everything you need to write about TestForge. Copy-paste ready.</p>
        </div>

        {/* One-liner */}
        <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
          <h2 className="font-semibold text-[#12101A] mb-2">One-Liner</h2>
          <p className="text-[#6B6B6B] mb-3">21-dimension AI testing platform. Drop any repo URL, get a full report in 30 seconds.</p>
          <button onClick={() => copy('21-dimension AI testing platform. Drop any repo URL, get a full report in 30 seconds.')} className="text-sm text-[#574a7d] underline">Copy</button>
        </section>

        {/* Short Description */}
        <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
          <h2 className="font-semibold text-[#12101A] mb-2">Short Description (100 words)</h2>
          <p className="text-[#6B6B6B] text-sm leading-relaxed mb-3">
            TestForge analyzes code across 21 dimensions — from security scanning to Agentic Scale Prediction (world first). Drop any public GitHub repo URL and get a full report in 30 seconds. Includes OWASP coverage, DORA metrics, supply chain audit, N+1 query detection, dead code analysis, license compliance, and more. Free tier available. Self-hosted option keeps code on your machine. MCP IDE integration for Cursor and VS Code.
          </p>
          <button onClick={() => copy(document.querySelector('[data-desc="short"]')?.textContent || '')} className="text-sm text-[#574a7d] underline" data-desc="short">Copy</button>
        </section>

        {/* Features */}
        <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
          <h2 className="font-semibold text-[#12101A] mb-2">Key Features</h2>
          <ul className="list-disc pl-5 text-sm text-[#6B6B6B] space-y-1">
            <li>21 analysis dimensions — from security to Agentic Scale Prediction</li>
            <li>Agentic Scale Prediction — simulates thousands of AI agents hitting your API (world first)</li>
            <li>DORA Metrics — deployment frequency, lead time, MTTR, change failure rate</li>
            <li>Supply chain CVE audit, N+1 query detection, dead code analysis</li>
            <li>OWASP Top 10 coverage mapping</li>
            <li>README badge generator for open source projects</li>
            <li>MCP IDE integration (Cursor, VS Code, Windsurf, Claude Code)</li>
            <li>Self-hosted option — your code never leaves your machine</li>
            <li>Free tier: 5 tests/month. Pro: $29/mo. Enterprise: $199/mo</li>
          </ul>
        </section>

        {/* Links */}
        <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
          <h2 className="font-semibold text-[#12101A] mb-2">Links</h2>
          <div className="space-y-2 text-sm">
            {[
              ['Website', 'https://testforge.run'],
              ['GitHub', 'https://github.com/t4tarzan/testforge'],
              ['npm', 'https://www.npmjs.com/package/@whitenoisenpm/testforge-mcp'],
              ['Dev.to', 'https://dev.to/t4tarzan'],
              ['MCP Server', 'https://testforge-mcp.fly.dev/health'],
            ].map(([label, url]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[#9A9A9A] w-24">{label}:</span>
                <a href={url} target="_blank" className="text-[#574a7d] hover:underline">{url}</a>
                <button onClick={() => copy(url)} className="text-xs text-[#574a7d] underline">Copy</button>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
          <h2 className="font-semibold text-[#12101A] mb-2">Tech Stack</h2>
          <div className="flex flex-wrap gap-2">
            {['React 19','TypeScript','Vite','Tailwind','Fastify','Neon PostgreSQL','Drizzle ORM','Fly.io','Vercel','Stripe','Playwright','Vitest'].map(t => (
              <span key={t} className="px-3 py-1 bg-[#E8E5FF] text-[#574a7d] rounded text-xs font-mono">{t}</span>
            ))}
          </div>
        </section>

        {/* Founder */}
        <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
          <h2 className="font-semibold text-[#12101A] mb-2">Creator</h2>
          <p className="text-sm text-[#6B6B6B]">
            Built by <a href="https://github.com/t4tarzan" className="text-[#574a7d] hover:underline">t4tarzan</a>. 117 features shipped in 1 week. MIT licensed.
          </p>
        </section>
      </div>
    </div>
  );
}
