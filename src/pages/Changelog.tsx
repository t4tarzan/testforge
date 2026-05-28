import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Package } from 'lucide-react';
import {
  changelog,
  TAG_LABELS,
  TAG_COLORS,
  RELEASE_COUNT,
  LATEST_VERSION,
  type ChangelogEntry,
} from '@/data/changelog';

function formatDate(iso: string): string {
  // iso is yyyy-mm-dd (or a range date) — render as "May 28, 2026".
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Row({ entry, open, onToggle }: { entry: ChangelogEntry; open: boolean; onToggle: () => void }) {
  const color = TAG_COLORS[entry.tag];
  return (
    <div className="border-b border-[#EDECE4] last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-4 py-4 px-4 text-left hover:bg-[#F7F7FB] transition-colors"
      >
        <span
          className="font-mono text-[13px] font-semibold tabular-nums w-[92px] shrink-0"
          style={{ color }}
        >
          v{entry.version}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-block"
          style={{ color, backgroundColor: `${color}14` }}
        >
          {TAG_LABELS[entry.tag]}
        </span>
        <span className="flex-1 font-body text-[14px] text-[#12101A] truncate">{entry.title}</span>
        <span className="font-mono text-[12px] text-[#9A9A9A] shrink-0 hidden md:inline">
          {formatDate(entry.date)}
        </span>
        <ChevronDown
          size={16}
          className={`text-[#9A9A9A] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <div
            className="mx-4 mb-4 ml-4 sm:ml-[112px] p-4 rounded-lg bg-[#F7F7FB] border-l-2"
            style={{ borderColor: color }}
          >
            <p className="text-[14px] text-[#4A4A4A] leading-relaxed font-body">{entry.summary}</p>
            <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-[#9A9A9A]">
              <span className="sm:hidden">{formatDate(entry.date)}</span>
              <code className="text-[#574a7d]">
                npx @whitenoisenpm/testforge-mcp@{entry.version.includes('–') ? '0.2.19' : entry.version}
              </code>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Changelog() {
  useEffect(() => {
    document.title = 'Changelog — every TestForge release, in the open';
  }, []);

  // Expand the three most recent entries by default.
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(changelog.slice(0, 3).map((e) => e.version))
  );
  const toggle = (v: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });

  // Group by date for the date rail.
  const byDate: { date: string; entries: ChangelogEntry[] }[] = [];
  for (const e of changelog) {
    const last = byDate[byDate.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else byDate.push({ date: e.date, entries: [e] });
  }

  return (
    <div className="bg-[#F7F7FB] min-h-screen">
      {/* Hero */}
      <section className="bg-[#12101A] pt-32 pb-16 px-6 lg:px-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(to right, #574a7d 1px, transparent 1px),
                              linear-gradient(to bottom, #574a7d 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 max-w-[900px] mx-auto text-center">
          <p className="font-mono text-xs text-[#a99bff] uppercase tracking-[0.15em] mb-6">
            // CHANGELOG · PUBLISHED ON NPM
          </p>
          <h1 className="text-display-xl text-white mb-6 leading-[1.1]">
            Every release, <span className="text-[#a99bff]">in the open</span>.
          </h1>
          <p className="text-[#a99bff]/70 text-lg max-w-[680px] mx-auto">
            {RELEASE_COUNT} versions of{' '}
            <code className="font-mono text-[16px] text-[#a99bff]">@whitenoisenpm/testforge-mcp</code>{' '}
            shipped since May 24, 2026. Dates are npm publish timestamps — not marketing.
            The precision releases are the flywheel: a public report surfaces a false
            positive, and the fix ships the same day.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-lg px-4 py-2">
            <Package size={16} className="text-[#a99bff]" />
            <span className="font-mono text-[13px] text-white">latest: v{LATEST_VERSION}</span>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="max-w-[860px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-white border border-[#D9D9D3] rounded-2xl overflow-hidden">
          {byDate.map((group) => (
            <div key={group.date}>
              <div className="sticky top-0 z-10 bg-[#F0EFE8]/95 backdrop-blur px-4 py-2 border-b border-[#EDECE4]">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#6B6B6B]">
                  {formatDate(group.date)}
                </span>
              </div>
              {group.entries.map((e) => (
                <Row key={e.version} entry={e} open={openSet.has(e.version)} onToggle={() => toggle(e.version)} />
              ))}
            </div>
          ))}
        </div>
        <p className="text-center text-[13px] text-[#9A9A9A] mt-8 font-body">
          Full commit history on{' '}
          <a
            href="https://github.com/t4tarzan/testforge/commits/main"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#574a7d] hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </div>
  );
}
