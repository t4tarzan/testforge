// Python intra-procedural taint tracking — closes the FastAPI/Python backend
// security gap the dimension audit flagged: JS/TS got AST taint analysis, Python
// got none. This runs a stdlib-`ast` taint engine via a python3 subprocess
// (same proven pattern as py-edge-cases) and feeds the Security dimension.
//
// SOURCES (untrusted): request.{query_params,path_params,args,form,json,body,…}
//   and route-handler parameters (FastAPI/Flask/Starlette decorated functions),
//   minus dependency-injected params (Depends/Session/Request) and FastAPI-
//   validated scalar types (int/float/bool/UUID).
// SINKS: SQL execute()/text() (SQLi), eval/exec/os.system/subprocess (RCE/cmd
//   injection), open()/send_file() (path traversal), requests/httpx/urllib (SSRF).
// SANITIZERS: int()/float()/bool()/shlex.quote() strip taint; a parameterized
//   `execute(sql, params)` is only flagged if the SQL STRING itself is built
//   from tainted input (params don't sanitize an interpolated query).
//
// Graceful degradation: missing/broken/slow python3, syntax errors, or bad
// output all return [] — never throw.
import { spawnSync } from 'node:child_process';
import { pythonAvailable } from './py-edge-cases.js';

export type PyTaintRule = 'py-taint-sqli' | 'py-taint-rce' | 'py-taint-path' | 'py-taint-ssrf';

export interface PyTaintHit {
  rule: PyTaintRule;
  filePath: string;
  line: number;
  vulnType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fixSuggestion: string;
}

