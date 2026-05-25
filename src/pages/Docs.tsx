import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Menu,
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

/* ────────────────────────────────────────────
   NAVIGATION DATA
   ──────────────────────────────────────────── */
const navGroups = [
  {
    header: 'GETTING STARTED',
    items: ['Overview', 'Quick Start', 'Your First Test'],
  },
  {
    header: 'INSTALLATION',
    items: ['Web Platform', 'CLI Installation', 'MCP IDE Setup', 'Self-Hosted (Fly.io)', 'MCP Server', 'Docker'],
  },
  {
    header: 'CONFIGURATION',
    items: [
      'Repository Setup',
      'Test Type Selection',
      'CI/CD Integration',
      'Environment Variables',
    ],
  },
  {
    header: 'GUIDES',
    items: [
      'Test Types Overview',
      'Security Testing',
      'Performance Testing',
      'MCP Usage Guide',
      'Container Deployment',
      'Custom Rules',
    ],
  },
  {
    header: 'REFERENCE',
    items: [
      'CLI Reference',
      'API Reference',
      'Troubleshooting',
      'Changelog',
    ],
  },
];

const pageIdMap: Record<string, string> = {
  Overview: 'overview',
  'Quick Start': 'quick-start',
  'Your First Test': 'your-first-test',
  'Web Platform': 'web-platform',
  'CLI Installation': 'cli-installation',
  'MCP Server': 'mcp-server',
  Docker: 'docker',
  'Repository Setup': 'repository-setup',
  'Test Type Selection': 'test-type-selection',
  'CI/CD Integration': 'cicd-integration',
  'Environment Variables': 'environment-variables',
  'Test Types Overview': 'test-types-overview',
  'Security Testing': 'security-testing',
  'Performance Testing': 'performance-testing',
  'Custom Rules': 'custom-rules',
  'CLI Reference': 'cli-reference',
  'API Reference': 'api-reference',
  Troubleshooting: 'troubleshooting',
  Changelog: 'changelog',
};

const reversePageIdMap: Record<string, string> = Object.fromEntries(
  Object.entries(pageIdMap).map(([k, v]) => [v, k])
);

/* ────────────────────────────────────────────
   EASINGS
   ──────────────────────────────────────────── */
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ────────────────────────────────────────────
   CALLOUT COMPONENTS
   ──────────────────────────────────────────── */
function InfoCallout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-[rgba(74,144,217,0.06)] border-l-[3px] border-[#4A90D9] px-6 py-4 my-4 rounded-r-lg">
      <Info size={18} className="text-[#4A90D9] flex-shrink-0 mt-0.5" />
      <div>
        {title && (
          <p className="font-body font-semibold text-[14px] text-[#4A90D9] mb-1">
            {title}
          </p>
        )}
        <div className="font-body text-[14px] text-[#333333] leading-[1.6]">
          {children}
        </div>
      </div>
    </div>
  );
}

function WarningCallout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-[rgba(232,168,56,0.06)] border-l-[3px] border-[#E8A838] px-6 py-4 my-4 rounded-r-lg">
      <AlertTriangle size={18} className="text-[#E8A838] flex-shrink-0 mt-0.5" />
      <div>
        {title && (
          <p className="font-body font-semibold text-[14px] text-[#E8A838] mb-1">
            {title}
          </p>
        )}
        <div className="font-body text-[14px] text-[#333333] leading-[1.6]">
          {children}
        </div>
      </div>
    </div>
  );
}

function SuccessCallout({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-[rgba(90,143,94,0.06)] border-l-[3px] border-[#574a7d] px-6 py-4 my-4 rounded-r-lg">
      <CheckCircle2 size={18} className="text-[#574a7d] flex-shrink-0 mt-0.5" />
      <div>
        {title && (
          <p className="font-body font-semibold text-[14px] text-[#574a7d] mb-1">
            {title}
          </p>
        )}
        <div className="font-body text-[14px] text-[#333333] leading-[1.6]">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   CODE BLOCK COMPONENT
   ──────────────────────────────────────────── */
function DocCodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="bg-[#12101A] rounded-xl overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E1B2E]">
        <span className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A]">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="font-mono font-medium text-[11px] text-[#9A9A9A] hover:text-[#574a7d] transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto">
        <code className="font-mono text-[13px] leading-[1.8] text-[#E8E8E3]">
          {code}
        </code>
      </pre>
    </div>
  );
}

/* ────────────────────────────────────────────
   TABLE COMPONENT
   ──────────────────────────────────────────── */
function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-[10px] overflow-hidden my-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F7F7FB]">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="font-mono font-medium text-[12px] uppercase text-[#6B6B6B] text-left px-4 py-3 tracking-[0.08em]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-t border-[#D9D9D3] hover:bg-[#F7F7FB] transition-colors"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="font-body text-[14px] text-[#333333] px-4 py-3"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   INLINE CODE
   ──────────────────────────────────────────── */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[14px] text-[#D4524A] bg-[#F7F7FB] px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}


/* ────────────────────────────────────────────
   CONTENT RENDERER — dispatches to page content
   ──────────────────────────────────────────── */
function DocContent({ pageId }: { pageId: string }) {
  switch (pageId) {
    case 'overview':
      return <OverviewPage />;
    case 'quick-start':
      return <QuickStartPage />;
    case 'your-first-test':
      return <YourFirstTestPage />;
    case 'web-platform':
      return <WebPlatformPage />;
    case 'cli-installation':
      return <CliInstallationPage />;
    case 'mcp-server':
      return <McpServerPage />;
    case 'docker':
      return <DockerPage />;
    case 'repository-setup':
      return <RepositorySetupPage />;
    case 'test-type-selection':
      return <TestTypeSelectionPage />;
    case 'cicd-integration':
      return <CicdIntegrationPage />;
    case 'environment-variables':
      return <EnvironmentVariablesPage />;
    case 'test-types-overview':
      return <TestTypesOverviewPage />;
    case 'security-testing':
      return <SecurityTestingPage />;
    case 'performance-testing':
      return <PerformanceTestingPage />;
    case 'custom-rules':
      return <CustomRulesPage />;
    case 'cli-reference':
      return <CliReferencePage />;
    case 'api-reference':
      return <ApiReferencePage />;
    case 'troubleshooting':
      return <TroubleshootingPage />;
    case 'changelog':
      return <ChangelogPage />;
    case 'mcp-ide-setup':
      return <McpIdeSetupPage />;
    case 'self-hosted-flyio':
      return <SelfHostedFlyioPage />;
    case 'mcp-usage-guide':
      return <McpUsageGuidePage />;
    case 'container-deployment':
      return <ContainerDeploymentPage />;
    default:
      return <OverviewPage />;
  }
}

/* ────────────────────────────────────────────
   PAGE CONTENT: OVERVIEW
   ──────────────────────────────────────────── */
function OverviewPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        TestForge Documentation
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        TestForge is an AI-powered autonomous testing platform that integrates
        directly into your development workflow. It analyzes your codebase,
        generates comprehensive tests across{' '}
        <strong className="font-semibold text-[#12101A]">21 dimensions</strong>,
        and delivers actionable reports with fix suggestions.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        What TestForge Does
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        TestForge connects to your Git repository, analyzes your entire
        codebase, and automatically generates and runs tests across{' '}
        <strong className="font-semibold text-[#12101A]">
          21 testing dimensions
        </strong>
        . Within minutes, you get:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>A complete test report with pass/fail status for every dimension</li>
        <li>
          Security vulnerability findings with severity ratings and fix
          suggestions
        </li>
        <li>A generated PRD (Product Requirements Document) from failed tests</li>
        <li>Performance benchmarks and load testing results</li>
        <li>Predictive risk analysis using ML models</li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        How It Works
      </h2>
      <ol className="list-decimal list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#12101A]">Connect</strong> your
          Git repository (public repos supported, private coming soon)
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Configure</strong>{' '}
          which test dimensions to run (all 20 are selected by default)
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Execute</strong> —
          TestForge clones, scans, and tests your code automatically
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Review</strong> the
          comprehensive report with findings, fixes, and generated PRDs
        </li>
      </ol>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Supported Technologies
      </h2>
      <DocTable
        headers={['Technology', 'Detection', 'Test Coverage']}
        rows={[
          ['Node.js / Express', 'package.json, require()', 'Full — all 21 dimensions'],
          ['Python / Flask / Django', 'requirements.txt, imports', 'Full — all 21 dimensions'],
          ['Go / Gin / Echo', 'go.mod', 'Full — all 21 dimensions'],
          ['Ruby / Rails', 'Gemfile', 'Full — all 21 dimensions'],
          ['Java / Spring', 'pom.xml, build.gradle', 'Partial — core dimensions'],
          ['Rust / Actix', 'Cargo.toml', 'Partial — core dimensions'],
        ]}
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Getting Help
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#12101A]">
            Quick questions?
          </strong>{' '}
          Ask in your IDE via our{' '}
          <a href="#/mcp" className="text-[#574a7d] hover:underline">
            MCP integration
          </a>
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Issues?</strong>{' '}
          Check the{' '}
          <a href="#troubleshooting" className="text-[#574a7d] hover:underline">
            Troubleshooting
          </a>{' '}
          section
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Feature requests?
          </strong>{' '}
          Email{' '}
          <a
            href="mailto:hello@testforge.dev"
            className="text-[#574a7d] hover:underline"
          >
            hello@testforge.dev
          </a>
        </li>
      </ul>

      <InfoCallout title="New to TestForge?">
        Start with the{' '}
        <a href="#" className="text-[#574a7d] hover:underline">
          Quick Start Guide
        </a>{' '}
        to run your first test in under 3 minutes.
      </InfoCallout>
    </div>
  );
}


