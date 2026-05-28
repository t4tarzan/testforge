// Python edge-case / boundary-condition detection.
//
// The deep per-line analysis everywhere else in this package is
// JS/TS-AST-centric (Babel). `isParseable()` only matches JS/TS, so
// Python/FastAPI backends were silently skipped by the per-line passes
// and only got project-level checks. This module closes that gap.
//
// WHY a python3 subprocess instead of a JS Python parser: there is no
// well-maintained, accurate Python parser on npm. The stdlib `ast`
// module IS the Python grammar — it tracks exact line numbers, never
// drifts from the real language, and `python3` is already present in
// the MCP runtime (the Docker image installs it). We embed the detector
// as a string constant (not a separate .py file) so npm packaging never
// has to ship/locate a sidecar script. The content is piped on stdin and
// the filePath is passed as argv[1]; the script prints a JSON array.
//
// Graceful degradation is mandatory: a missing/broken/slow python3, or a
// target file with a SyntaxError, must yield [] and NEVER throw — one bad
// file cannot 500 the whole analysis.
//
// Rules (all AST-precise to avoid the regex false-positive trap that the
// old JS line-level checks fell into):
//
//   - mutable-default-arg     def f(x=[]) / ={} / =set()/dict()/list() —
//                             the default is shared across calls; classic footgun.
//   - bare-except             `except:` with no type swallows KeyboardInterrupt/SystemExit.
//   - eq-none                 `== None` / `!= None` — should be `is` / `is not`.
//   - assert-for-validation   `assert` in non-test code — `python -O` strips it.
//   - sql-string-interpolation  execute/executemany/raw() with an f-string,
//                             `%`-formatted str, or `.format(...)` first arg → SQLi.
//   - int-coercion-unchecked  int(x)/float(x) on a non-literal outside try → ValueError.
//   - requests-no-timeout     requests/httpx .get/.post/... with no timeout=.
//                             (Bare `session`/`client` are deliberately NOT matched:
//                             they are overwhelmingly SQLAlchemy/k8s, not HTTP — proven
//                             against a real FastAPI backend — and would be all-FP.)

import { spawnSync } from 'node:child_process';

export type PyEdgeRule =
  | 'mutable-default-arg'
  | 'bare-except'
  | 'eq-none'
  | 'assert-for-validation'
  | 'sql-string-interpolation'
  | 'int-coercion-unchecked'
  | 'requests-no-timeout';

export interface PyEdgeHit {
  rule: PyEdgeRule;
  filePath: string;
  line: number;
  description: string;
}

export const PY_RULE_SEVERITY: Record<PyEdgeRule, 'critical' | 'high' | 'medium' | 'low'> = {
  'sql-string-interpolation': 'high',
  'mutable-default-arg': 'medium',
  'int-coercion-unchecked': 'medium',
  'requests-no-timeout': 'medium',
  'bare-except': 'low',
  'eq-none': 'low',
  'assert-for-validation': 'low',
};

export const PY_RULE_FIX: Record<PyEdgeRule, string> = {
  'mutable-default-arg':
    'Use `None` as the default and create the container inside the body: `def f(x=None): x = x or []`. The default object is evaluated once and shared across every call, so mutations leak between calls.',
  'bare-except':
    'Catch a specific exception (`except ValueError:`) or at least `except Exception:`. A bare `except:` also swallows KeyboardInterrupt and SystemExit, hiding bugs and breaking Ctrl-C.',
  'eq-none':
    'Use `is None` / `is not None`. `== None` invokes `__eq__`, which a subclass can override (and is slower); identity is the correct, idiomatic check.',
  'assert-for-validation':
    'Do not use `assert` for runtime validation. Raise an explicit exception (e.g. `raise ValueError(...)` / FastAPI `HTTPException`). Python run with `-O` strips all asserts, silently removing the check.',
  'sql-string-interpolation':
    'Never build SQL by string interpolation. Use parameterized queries / bound parameters (`cursor.execute(sql, params)`) or the ORM query builder. F-strings, `%`, and `.format()` in execute() are SQL-injection vectors.',
  'int-coercion-unchecked':
    'Wrap `int(x)`/`float(x)` on external input in try/except ValueError, or validate first (Pydantic / explicit check). Bad input raises ValueError and crashes the request.',
  'requests-no-timeout':
    'Always pass `timeout=` to HTTP calls (e.g. `requests.get(url, timeout=10)`). With no timeout the call can hang forever if the peer never responds, exhausting workers.',
};