// Embedded Python taint engine. Plain template literal — the script contains no
// backticks and no `${` sequences (descriptions use string concatenation, never
// Python f-strings), so there is nothing for JS to interpolate.
const PY_SCRIPT = `
import ast, json, sys
src = sys.stdin.read()
try:
    tree = ast.parse(src)
except Exception:
    print("[]"); sys.exit(0)

HTTP_METHODS = {"get","post","put","delete","patch","options","head","route","api_route","websocket"}
REQ_SOURCE_ATTRS = {"query_params","path_params","args","form","values","data","json","body","get_json","GET","POST","files","cookies","headers","stream"}
REQ_NAMES = {"request","req"}
DI_PARAM_NAMES = {"self","cls","request","req","db","session","db_session","current_user","user","background_tasks","response","settings","config","cache"}
DI_ANNOS = {"Session","AsyncSession","Request","Depends","BackgroundTasks","Response","WebSocket"}
SAFE_SCALAR_ANNOS = {"int","float","bool","UUID","Decimal","datetime","date","bytes"}
SANITIZER_FUNCS = {"int","float","bool","len","abs","round"}
SANITIZER_ATTRS = {"quote"}
STR_PASSTHRU = {"strip","lstrip","rstrip","lower","upper","title","replace","format","format_map","join","encode","decode","capitalize","casefold","get","getlist","decode"}
SQL_SINKS = {"execute","executemany","executescript","raw"}
SUBPROC = {"run","call","check_call","check_output","Popen"}
SSRF_BASE = {"requests","httpx","session","client","urllib"}
SSRF_METH = {"get","post","put","delete","patch","head","request","urlopen"}

hits = []
def add(rule, node, vuln, sev, desc, fix):
    hits.append({"rule": rule, "line": getattr(node, "lineno", 1), "vulnType": vuln, "severity": sev, "description": desc, "fixSuggestion": fix})

def name_of(n):
    if isinstance(n, ast.Name): return n.id
    if isinstance(n, ast.Attribute): return n.attr
    return None

def anno_name(a):
    if a is None: return None
    if isinstance(a, ast.Name): return a.id
    if isinstance(a, ast.Subscript): return anno_name(a.value)
    if isinstance(a, ast.Attribute): return a.attr
    if isinstance(a, ast.Call): return anno_name(a.func)
    if isinstance(a, ast.Constant) and isinstance(a.value, str): return a.value
    return None

def deco_is_route(fn):
    for d in fn.decorator_list:
        t = d.func if isinstance(d, ast.Call) else d
        if isinstance(t, ast.Attribute) and t.attr in HTTP_METHODS: return True
    return False

class FuncTaint:
    def __init__(self, fn):
        self.fn = fn
        self.tainted = set()
        args = fn.args
        allargs = list(getattr(args, "posonlyargs", [])) + list(args.args) + list(args.kwonlyargs)
        default_for = {}
        if args.defaults:
            for a, d in zip(args.args[-len(args.defaults):], args.defaults): default_for[a.arg] = d
        for a, d in zip(args.kwonlyargs, args.kw_defaults):
            if d is not None: default_for[a.arg] = d
        if deco_is_route(fn):
            for a in allargs:
                nm = a.arg
                if nm in DI_PARAM_NAMES: continue
                ann = anno_name(a.annotation)
                if ann in DI_ANNOS or ann in SAFE_SCALAR_ANNOS: continue
                d = default_for.get(nm)
                if isinstance(d, ast.Call) and name_of(d.func) == "Depends": continue
                self.tainted.add(nm)
        self.fixpoint()

    def is_req(self, node):
        return isinstance(node, ast.Name) and node.id in REQ_NAMES

    def tainted_expr(self, e):
        if e is None: return False
        if isinstance(e, ast.Name): return e.id in self.tainted
        if isinstance(e, ast.Attribute):
            if self.is_req(e.value) and e.attr in REQ_SOURCE_ATTRS: return True
            return self.tainted_expr(e.value)
        if isinstance(e, ast.Subscript): return self.tainted_expr(e.value)
        if isinstance(e, ast.Starred): return self.tainted_expr(e.value)
        if isinstance(e, ast.FormattedValue): return self.tainted_expr(e.value)
        if isinstance(e, ast.JoinedStr): return any(self.tainted_expr(v) for v in e.values)
        if isinstance(e, ast.BinOp) and isinstance(e.op, (ast.Add, ast.Mod)):
            return self.tainted_expr(e.left) or self.tainted_expr(e.right)
        if isinstance(e, ast.BoolOp): return any(self.tainted_expr(v) for v in e.values)
        if isinstance(e, ast.IfExp): return self.tainted_expr(e.body) or self.tainted_expr(e.orelse)
        if isinstance(e, (ast.List, ast.Tuple, ast.Set)): return any(self.tainted_expr(x) for x in e.elts)
        if isinstance(e, ast.Await): return self.tainted_expr(e.value)
        if isinstance(e, ast.Call):
            f = e.func
            if isinstance(f, ast.Name) and f.id in SANITIZER_FUNCS: return False
            if isinstance(f, ast.Attribute) and f.attr in SANITIZER_ATTRS: return False
            if isinstance(f, ast.Name) and f.id == "str": return any(self.tainted_expr(a) for a in e.args)
            if isinstance(f, ast.Attribute):
                if self.is_req(f.value) and f.attr in REQ_SOURCE_ATTRS: return True
                if self.tainted_expr(f.value): return True
                if f.attr in STR_PASSTHRU: return any(self.tainted_expr(a) for a in e.args)
            return False
        return False

    def targets(self, t):
        if isinstance(t, ast.Name): return [t.id]
        if isinstance(t, (ast.Tuple, ast.List)):
            out = []
            for el in t.elts: out += self.targets(el)
            return out
        return []

    def fixpoint(self):
        changed = True
        while changed:
            changed = False
            for node in ast.walk(self.fn):
                tgt, val = None, None
                if isinstance(node, ast.Assign): val = node.value; tgts = node.targets
                elif isinstance(node, (ast.AnnAssign, ast.AugAssign, ast.NamedExpr)) and getattr(node, "value", None) is not None:
                    val = node.value; tgts = [node.target]
                elif isinstance(node, (ast.For, ast.AsyncFor)):
                    if self.tainted_expr(node.iter):
                        for nm in self.targets(node.target):
                            if nm not in self.tainted: self.tainted.add(nm); changed = True
                    continue
                else:
                    continue
                if self.tainted_expr(val):
                    for t in tgts:
                        for nm in self.targets(t):
                            if nm not in self.tainted: self.tainted.add(nm); changed = True

    def dangerous_sql(self, arg):
        if arg is None: return False
        if isinstance(arg, ast.JoinedStr): return any(self.tainted_expr(v) for v in arg.values)
        if isinstance(arg, ast.BinOp) and isinstance(arg.op, (ast.Add, ast.Mod)):
            return self.tainted_expr(arg.left) or self.tainted_expr(arg.right)
        if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Attribute) and arg.func.attr == "format":
            return self.tainted_expr(arg.func.value) or any(self.tainted_expr(a) for a in arg.args)
        if isinstance(arg, ast.Name): return arg.id in self.tainted
        return False

    def scan(self):
        for node in ast.walk(self.fn):
            if not isinstance(node, ast.Call): continue
            f = node.func
            a0 = node.args[0] if node.args else None
            if isinstance(f, ast.Attribute) and f.attr in SQL_SINKS and self.dangerous_sql(a0):
                add("py-taint-sqli", node, "SQL Injection", "high", "User-controlled input is built into a SQL string passed to ." + f.attr + "() (request input -> query string). Bound parameters do not sanitize an interpolated query string.", "Use bound parameters: execute('... WHERE x = %s', (value,)) or the ORM query builder; never f-string/%/.format user input into SQL.")
            if isinstance(f, ast.Name) and f.id == "text" and self.dangerous_sql(a0):
                add("py-taint-sqli", node, "SQL Injection", "high", "User input flows into sqlalchemy text() raw SQL.", "Bind parameters via text('... :p').bindparams(p=value).")
            if isinstance(f, ast.Name) and f.id in ("eval", "exec") and self.tainted_expr(a0):
                add("py-taint-rce", node, "Code Injection", "critical", "User-controlled input reaches " + f.id + "() — arbitrary code execution.", "Never eval/exec untrusted input; use ast.literal_eval or an explicit dispatch table.")
            if isinstance(f, ast.Attribute):
                base = name_of(f.value)
                if base == "os" and f.attr in ("system", "popen") and self.tainted_expr(a0):
                    add("py-taint-rce", node, "Command Injection", "critical", "User input flows into os." + f.attr + "() — shell command injection.", "Use subprocess with an argv list and shell=False; validate/allowlist input.")
                if base == "subprocess" and f.attr in SUBPROC and self.tainted_expr(a0):
                    shell = any(isinstance(k, ast.keyword) and k.arg == "shell" and isinstance(k.value, ast.Constant) and k.value.value is True for k in node.keywords)
                    if shell:
                        add("py-taint-rce", node, "Command Injection", "critical", "User input reaches subprocess." + f.attr + "(..., shell=True) — shell injection.", "Drop shell=True; pass a fixed argv list and validate the input.")
                    else:
                        add("py-taint-rce", node, "Command Injection", "high", "User input reaches subprocess." + f.attr + "() as the command.", "Pass a fixed argv list; never include unvalidated input in the command.")
                if base in SSRF_BASE and f.attr in SSRF_METH and self.tainted_expr(a0):
                    add("py-taint-ssrf", node, "SSRF", "high", "User-controlled URL flows into an outbound HTTP call (" + (base or "") + "." + f.attr + ") — server-side request forgery.", "Validate the URL against an allowlist of hosts/schemes before fetching.")
                if f.attr == "send_file" and self.tainted_expr(a0):
                    add("py-taint-path", node, "Path Traversal", "high", "User input flows into send_file() — path traversal / arbitrary file read.", "Resolve against a fixed base dir, reject '..', use werkzeug safe_join / secure_filename.")
            if isinstance(f, ast.Name) and f.id == "open" and self.tainted_expr(a0):
                add("py-taint-path", node, "Path Traversal", "high", "User input flows into open() as the file path — path traversal.", "Resolve against a fixed base directory and reject '..'/absolute paths; validate the filename.")

for fn in [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
    FuncTaint(fn).scan()

seen = set(); out = []
for h in hits:
    k = (h["rule"], h["line"])
    if k in seen: continue
    seen.add(k); out.append(h)
print(json.dumps(out[:40]))
`;

const VALID_RULES = new Set<PyTaintRule>(['py-taint-sqli', 'py-taint-rce', 'py-taint-path', 'py-taint-ssrf']);

export function findPythonTaint(filePath: string, content: string): PyTaintHit[] {
  if (!pythonAvailable()) return [];
  let res;
  try {
    res = spawnSync('python3', ['-c', PY_SCRIPT, filePath], {
      input: content, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  if (res.error || res.status !== 0 || !res.stdout) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(res.stdout); } catch { return []; }
  if (!Array.isArray(parsed)) return [];

  const out: PyTaintHit[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.rule !== 'string' || !VALID_RULES.has(r.rule as PyTaintRule)) continue;
    if (typeof r.line !== 'number') continue;
    out.push({
      rule: r.rule as PyTaintRule,
      filePath,
      line: r.line,
      vulnType: typeof r.vulnType === 'string' ? r.vulnType : 'Security',
      severity: (['critical', 'high', 'medium', 'low'].includes(r.severity as string) ? r.severity : 'high') as PyTaintHit['severity'],
      description: typeof r.description === 'string' ? r.description : '',
      fixSuggestion: typeof r.fixSuggestion === 'string' ? r.fixSuggestion : '',
    });
  }
  return out;
}