/* ────────────────────────────────────────────
   PAGE CONTENT: QUICK START
   ──────────────────────────────────────────── */
function QuickStartPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Quick Start Guide
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Get your first test running in under 3 minutes.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Step 1: Create an Account
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Sign up at{' '}
        <a href="#/auth" className="text-[#574a7d] hover:underline">
          testforge.dev
        </a>{' '}
        with your email or GitHub account. No credit card required for the free
        tier.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Step 2: Connect a Repository
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        From your{' '}
        <a href="#/account" className="text-[#574a7d] hover:underline">
          dashboard
        </a>
        , click "Connect Repository" and enter a public Git URL. For testing,
        try our demo repo:
      </p>
      <DocCodeBlock
        code="https://github.com/testforge-demo/express-ecommerce-api"
        language="text"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Step 3: Run Your First Test
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Click "Start New Test" on the dashboard or go to{' '}
        <a href="#/run-test" className="text-[#574a7d] hover:underline">
          /run-test
        </a>
        . Select your connected repository and click "Run Tests."
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        TestForge will automatically:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>Clone and scan your repository</li>
        <li>Detect your technology stack</li>
        <li>Run all 21 test dimensions</li>
        <li>Generate a comprehensive report</li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Step 4: Review Results
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Your test report appears in the dashboard within 2-5 minutes. Each
        dimension shows detailed findings, and the overall score gives you a
        quick health check.
      </p>

      <SuccessCallout title="Tip">
        Click "Export Report" to download results as JSON, Markdown, or PDF.
      </SuccessCallout>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: YOUR FIRST TEST
   ──────────────────────────────────────────── */
function YourFirstTestPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Your First Test Walkthrough
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Let's walk through running a test on the demo repository and
        understanding the results.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Choosing a Repository
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        For this walkthrough, use the demo repository:
      </p>
      <DocCodeBlock
        code="https://github.com/testforge-demo/express-ecommerce-api"
        language="text"
      />
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        This is a real Express.js e-commerce API with intentional bugs for
        testing purposes.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Understanding Test Configuration
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        When you start a test, you'll see the configuration screen:
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        <strong className="font-semibold text-[#12101A]">Test Types</strong> —
        All 21 dimensions are checked by default. Uncheck any you don't need to
        save time.
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        <strong className="font-semibold text-[#12101A]">Coverage Depth</strong>{' '}
        — Choose between:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#12101A]">Shallow</strong> (~2
          min): Primary endpoints and happy paths
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Deep</strong> (~5
          min): Full coverage including edge cases and error handling
        </li>
      </ul>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        <strong className="font-semibold text-[#12101A]">Technology</strong> —
        Auto-detected from your repo. Verify it's correct.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Reading the Results
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        As tests run, you'll see live output for each dimension:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#574a7d]">PASS</strong>{' '}
          (green): All checks passed
        </li>
        <li>
          <strong className="font-semibold text-[#E8A838]">WARN</strong>{' '}
          (yellow): Passed with minor issues (e.g., flaky tests, WCAG
          violations)
        </li>
        <li>
          <strong className="font-semibold text-[#D4524A]">FAIL</strong> (red):
          Critical issues found
        </li>
      </ul>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Click any dimension card to expand and see the full terminal output.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Understanding Your Score
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        The overall score (0-100) is weighted:
      </p>
      <DocTable
        headers={['Category', 'Weight', 'Description']}
        rows={[
          ['Security', '30%', 'Vulnerability findings'],
          ['Functionality', '25%', 'Unit, integration, E2E test results'],
          ['Performance', '20%', 'Load testing and response times'],
          ['Quality', '15%', 'Mutation score, code coverage'],
          ['Reliability', '10%', 'Chaos engineering, flaky test detection'],
        ]}
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Next Steps
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <a href="#/mcp" className="text-[#574a7d] hover:underline">
            Set up the MCP server
          </a>{' '}
          to test from your IDE
        </li>
        <li>
          <a href="#cicd-integration" className="text-[#574a7d] hover:underline">
            Configure CI/CD integration
          </a>{' '}
          for automated testing
        </li>
        <li>
          <a href="#cli-reference" className="text-[#574a7d] hover:underline">
            Review the CLI reference
          </a>{' '}
          for advanced usage
        </li>
      </ul>
    </div>
  );
}


/* ────────────────────────────────────────────
   PAGE CONTENT: WEB PLATFORM
   ──────────────────────────────────────────── */
function WebPlatformPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Web Platform
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        The easiest way to use TestForge is through the web interface at{' '}
        <a
          href="https://testforge.dev"
          className="text-[#574a7d] hover:underline"
        >
          testforge.dev
        </a>
        .
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Sign Up
      </h2>
      <ol className="list-decimal list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          Go to{' '}
          <a href="#/auth" className="text-[#574a7d] hover:underline">
            /auth
          </a>
        </li>
        <li>Sign up with email or GitHub</li>
        <li>
          You'll land on the{' '}
          <a href="#/account" className="text-[#574a7d] hover:underline">
            dashboard
          </a>
        </li>
      </ol>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Free Tier Limits
      </h2>
      <DocTable
        headers={['Feature', 'Free', 'Pro ($49/mo)', 'Enterprise']}
        rows={[
          ['Test runs / month', '50', 'Unlimited', 'Unlimited'],
          ['Repositories', '3', '20', 'Unlimited'],
          ['Test dimensions', 'All 20', 'All 20', 'All 20'],
          ['Concurrent tests', '1', '3', '10'],
          ['Report retention', '7 days', '90 days', '1 year'],
          ['MCP access', 'No', 'Yes', 'Yes'],
          ['API access', 'No', 'Yes', 'Yes'],
        ]}
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: CLI INSTALLATION
   ──────────────────────────────────────────── */
function CliInstallationPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        CLI Installation
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Install TestForge globally via npm:
      </p>
      <DocCodeBlock code="npm install -g @testforge/cli" language="bash" />

      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Verify installation:
      </p>
      <DocCodeBlock
        code={"testforge --version\n# testforge/2.4.1 darwin-arm64 node-v20.11.0"}
        language="bash"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Authentication
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Log in to link your CLI to your TestForge account:
      </p>
      <DocCodeBlock
        code={"testforge login\n# Opens browser for authentication"}
        language="bash"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Basic Commands
      </h2>
      <DocTable
        headers={['Command', 'Description']}
        rows={[
          [<Code>testforge run {'<repo-url>'}</Code>, 'Run full test suite on a repository'],
          [<Code>testforge status {'<run-id>'}</Code>, 'Check status of a running test'],
          [<Code>testforge report {'<run-id>'}</Code>, 'View test report'],
          [<Code>testforge repos</Code>, 'List connected repositories'],
          [<Code>testforge config</Code>, 'Open configuration editor'],
        ]}
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Running Your First CLI Test
      </h2>
      <DocCodeBlock
        code={`# Run tests on a public repository\ntestforge run https://github.com/testforge-demo/express-ecommerce-api\n\n# Run with specific options\ntestforge run https://github.com/user/repo \\\\\n  --branch develop \\\\\n  --depth deep \\\\\n  --tests security,performance \\\\\n  --output json`}
        language="bash"
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: MCP SERVER
   ──────────────────────────────────────────── */
function McpServerPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        MCP Server Installation
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        The TestForge MCP server integrates with AI-powered IDEs for natural
        language test generation.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        One-Line Install
      </h2>
      <DocCodeBlock code="npx @whitenoisenpm/testforge-mcp install" language="bash" />
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        This installs the MCP server and guides you through IDE configuration.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Manual Install
      </h2>
      <DocCodeBlock code="npm install -g @whitenoisenpm/testforge-mcp" language="bash" />
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Then configure your IDE (see the{' '}
        <a href="#/mcp" className="text-[#574a7d] hover:underline">
          MCP Integration page
        </a>{' '}
        for IDE-specific configs).
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Verify Installation
      </h2>
      <DocCodeBlock code="testforge-mcp --version" language="bash" />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Start the Server
      </h2>
      <DocCodeBlock
        code={`# Start with auto-detect\ntestforge-mcp start\n\n# Start with specific project\ntestforge-mcp start --project ./my-api\n\n# Start with verbose logging\ntestforge-mcp start --verbose`}
        language="bash"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Environment Variables
      </h2>
      <DocTable
        headers={['Variable', 'Required', 'Description']}
        rows={[
          [
            <Code>TESTFORGE_API_KEY</Code>,
            'Yes',
            'Your API key from the dashboard',
          ],
          [
            <Code>TESTFORGE_PROJECT_PATH</Code>,
            'No',
            'Default project path',
          ],
          [
            <Code>TESTFORGE_LOG_LEVEL</Code>,
            'No',
            'debug, info, warn (default: info)',
          ],
        ]}
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: DOCKER
   ──────────────────────────────────────────── */
function DockerPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Docker Installation
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Run TestForge in a Docker container for isolated, reproducible testing.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Pull the Image
      </h2>
      <DocCodeBlock code="docker pull testforge/cli:latest" language="bash" />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Run a Test
      </h2>
      <DocCodeBlock
        code={`docker run -it --rm \\\\\n  -e TESTFORGE_API_KEY=your_api_key \\\\\n  testforge/cli:latest \\\\\n  run https://github.com/testforge-demo/express-ecommerce-api`}
        language="bash"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Docker Compose
      </h2>
      <DocCodeBlock
        code={`version: '3.8'\nservices:\n  testforge:\n    image: testforge/cli:latest\n    environment:\n      - TESTFORGE_API_KEY=$\{TESTFORGE_API_KEY\}\n    volumes:\n      - ./reports:/app/reports\n    command: run https://github.com/your-org/your-repo`}
        language="yaml"
      />
    </div>
  );
}


/* ────────────────────────────────────────────
   PAGE CONTENT: REPOSITORY SETUP
   ──────────────────────────────────────────── */
function RepositorySetupPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Repository Setup
      </h1>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Connecting a Repository
      </h2>
      <ol className="list-decimal list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          From your{' '}
          <a href="#/account" className="text-[#574a7d] hover:underline">
            dashboard
          </a>
          , navigate to <strong className="font-semibold text-[#12101A]">Repositories</strong>
        </li>
        <li>
          Click <strong className="font-semibold text-[#12101A]">Connect Repository</strong>
        </li>
        <li>Enter the public Git URL</li>
        <li>Select the default branch</li>
        <li>Click <strong className="font-semibold text-[#12101A]">Connect</strong></li>
      </ol>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Supported Git Hosts
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>GitHub (public repositories)</li>
        <li>GitLab (public repositories)</li>
        <li>Bitbucket (public repositories)</li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Repository Requirements
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>Must be a public repository</li>
        <li>Must contain a recognizable project structure</li>
        <li>Must not exceed 500MB in size</li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Auto-Detection
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        TestForge automatically detects:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>Programming language and framework</li>
        <li>API endpoints and route handlers</li>
        <li>Middleware chain</li>
        <li>Database schemas (ORM models)</li>
        <li>Authentication mechanisms</li>
        <li>Environment variables (names only, not values)</li>
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: TEST TYPE SELECTION
   ──────────────────────────────────────────── */
function TestTypeSelectionPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Test Type Selection
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        TestForge runs{' '}
        <strong className="font-semibold text-[#12101A]">21 testing dimensions</strong>.
        You can customize which to run for each test execution.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        All 20 Dimensions
      </h2>
      <DocTable
        headers={['#', 'Dimension', 'What It Tests', 'Avg. Time']}
        rows={[
          ['1', 'Scope Test', 'API endpoint discovery, middleware analysis', '5s'],
          ['2', 'Vision/Goal', 'Business goal alignment with implementation', '10s'],
          ['3', 'Feature Matrix', 'Feature coverage and gap analysis', '15s'],
          ['4', 'Unit Test', 'Individual function correctness', '1-3m'],
          ['5', 'Integration Test', 'Service interaction and data flow', '2-4m'],
          ['6', 'E2E Test', 'Complete user flow validation', '3-5m'],
          ['7', 'Load & Scale', 'Performance under concurrent load', '5-8m'],
          ['8', 'Predictive', 'ML-based risk prediction', '20s'],
          ['9', 'Security', 'Vulnerability scanning (OWASP Top 10)', '2-3m'],
          ['10', 'Visual Regression', 'UI snapshot comparison', '1-2m'],
          ['11', 'Accessibility', 'WCAG 2.1 AA compliance', '30s'],
          ['12', 'Chaos Engineering', 'Fault injection and recovery', '5-6m'],
          ['20', 'Mutation Testing', 'Test suite quality assessment', '3-5m'],
        ]}
      />

      <InfoCallout title="Recommendation">
        For CI/CD pipelines, we recommend running all dimensions. For quick
        checks, run: Scope, Security, Unit, and Integration.
      </InfoCallout>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: CI/CD INTEGRATION
   ──────────────────────────────────────────── */
function CicdIntegrationPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        CI/CD Integration
      </h1>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        GitHub Actions
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Create <Code>.github/workflows/testforge.yml</Code>:
      </p>
      <DocCodeBlock
        code={`name: TestForge\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Run TestForge\n        uses: testforge/action@v2\n        with:\n          api-key: \{\{ secrets.TESTFORGE_API_KEY \}\}\n          depth: deep\n          fail-on-critical: true`}
        language="yaml"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        GitLab CI
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Add to <Code>.gitlab-ci.yml</Code>:
      </p>
      <DocCodeBlock
        code={`testforge:\n  image: testforge/cli:latest\n  script:\n    - testforge run $CI_REPOSITORY_URL --branch $CI_COMMIT_REF_NAME\n  only:\n    - merge_requests\n    - main`}
        language="yaml"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Configuration Options
      </h2>
      <DocTable
        headers={['Option', 'Default', 'Description']}
        rows={[
          [<Code>depth</Code>, <Code>shallow</Code>, 'Test coverage depth'],
          [<Code>fail-on-critical</Code>, <Code>false</Code>, 'Fail pipeline on critical findings'],
          [<Code>output-format</Code>, <Code>json</Code>, 'Report output format'],
          [<Code>notify</Code>, <Code>false</Code>, 'Send Slack/email notifications'],
        ]}
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: ENVIRONMENT VARIABLES
   ──────────────────────────────────────────── */
function EnvironmentVariablesPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Environment Variables
      </h1>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Required Variables
      </h2>
      <DocTable
        headers={['Variable', 'Description', 'Where to Find']}
        rows={[
          [
            <Code>TESTFORGE_API_KEY</Code>,
            'Authentication key',
            <a href="#/account" className="text-[#574a7d] hover:underline">Dashboard → API Keys</a>,
          ],
        ]}
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Optional Variables
      </h2>
      <DocTable
        headers={['Variable', 'Default', 'Description']}
        rows={[
          [<Code>TESTFORGE_LOG_LEVEL</Code>, <Code>info</Code>, 'Logging verbosity'],
          [<Code>TESTFORGE_OUTPUT_DIR</Code>, <Code>./reports</Code>, 'Report output directory'],
          [<Code>TESTFORGE_TIMEOUT</Code>, <Code>300</Code>, 'Test timeout in seconds'],
          [<Code>TESTFORGE_PARALLEL</Code>, <Code>true</Code>, 'Run tests in parallel'],
          [<Code>TESTFORGE_MAX_CONCURRENT</Code>, <Code>5</Code>, 'Max concurrent test dimensions'],
        ]}
      />
    </div>
  );
}


