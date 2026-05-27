import { Link } from 'react-router-dom'

const LAST_UPDATED = 'May 27, 2026'

export default function Terms() {
  return (
    <div className="min-h-[100dvh] bg-[#F7F7FB] pt-[140px] pb-20">
      <div className="container-tf max-w-[820px]">
        <p className="font-mono text-xs uppercase tracking-wider text-[#574a7d] mb-3">// TERMS</p>
        <h1 className="text-display-lg text-[#333333] mb-3" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          Terms of Service
        </h1>
        <p className="text-sm text-[#6B6B6B] mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 text-[#333333] leading-relaxed">
          <Section title="Acceptance">
            <p>
              By using testforge.run, the TestForge MCP server, or the TestForge CLI ("the Service"), you agree to
              these Terms. If you don't agree, don't use the Service.
            </p>
          </Section>

          <Section title="What TestForge does">
            <p>
              TestForge analyzes source code to surface tests, security issues, and quality signals across 21
              dimensions. The local MCP and CLI run analyses on your machine. The hosted Managed flow accepts
              repository URLs and produces reports. See our{' '}
              <Link to="/privacy" className="text-[#574a7d] hover:underline">Privacy Policy</Link> for what data is collected.
            </p>
          </Section>

          <Section title="Your account">
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for keeping your credentials secure.</li>
              <li>One person or organization per account. No sharing of paid accounts across teams beyond the seat limit of your plan.</li>
              <li>You must be at least 16 years old to create an account.</li>
            </ul>
          </Section>

          <Section title="Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Scan or test code you don't have permission to test.</li>
              <li>Use the Service to attack, probe, or scan third-party systems without their authorization.</li>
              <li>Reverse engineer, scrape, or rate-abuse our APIs in ways that degrade the Service for others.</li>
              <li>Upload malware, exploits-in-the-wild, or illegal content.</li>
              <li>Misrepresent TestForge's findings as a formal security audit or certification.</li>
            </ul>
          </Section>

          <Section title="Your code, your IP">
            <p>
              You retain full ownership of your source code and all derivative outputs (reports, tests, PRDs).
              TestForge claims no rights over your code. We do not train machine-learning models on your code or
              reports.
            </p>
          </Section>

          <Section title="The TestForge product is yours to use, not own">
            <p>
              We grant you a non-exclusive, non-transferable license to use the Service while your account is in
              good standing. The TestForge name, logo, website code, and analyzer engine remain our property. The
              open-source components are released under their respective licenses (see the GitHub repo).
            </p>
          </Section>

          <Section title="Paid plans">
            <ul className="list-disc pl-6 space-y-2">
              <li>Subscriptions are billed monthly or annually in advance via Stripe.</li>
              <li>You can cancel anytime; access continues until the end of the paid period.</li>
              <li>Refunds for paid plans within 14 days of purchase, no questions asked, by emailing <a href="mailto:billing@testforge.run" className="text-[#574a7d] hover:underline">billing@testforge.run</a>.</li>
              <li>Prices may change; you will get at least 30 days' notice for renewals at a higher price.</li>
            </ul>
          </Section>

          <Section title="Disclaimer — important">
            <p>
              TestForge surfaces likely issues; it is not a formal audit, penetration test, or compliance
              certification. Findings can be false positives or miss real issues. You remain responsible for
              reviewing and acting on results. The Service is provided "as is," without warranties of any kind to
              the maximum extent permitted by law.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, TestForge's total liability for any claim related to the
              Service is limited to the amount you paid us in the 12 months before the claim arose. We are not
              liable for indirect, incidental, consequential, or lost-profit damages.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You can stop using the Service or delete your account anytime. We may suspend or terminate accounts
              that breach these Terms, with notice where feasible. On termination, your data is deleted within 30
              days, except where retention is required by law (e.g., billing records).
            </p>
          </Section>

          <Section title="Service availability">
            <p>
              We aim for high uptime but do not guarantee it on free plans. The MCP and CLI run locally and are
              not subject to our hosted uptime. SLAs for paid plans are described on the{' '}
              <Link to="/pricing" className="text-[#574a7d] hover:underline">pricing page</Link>.
            </p>
          </Section>

          <Section title="Changes to these Terms">
            <p>
              We will update the "Last updated" date when we change these Terms. Material changes will be announced
              via email to active accounts at least 14 days before they take effect.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These Terms are governed by the laws of the jurisdiction where TestForge operates. Disputes will be
              resolved in good faith first; if that fails, in the competent courts of that jurisdiction.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions: <a href="mailto:hello@testforge.run" className="text-[#574a7d] hover:underline">hello@testforge.run</a><br />
              Billing: <a href="mailto:billing@testforge.run" className="text-[#574a7d] hover:underline">billing@testforge.run</a><br />
              Security: <a href="mailto:security@testforge.run" className="text-[#574a7d] hover:underline">security@testforge.run</a>
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[#D9D9D3]">
          <Link to="/" className="text-sm text-[#574a7d] hover:underline">&larr; Back to testforge.run</Link>
          <span className="text-[#D9D9D3] mx-3">·</span>
          <Link to="/privacy" className="text-sm text-[#574a7d] hover:underline">Privacy Policy</Link>
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
