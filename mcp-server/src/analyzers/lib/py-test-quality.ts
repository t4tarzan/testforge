// Python (pytest/unittest) test-quality via AST — the Unit dimension only
// COUNTED Python tests (regex); JS got assertion/skip/empty analysis. This runs
// a stdlib-ast subprocess (same pattern as py-edge-cases) to classify each
// test_* function: does it assert anything, is it skipped, is it empty? So a
// Python suite with assertion-free tests no longer reads as healthy coverage.
import { spawnSync } from 'node:child_process';
import { pythonAvailable } from './py-edge-cases.js';

export interface PyTestQuality {
  total: number;
  assertionless: number;
  skipped: number;
  empty: number;
}

const PY_SCRIPT = `
import ast, json, sys
src = sys.stdin.read()
try:
    tree = ast.parse(src)
except Exception:
    print(json.dumps({"total":0,"assertionless":0,"skipped":0,"empty":0})); sys.exit(0)

ASSERT_HELPERS = ("assert",)  # self.assertEqual / .assertTrue / pytest helpers start with 'assert'

def is_test_fn(node, in_test_class):
    n = node.name
    return n.startswith("test_") or n == "test" or (in_test_class and n.startswith("test"))

def deco_skips(fn):
    for d in fn.decorator_list:
        t = d.func if isinstance(d, ast.Call) else d
        if isinstance(t, ast.Attribute) and t.attr in ("skip", "skipif"): return True
        if isinstance(t, ast.Attribute) and t.attr == "skipUnless": return True
    return False

def body_calls_skip(fn):
    for n in ast.walk(fn):
        if isinstance(n, ast.Call):
            f = n.func
            nm = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
            if nm in ("skip", "skipTest", "xfail"): return True
    return False

def has_assertion(fn):
    for n in ast.walk(fn):
        if isinstance(n, ast.Assert): return True
        if isinstance(n, ast.With) or isinstance(n, ast.AsyncWith):
            for item in n.items:
                c = item.context_expr
                f = c.func if isinstance(c, ast.Call) else c
                a = f.attr if isinstance(f, ast.Attribute) else None
                if a in ("raises", "warns", "assertRaises", "assertWarns"): return True
        if isinstance(n, ast.Call):
            f = n.func
            a = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else "")
            if a and (a.startswith("assert") or a.endswith("_called") or a.endswith("_called_once") or a.endswith("_called_with")):
                return True
    return False

def is_empty(fn):
    stmts = [s for s in fn.body if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant))]  # drop docstrings
    if not stmts: return True
    return all(isinstance(s, ast.Pass) or (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant) and s.value.value is Ellipsis) for s in stmts)

total = assertionless = skipped = empty = 0

def visit(node, in_test_class):
    global total, assertionless, skipped, empty
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if is_test_fn(child, in_test_class):
                total += 1
                if deco_skips(child) or body_calls_skip(child): skipped += 1
                elif is_empty(child): empty += 1; assertionless += 1
                elif not has_assertion(child): assertionless += 1
        elif isinstance(child, ast.ClassDef):
            visit(child, child.name.startswith("Test"))
        else:
            visit(child, in_test_class)

visit(tree, False)
print(json.dumps({"total": total, "assertionless": assertionless, "skipped": skipped, "empty": empty}))
`;

export function findPythonTestQuality(content: string): PyTestQuality {
  const zero: PyTestQuality = { total: 0, assertionless: 0, skipped: 0, empty: 0 };
  if (!pythonAvailable()) return zero;
  let res;
  try {
    res = spawnSync('python3', ['-c', PY_SCRIPT], { input: content, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return zero;
  }
  if (res.error || res.status !== 0 || !res.stdout) return zero;
  try {
    const o = JSON.parse(res.stdout);
    return {
      total: Number(o.total) || 0,
      assertionless: Number(o.assertionless) || 0,
      skipped: Number(o.skipped) || 0,
      empty: Number(o.empty) || 0,
    };
  } catch {
    return zero;
  }
}