/* ────────────────────────────────────────────
   PAGE CONTENT: TEST TYPES OVERVIEW
   ──────────────────────────────────────────── */
function TestTypesOverviewPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Test Types Overview
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        TestForge runs 21 testing dimensions covering every aspect of your
        application. Here's what each one does.
      </p>

      <DocTable
        headers={['#', 'Dimension', 'Description', 'When It Fails']}
        rows={[
          ['1', 'Scope Test', 'Discovers all API endpoints and analyzes middleware chain', 'Missing endpoints or middleware gaps'],
          ['2', 'Vision/Goal', 'Validates business requirements against implementation', 'Features not aligned with goals'],
          ['3', 'Feature Matrix', 'Maps features to tests, identifies coverage gaps', 'Untested features or dead code'],
          ['4', 'Unit Test', 'Tests individual functions and methods in isolation', 'Logic errors, edge case failures'],
          ['5', 'Integration Test', 'Tests service interactions and database operations', 'API contract violations, data corruption'],
          ['6', 'E2E Test', 'Simulates complete user flows through the application', 'Broken user journeys, workflow failures'],
          ['7', 'Load & Scale', 'Performance testing under concurrent user load', 'Slow responses, crashes under load'],
          ['8', 'Predictive', 'ML-based risk prediction for code changes', 'High-risk modules identified'],
          ['9', 'Security', 'OWASP Top 10 vulnerability scanning', 'Injection, XSS, auth bypass, etc.'],
          ['10', 'Visual Regression', 'Detects unintended UI changes', 'Layout shifts, styling regressions'],
          ['11', 'Accessibility', 'WCAG 2.1 AA compliance checking', 'Missing ARIA labels, contrast issues'],
          ['12', 'Chaos Engineering', 'Fault injection to test resilience', 'Single points of failure, poor recovery'],
          ['20', 'Mutation Testing', 'Assesses test suite quality by injecting bugs', 'Weak tests that pass on broken code'],
        ]}
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: SECURITY TESTING
   ──────────────────────────────────────────── */
function SecurityTestingPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Security Testing
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        TestForge's security dimension performs comprehensive vulnerability
        scanning based on the OWASP Top 10 framework.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        What We Test
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#12101A]">
            SAST (Static Application Security Testing)
          </strong>{' '}
          — Analyzes source code for vulnerabilities without executing it
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            DAST (Dynamic Application Security Testing)
          </strong>{' '}
          — Tests the running application by sending malicious payloads
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Fuzzing</strong> —
          Sends random/invalid data to inputs to find crash or vulnerability
          points
        </li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Vulnerability Categories
      </h2>
      <DocTable
        headers={['Severity', 'Examples']}
        rows={[
          [
            <span className="font-mono font-medium text-[#D4524A]">CRITICAL</span>,
            'SQL Injection, Remote Code Execution, Authentication Bypass',
          ],
          [
            <span className="font-mono font-medium text-[#E87D3A]">HIGH</span>,
            'XSS, CSRF, Sensitive Data Exposure, Broken Access Control',
          ],
          [
            <span className="font-mono font-medium text-[#E8A838]">MEDIUM</span>,
            'Security Misconfiguration, Insecure Dependencies',
          ],
          [
            <span className="font-mono font-medium text-[#574a7d]">LOW</span>,
            'Missing Security Headers, Verbose Error Messages',
          ],
        ]}
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        How to Interpret Findings
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Each security finding includes:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#12101A]">Location</strong> —
          File path and line number where the vulnerability exists
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Vulnerability Type
          </strong>{' '}
          — OWASP classification (e.g., A03:2021 – Injection)
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">Severity</strong> —
          Critical, High, Medium, or Low based on exploitability and impact
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Proof of Concept
          </strong>{' '}
          — A sample payload or request that demonstrates the vulnerability
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Remediation
          </strong>{' '}
          — Step-by-step fix instructions with code examples
        </li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Remediation Workflow
      </h2>
      <ol className="list-decimal list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          Review the security findings in your test report, sorted by severity
        </li>
        <li>
          Click any finding to see the detailed explanation and proof of concept
        </li>
        <li>
          Follow the remediation steps to fix the vulnerability in your code
        </li>
        <li>Re-run the security test to verify the fix</li>
        <li>
          Export a security report for compliance or team review if needed
        </li>
      </ol>

      <WarningCallout title="Important">
        Always prioritize CRITICAL and HIGH severity findings. These represent
        actively exploitable vulnerabilities that could lead to data breaches or
        system compromise.
      </WarningCallout>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: PERFORMANCE TESTING
   ──────────────────────────────────────────── */
function PerformanceTestingPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Performance Testing
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        TestForge evaluates your application's performance under various load
        conditions to identify bottlenecks before they impact users.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Load & Scale Testing
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Simulates concurrent users hitting your API endpoints to measure:
      </p>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          <strong className="font-semibold text-[#12101A]">
            Response Time
          </strong>{' '}
          — P50, P95, and P99 latency percentiles
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Throughput
          </strong>{' '}
          — Requests per second your application can handle
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Error Rate
          </strong>{' '}
          — Percentage of failed requests under load
        </li>
        <li>
          <strong className="font-semibold text-[#12101A]">
            Breaking Point
          </strong>{' '}
          — The concurrency level where your application fails
        </li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        What We Measure
      </h2>
      <DocTable
        headers={['Metric', 'Description', 'Good Range']}
        rows={[
          ['P50 Latency', 'Median response time', '&lt; 100ms'],
          ['P95 Latency', '95th percentile response time', '&lt; 500ms'],
          ['P99 Latency', '99th percentile response time', '&lt; 1s'],
          ['Throughput', 'Requests per second', '&gt; 1000 RPS'],
          ['Error Rate', 'Failed request percentage', '&lt; 0.1%'],
        ]}
      />

      <InfoCallout title="Tip">
        Run performance tests against a staging environment that mirrors
        production. Testing against localhost may give unrealistic results due
        to network latency differences.
      </InfoCallout>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: CUSTOM RULES
   ──────────────────────────────────────────── */
function CustomRulesPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Custom Rules
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Define custom testing rules and assertions specific to your project's
        requirements.
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Configuration File
      </h2>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Create a <Code>testforge.config.json</Code> in your project root:
      </p>
      <DocCodeBlock
        code={`{\n  "rules": [\n    {\n      "name": "Require authentication on admin routes",\n      "type": "security",\n      "pattern": "/admin/*",\n      "assert": "middleware.includes('auth')"\n    },\n    {\n      "name": "Response time under 200ms",\n      "type": "performance",\n      "endpoint": "*",\n      "assert": "response.time < 200"\n    },\n    {\n      "name": "Require rate limiting",\n      "type": "security",\n      "pattern": "/api/*",\n      "assert": "middleware.includes('rateLimit')"\n    }\n  ]\n}`}
        language="json"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Rule Types
      </h2>
      <DocTable
        headers={['Type', 'Description']}
        rows={[
          ['security', 'Security-focused assertions on routes and middleware'],
          ['performance', 'Response time and throughput requirements'],
          ['quality', 'Code quality checks (coverage, complexity)'],
          ['custom', 'Any arbitrary assertion using the rule engine'],
        ]}
      />

      <SuccessCallout title="Pro Tip">
        Share custom rules across projects by committing{' '}
        <Code>testforge.config.json</Code> to your repository. TestForge
        automatically reads it on each test run.
      </SuccessCallout>
    </div>
  );
}


/* ────────────────────────────────────────────
   PAGE CONTENT: CLI REFERENCE
   ──────────────────────────────────────────── */
