import { Link } from 'react-router-dom'

const LAST_UPDATED = 'May 27, 2026'

export default function Privacy() {
  return (
    <div className="min-h-[100dvh] bg-[#F7F7FB] pt-[140px] pb-20">
      <div className="container-tf max-w-[820px]">
        <p className="font-mono text-xs uppercase tracking-wider text-[#574a7d] mb-3">// PRIVACY</p>
        <h1 className="text-display-lg text-[#333333] mb-3" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-[#6B6B6B] mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 text-[#333333] leading-relaxed">
          <Section title="Our privacy stance, in one sentence">
            <p>
              TestForge is designed so your source code never has to leave your machine. When you use the MCP server
              or the local CLI, all analysis runs locally — TestForge never sees, transmits, or stores the code itself.
              This policy covers the limited data we do collect when you use our hosted services (account, billing,
              managed scans).
            </p>
          </Section>

          <Section title="What we collect">
            <SubSection title="Local mode (MCP / CLI) — almost nothing">
              <p>
                When you run <code className="font-mono text-[13px] bg-white border border-[#E8E5FF] px-1.5 py-0.5 rounded">npx @whitenoisenpm/testforge-mcp</code>{' '}
                or use the MCP server from your IDE, the binary executes entirely on your machine. We do not receive
                your code, your analysis results, or any telemetry. If the MCP is configured to call our hosted
                completion endpoints, the request payloads are limited to the prompts you explicitly send and contain
                no source code unless you paste it in yourself.
              </p>
            </SubSection>

            <SubSection title="Account & web service">
              <p>When you sign up at testforge.run, we collect:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Email address (for authentication and product updates you can opt out of).</li>
                <li>OAuth identity if you sign in with GitHub (your public profile + email).</li>
                <li>Usage metadata: which features you used, when, error logs. No code content.</li>
              </ul>
            </SubSection>

            <SubSection title="Managed scans (opt-in)">
              <p>
                If you submit a repository URL to the Managed flow, that repository is cloned ephemerally for analysis.
                We store the analysis result (the report) but not the source code. Reports are retained for the
                retention period of your plan and deleted afterward.
              </p>
            </SubSection>

            <SubSection title="Billing (Stripe)">
              <p>
                Payment information is handled by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#574a7d] hover:underline">Stripe</a>.
                We never see your card number. We do receive your plan, billing email, and subscription status.
              </p>
            </SubSection>
          </Section>

          <Section title="Subprocessors">
            <p>TestForge uses the following third parties to run the hosted service:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Vercel</strong> — hosting and edge serving.</li>
              <li><strong>Neon</strong> — Postgres database for account + report metadata.</li>
              <li><strong>Stripe</strong> — billing.</li>
              <li><strong>Fly.io</strong> — running the MCP completion endpoint for managed scans.</li>
              <li><strong>Anthropic / OpenAI</strong> — LLM providers for analysis steps you opt into (only the prompts you send).</li>
            </ul>
          </Section>

          <Section title="What we don't do">
            <ul className="list-disc pl-6 space-y-2">
              <li>We don't sell your data.</li>
              <li>We don't train AI models on your code or your reports.</li>
              <li>We don't share data with advertisers.</li>
              <li>We don't use behavioral tracking cookies — only a session cookie for authentication.</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>
              You can export your account data, delete your account, and ask us to remove specific reports at any time.
              Email <a href="mailto:privacy@testforge.run" className="text-[#574a7d] hover:underline">privacy@testforge.run</a> and we will respond within 30 days. If you are
              in the EU/UK, you have rights under GDPR including access, rectification, erasure, and portability. If
              you are in California, you have rights under CCPA including the right to know and the right to delete.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Data in transit is encrypted with TLS 1.3. Account secrets are hashed with bcrypt. Production database
              access is restricted to the Vercel deployment context. We do not currently hold a SOC 2 report; we will
              update this page when that changes.
            </p>
          </Section>

          <Section title="Children">
            <p>TestForge is not directed to anyone under 16 and we do not knowingly collect data from children.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We will update the "Last updated" date at the top of this page when we make material changes. Significant
              changes will be announced via email to active accounts at least 14 days before they take effect.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Privacy questions: <a href="mailto:privacy@testforge.run" className="text-[#574a7d] hover:underline">privacy@testforge.run</a><br />
              General: <a href="mailto:hello@testforge.run" className="text-[#574a7d] hover:underline">hello@testforge.run</a>
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[#D9D9D3]">
          <Link to="/" className="text-sm text-[#574a7d] hover:underline">&larr; Back to testforge.run</Link>
          <span className="text-[#D9D9D3] mx-3">·</span>
          <Link to="/terms" className="text-sm text-[#574a7d] hover:underline">Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-heading-md text-[#333333] mb-4 font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        {title}
      </h2>
      <div className="space-y-3 text-[15px]">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-[16px] font-semibold text-[#333333] mb-2">{title}</h3>
      <div className="space-y-2 text-[15px]">{children}</div>
    </div>
  )
}