// The detector, embedded as a plain single-quoted JS string built from a
// joined array of lines. NOTE: this is NOT a template literal, so there
// are no `${}`/backtick collisions to worry about — Python f-strings and
// dict braces inside the script are completely safe here.
const PY_SCRIPT = [
  'import ast, json, sys',
  '',
  'src = sys.stdin.read()',
  'path = sys.argv[1] if len(sys.argv) > 1 else ""',
  'is_test = "test" in path.lower()',
  '',
  'try:',
  '    tree = ast.parse(src)',
  'except SyntaxError:',
  '    # Unparseable target file -> emit nothing rather than crash.',
  '    print("[]")',
  '    sys.exit(0)',
  'except Exception:',
  '    print("[]")',
  '    sys.exit(0)',
  '',
  'hits = []',
  'def add(rule, node, desc):',
  '    line = getattr(node, "lineno", 1) or 1',
  '    hits.append({"rule": rule, "line": line, "description": desc})',
  '',
  '# Pre-pass: record (start, end) line ranges of every Try body so we can',
  '# tell whether an int()/float() coercion is already guarded. Mirrors the',
  '# JS analyzer\'s tryRanges approach.',
  'try_ranges = []',
  'for node in ast.walk(tree):',
  '    if isinstance(node, ast.Try):',
  '        lines = [getattr(node, "lineno", None)]',
  '        for stmt in node.body:',
  '            for sub in ast.walk(stmt):',
  '                ln = getattr(sub, "lineno", None)',
  '                if ln is not None:',
  '                    lines.append(ln)',
  '        lines = [l for l in lines if l is not None]',
  '        if lines:',
  '            try_ranges.append((min(lines), max(lines)))',
  '',
  'def in_try(node):',
  '    ln = getattr(node, "lineno", None)',
  '    if ln is None:',
  '        return False',
  '    return any(s <= ln <= e for (s, e) in try_ranges)',
  '',
  '_CONTAINER_CALLS = {"list", "dict", "set"}',
  'def is_mutable_default(d):',
  '    if isinstance(d, (ast.List, ast.Dict, ast.Set)):',
  '        return True',
  '    if isinstance(d, ast.Call) and isinstance(d.func, ast.Name) and d.func.id in _CONTAINER_CALLS:',
  '        return True',
  '    return False',
  '',
  'def _is_safe_sql_composer(recv):',
  '    # psycopg/psycopg2 safe composition: sql.SQL("...").format(...) /',
  '    # psycopg.sql.SQL(...).format(...) bind identifiers safely, NOT string',
  '    # interpolation. Skip these to avoid false positives.',
  '    if isinstance(recv, ast.Call) and isinstance(recv.func, ast.Attribute) and recv.func.attr == "SQL":',
  '        return True',
  '    if isinstance(recv, ast.Call) and isinstance(recv.func, ast.Name) and recv.func.id == "SQL":',
  '        return True',
  '    return False',
  '',
  'def is_str_format(node):',
  '    # f-string',
  '    if isinstance(node, ast.JoinedStr):',
  '        return True',
  '    # "..." % x  (only flag when the left side is clearly a string literal)',
  '    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):',
  '        left = node.left',
  '        if isinstance(left, ast.Constant) and isinstance(left.value, str):',
  '            return True',
  '    # x.format(...) — but NOT psycopg sql.SQL(...).format(...) (safe binding)',
  '    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "format":',
  '        if _is_safe_sql_composer(node.func.value):',
  '            return False',
  '        return True',
  '    return False',
  '',
  '_HTTP_VERBS = {"get", "post", "put", "delete", "patch", "head"}',
  '# Only library names that UNAMBIGUOUSLY denote HTTP clients. A bare',
  '# `session`/`client` is far more often SQLAlchemy Session.get(Model, pk)',
  '# or the kubernetes client than an HTTP call, so matching those by name',
  '# is almost all false positives (proven against a real FastAPI backend).',
  '# Without import resolution we cannot tell them apart, so we stay precise.',
  '_HTTP_OBJS = {"requests", "httpx"}',
  '_SQL_METHODS = {"execute", "executemany", "raw"}',
  '',
  'for node in ast.walk(tree):',
  '    # --- mutable-default-arg',
  '    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):',
  '        args = node.args',
  '        defaults = list(args.defaults) + [d for d in args.kw_defaults if d is not None]',
  '        for d in defaults:',
  '            if is_mutable_default(d):',
  '                add("mutable-default-arg", d, "Mutable default argument (list/dict/set) — shared across all calls; mutations leak between invocations.")',
  '',
  '    # --- bare-except',
  '    if isinstance(node, ast.ExceptHandler) and node.type is None:',
  '        add("bare-except", node, "Bare `except:` — swallows KeyboardInterrupt/SystemExit and hides every error.")',
  '',
  '    # --- eq-none  (== None / != None)',
  '    if isinstance(node, ast.Compare):',
  '        comparators = node.comparators',
  '        for op, comp in zip(node.ops, comparators):',
  '            if isinstance(op, (ast.Eq, ast.NotEq)) and isinstance(comp, ast.Constant) and comp.value is None:',
  '                sym = "==" if isinstance(op, ast.Eq) else "!="',
  '                add("eq-none", node, "Comparison to None with `" + sym + "` — use `is` / `is not` for identity checks.")',
  '        # also handle  None == x',
  '        if isinstance(node.left, ast.Constant) and node.left.value is None and node.ops and isinstance(node.ops[0], (ast.Eq, ast.NotEq)):',
  '            add("eq-none", node, "Comparison to None with `==`/`!=` — use `is` / `is not` for identity checks.")',
  '',
  '    # --- assert-for-validation (non-test files only)',
  '    if isinstance(node, ast.Assert) and not is_test:',
  '        add("assert-for-validation", node, "`assert` used outside tests — `python -O` strips asserts, silently removing the check.")',
  '',
  '    # --- call-based rules',
  '    if isinstance(node, ast.Call):',
  '        func = node.func',
  '        # sql-string-interpolation: <obj>.execute/executemany/raw(<formatted str>, ...)',
  '        if isinstance(func, ast.Attribute) and func.attr in _SQL_METHODS and node.args:',
  '            if is_str_format(node.args[0]):',
  '                add("sql-string-interpolation", node, "SQL built with string interpolation (f-string / % / .format) in " + func.attr + "() — SQL-injection risk; use bound parameters.")',
  '',
  '        # requests-no-timeout: <obj>.<verb>(...) with no timeout= kwarg',
  '        if isinstance(func, ast.Attribute) and func.attr in _HTTP_VERBS:',
  '            obj = func.value',
  '            obj_name = None',
  '            if isinstance(obj, ast.Name):',
  '                obj_name = obj.id.lower()',
  '            elif isinstance(obj, ast.Attribute):',
  '                obj_name = obj.attr.lower()',
  '            if obj_name in _HTTP_OBJS:',
  '                has_timeout = any(kw.arg == "timeout" for kw in node.keywords)',
  '                if not has_timeout:',
  '                    add("requests-no-timeout", node, "HTTP " + func.attr + "() with no timeout= — the call can hang forever if the peer stalls.")',
  '',
  '        # int-coercion-unchecked: int(x)/float(x) on non-literal, outside a try',
  '        if isinstance(func, ast.Name) and func.id in ("int", "float") and len(node.args) >= 1:',
  '            arg = node.args[0]',
  '            is_literal = isinstance(arg, ast.Constant)',
  '            if not is_literal and not in_try(node):',
  '                add("int-coercion-unchecked", node, func.id + "(x) on non-literal input outside try/except — raises ValueError on bad input.")',
  '',
  '# De-dup by (line, rule).',
  'seen = set()',
  'out = []',
  'for h in hits:',
  '    k = (h["line"], h["rule"])',
  '    if k in seen:',
  '        continue',
  '    seen.add(k)',
  '    out.append(h)',
  '',
  'print(json.dumps(out))',
].join('\n');