function CliReferencePage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        CLI Reference
      </h1>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Global Options
      </h2>
      <DocCodeBlock
        code={`--version, -v     Show version number\n--help, -h        Show help\n--config          Path to config file\n--verbose         Enable verbose logging`}
        language="text"
      />

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Commands
      </h2>

      <h3 className="font-heading font-semibold text-[20px] text-[#12101A] mt-8 mb-3">
        testforge run {'<repo-url>'}
      </h3>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Run a test suite on a repository.
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-2">
        Options:
      </p>
      <DocCodeBlock
        code={`--branch, -b        Git branch to test (default: main)\n--depth             Test depth: shallow or deep (default: shallow)\n--tests             Comma-separated test dimensions to run\n--output, -o        Output format: json, markdown, pdf (default: json)\n--timeout           Timeout in seconds (default: 300)\n--fail-on-critical  Exit with error if critical findings`}
        language="text"
      />
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">Example:</p>
      <DocCodeBlock
        code={`testforge run https://github.com/user/repo \\\\\n  --branch develop \\\\\n  --depth deep \\\\\n  --tests security,unit,integration \\\\\n  --output markdown`}
        language="bash"
      />

      <h3 className="font-heading font-semibold text-[20px] text-[#12101A] mt-8 mb-3">
        testforge status {'<run-id>'}
      </h3>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Check the status of a running or completed test.
      </p>

      <h3 className="font-heading font-semibold text-[20px] text-[#12101A] mt-8 mb-3">
        testforge report {'<run-id>'}
      </h3>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        View or download a test report.
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-2">
        Options:
      </p>
      <DocCodeBlock
        code={`--format     Output format: json, markdown, pdf\n--output     File path to save report`}
        language="text"
      />

      <h3 className="font-heading font-semibold text-[20px] text-[#12101A] mt-8 mb-3">
        testforge repos
      </h3>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        List all connected repositories.
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-2">
        Options:
      </p>
      <DocCodeBlock
        code={`--add {'<url>'}     Connect a new repository\n--remove {'<id>'}   Disconnect a repository`}
        language="text"
      />

      <h3 className="font-heading font-semibold text-[20px] text-[#12101A] mt-8 mb-3">
        testforge config
      </h3>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-4">
        Open the configuration editor.
      </p>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-2">
        Options:
      </p>
      <DocCodeBlock
        code={`--get {'<key>'}     Get a config value\n--set {'<key>'} {'<value>'}  Set a config value\n--list          List all config values`}
        language="text"
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: API REFERENCE
   ──────────────────────────────────────────── */
function ApiReferencePage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">API Reference</h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        The TestForge REST API allows programmatic access to test execution, reporting, and platform management. Base URL: <code className="bg-[#E8E5FF] px-2 py-0.5 rounded text-[#574a7d] font-mono text-sm">https://testforge.run/api</code>
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">🔬 Analysis Endpoints</h2>
      <div className="space-y-6">
        {[
          { method: 'GET', path: '/health', desc: 'Health check with database status', example: '{"status":"ok","database":"connected"}' },
          { method: 'POST', path: '/analyze', desc: 'Analyze a public GitHub repository. Returns 21-dimension analysis.', body: '{"repoUrl":"https://github.com/user/repo"}', example: '{"codebase":{"totalFiles":127},"security":{"findings":4},...}' },
          { method: 'GET', path: '/analyze', desc: 'Get MCP server connection info and available endpoints', example: '{"mcpServer":"https://testforge-mcp.fly.dev"}' },
          { method: 'POST', path: '/test', desc: 'Start a test suite run on Fly.io MCP server', body: '{"repoUrl":"...","dimensions":["security","unit"]}', example: '{"testRunId":"...","status":"queued"}' },
        ].map(e => <EndpointCard key={e.path} {...e} />)}
      </div>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">📊 Data Endpoints</h2>
      <div className="space-y-6">
        {[
          { method: 'GET', path: '/projects', desc: 'List all analyzed projects from Neon DB', example: '[{"id":"...","name":"express-ecommerce-api"}]' },
          { method: 'GET', path: '/test-runs', desc: 'List test runs. Query: ?id=run_id for specific run', example: '[{"id":"...","overall_score":68,"total_findings":16}]' },
          { method: 'GET', path: '/history', desc: 'Last 20 test runs with project names. Dashboard feed.', example: '[{"project_name":"...","overall_score":72}]' },
          { method: 'GET', path: '/reports/:id', desc: 'Full PRD report with phases and findings', example: '{"title":"...","phases":[...],"findings":[...]}' },
          { method: 'POST', path: '/save-results', desc: 'Save analysis results to Neon DB', body: '{"repo":"...","security":{...}}', example: '{"saved":true,"runId":"uuid"}' },
        ].map(e => <EndpointCard key={e.path} {...e} />)}
      </div>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">🔐 Auth & Users</h2>
      <div className="space-y-6">
        {[
          { method: 'POST', path: '/auth/login', desc: 'Login with email/password (mock). Returns user + token.', body: '{"email":"user@test.com","password":"pass"}', example: '{"token":"...","user":{"name":"Alex"}}' },
          { method: 'GET', path: '/auth/callback', desc: 'GitHub OAuth callback. Redirects to GitHub then back with user data.' },
        ].map(e => <EndpointCard key={e.path} {...e} />)}
      </div>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">🏢 Enterprise Endpoints</h2>
      <div className="space-y-6">
        {[
          { method: 'GET', path: '/stripe', desc: 'Get pricing plans (Free/Pro/Enterprise)', example: '{"plans":[{"id":"pro","price":29}]}' },
          { method: 'POST', path: '/stripe', desc: 'Create Stripe checkout session', body: '{"plan":"pro","email":"user@test.com"}', example: '{"ok":true,"checkoutUrl":"..."}' },
          { method: 'POST', path: '/webhook', desc: 'GitHub push webhook. Triggers analysis on push.', body: '{"ref":"refs/heads/main","repository":{...}}' },
          { method: 'GET', path: '/orgs', desc: 'List organizations. POST to create.', example: '[{"id":"...","name":"Acme Corp"}]' },
          { method: 'GET', path: '/status', desc: 'Public status page — checks all 4 services live', example: '{"status":"all_systems_operational"}' },
          { method: 'GET', path: '/usage', desc: 'API usage stats: tests run, quota, avg score', example: '{"testsRun":47,"remainingQuota":53}' },
          { method: 'GET', path: '/tasks', desc: 'Enterprise task tracking. PATCH to update status.', example: '{"tasks":[...],"total":86}' },
        ].map(e => <EndpointCard key={e.path} {...e} />)}
      </div>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">🔔 Integrations</h2>
      <div className="space-y-6">
        {[
          { method: 'POST', path: '/notify', desc: 'Send results to Slack or Discord webhook', body: '{"platform":"slack","webhookUrl":"...","score":85}' },
          { method: 'GET', path: '/badge', desc: 'SVG badge for README. Query: ?score=85 or ?repo=owner/name', example: '<svg> badge with score </svg>' },
          { method: 'POST', path: '/rules', desc: 'Custom rule builder. GET/POST/DELETE custom analysis rules.', body: '{"name":"no-console","pattern":"console.log"}' },
        ].map(e => <EndpointCard key={e.path} {...e} />)}
      </div>
    </div>
  );
}

function EndpointCard({ method, path, desc, body, example }: { method: string; path: string; desc: string; body?: string; example?: string }) {
  const methodColors: Record<string, string> = { GET: '#22C55E', POST: '#3B82F6', PATCH: '#EAB308', DELETE: '#EF4444' };
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-xl p-5">
      <div className="flex items-start gap-3 mb-2">
        <span className="font-mono text-xs px-2 py-0.5 rounded font-bold" style={{ backgroundColor: (methodColors[method] || '#6B6B6B') + '20', color: methodColors[method] }}>{method}</span>
        <code className="font-mono text-sm text-[#12101A] font-medium">{path}</code>
      </div>
      <p className="text-sm text-[#6B6B6B] mb-2">{desc}</p>
      {body && <div className="bg-[#12101A] rounded-lg p-3 font-mono text-xs text-[#a99bff] overflow-x-auto mb-2">{body}</div>}
      <p className="text-[11px] text-[#9A9A9A] font-mono">→ {example ? example.slice(0, 100) : 'See response'}</p>
    </div>
  );
}
function TroubleshootingPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Troubleshooting
      </h1>
      <p className="font-body text-[16px] text-[#333333] leading-[1.7] mb-6">
        Common issues and solutions. If your problem isn't listed here, contact{' '}
        <a href="mailto:support@testforge.dev" className="text-[#574a7d] hover:underline">
          support@testforge.dev
        </a>
        .
      </p>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        "Repository not found" error
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>Verify the repository URL is correct and publicly accessible</li>
        <li>Ensure the repository hasn't been deleted or made private</li>
        <li>Check that the branch name exists</li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Tests timing out
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          Increase the timeout:{' '}
          <Code>testforge run {'<url>'} --timeout 600</Code>
        </li>
        <li>
          Try shallow depth first: <Code>--depth shallow</Code>
        </li>
        <li>
          Run fewer dimensions:{' '}
          <Code>--tests scope,security,unit</Code>
        </li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        MCP server not responding
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>
          Verify the server is running: <Code>testforge-mcp --status</Code>
        </li>
        <li>
          Check your API key is set: <Code>echo $TESTFORGE_API_KEY</Code>
        </li>
        <li>
          Restart the server: <Code>testforge-mcp restart</Code>
        </li>
        <li>
          Check logs: <Code>testforge-mcp logs --follow</Code>
        </li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        "Rate limit exceeded" error
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>Free tier: 10 requests/minute</li>
        <li>Wait 60 seconds and retry</li>
        <li>Consider upgrading to Pro for higher limits</li>
      </ul>

      <h2 className="font-heading font-semibold text-[26px] text-[#12101A] mt-10 mb-4">
        Getting Help
      </h2>
      <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] mb-6 ml-2">
        <li>Browse this documentation</li>
        <li>
          Check{' '}
          <a
            href="https://github.com/testforge/issues"
            className="text-[#574a7d] hover:underline"
          >
            GitHub Issues
          </a>
        </li>
        <li>
          Email:{' '}
          <a
            href="mailto:support@testforge.dev"
            className="text-[#574a7d] hover:underline"
          >
            support@testforge.dev
          </a>
        </li>
        <li>Response time: Within 24 hours for Pro, 4 hours for Enterprise</li>
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: CHANGELOG
   ──────────────────────────────────────────── */
