import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Settings,
  MessageSquare,
  FlaskConical,
  BarChart3,
  CheckCircle,
  ChevronDown,
  Sparkles,
  Shield,
  Wrench,
  FileText,
  Layers,
  Activity,
  ArrowUpRight,
  Download,
  Puzzle,
} from 'lucide-react';
import CopyButton from '@/components/mcp/CopyButton';
import SyntaxCode from '@/components/mcp/SyntaxCode';

/* ────────────────────────────────────────────
   Easing
   ──────────────────────────────────────────── */
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ────────────────────────────────────────────
   Section wrapper with scroll-triggered reveal
   ──────────────────────────────────────────── */
function SectionReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: easeOutExpo, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ────────────────────────────────────────────
   HERO SECTION
   ──────────────────────────────────────────── */
function HeroSection() {
  const [showManual, setShowManual] = useState(false);
  const [typedText, setTypedText] = useState('');
  const fullCommand = 'npx @whitenoisenpm/testforge-mcp install';
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true });

  // Typewriter effect for the command
  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(fullCommand.slice(0, i));
      if (i >= fullCommand.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#12101A] pt-24 pb-20 overflow-hidden"
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `linear-gradient(to right, #574a7d 1px, transparent 1px),
                            linear-gradient(to bottom, #574a7d 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Decorative glow */}
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(90,143,94,0.08), transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-[1280px] mx-auto px-6 lg:px-16 text-center">
        {/* Section label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
          className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d] mb-6"
        >
          {'// MCP SERVER'}
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: easeOutExpo }}
          className="font-heading font-semibold text-[42px] md:text-[52px] leading-[1.1] tracking-[-0.025em]"
        >
          <span className="text-white">One Line.</span>
          <br />
          <span className="text-[#574a7d]">Full Integration.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="font-body text-[18px] text-[#9A9A9A] max-w-[640px] mx-auto mt-6 leading-[1.65]"
        >
          Connect TestForge to your IDE in under 60 seconds. No configuration
          files. No complex setup.
        </motion.p>

        {/* Install Command Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-[700px] mx-auto mt-10"
        >
          <div className="relative bg-[#1E1B2E] border border-[#3A3A3A] rounded-2xl p-6 text-left">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-[#D4524A]" />
              <div className="w-3 h-3 rounded-full bg-[#E8A838]" />
              <div className="w-3 h-3 rounded-full bg-[#574a7d]" />
              <span className="font-mono text-[12px] text-[#9A9A9A] ml-4">terminal</span>
            </div>

            {/* Subtle glow behind command */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-[80%] h-[60px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse, rgba(90,143,94,0.08), transparent 70%)',
              }}
            />

            {/* Command line */}
            <div className="relative flex items-center gap-3 py-4">
              <span className="font-mono text-[16px] text-[#574a7d]">$</span>
              <span className="font-mono font-medium text-[18px] text-white tracking-[0.02em]">
                {typedText}
                <span className="inline-block w-[2px] h-[20px] bg-[#574a7d] ml-0.5 animate-pulse align-middle" />
              </span>
            </div>

            {/* Copy button */}
            <div className="absolute top-[60px] right-6">
              <CopyButton text="npx @whitenoisenpm/testforge-mcp install" />
            </div>
          </div>
        </motion.div>

        {/* Supported editors */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="font-body text-[14px] text-[#9A9A9A] mt-5"
        >
          Works with{' '}
          <span className="text-[#7a6fad]">
            Cursor, VS Code, Windsurf, Trae, Claude Code
          </span>
          , and any MCP-compatible editor
        </motion.p>

        {/* Post-install hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-5 flex items-center justify-center gap-2 flex-wrap"
        >
          <span className="font-body text-[15px] text-[#9A9A9A]">Then say</span>
          <code className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-md px-3 py-1 font-mono font-medium text-[15px] text-[#7a6fad]">
            Test this project
          </code>
          <span className="font-body text-[15px] text-[#9A9A9A]">
            in your IDE's AI chat. That's it.
          </span>
        </motion.div>

        {/* Manual install toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-6"
        >
          <button
            onClick={() => setShowManual(!showManual)}
            className="inline-flex items-center gap-1 font-mono font-medium text-[13px] text-[#574a7d] hover:underline transition-all"
          >
            Or install manually
            <motion.span
              animate={{ rotate: showManual ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown size={14} />
            </motion.span>
          </button>

          <AnimatePresence>
            {showManual && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: easeOutExpo }}
                className="overflow-hidden"
              >
                <div className="max-w-[700px] mx-auto mt-4 bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-6 text-left">
                  <div className="space-y-5">
                    <div>
                      <span className="font-mono font-medium text-[11px] text-[#574a7d] uppercase">
                        Step 1
                      </span>
                      <p className="font-body text-[14px] text-[#9A9A9A] mt-1">
                        Install the MCP server globally
                      </p>
                      <div className="mt-2 bg-[#12101A] rounded-lg p-3 flex items-center justify-between">
                        <code className="font-mono text-[13px] text-white">
                          npm install -g @whitenoisenpm/testforge-mcp
                        </code>
                        <CopyButton
                          text="npm install -g @whitenoisenpm/testforge-mcp"
                          size="sm"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="font-mono font-medium text-[11px] text-[#574a7d] uppercase">
                        Step 2
                      </span>
                      <p className="font-body text-[14px] text-[#9A9A9A] mt-1">
                        Configure your IDE (see IDE cards below)
                      </p>
                    </div>
                    <div>
                      <span className="font-mono font-medium text-[11px] text-[#574a7d] uppercase">
                        Step 3
                      </span>
                      <p className="font-body text-[14px] text-[#9A9A9A] mt-1">
                        Start testing
                      </p>
                      <div className="mt-2 bg-[#12101A] rounded-lg p-3 flex items-center justify-between">
                        <code className="font-mono text-[13px] text-white">
                          testforge-mcp --project ./my-api
                        </code>
                        <CopyButton
                          text="testforge-mcp --project ./my-api"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}


/* ────────────────────────────────────────────
   IDE SETUP CARDS
   ──────────────────────────────────────────── */
const ideConfigs = [
  {
    name: 'Cursor',
    badge: 'Popular',
    badgeColor: 'bg-[#E8E5FF] text-[#574a7d]',
    iconBg: '#12101A',
    description: "Add to Cursor's MCP settings. No restart required.",
    config: `{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["@whitenoisenpm/testforge-mcp", "start"],
      "env": {
        "TESTFORGE_API_KEY": "your-api-key"
      }
    }
  }
}`,
    buttonText: 'Add to Cursor',
    buttonStyle: 'primary' as const,
  },
  {
    name: 'VS Code',
    badge: 'Free',
    badgeColor: 'bg-[#F7F7FB] text-[#6B6B6B]',
    iconBg: '#007ACC',
    description: 'Install the extension or add to settings.json.',
    config: `// Add to .vscode/mcp.json
{
  "servers": {
    "testforge": {
      "type": "stdio",
      "command": "npx",
      "args": ["@whitenoisenpm/testforge-mcp", "start"]
    }
  }
}`,
    buttonText: 'Add to VS Code',
    buttonStyle: 'primary' as const,
  },
  {
    name: 'Windsurf',
    badge: '',
    badgeColor: '',
    iconBg: '#1E1E2E',
    description: 'Add to your Windsurf MCP configuration.',
    config: `// ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["@whitenoisenpm/testforge-mcp", "start"]
    }
  }
}`,
    buttonText: 'Add to Windsurf',
    buttonStyle: 'ghost' as const,
  },
  {
    name: 'Trae',
    badge: '',
    badgeColor: '',
    iconBg: '#1E1B2E',
    description: "Configure via Trae's MCP settings panel.",
    config: `// ~/.trae/mcp.json
{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["@whitenoisenpm/testforge-mcp", "start"],
      "env": {
        "TESTFORGE_API_KEY": "tf_..."
      }
    }
  }
}`,
    buttonText: 'Add to Trae',
    buttonStyle: 'ghost' as const,
  },
  {
    name: 'Claude Code',
    badge: '',
    badgeColor: '',
    iconBg: '#CC785C',
    description: 'Set environment variable before starting Claude Code.',
    config: `# Set your API key
