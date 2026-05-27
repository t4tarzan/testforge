import { useState } from 'react'
import { Copy, Check, Terminal } from 'lucide-react'

type TabKey = 'macos' | 'linux' | 'windows' | 'claude' | 'cursor' | 'windsurf'

interface Tab {
  key: TabKey
  label: string
  command: string
  note?: string
}

// One source of truth for the install snippets. macOS / Linux / Windows are
// identical because the binary is platform-agnostic — Node 22+ is the only
// prerequisite. The IDE tabs ship the config snippet the user actually needs.
const TABS: Tab[] = [
  {
    key: 'macos',
    label: 'macOS',
    command: 'npx -y @whitenoisenpm/testforge-mcp@latest',
    note: 'Then open http://localhost:33221 — 21-dimension analysis, runs locally.',
  },
  {
    key: 'linux',
    label: 'Linux',
    command: 'npx -y @whitenoisenpm/testforge-mcp@latest',
    note: 'Then open http://localhost:33221 — Node 22+ required.',
  },
  {
    key: 'windows',
    label: 'Windows',
    command: 'npx -y @whitenoisenpm/testforge-mcp@latest',
    note: 'Then open http://localhost:33221 — works in PowerShell or WSL.',
  },
  {
    key: 'claude',
    label: 'Claude Code',
    command: 'claude mcp add testforge -- npx -y @whitenoisenpm/testforge-mcp',
    note: 'Registers TestForge as a Claude Code MCP server.',
  },
  {
    key: 'cursor',
    label: 'Cursor',
    command: `{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["-y", "@whitenoisenpm/testforge-mcp"]
    }
  }
}`,
    note: 'Add to ~/.cursor/mcp.json.',
  },
  {
    key: 'windsurf',
    label: 'Windsurf',
    command: `{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["-y", "@whitenoisenpm/testforge-mcp"]
    }
  }
}`,
    note: 'Add to ~/.codeium/windsurf/mcp_config.json.',
  },
]

export default function InstallCard() {
  const [active, setActive] = useState<TabKey>('macos')
  const [copied, setCopied] = useState(false)

  const current = TABS.find((t) => t.key === active) ?? TABS[0]
  const isMultiline = current.command.includes('\n')

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(current.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Fallback: select the code block so the user can copy manually.
    }
  }

  return (
    <section className="bg-cream-dark py-8 lg:py-10">
      <div className="container-tf">
        <div className="max-w-[920px] mx-auto rounded-xl border border-[#D9D9D3] bg-white shadow-sm overflow-hidden">
          {/* Header strip */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#ECEBF5]">
            <p className="font-mono text-[12px] tracking-[0.18em] uppercase text-[#574a7d] font-semibold">
              // Install — one command
            </p>
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[11px] text-[#6B6B6B]">
              <Terminal size={12} />
              works for Self-host (Tier 1 free) — Tier 2 needs OpenRouter key or Forge plan
            </span>
          </div>

          {/* Tab row */}
          <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-[#F3F1FB]">
            {TABS.map((t) => {
              const isActive = t.key === active
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setActive(t.key)
                    setCopied(false)
                  }}
                  className={`px-3 py-1.5 rounded-t-md text-[13px] font-body font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#12101A] text-white'
                      : 'text-[#6B6B6B] hover:text-[#333333] hover:bg-[#F7F7FB]'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Command block + copy */}
          <div className="p-4 lg:p-5">
            <div className="relative">
              <pre
                className={`font-mono text-[13px] lg:text-[14px] leading-[1.55] text-[#E4DFF1] bg-[#15102E] rounded-lg overflow-x-auto ${
                  isMultiline ? 'px-4 py-3.5' : 'px-4 py-3.5'
                }`}
                aria-label="Install command"
              >
                {!isMultiline && (
                  <span className="text-[#a99bff] select-none mr-2">$</span>
                )}
                <code className="whitespace-pre">{current.command}</code>
              </pre>
              <button
                type="button"
                onClick={onCopy}
                aria-label="Copy command"
                className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#574a7d]/90 hover:bg-[#574a7d] text-white text-[11px] font-mono transition-colors duration-150 shadow-sm"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {current.note && (
              <p className="mt-3 text-[12.5px] text-[#6B6B6B] font-body leading-relaxed">
                → {current.note}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
