/**
 * Whitepaper-style full TestForge report for one In-the-Wild repo.
 *
 * Rendered without site chrome (no Layout wrapper). Inline `<style>`
 * block mirrors the testforge-whitepaper.html palette + fonts so each
 * report reads like a real audit document — credibility builder per
 * the strategic audit.
 *
 * Sections (in order):
 *   1. Masthead — TestForge brand + repo handle + analyzed date
 *   2. Cover — eyebrow ("CODEBASE AUDIT · NN/100"), big title (repo
 *      name), tagline, top-line stats grid
 *   3. TOC — left sticky sidebar with anchors to every section
 *   4. Body sections — Executive Summary / Codebase / Language Coverage /
 *      Dimension Scores / Test Coverage / Security / Methodology
 *   5. Footer — CTA back to the index + install command
 */
import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getShowcaseReport } from '@/data/showcaseReports';

const SEV_COLOR: Record<string, string> = {
  critical: '#c53030',
  high: '#dd6b20',
  medium: '#d69e2e',
  low: '#574a7d',
  info: '#9A9A9A',
};

function scoreColor(score: number | null) {
  if (score === null) return '#9A9A9A';
  if (score >= 80) return '#2f855a';
  if (score >= 50) return '#d69e2e';
  return '#c53030';
}