export TESTFORGE_API_KEY="tf_your_api_key"

# Start Claude Code with MCP
claude mcp add testforge \\
  npx @whitenoisenpm/testforge-mcp start`,
    buttonText: 'Add to Claude Code',
    buttonStyle: 'ghost' as const,
    language: 'bash',
  },
  {
    name: 'Other MCP Client',
    badge: '',
    badgeColor: '',
    iconBg: '#ECEBF5',
    icon: Puzzle,
    description: 'Standard MCP server configuration for any compatible client.',
    config: `{
  "name": "testforge",
  "transport": "stdio",
  "command": "npx",
  "args": ["@whitenoisenpm/testforge-mcp", "start"],
  "description": "AI-powered test generation"
}`,
    buttonText: 'Copy Config',
    buttonStyle: 'ghost' as const,
  },
];

function IdeCard({
  ide,
  index,
}: {
  ide: (typeof ideConfigs)[0];
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ide.config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = ide.config;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const IconComp = ide.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: easeOutExpo }}
      whileHover={{ y: -4 }}
      className="bg-white border border-[#D9D9D3] rounded-[14px] p-6 overflow-hidden
        hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-[#a39fd4]
        transition-shadow duration-300 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: ide.iconBg }}
        >
          {IconComp ? (
            <IconComp size={24} className="text-[#6B6B6B]" />
          ) : (
            <span className="font-heading font-semibold text-[18px] text-white">
              {ide.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-body font-semibold text-[18px] text-[#12101A]">
              {ide.name}
            </h3>
            {ide.badge && (
              <span
                className={`font-mono font-medium text-[11px] uppercase px-2.5 py-0.5 rounded ${ide.badgeColor}`}
              >
                {ide.badge}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="font-body text-[14px] text-[#6B6B6B] mt-3">
        {ide.description}
      </p>

      {/* Config snippet */}
      <div className="mt-4 flex-1">
        <SyntaxCode code={ide.config} language={ide.language || 'json'} />
      </div>

      {/* Button */}
      <button
        onClick={handleCopy}
        className={`mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 
          rounded-lg font-body font-medium text-[14px] transition-all duration-200 active:scale-[0.98]
          ${
            ide.buttonStyle === 'primary'
              ? 'bg-[#574a7d] text-white hover:bg-[#4a3d6b]'
              : 'bg-transparent border border-[#D9D9D3] text-[#333333] hover:bg-[#E8E5FF] hover:border-[#a39fd4]'
          }`}
      >
        {copied ? (
          <>
            <CheckCircle size={16} className="text-[#574a7d]" />
            Copied! Open {ide.name} →
          </>
        ) : (
          <>
            {ide.buttonText}
            <ArrowUpRight size={16} />
          </>
        )}
      </button>
    </motion.div>
  );
}

function IdeCardsSection() {
  return (
    <section className="bg-[#F7F7FB] py-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-16">
        <SectionReveal className="text-center">
          <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d]">
            {'// SUPPORTED IDES'}
          </p>
          <h2 className="font-heading font-medium text-[28px] text-[#12101A] mt-3 tracking-[-0.01em]">
            Configure Your Editor
          </h2>
          <p className="font-body text-[16px] text-[#6B6B6B] mt-3">
            Choose your IDE and get testing in under 60 seconds.
          </p>
        </SectionReveal>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideConfigs.map((ide, i) => (
            <IdeCard key={ide.name} ide={ide} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}


/* ────────────────────────────────────────────
   HOW IT WORKS — 5 STEP FLOW
   ──────────────────────────────────────────── */
const steps = [
  {
    icon: Download,
    number: '01',
    title: 'Install',
    description: 'Run npx @whitenoisenpm/testforge-mcp install — takes 10 seconds.',
  },
  {
    icon: Settings,
    number: '02',
    title: 'Configure',
    description: 'Add the config snippet to your editor settings.',
  },
  {
    icon: MessageSquare,
    number: '03',
    title: 'Chat',
    description: 'Open your IDE\'s AI chat and type: Test this project.',
  },
  {
    icon: FlaskConical,
    number: '04',
    title: 'Generate',
    description: 'TestForge analyzes your code and generates the full test suite.',
  },
  {
    icon: BarChart3,
    number: '05',
    title: 'Results',
    description: 'View pass/fail results, vulnerabilities, and PRDs — without leaving your editor.',
  },
];

function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative bg-[#12101A] py-20 overflow-hidden">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `linear-gradient(to right, #574a7d 1px, transparent 1px),
                            linear-gradient(to bottom, #574a7d 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-16">
        <SectionReveal className="text-center">
          <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d]">
            {'// HOW IT WORKS'}
          </p>
          <h2 className="font-heading font-medium text-[28px] text-white mt-3 tracking-[-0.01em]">
            Five Steps to Testing Bliss
          </h2>
          <p className="font-body text-[16px] text-[#9A9A9A] mt-3">
            From install to results — the full flow.
          </p>
        </SectionReveal>

        {/* Steps flow */}
        <div className="mt-16">
          {/* Desktop: horizontal flow */}
          <div className="hidden md:block relative">
            {/* Connecting line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 1, ease: easeOutExpo, delay: 0.3 }}
              className="absolute top-[28px] left-[10%] right-[10%] h-[2px] origin-left"
              style={{
                background:
                  'linear-gradient(to right, #574a7d, #a39fd4)',
              }}
            />

            <div className="flex justify-between relative">
              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: 0.4 + i * 0.15,
                    ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
                  }}
                  className="flex flex-col items-center text-center max-w-[180px]"
                >
                  {/* Circle with icon */}
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-[#1E1B2E] border-2 border-[#574a7d] flex items-center justify-center
                      hover:scale-110 transition-transform duration-200
                      hover:shadow-[0_0_0_4px_rgba(90,143,94,0.2)]">
                      <step.icon size={24} className="text-[#574a7d]" />
                    </div>
                    {/* Number badge */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#574a7d] flex items-center justify-center">
                      <span className="font-mono font-semibold text-[10px] text-white">
                        {step.number.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <motion.h3
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}
                    className="font-body font-semibold text-[15px] text-white mt-4"
                  >
                    {step.title}
                  </motion.h3>

                  {/* Description */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ duration: 0.4, delay: 0.55 + i * 0.15 }}
                    className="font-body text-[13px] text-[#9A9A9A] mt-2 leading-[1.5]"
                  >
                    {step.description}
                  </motion.p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical flow */}
          <div className="md:hidden relative space-y-8">
            {/* Vertical connecting line */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 1, ease: easeOutExpo, delay: 0.3 }}
              className="absolute top-0 bottom-0 left-[27px] w-[2px] origin-top"
              style={{
                background:
                  'linear-gradient(to bottom, #574a7d, #a39fd4)',
              }}
            />

            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.15 }}
                className="flex items-start gap-4 relative"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-[#1E1B2E] border-2 border-[#574a7d] flex items-center justify-center">
                    <step.icon size={24} className="text-[#574a7d]" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#574a7d] flex items-center justify-center">
                    <span className="font-mono font-semibold text-[10px] text-white">
                      {step.number.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <h3 className="font-body font-semibold text-[15px] text-white">
                    {step.title}
                  </h3>
                  <p className="font-body text-[13px] text-[#9A9A9A] mt-1 leading-[1.5]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


/* ────────────────────────────────────────────
   TERMINAL DEMO SECTION
   ──────────────────────────────────────────── */
const terminalLines = [
  { text: '$ npx @whitenoisenpm/testforge-mcp install', color: '#E8E8E3' },
  { text: '✓ MCP server installed (2.3s)', color: '#7a6fad' },
  { text: '✓ Detected project: express-ecommerce-api', color: '#7a6fad' },
  { text: '✓ Found 47 endpoints, 12 middleware functions', color: '#7a6fad' },
  { text: '✓ Generated test plan with 20 test dimensions', color: '#7a6fad' },
  { text: '✓ Connected to TestForge cloud', color: '#7a6fad' },
  { text: '', color: '#E8E8E3' },
  { text: '$ cursor .', color: '#E8E8E3' },
  { text: '# In Cursor chat, type:', color: '#5A5A5A' },
  { text: '> Test this project for security vulnerabilities', color: '#4A90D9' },
  { text: '', color: '#E8E8E3' },
  { text: '✓ Running security scan... (12s)', color: '#7a6fad' },
  { text: '⚠ Found 3 vulnerabilities:', color: '#E8A838' },
  { text: '  • CRITICAL: SQL Injection in /api/orders', color: '#D4524A' },
  { text: '  • HIGH: Auth bypass in /admin/*', color: '#E87D3A' },
  { text: '  • HIGH: XSS in /search', color: '#E87D3A' },
  { text: '', color: '#E8E8E3' },
  { text: '✓ Generated fixes pushed to branch fix/security-001', color: '#7a6fad' },
];

function TerminalDemoSection() {
  const [visibleLines, setVisibleLines] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [replayKey, setReplayKey] = useState(0);

  const replay = useCallback(() => {
    setVisibleLines(0);
    setReplayKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= terminalLines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [inView, replayKey]);

  return (
    <section className="bg-[#F7F7FB] py-20">
      <div className="max-w-[900px] mx-auto px-6 lg:px-16">
        <SectionReveal className="text-center">
          <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d]">
            {'// LIVE DEMO'}
          </p>
          <h2 className="font-heading font-medium text-[28px] text-[#12101A] mt-3 tracking-[-0.01em]">
            See It in Action
          </h2>
          <p className="font-body text-[16px] text-[#6B6B6B] mt-3">
            Watch how TestForge MCP works inside your IDE.
          </p>
        </SectionReveal>

        {/* Terminal */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="mt-10"
        >
          <div className="bg-[#12101A] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
            {/* Chrome bar */}
            <div className="bg-[#1E1B2E] px-5 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#D4524A]" />
                <div className="w-3 h-3 rounded-full bg-[#E8A838]" />
                <div className="w-3 h-3 rounded-full bg-[#574a7d]" />
              </div>
              <span className="font-mono font-medium text-[12px] text-[#9A9A9A] mx-auto">
                testforge-mcp
              </span>
            </div>

            {/* Terminal body */}
            <div className="p-6 min-h-[480px] font-mono text-[13px] leading-[1.9]">
              {terminalLines.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={`${replayKey}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1 }}
                  style={{ color: line.color }}
                >
                  {line.text || '\u00A0'}
                </motion.div>
              ))}
              {visibleLines >= terminalLines.length && (
                <span className="inline-block w-[8px] h-[16px] bg-[#574a7d] ml-0.5 animate-pulse" />
              )}
            </div>
          </div>

          {/* Replay button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={replay}
              className="font-mono font-medium text-[12px] text-[#574a7d] hover:underline transition-all"
            >
              Replay
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   CAPABILITIES GRID
   ──────────────────────────────────────────── */
const capabilities = [
  {
    icon: Sparkles,
    title: 'Autonomous Test Generation',
    description: "Say 'test this' and watch comprehensive tests appear in your IDE.",
  },
  {
    icon: Shield,
    title: 'Instant Security Scans',
    description: 'Find vulnerabilities as you code — OWASP Top 10 coverage built-in.',
  },
  {
    icon: Wrench,
    title: 'Smart Fix Suggestions',
    description: 'Get patches applied directly in your IDE, not just suggestions.',
  },
  {
    icon: FileText,
    title: 'PRD Generation',
    description: 'Convert test failures to detailed requirements documents.',
  },
  {
    icon: Layers,
    title: 'Stack Analysis',
    description: 'Detect dependency conflicts and compatibility issues before they break.',
  },
  {
    icon: Activity,
    title: 'Live Progress',
    description: 'Watch all 20 test dimensions execute in real-time with live logs.',
  },
];

function CapabilitiesSection() {
  return (
    <section className="bg-[#F7F7FB] py-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-16">
        <SectionReveal className="text-center mb-12">
          <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d]">
            {'// CAPABILITIES'}
          </p>
          <h2 className="font-heading font-medium text-[28px] text-[#12101A] mt-3 tracking-[-0.01em]">
            What You Can Do
          </h2>
          <p className="font-body text-[16px] text-[#6B6B6B] mt-3">
            Full testing power, now inside your editor.
          </p>
        </SectionReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: easeOutExpo }}
              whileHover={{ y: -4 }}
              className="bg-white border border-[#D9D9D3] rounded-xl p-8
                hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-[#a39fd4]
                transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8E5FF] flex items-center justify-center">
                <cap.icon size={24} className="text-[#574a7d]" />
              </div>
              <h3 className="font-body font-semibold text-[18px] text-[#12101A] mt-5">
                {cap.title}
              </h3>
              <p className="font-body text-[15px] text-[#6B6B6B] mt-2 leading-[1.6]">
                {cap.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ────────────────────────────────────────────
   COMPARISON SECTION
   ──────────────────────────────────────────── */
const comparisonRows = [
  { metric: 'Setup Time', manual: '2 hours', mcp: '60 seconds' },
  { metric: 'Test Coverage', manual: '47%', mcp: '94%' },
  { metric: 'Bug Escape Rate', manual: '23%', mcp: '3%' },
  { metric: 'Context Switches / Day', manual: '12', mcp: '1' },
];

function ComparisonSection() {
  return (
    <section className="bg-[#12101A] py-20">
      <div className="max-w-[800px] mx-auto px-6 lg:px-16">
        <SectionReveal className="text-center mb-12">
          <p className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d]">
            {'// COMPARISON'}
          </p>
          <h2 className="font-heading font-medium text-[28px] text-white mt-3 tracking-[-0.01em]">
            Manual Testing vs MCP Integration
          </h2>
        </SectionReveal>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-2xl overflow-hidden"
        >
          {/* Table header */}
          <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-[#333333]/50">
            <span className="font-mono font-medium text-[12px] uppercase text-[#9A9A9A] tracking-[0.08em]">
              Metric
            </span>
            <span className="font-mono font-medium text-[12px] uppercase text-[#9A9A9A] tracking-[0.08em] text-center">
              Manual
            </span>
            <span className="font-mono font-medium text-[12px] uppercase text-[#574a7d] tracking-[0.08em] text-center">
              MCP
            </span>
          </div>

          {/* Rows */}
          {comparisonRows.map((row, i) => (
            <motion.div
              key={row.metric}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="grid grid-cols-3 gap-4 px-6 py-4 border-t border-[#3A3A3A] hover:bg-[#333333]/30 transition-colors"
            >
              <span className="font-body font-medium text-[15px] text-white">
                {row.metric}
              </span>
              <span className="font-mono text-[15px] text-[#9A9A9A] text-center">
                {row.manual}
              </span>
              <span className="font-mono text-[15px] text-[#574a7d] text-center font-medium">
                {row.mcp}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   CTA SECTION
   ──────────────────────────────────────────── */
function CTASection() {
  const [typedText, setTypedText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const fullCommand = 'npx @whitenoisenpm/testforge-mcp install';

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(fullCommand.slice(0, i));
      if (i >= fullCommand.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [inView]);

  return (
    <section ref={ref} className="bg-[#574a7d] py-20">
      <div className="max-w-[700px] mx-auto px-6 lg:px-16 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className="font-heading font-semibold text-[36px] text-white tracking-[-0.015em]"
        >
          Ready to Test From Your IDE?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="font-body text-[18px] text-white/80 mt-4 max-w-[560px] mx-auto"
        >
          Install the MCP server and start testing without ever leaving your
          editor.
        </motion.p>

        {/* Command box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-[500px] mx-auto mt-8"
        >
          <div className="bg-[#12101A] border border-[#3A3A3A] rounded-2xl p-5 text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D4524A]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#E8A838]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#574a7d]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[14px] text-[#574a7d]">$</span>
              <span className="font-mono font-medium text-[16px] text-white">
                {typedText}
              </span>
            </div>
            <div className="mt-4 flex justify-end">
              <CopyButton text="npx @whitenoisenpm/testforge-mcp install" size="sm" />
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-6 flex items-center justify-center gap-4 flex-wrap"
        >
          <a
            href="#/docs"
            className="inline-flex items-center px-7 py-3.5 rounded-lg border border-white/30
              text-white font-body font-medium text-[15px]
              hover:bg-white/5 transition-all duration-200"
          >
            View Documentation
          </a>
          <a
            href="#/account"
            className="font-body font-medium text-[15px] text-white/90 hover:underline transition-all"
          >
            Get API Key →
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   MAIN PAGE COMPONENT
   ──────────────────────────────────────────── */
export default function McpIntegration() {
  return (
    <main>
      <HeroSection />
      <IdeCardsSection />
      <HowItWorksSection />
      <TerminalDemoSection />
      <CapabilitiesSection />
      <ComparisonSection />
      <CTASection />
    </main>
  );
}
