#!/usr/bin/env bash
# Generate a showcase report for /#/in-the-wild/<slug>.
#
# Clones the repo (depth=1) to /tmp, runs TestForge /analyze against it,
# distills the full response down to the fields the showcase page renders,
# and writes the JSON to src/data/showcaseReports/<slug>.json.
#
# Requires a running MCP at localhost:33221 (start with:
# `npx -y @whitenoisenpm/testforge-mcp@latest`).
#
# Usage:
#   scripts/generate-showcase-report.sh <slug> <repo-url> "Tagline shown on the index card"
#
# Re-run any time to refresh — overwrites the existing JSON.

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "usage: $0 <slug> <repo-url> <tagline>" >&2
  exit 1
fi

SLUG="$1"
REPO_URL="$2"
TAGLINE="$3"

REPO_NAME="${REPO_URL##*/}"
REPO_NAME="${REPO_NAME%.git}"
CLONE_DIR="/tmp/testforge-showcase-$SLUG"
OUT_FILE="src/data/showcaseReports/$SLUG.json"

mkdir -p "$(dirname "$OUT_FILE")"

# Clone fresh (or update if dir exists)
if [ -d "$CLONE_DIR/.git" ]; then
  echo "==> updating existing clone at $CLONE_DIR"
  git -C "$CLONE_DIR" fetch --depth=1 origin HEAD
  git -C "$CLONE_DIR" reset --hard FETCH_HEAD
else
  echo "==> cloning $REPO_URL (depth=1) to $CLONE_DIR"
  rm -rf "$CLONE_DIR"
  git clone --depth 1 "$REPO_URL" "$CLONE_DIR"
fi

echo "==> hitting MCP /analyze"
TMP_RAW="/tmp/testforge-showcase-$SLUG-raw.json"
START=$(python3 -c "import time; print(int(time.time()*1000))")
curl -s -X POST http://localhost:33221/analyze \
  -H "Content-Type: application/json" \
  -d "{\"projectPath\":\"$CLONE_DIR\"}" > "$TMP_RAW"
END=$(python3 -c "import time; print(int(time.time()*1000))")
ANALYSIS_MS=$((END - START))

echo "==> distilling to $OUT_FILE  (analyze ${ANALYSIS_MS}ms)"
python3 - "$SLUG" "$REPO_URL" "$REPO_NAME" "$TAGLINE" "$ANALYSIS_MS" "$OUT_FILE" "$TMP_RAW" <<'PY'
import json, sys, os
slug, repo_url, repo_name, tagline, analysis_ms, out_file, raw_file = sys.argv[1:8]
analysis_ms = int(analysis_ms)

raw = json.load(open(raw_file))
cb = raw.get('codebase', {})
sec = raw.get('security', {})

# Curated dimension list — we render up to 12; pick the meaningful ones.
dims = [
    ('security',  'Security',          lambda d: max(0, 100 - (d.get('security',{}).get('critical',0)*20 + d.get('security',{}).get('high',0)*5))),
    ('unit',      'Unit Tests',        lambda d: d.get('unit',{}).get('coverage', 0)),
    ('accessibility','Accessibility',  lambda d: d.get('accessibility',{}).get('score', 0)),
    ('vision',    'Vision',            lambda d: d.get('vision',{}).get('score', 0)),
    ('scope',     'Scope',             lambda d: d.get('scope',{}).get('coverage', 0)),
    ('stack',     'Stack',             lambda d: d.get('stack',{}).get('score', 0)),
    ('chaos',     'Chaos / Resilience',lambda d: d.get('chaos',{}).get('score', 0)),
    ('mutation',  'Mutation',          lambda d: d.get('mutation',{}).get('score', 0)),
    ('predictive','Predictive Risk',   lambda d: d.get('predictive',{}).get('score', 0)),
    ('supplyChain','Supply Chain',     lambda d: d.get('supplyChain',{}).get('score', 0)),
    ('dora',      'DORA',              lambda d: d.get('dora',{}).get('score', 0)),
    ('agentic',   'Agentic Scale',     lambda d: d.get('agentic',{}).get('score', 0)),
]
scores = []
for key, label, fn in dims:
    try:
        v = fn(raw)
        scores.append({'key': key, 'label': label, 'score': int(round(v))})
    except Exception:
        scores.append({'key': key, 'label': label, 'score': 0})

overall = int(round(sum(s['score'] for s in scores) / len(scores)))

distilled = {
    'slug': slug,
    'repoUrl': repo_url,
    'repoName': repo_name,
    'tagline': tagline,
    'analyzedAt': raw.get('analyzedAt'),
    'analyzeMs': analysis_ms,
    'codebase': {
        'totalFiles': cb.get('totalFiles'),
        'totalLines': cb.get('totalLines'),
        'endpoints': cb.get('endpoints'),
        'dependencies': cb.get('dependencies'),
        'techStack': cb.get('techStack', []),
        'languageCoverage': cb.get('languageCoverage'),
    },
    'unit': {
        'coverage': raw.get('unit',{}).get('coverage'),
        'testFiles': raw.get('unit',{}).get('testFiles'),
        'totalTests': raw.get('unit',{}).get('totalTests'),
        'frameworks': raw.get('unit',{}).get('frameworks', []),
    },
    'security': {
        'findings': sec.get('findings'),
        'critical': sec.get('critical', 0),
        'high': sec.get('high', 0),
        'medium': sec.get('medium', 0),
        'low': sec.get('low', 0),
        # Top 5 most-severe items (full payload would bloat the bundle).
        'topItems': [
            {
                'severity': i.get('severity'),
                'title': i.get('title'),
                'description': (i.get('description','') or '')[:240],
                'filePath': i.get('filePath'),
                'lineNumber': i.get('lineNumber'),
                'fixSuggestion': (i.get('fixSuggestion','') or '')[:240],
            }
            for i in (sec.get('items') or [])[:5]
        ],
    },
    'scores': scores,
    'overall': overall,
}

with open(out_file, 'w') as f:
    json.dump(distilled, f, indent=2)
print(f"  wrote {out_file} ({os.path.getsize(out_file)} bytes)")
PY

rm -f "$TMP_RAW"
echo "==> done"