function ChangelogPage() {
  return (
    <div>
      <h1 className="font-heading font-semibold text-[36px] text-[#12101A] mb-6">
        Changelog
      </h1>

      <div className="space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="font-heading font-semibold text-[22px] text-[#12101A]">
              v2.0.0
            </h2>
            <span className="font-mono text-[12px] text-[#9A9A9A]">
              2026-01-15
            </span>
            <span className="font-mono font-medium text-[11px] uppercase px-2 py-0.5 rounded bg-[#E8E5FF] text-[#574a7d]">
              Latest
            </span>
          </div>
          <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] ml-2">
            <li>New MCP server with one-line installer</li>
            <li>Added 20th testing dimension: Mutation Testing</li>
            <li>Predictive analysis with ML risk scoring</li>
            <li>Chaos engineering with fault injection</li>
            <li>PRD generation from failed tests</li>
            <li>Real-time progress tracking in dashboard</li>
            <li>New IDE integrations: Cursor, VS Code, Windsurf, Trae, Claude Code</li>
            <li>Improved security scanning with OWASP Top 10 2021</li>
            <li>Visual regression testing with screenshot comparison</li>
            <li>Accessibility testing with WCAG 2.1 AA compliance</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="font-heading font-semibold text-[22px] text-[#12101A]">
              v1.9.0
            </h2>
            <span className="font-mono text-[12px] text-[#9A9A9A]">
              2025-11-20
            </span>
          </div>
          <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] ml-2">
            <li>Load & scale testing with configurable concurrency</li>
            <li>Integration test improvements for async flows</li>
            <li>Performance optimization: 40% faster test runs</li>
            <li>New webhook notifications for Slack and Discord</li>
            <li>Bug fixes for Docker container networking</li>
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="font-heading font-semibold text-[22px] text-[#12101A]">
              v1.8.0
            </h2>
            <span className="font-mono text-[12px] text-[#9A9A9A]">
              2025-09-10
            </span>
          </div>
          <ul className="list-disc list-inside space-y-2 font-body text-[16px] text-[#333333] leading-[1.7] ml-2">
            <li>E2E test flow recording and replay</li>
            <li>Feature matrix coverage analysis</li>
            <li>Security scan with CWE classification</li>
            <li>GitHub Actions marketplace integration</li>
            <li>CLI: improved output formatting with colors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


/* ────────────────────────────────────────────
   RIGHT-SIDE TABLE OF CONTENTS
   ──────────────────────────────────────────── */
function RightTOC({ headings }: { headings: string[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      const headingElements = document.querySelectorAll('[data-doc-heading]');
      let current = '';
      headingElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 150) {
          current = el.id;
        }
      });
      setActiveId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (headings.length === 0) return null;

  return (
    <div className="hidden xl:block w-[220px] flex-shrink-0">
      <div className="sticky top-[96px] pl-6">
        <p className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A] tracking-[0.08em] mb-3">
          ON THIS PAGE
        </p>
        <nav className="space-y-1">
          {headings.map((heading) => {
            const el = document.getElementById(heading);
            const isH3 = el?.tagName === 'H3';
            const isActive = activeId === heading;

            return (
              <a
                key={heading}
                href={`#${heading}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(heading)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className={`block text-[13px] py-1 transition-colors duration-200
                  ${isH3 ? 'pl-4 text-[#6B6B6B]' : 'text-[#333333] font-medium'}
                  ${isActive ? 'text-[#574a7d] border-l-2 border-[#574a7d] -ml-[1px] pl-3' : 'hover:text-[#12101A]'}
                  ${isActive && isH3 ? 'pl-[calc(1rem-1px)]' : ''}
                `}
              >
                {heading.replace(/-/g, ' ')}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: MCP IDE SETUP
   ──────────────────────────────────────────── */
function McpIdeSetupPage() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-label-mono text-[#574a7d] mb-3">// INSTALLATION</p>
        <h1 className="text-display-md text-[#12101A] mb-2">MCP IDE Setup</h1>
        <p className="text-body-lg text-[#6B6B6B]">
          Install the TestForge MCP server in your IDE for AI-powered testing directly from your editor.
        </p>
      </div>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">What is MCP?</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">
          The <strong>Model Context Protocol (MCP)</strong> is an open standard that enables AI coding assistants (like Cursor, Claude Code, Windsurf) to communicate with external tools. TestForge implements MCP so your AI assistant can run tests, analyze code, and generate reports — without leaving your IDE.
        </p>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">One-Command Installation</h2>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto mb-4">
          npx @whitenoisenpm/testforge-mcp install
        </div>
        <p className="text-body-md text-[#6B6B6B] mb-4">
          This automatically detects your IDE and configures the MCP connection. TestForge supports:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {['Cursor', 'VS Code', 'Windsurf', 'Claude Code', 'Trae', 'Zed'].map(ide => (
            <div key={ide} className="border border-[#D9D9D3] rounded-lg p-3 text-center text-sm font-medium text-[#333333]">
              {ide}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Manual Setup (Cursor)</h2>
        <ol className="space-y-4 text-body-md text-[#6B6B6B]">
          <li className="flex gap-3">
            <span className="font-mono text-[#574a7d] font-bold">1.</span>
            <span>Open Cursor Settings → Features → MCP</span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[#574a7d] font-bold">2.</span>
            <span>Click <strong>Add New MCP Server</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-[#574a7d] font-bold">3.</span>
            <span>Configure with the following JSON:</span>
          </li>
        </ol>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm mt-4 overflow-x-auto">
          <pre className="text-[#a39fd4]">{`{\n  "mcpServers": {\n    "testforge": {\n      "command": "npx",\n      "args": ["-y", "@whitenoisenpm/testforge-mcp", "serve"],\n      "env": {\n        "TESTFORGE_MCP_PORT": "3001"\n      }\n    }\n  }\n}`}</pre>
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Available MCP Tools</h2>
        <div className="space-y-3">
          {[
            { tool: 'testforge_analyze', desc: 'Scan your codebase for endpoints, dependencies, tech stack, and structure' },
            { tool: 'testforge_test', desc: 'Run the full 20-dimension test suite across your project' },
            { tool: 'testforge_quick_scan', desc: 'Fast 30-second security + unit test scan' },
            { tool: 'testforge_report', desc: 'Generate a structured PRD report from test results' },
          ].map(t => (
            <div key={t.tool} className="border border-[#D9D9D3] rounded-lg p-4">
              <code className="font-mono text-sm text-[#574a7d] font-medium">{t.tool}</code>
              <p className="text-body-md text-[#6B6B6B] mt-1">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Example: Test Your Project</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">Once installed, just ask your AI assistant:</p>
        <div className="bg-[#E8E5FF] border border-[#a39fd4] rounded-lg p-4 text-body-md text-[#333333]">
          "Run a security scan on this project"
        </div>
        <p className="text-body-md text-[#6B6B6B] mt-4">Or more specifically:</p>
        <div className="bg-[#E8E5FF] border border-[#a39fd4] rounded-lg p-4 text-body-md text-[#333333] mt-2">
          "Test this project for security issues, check unit test coverage, and generate a PRD report"
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: SELF-HOSTED (FLY.IO)
   ──────────────────────────────────────────── */
function SelfHostedFlyioPage() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-label-mono text-[#574a7d] mb-3">// INSTALLATION</p>
        <h1 className="text-display-md text-[#12101A] mb-2">Self-Hosted on Fly.io</h1>
        <p className="text-body-lg text-[#6B6B6B]">
          Deploy your own TestForge MCP server on Fly.io — your code never leaves your infrastructure.
        </p>
      </div>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Why Self-Host?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[
            { icon: '🔒', title: 'Privacy First', desc: 'Your source code never leaves your machine. All analysis happens in your container.' },
            { icon: '⚡', title: 'Low Latency', desc: 'Deploy in your preferred region for sub-50ms response times.' },
            { icon: '💰', title: 'Cost Control', desc: 'Fly.io offers $5/month free credits. Scale as needed, pay only for what you use.' },
            { icon: '🎛️', title: 'Full Control', desc: 'Customize analyzers, set your own resource limits, manage your own data.' },
          ].map(f => (
            <div key={f.title} className="border border-[#D9D9D3] rounded-lg p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="font-medium text-[#12101A] mb-1">{f.title}</h3>
              <p className="text-sm text-[#6B6B6B]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Quick Deploy (5 minutes)</h2>
        <div className="space-y-6">
          <div>
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-2">Step 1: Clone the Repository</p>
            <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
              git clone https://github.com/t4tarzan/testforge.git<br/>
              cd testforge/mcp-server
            </div>
          </div>
          <div>
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-2">Step 2: Install Fly.io CLI</p>
            <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
              curl -L https://fly.io/install.sh | sh
            </div>
          </div>
          <div>
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-2">Step 3: Login & Deploy</p>
            <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
              flyctl auth login<br/>
              flyctl launch --now
            </div>
          </div>
          <div>
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-2">Step 4: Verify</p>
            <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
              curl https://your-app.fly.dev/health
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Configuration</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">Set these environment variables in your Fly.io app:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D9D9D3]">
                <th className="text-left py-2 px-3 font-mono text-[#574a7d]">Variable</th>
                <th className="text-left py-2 px-3 font-mono text-[#574a7d]">Default</th>
                <th className="text-left py-2 px-3 font-mono text-[#574a7d]">Description</th>
              </tr>
            </thead>
            <tbody className="text-[#6B6B6B]">
              <tr className="border-b border-[#D9D9D3]"><td className="py-2 px-3 font-mono">TESTFORGE_MCP_PORT</td><td className="py-2 px-3">3001</td><td className="py-2 px-3">Server port</td></tr>
              <tr className="border-b border-[#D9D9D3]"><td className="py-2 px-3 font-mono">DATABASE_URL</td><td className="py-2 px-3">-</td><td className="py-2 px-3">Neon PostgreSQL connection string</td></tr>
              <tr className="border-b border-[#D9D9D3]"><td className="py-2 px-3 font-mono">TMP_DIR</td><td className="py-2 px-3">/tmp/testforge-repos</td><td className="py-2 px-3">Temp directory for cloned repos</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Your Server Endpoints</h2>
        <div className="space-y-3">
          {[
            { method: 'GET', path: '/health', desc: 'Health check — verify your server is running' },
            { method: 'POST', path: '/clone-and-analyze', desc: 'Clone a git repo and run full analysis' },
            { method: 'POST', path: '/analyze', desc: 'Analyze a local project path' },
            { method: 'POST', path: '/test', desc: 'Start a test suite run' },
            { method: 'GET', path: '/test/:id/progress', desc: 'Get test run progress/status' },
            { method: 'GET', path: '/report/:id', desc: 'Get a generated test report' },
          ].map(e => (
            <div key={e.path} className="flex items-start gap-3 border border-[#D9D9D3] rounded-lg p-3">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#E8E5FF] text-[#574a7d] font-medium flex-shrink-0">{e.method}</span>
              <div><code className="font-mono text-sm text-[#12101A]">{e.path}</code><p className="text-sm text-[#6B6B6B]">{e.desc}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: MCP USAGE GUIDE
   ──────────────────────────────────────────── */
function McpUsageGuidePage() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-label-mono text-[#574a7d] mb-3">// GUIDES</p>
        <h1 className="text-display-md text-[#12101A] mb-2">MCP Usage Guide</h1>
        <p className="text-body-lg text-[#6B6B6B]">
          Learn how to use TestForge through the MCP protocol — automate testing from your IDE, CI/CD, or any MCP-compatible client.
        </p>
      </div>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">🖥️ Local Dashboard (v0.2.17)</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">
          The MCP server now includes a beautiful local dashboard at <code className="bg-[#E8E5FF] px-1.5 py-0.5 rounded text-[#574a7d] font-mono text-sm">http://localhost:3001</code>. No cloud, no sign-in, no hosting needed.
        </p>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a99bff] overflow-x-auto mb-4">
          npx @whitenoisenpm/testforge-mcp@0.2.17 serve<br/>
          open http://localhost:3001
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: '📁 Local Analysis', desc: 'Enter any project path on your machine. Full 21-dimension analysis runs locally.' },
            { title: '📊 Live Report', desc: 'See the complete report inline — score ring, 12 dimension grid, all findings with fix suggestions.' },
            { title: '💾 SQLite Storage', desc: 'Results auto-saved to ~/.testforge/history.db. View past reports anytime.' },
            { title: '📚 Report History', desc: 'Past 20 reports listed. Click any to reload and view full details.' },
            { title: '🤖 Agentic Scale', desc: 'World-first prediction: how many AI agents can your API handle simultaneously?' },
            { title: '🖨️ Export', desc: 'Print or save as PDF directly from the dashboard.' },
          ].map(f => (
            <div key={f.title} className="border border-[#D9D9D3] rounded-lg p-4">
              <div className="font-medium text-[#12101A] mb-1">{f.title}</div>
              <div className="text-sm text-[#6B6B6B]">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Quick Start Flow</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Install MCP Server', cmd: 'npx @whitenoisenpm/testforge-mcp install' },
            { step: '2', title: 'Open Your Project in Cursor/VS Code', cmd: 'code .' },
            { step: '3', title: 'Ask Your AI Assistant', cmd: '"Analyze this project for security vulnerabilities"' },
            { step: '4', title: 'Review Results in IDE', desc: 'Findings appear inline with file paths and line numbers' },
            { step: '5', title: 'Generate Report', cmd: '"Generate a PRD from the test results"' },
          ].map(s => (
            <div key={s.step} className="flex gap-4 border border-[#D9D9D3] rounded-lg p-4">
              <div className="w-8 h-8 rounded-full bg-[#574a7d] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{s.step}</div>
              <div>
                <h3 className="font-medium text-[#12101A]">{s.title}</h3>
                {s.cmd && <div className="bg-[#E8E5FF] rounded px-3 py-1.5 mt-2 font-mono text-sm text-[#333333]">{s.cmd}</div>}
                {s.desc && <p className="text-sm text-[#6B6B6B] mt-1">{s.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">MCP Protocol Endpoints</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">If you want to integrate TestForge with your own MCP client, here are the available tools:</p>
        <div className="space-y-3">
          {[
            { tool: 'testforge_analyze', params: '{ projectPath: string }', returns: 'CodebaseInfo (files, endpoints, dependencies, tech stack)' },
            { tool: 'testforge_test', params: '{ projectPath: string, dimensions?: string[], branch?: string }', returns: '{ testRunId, status, streamUrl }' },
            { tool: 'testforge_quick_scan', params: '{ projectPath: string }', returns: '{ testRunId } (runs in background, streams via SSE)' },
            { tool: 'testforge_report', params: '{ testRunId: string, format?: "json"|"markdown" }', returns: 'Structured PRD report with phases' },
          ].map(t => (
            <div key={t.tool} className="border border-[#D9D9D3] rounded-lg p-4">
              <code className="font-mono text-sm text-[#574a7d] font-medium">{t.tool}</code>
              <div className="mt-2 text-sm"><span className="text-[#9A9A9A]">Params: </span><code className="text-[#6B6B6B]">{t.params}</code></div>
              <div className="text-sm mt-1"><span className="text-[#9A9A9A]">Returns: </span><span className="text-[#6B6B6B]">{t.returns}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Real-Time Progress with SSE</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">TestForge streams progress updates via Server-Sent Events:</p>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
          {`const events = new EventSource('http://localhost:3001/mcp/sse');\nevents.onmessage = (event) => {\n  const data = JSON.parse(event.data);\n  console.log(data.type, data.stage, data.progress + '%');\n};`}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">CI/CD Integration via MCP</h2>
        <p className="text-body-md text-[#6B6B6B] mb-4">Call TestForge MCP tools from your CI/CD pipeline:</p>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
          {`- name: TestForge Security Scan\n  run: |\n    curl -X POST https://your-server.fly.dev/analyze \\\\\\n      -H "Content-Type: application/json" \\\\\\n      -d '{"projectPath": "."}'`}
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   PAGE CONTENT: CONTAINER DEPLOYMENT
   ──────────────────────────────────────────── */
function ContainerDeploymentPage() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-label-mono text-[#574a7d] mb-3">// GUIDES</p>
        <h1 className="text-display-md text-[#12101A] mb-2">Container Deployment</h1>
        <p className="text-body-lg text-[#6B6B6B]">
          Deploy TestForge MCP server as a container — works with Fly.io, Docker, Railway, Render, or any container platform.
        </p>
      </div>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Docker Deployment</h2>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
          {`docker build -t testforge-mcp .\ndocker run -p 3001:3001 \\\\\\n  -e DATABASE_URL=your_neon_url \\\\\\n  testforge-mcp`}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Docker Compose (with DB)</h2>
        <div className="bg-[#12101A] rounded-lg p-4 font-mono text-sm text-[#a39fd4] overflow-x-auto">
          {`version: '3.8'\nservices:\n  testforge:\n    build: ./mcp-server\n    ports:\n      - "3001:3001"\n    environment:\n      - DATABASE_URL=postgresql://user:pass@db:5432/testforge\n  db:\n    image: postgres:16\n    environment:\n      - POSTGRES_USER=user\n      - POSTGRES_PASSWORD=pass\n      - POSTGRES_DB=testforge`}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Other Container Platforms</h2>
        <div className="space-y-4">
          {[
            { platform: 'Railway', steps: '1. Create new service → Deploy from GitHub repo\n2. Set DATABASE_URL env var\n3. Railway auto-detects Dockerfile and deploys' },
            { platform: 'Render', steps: '1. New Web Service → Connect GitHub repo\n2. Select Docker runtime\n3. Set port to 3001 and add env vars' },
            { platform: 'Google Cloud Run', steps: '1. gcloud builds submit --tag gcr.io/PROJECT/testforge\n2. gcloud run deploy --image gcr.io/PROJECT/testforge --port 3001\n3. Set DATABASE_URL via Secret Manager' },
            { platform: 'AWS ECS / Fargate', steps: '1. Push image to ECR\n2. Create ECS task definition with port 3001\n3. Create Fargate service with DATABASE_URL secret' },
          ].map(p => (
            <div key={p.platform} className="border border-[#D9D9D3] rounded-lg p-4">
              <h3 className="font-medium text-[#12101A] mb-2">{p.platform}</h3>
              <pre className="text-sm text-[#6B6B6B] whitespace-pre-line font-body">{p.steps}</pre>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-[#D9D9D3] rounded-xl p-6">
        <h2 className="text-heading-sm text-[#12101A] mb-4">Resource Requirements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D9D9D3]">
                <th className="text-left py-2 px-3 font-mono text-[#574a7d]">Resource</th>
                <th className="text-left py-2 px-3 font-mono text-[#574a7d]">Minimum</th>
                <th className="text-left py-2 px-3 font-mono text-[#574a7d]">Recommended</th>
              </tr>
            </thead>
            <tbody className="text-[#6B6B6B]">
              <tr className="border-b border-[#D9D9D3]"><td className="py-2 px-3">CPU</td><td className="py-2 px-3">0.5 vCPU</td><td className="py-2 px-3">1 vCPU</td></tr>
              <tr className="border-b border-[#D9D9D3]"><td className="py-2 px-3">RAM</td><td className="py-2 px-3">512 MB</td><td className="py-2 px-3">1 GB</td></tr>
              <tr className="border-b border-[#D9D9D3]"><td className="py-2 px-3">Disk</td><td className="py-2 px-3">1 GB</td><td className="py-2 px-3">5 GB</td></tr>
              <tr><td className="py-2 px-3">Network</td><td className="py-2 px-3">Outbound only</td><td className="py-2 px-3">Public (for git cloning)</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN DOCS PAGE COMPONENT
   ──────────────────────────────────────────── */
export default function Docs() {
  const [activePage, setActivePage] = useState('Overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tocHeadings, setTocHeadings] = useState<string[]>([]);
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse URL hash or path for page selection
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && reversePageIdMap[hash]) {
      setActivePage(reversePageIdMap[hash]);
    }
  }, [location.hash]);

  // Extract headings from content for TOC
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const headings = contentRef.current.querySelectorAll('h2, h3');
        const ids: string[] = [];
        headings.forEach((h) => {
          if (h.id) {
            ids.push(h.id);
          } else {
            // Generate id from text
            const text = h.textContent || '';
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            h.id = id;
            h.setAttribute('data-doc-heading', 'true');
            ids.push(id);
          }
        });
        setTocHeadings(ids);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activePage]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [activePage]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleNavClick = (item: string) => {
    setActivePage(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Update URL hash
    const id = pageIdMap[item];
    if (id) {
      window.history.pushState(null, '', `#${id}`);
    }
  };

  return (
    <div className="flex min-h-[100dvh] pt-[72px]">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#12101A]/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-6 right-6 z-50 lg:hidden w-12 h-12 rounded-full bg-[#574a7d] text-white shadow-lg flex items-center justify-center"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutExpo }}
        className={`
          fixed lg:sticky top-[72px] left-0 z-40
          w-[280px] md:w-[280px]
          h-[calc(100dvh-72px)]
          bg-white border-r border-[#D9D9D3]
          overflow-y-auto
          transition-transform duration-300 lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Search bar */}
        <div className="px-5 pb-5 pt-6">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
            />
            <input
              type="text"
              placeholder="Search documentation..."
              className="w-full h-10 bg-[#F7F7FB] border border-[#D9D9D3] rounded-lg pl-10 pr-4
                font-body text-[14px] text-[#333333]
                focus:outline-none focus:border-[#574a7d] transition-colors"
            />
          </div>
        </div>

        {/* Nav groups */}
        <nav className="pb-6">
          {navGroups.map((group) => (
            <div key={group.header} className="mb-2">
              <p className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A] tracking-[0.08em] px-5 pt-4 pb-2">
                {group.header}
              </p>
              <ul>
                {group.items.map((item) => {
                  const isActive = activePage === item;
                  return (
                    <li key={item}>
                      <button
                        onClick={() => handleNavClick(item)}
                        className={`w-full text-left px-5 py-2 font-body text-[14px] 
                          border-l-2 transition-all duration-200
                          ${
                            isActive
                              ? 'text-[#574a7d] border-[#574a7d] bg-[rgba(90,143,94,0.04)]'
                              : 'text-[#333333] border-transparent hover:bg-[#F7F7FB] hover:text-[#12101A]'
                          }`}
                      >
                        {item}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Version selector */}
        <div className="px-5 pt-4 border-t border-[#D9D9D3] mt-4 pb-6">
          <p className="font-mono font-medium text-[11px] text-[#9A9A9A] mb-2">
            Version
          </p>
          <select
            className="w-full h-9 bg-[#F7F7FB] border border-[#D9D9D3] rounded-md px-3
              font-body text-[13px] text-[#333333] focus:outline-none focus:border-[#574a7d]"
          >
            <option>v2.0 (current)</option>
            <option>v1.9</option>
            <option>v1.8</option>
          </select>
        </div>
      </motion.aside>

      {/* Content area */}
      <div className="flex flex-1 justify-center">
        <main className="w-full max-w-[800px] px-6 md:px-12 py-12" ref={contentRef}>
          <DocContent pageId={pageIdMap[activePage] || 'overview'} />
        </main>

        {/* Right TOC - wide screens only */}
        <div className="hidden xl:block w-[220px] flex-shrink-0">
          <RightTOC headings={tocHeadings} />
        </div>
      </div>
    </div>
  );
}
