// Python endpoint discovery (FastAPI / Flask / Starlette) via AST — the Contract
// dimension only discovered routes through the JS/TS Babel walk, so a FastAPI
// backend's (mostly Python) endpoints were invisible to contract analysis. This
// runs a stdlib-ast subprocess (same pattern as py-edge-cases/py-taint) and
// extracts each route's method/path plus the FastAPI contract signals:
// response_model (typed response), status_code, and whether a request body model
// is declared. Graceful [] on missing python3 / syntax error.
import { spawnSync } from 'node:child_process';
import { pythonAvailable } from './py-edge-cases.js';

export interface PyEndpoint {
  method: string;
  path: string;
  line: number;
  filePath: string;
  funcName: string;
  /** FastAPI: a response_model= was declared (the response shape is in the contract). */
  responseModel: boolean;
  /** An explicit status_code= was set. */
  statusCode: boolean;
  /** A request body / Pydantic model param is declared. */
  hasBodyModel: boolean;
}

const PY_SCRIPT = `
import ast, json, sys
src = sys.stdin.read()
try:
    tree = ast.parse(src)
except Exception:
    print("[]"); sys.exit(0)

HTTP = {"get","post","put","delete","patch","head","options","trace"}
ROUTE_DECOS = HTTP | {"route","api_route","websocket","add_api_route"}
BUILTIN_ANNO = {"int","str","float","bool","bytes","dict","list","set","tuple","Any","None","UUID","Request","Response","BackgroundTasks","WebSocket","Session","AsyncSession","Depends","Optional","List","Dict"}

def str_arg(call):
    if call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
        return call.args[0].value
    return None

def kw(call, name):
    for k in call.keywords:
        if k.arg == name: return k.value
    return None

def anno_name(a):
    if isinstance(a, ast.Name): return a.id
    if isinstance(a, ast.Attribute): return a.attr
    if isinstance(a, ast.Subscript): return anno_name(a.value)
    if isinstance(a, ast.Constant) and isinstance(a.value, str): return a.value
    return None

def methods_from(call):
    m = kw(call, "methods"); res = []
    if isinstance(m, (ast.List, ast.Tuple)):
        for e in m.elts:
            if isinstance(e, ast.Constant) and isinstance(e.value, str): res.append(e.value.lower())
    return res

def has_body_model(fn):
    args = fn.args
    allargs = list(getattr(args, "posonlyargs", [])) + list(args.args) + list(args.kwonlyargs)
    for a in allargs:
        ann = anno_name(a.annotation)
        if ann and ann not in BUILTIN_ANNO and ann[:1].isupper():
            return True
    for d in list(args.defaults or []) + [x for x in (args.kw_defaults or []) if x is not None]:
        if isinstance(d, ast.Call):
            f = d.func
            nm = f.id if isinstance(f, ast.Name) else (f.attr if isinstance(f, ast.Attribute) else None)
            if nm in ("Body", "Form", "File"): return True
    return False

out = []
for fn in [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
    for d in fn.decorator_list:
        if not isinstance(d, ast.Call): continue
        f = d.func
        if not isinstance(f, ast.Attribute) or f.attr not in ROUTE_DECOS: continue
        path = str_arg(d)
        if not path or not path.startswith("/"): continue
        resp = kw(d, "response_model") is not None
        status = kw(d, "status_code") is not None
        body = has_body_model(fn)
        methods = [f.attr] if f.attr in HTTP else (methods_from(d) or ["get"])
        for m in methods:
            out.append({"method": m.lower(), "path": path, "line": fn.lineno, "funcName": fn.name, "responseModel": resp, "statusCode": status, "hasBodyModel": body})

print(json.dumps(out[:300]))
`;

export function findPythonEndpoints(filePath: string, content: string): PyEndpoint[] {
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

  const out: PyEndpoint[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.method !== 'string' || typeof r.path !== 'string' || typeof r.line !== 'number') continue;
    out.push({
      method: r.method,
      path: r.path,
      line: r.line,
      filePath,
      funcName: typeof r.funcName === 'string' ? r.funcName : '',
      responseModel: r.responseModel === true,
      statusCode: r.statusCode === true,
      hasBodyModel: r.hasBodyModel === true,
    });
  }
  return out;
}