// Cache python3 availability so we don't pay a spawn-fail on every file.
// `undefined` = not probed yet; true/false = probed result.
let _pythonAvailable: boolean | undefined;

function pythonAvailable(): boolean {
  if (_pythonAvailable !== undefined) return _pythonAvailable;
  try {
    const probe = spawnSync('python3', ['--version'], { encoding: 'utf8', timeout: 5000 });
    _pythonAvailable = probe.status === 0 && !probe.error;
  } catch {
    _pythonAvailable = false;
  }
  return _pythonAvailable;
}

/** Test-only hook to reset the cached probe (so the suite can simulate "no python3"). */
export function _resetPythonProbe(): void {
  _pythonAvailable = undefined;
}

export function findPythonEdgeCases(filePath: string, content: string): PyEdgeHit[] {
  if (!pythonAvailable()) return [];

  let res;
  try {
    res = spawnSync('python3', ['-c', PY_SCRIPT, filePath], {
      input: content,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    // spawn itself blew up (e.g. python3 vanished between probe and call).
    return [];
  }

  // Timed out, killed, non-zero exit, or no stdout → degrade to [].
  if (res.error || res.status !== 0 || !res.stdout) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: PyEdgeHit[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { rule?: unknown; line?: unknown; description?: unknown };
    if (typeof r.rule !== 'string' || typeof r.line !== 'number') continue;
    out.push({
      rule: r.rule as PyEdgeRule,
      filePath,
      line: r.line,
      description: typeof r.description === 'string' ? r.description : '',
    });
  }
  return out;
}