export default function InTheWildReportFull() {
  const { slug } = useParams<{ slug: string }>();
  const report = slug ? getShowcaseReport(slug) : undefined;

  useEffect(() => {
    if (report) {
      document.title = `${report.repoName} · TestForge audit report`;
    }
  }, [report]);

  if (!report) return <Navigate to="/in-the-wild" replace />;

  const lc = report.codebase.languageCoverage;
  const showCoverageBanner = lc && lc.coveragePercent < 100 && lc.unsupportedFiles > 0;
  const analyzedDate = new Date(report.analyzedAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const repoHandle = report.repoUrl.replace('https://github.com/', '');

  const sections = [
    { id: 'executive-summary', label: 'Executive summary' },
    { id: 'codebase', label: 'Codebase' },
    ...(showCoverageBanner ? [{ id: 'language-coverage', label: 'Language coverage' }] : []),
    { id: 'dimension-scores', label: 'Dimension scores' },
    { id: 'test-coverage', label: 'Test coverage' },
    { id: 'security', label: 'Security findings' },
    { id: 'methodology', label: 'Methodology' },
  ];

  return (
    <div className="itw-full">
      <style>{INLINE_CSS}</style>

      <div className="page">
        {/* Masthead */}
        <header className="masthead">
          <div className="mast-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="8" cy="8" r="3" stroke="#574a7d" strokeWidth="2" />
              <circle cx="24" cy="8" r="3" stroke="#574a7d" strokeWidth="2" />
              <circle cx="8" cy="24" r="3" stroke="#574a7d" strokeWidth="2" />
              <circle cx="24" cy="24" r="3" stroke="#574a7d" strokeWidth="2" />
              <line x1="11" y1="8" x2="21" y2="8" stroke="#574a7d" strokeWidth="1.5" />
              <line x1="8" y1="11" x2="8" y2="21" stroke="#574a7d" strokeWidth="1.5" />
              <line x1="11" y1="24" x2="21" y2="24" stroke="#574a7d" strokeWidth="1.5" />
            </svg>
            <span className="mast-name">Test<em>Forge</em></span>
          </div>
          <div>In the Wild <span className="dot">·</span> Public report</div>
          <div>{analyzedDate}</div>
        </header>

        {/* Cover */}
        <section className="cover">
          <div className="eyebrow">
            Codebase audit <span className="dot">·</span> overall {report.overall}/100
          </div>
          <h1 className="title">
            {report.repoName}<em>.</em>
          </h1>
          <p className="sub">{report.tagline}</p>
          <p className="meta">
            <a href={report.repoUrl} target="_blank" rel="noopener noreferrer">{repoHandle}</a>
            <span className="sep">·</span>
            <span>{report.codebase.totalFiles.toLocaleString()} files</span>
            <span className="sep">·</span>
            <span>{report.codebase.totalLines.toLocaleString()} lines</span>
            <span className="sep">·</span>
            <span>{report.codebase.endpoints.toLocaleString()} endpoints</span>
            <span className="sep">·</span>
            <span>{report.codebase.dependencies.toLocaleString()} deps</span>
          </p>
        </section>

        <hr className="rule" />

        <div className="layout">
          {/* TOC */}
          <aside className="toc">
            <div className="toc-label">Contents</div>
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <span className="num">0{i + 1}</span>
                  <a href={`#${s.id}`}>{s.label}</a>
                </li>
              ))}
            </ol>
          </aside>

          <main className="body">
            <section id="executive-summary">
              <h2>Executive summary</h2>
              <p className="lede">
                TestForge analyzed <strong>{report.repoName}</strong> across {report.scores.length}{' '}
                dimensions on {analyzedDate}. The scan completed in{' '}
                <strong>{report.analyzeMs.toLocaleString()} ms</strong> against{' '}
                {report.codebase.totalFiles.toLocaleString()} source files
                ({report.codebase.totalLines.toLocaleString()} lines). Composite score:{' '}
                <strong style={{ color: scoreColor(report.overall) }}>{report.overall}/100</strong>.
              </p>
              <div className="stats-grid">
                {[
                  { label: 'Endpoints', value: report.codebase.endpoints.toLocaleString() },
                  { label: 'Dependencies', value: report.codebase.dependencies.toLocaleString() },
                  { label: 'Test files', value: report.unit.testFiles.toLocaleString() },
                  { label: 'Test cases', value: report.unit.totalTests.toLocaleString() },
                  { label: 'Coverage est.', value: `${report.unit.coverage}%` },
                  { label: 'Security findings', value: report.security.findings.toLocaleString() },
                ].map((s) => (
                  <div key={s.label} className="stat">
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section id="codebase">
              <h2>Codebase</h2>
              <p>
                Detected tech stack ({report.codebase.techStack.length} entries) covers the project&rsquo;s
                runtime + dev surface across the languages TestForge parses natively (JavaScript,
                TypeScript, Python, Go). Each tag is matched against either a declared dependency or a
                framework signature in source.
              </p>
              <div className="chips">
                {report.codebase.techStack.length === 0 ? (
                  <em className="muted">No recognized tech-stack tags. The repo likely uses libraries TestForge doesn&rsquo;t catalog yet.</em>
                ) : (
                  report.codebase.techStack.map((t) => <span key={t} className="chip">{t}</span>)
                )}
              </div>
            </section>

            {showCoverageBanner && lc && (
              <section id="language-coverage">
                <h2>Language coverage</h2>
                <div className="callout amber">
                  <strong>{lc.coveragePercent}% of source files analyzed natively.</strong>{' '}
                  TestForge parses JavaScript, TypeScript, Python, and Go end-to-end (file count,
                  endpoints, deps, tests, security). The remaining{' '}
                  <strong>{lc.unsupportedFiles.toLocaleString()} file
                    {lc.unsupportedFiles === 1 ? '' : 's'}</strong>{' '}
                  in other languages were counted in the file census but not parsed for
                  language-specific signals.
                </div>
                <table className="data">
                  <thead><tr><th>Language</th><th className="num">Files</th></tr></thead>
                  <tbody>
                    {lc.unsupportedLanguages.map((u) => (
                      <tr key={u.language}>
                        <td>{u.language}</td>
                        <td className="num">{u.files.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="footnote">
                  These languages roll into the language-coverage percentage but their endpoints,
                  dependencies, and security patterns are not captured in this report. Future
                  TestForge releases extend native support &mdash; Go was added in v0.28.0.
                </p>
              </section>
            )}

            <section id="dimension-scores">
              <h2>Dimension scores</h2>
              <p>
                Each dimension is a deterministic Tier-1 analyzer (same input &rarr; same output).
                <strong> N/A</strong> means the dimension doesn&rsquo;t apply to the project type
                (e.g. accessibility on a backend-only Python library).
              </p>
              <table className="data dim-table">
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th className="num">Score</th>
                    <th>Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {report.scores.map((s) => {
                    const na = s.score === null;
                    const c = scoreColor(s.score);
                    return (
                      <tr key={s.key}>
                        <td>{s.label}</td>
                        <td className="num" style={{ color: c, fontWeight: 700 }}>
                          {na ? 'N/A' : s.score}
                        </td>
                        <td>
                          <div className="bar">
                            {!na && <div className="bar-fill" style={{ width: `${s.score}%`, background: c }} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section id="test-coverage">
              <h2>Test coverage</h2>
              <p>
                Heuristic estimate from function-name matching between detected test files and
                source files. Library-style repos (where most functions are exercised indirectly via
                integration tests) under-report on this metric; treat it as a floor, not a ceiling.
              </p>
              <table className="data">
                <tbody>
                  <tr><th scope="row">Estimated function coverage</th><td className="num">{report.unit.coverage}%</td></tr>
                  <tr><th scope="row">Test files</th><td className="num">{report.unit.testFiles.toLocaleString()}</td></tr>
                  <tr><th scope="row">Test cases</th><td className="num">{report.unit.totalTests.toLocaleString()}</td></tr>
                  <tr><th scope="row">Frameworks detected</th><td>{report.unit.frameworks.length === 0 ? <em className="muted">none</em> : report.unit.frameworks.join(', ')}</td></tr>
                </tbody>
              </table>
            </section>

            <section id="security">
              <h2>Security findings</h2>
              <p className="lede">
                <strong>{report.security.findings}</strong> finding{report.security.findings === 1 ? '' : 's'}{' '}
                across the security analyzer&rsquo;s checks: SAST (Babel AST), taint flow, hardcoded
                secrets, vulnerable dependencies, missing rate-limit / headers (when applicable),
                and OWASP-mapped patterns. Findings in test paths
                (<code>tests/</code>, <code>e2e/</code>, <code>__tests__/</code>, <code>*.spec.*</code>,
                pytest <code>test_*.py</code>) are suppressed since the patterns we flag are usually
                intentional in tests.
              </p>
              <table className="data sev-table">
                <thead>
                  <tr><th>Severity</th><th className="num">Count</th></tr>
                </thead>
                <tbody>
                  {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                    <tr key={sev}>
                      <td>
                        <span className="sev-dot" style={{ background: SEV_COLOR[sev] }} />
                        <span className="sev-name">{sev}</span>
                      </td>
                      <td className="num" style={{ color: SEV_COLOR[sev], fontWeight: 700 }}>
                        {report.security[sev]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {report.security.topItems.length > 0 && (
                <>
                  <h3>Top findings</h3>
                  <ol className="findings">
                    {report.security.topItems.map((item, i) => (
                      <li key={i}>
                        <div className="finding-head">
                          <span
                            className="sev-badge"
                            style={{ background: SEV_COLOR[item.severity] || '#9A9A9A' }}
                          >
                            {item.severity}
                          </span>
                          <h4>{item.title}</h4>
                        </div>
                        {item.filePath && (
                          <p className="finding-path">
                            <code>{item.filePath}{item.lineNumber ? `:${item.lineNumber}` : ''}</code>
                          </p>
                        )}
                        <p>{item.description}</p>
                        {item.fixSuggestion && (
                          <p className="finding-fix"><strong>Suggested fix:</strong> {item.fixSuggestion}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>

            <section id="methodology">
              <h2>Methodology</h2>
              <p>
                This report was produced by{' '}
                <code>npx -y @whitenoisenpm/testforge-mcp@latest</code> running locally against a
                shallow clone (<code>git clone --depth 1</code>) of the public repository. The
                analyzer parses JavaScript/TypeScript (Babel AST) and Python/Go (regex-based scans)
                across 21+ deterministic Tier-1 dimensions. Same input always produces the same
                output &mdash; no LLM calls, no <code>Math.random()</code>, no telemetry.
              </p>
              <p>
                Reports are regenerated whenever the analyzer ships a meaningful improvement; the
                analyzed timestamp on the cover indicates exactly when this snapshot was taken.
                Historic versions of each report are intentionally not pruned &mdash; the
                before/after story across analyzer releases is part of TestForge&rsquo;s public QA
                feedback loop.
              </p>
              <p>
                <a href={report.repoUrl} target="_blank" rel="noopener noreferrer">
                  Source repository &rarr;
                </a>
              </p>
            </section>
          </main>
        </div>

        <hr className="rule" />

        {/* Footer */}
        <footer className="report-footer">
          <div>
            <Link to={`/in-the-wild/${report.slug}`} className="back">&larr; Back to summary</Link>
            <span className="sep">·</span>
            <Link to="/in-the-wild" className="back">All reports</Link>
          </div>
          <div className="install">
            <span className="install-label">Run this on your own repo</span>
            <code className="install-cmd">npx -y @whitenoisenpm/testforge-mcp@latest</code>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Self-contained CSS so the page reads like a stand-alone audit document
// regardless of the surrounding app's CSS. Mirrors the palette + fonts of
// /public/testforge-whitepaper.html so the two artifacts feel like the
// same publication series.
const INLINE_CSS = `
.itw-full {
  --ink: #12101A;
  --ink-soft: #555266;
  --accent: #574a7d;
  --paper: #fdfcf8;
  --rule: #d9d6cc;
  --muted: #87837a;

  background: var(--paper);
  color: var(--ink);
  font-family: 'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  font-size: 17px;
  line-height: 1.65;
}
.itw-full .page { max-width: 1080px; margin: 0 auto; padding: 0 2.5rem 4rem; }
@media (max-width: 800px) { .itw-full .page { padding: 0 1.25rem 3rem; } }

/* Masthead */
.itw-full .masthead {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  align-items: center;
  padding: 1.75rem 0 1rem;
  border-bottom: 1px solid var(--ink);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.itw-full .masthead > div:nth-child(2) { text-align: center; }
.itw-full .masthead > div:nth-child(3) { text-align: right; }
.itw-full .masthead .dot { color: var(--accent); margin: 0 0.4em; }
.itw-full .mast-brand { display: inline-flex; align-items: center; gap: 0.55rem; }
.itw-full .mast-name {
  font-family: 'Manrope', sans-serif;
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
  text-transform: none;
  color: var(--ink);
}
.itw-full .mast-name em { color: var(--accent); font-style: italic; font-weight: 600; }

/* Cover */
.itw-full .cover { padding: 4rem 0 3rem; }
.itw-full .cover .eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 1.5rem;
}
.itw-full .cover .eyebrow .dot { margin: 0 0.5em; color: var(--ink-soft); }
.itw-full .cover h1.title {
  font-weight: 800;
  font-size: clamp(2.6rem, 6vw, 4.8rem);
  line-height: 1;
  letter-spacing: -0.035em;
  color: var(--ink);
  margin: 0 0 1.25rem;
  word-break: break-word;
}
.itw-full .cover h1.title em { color: var(--accent); font-style: italic; font-weight: 600; }
.itw-full .cover .sub {
  font-weight: 500;
  font-size: clamp(1.05rem, 1.5vw, 1.3rem);
  line-height: 1.45;
  color: var(--ink-soft);
  max-width: 50ch;
  margin: 0 0 2rem;
  font-style: italic;
}
.itw-full .cover .meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  margin: 0;
}
.itw-full .cover .meta a { color: var(--accent); text-decoration: none; }
.itw-full .cover .meta a:hover { text-decoration: underline; }
.itw-full .cover .sep { margin: 0 0.6em; color: var(--rule); }

.itw-full .rule { border: 0; border-top: 1px solid var(--rule); margin: 2.5rem 0; }

/* Layout */
.itw-full .layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 3rem;
  margin-top: 2rem;
}
@media (max-width: 900px) { .itw-full .layout { grid-template-columns: 1fr; gap: 1.5rem; } }

/* TOC */
.itw-full .toc {
  position: sticky;
  top: 2rem;
  align-self: start;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.78rem;
  line-height: 1.7;
}
.itw-full .toc-label {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.itw-full .toc ol { list-style: none; padding: 0; margin: 0; }
.itw-full .toc li { display: flex; gap: 0.55rem; padding: 0.25rem 0; }
.itw-full .toc .num { color: var(--muted); }
.itw-full .toc a { color: var(--ink); text-decoration: none; border-bottom: 1px dotted transparent; }
.itw-full .toc a:hover { color: var(--accent); border-bottom-color: var(--accent); }

/* Body */
.itw-full .body { min-width: 0; }
.itw-full .body section { padding: 1.5rem 0 2.5rem; border-bottom: 1px dashed var(--rule); }
.itw-full .body section:last-child { border-bottom: 0; }
.itw-full .body h2 {
  font-weight: 700;
  font-size: clamp(1.5rem, 2.3vw, 2rem);
  letter-spacing: -0.02em;
  margin: 0 0 1rem;
  color: var(--ink);
}
.itw-full .body h3 {
  font-weight: 600;
  font-size: 1.15rem;
  letter-spacing: -0.01em;
  margin: 2rem 0 0.75rem;
  color: var(--ink);
}
.itw-full .body h4 {
  font-weight: 600;
  font-size: 1.02rem;
  margin: 0;
  color: var(--ink);
}
.itw-full .body p { margin: 0 0 1rem; color: var(--ink); }
.itw-full .body .lede { font-size: 1.05rem; color: var(--ink-soft); }
.itw-full .body .muted { color: var(--muted); }
.itw-full .body a { color: var(--accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
.itw-full .body code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.86em;
  background: rgba(87, 74, 125, 0.07);
  color: var(--accent);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

/* Stats grid */
.itw-full .stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1.5rem 0 0.5rem;
}
@media (max-width: 640px) { .itw-full .stats-grid { grid-template-columns: repeat(2, 1fr); } }
.itw-full .stat { border-left: 3px solid var(--accent); padding: 0.5rem 0 0.5rem 0.85rem; }
.itw-full .stat-value { font-weight: 700; font-size: 1.4rem; letter-spacing: -0.02em; }
.itw-full .stat-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--muted);
  margin-top: 0.25rem;
}

/* Chips */
.itw-full .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0 0; }
.itw-full .chip {
  background: rgba(87, 74, 125, 0.1);
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 500;
  padding: 0.25rem 0.65rem;
  border-radius: 3px;
}

/* Callouts */
.itw-full .callout { padding: 1rem 1.15rem; border-radius: 4px; border-left: 4px solid; margin: 1rem 0 1.25rem; font-size: 0.95rem; }
.itw-full .callout.amber { background: rgba(214, 158, 46, 0.07); border-left-color: #d69e2e; color: #735110; }

/* Tables */
.itw-full table.data {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.92rem;
}
.itw-full table.data th, .itw-full table.data td {
  text-align: left;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--rule);
}
.itw-full table.data th {
  font-weight: 600;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--muted);
  background: rgba(87, 74, 125, 0.04);
}
.itw-full table.data td.num, .itw-full table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }
.itw-full table.data th[scope="row"] {
  font-weight: 500;
  font-family: inherit;
  font-size: inherit;
  text-transform: none;
  letter-spacing: normal;
  color: inherit;
  background: none;
}
.itw-full .dim-table .bar {
  width: 100%;
  height: 6px;
  background: rgba(87, 74, 125, 0.08);
  border-radius: 3px;
  overflow: hidden;
}
.itw-full .dim-table .bar-fill { height: 100%; border-radius: 3px; }

/* Severity rows */
.itw-full .sev-table td:first-child { display: flex; align-items: center; gap: 0.6rem; }
.itw-full .sev-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.itw-full .sev-name { text-transform: capitalize; }

/* Findings */
.itw-full ol.findings { list-style: none; padding: 0; margin: 1rem 0 0; counter-reset: f; }
.itw-full ol.findings > li {
  padding: 1rem 0 1.25rem;
  border-bottom: 1px dashed var(--rule);
  counter-increment: f;
}
.itw-full ol.findings > li:last-child { border-bottom: 0; }
.itw-full ol.findings > li::before {
  content: counter(f, decimal-leading-zero);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: var(--muted);
  letter-spacing: 0.1em;
  margin-right: 0.5rem;
}
.itw-full .finding-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
.itw-full .sev-badge {
  color: white;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.45rem;
  border-radius: 2px;
}
.itw-full .finding-path { margin: 0 0 0.5rem; }
.itw-full .finding-path code { background: transparent; padding: 0; font-size: 0.82rem; }
.itw-full .finding-fix { font-size: 0.9rem; color: var(--ink-soft); margin: 0.5rem 0 0; }
.itw-full .footnote { font-size: 0.82rem; color: var(--muted); font-style: italic; margin-top: 0.5rem; }

/* Footer */
.itw-full .report-footer {
  margin-top: 3rem;
  padding: 1.5rem 0 0;
  border-top: 1px solid var(--ink);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}
.itw-full .report-footer .back { color: var(--accent); text-decoration: none; }
.itw-full .report-footer .back:hover { text-decoration: underline; }
.itw-full .report-footer .sep { margin: 0 0.6em; color: var(--rule); }
.itw-full .install-label { color: var(--muted); margin-right: 0.5rem; }
.itw-full .install-cmd {
  background: var(--ink);
  color: var(--paper);
  padding: 0.4rem 0.7rem;
  border-radius: 3px;
  font-size: 0.78rem;
}

/* Print */
@media print {
  .itw-full { background: white; }
  .itw-full .toc { position: static; }
  .itw-full .report-footer { display: none; }
}
`;
