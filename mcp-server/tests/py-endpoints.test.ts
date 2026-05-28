// FastAPI/Flask endpoint discovery + contract-awareness tests. Gated on python3.
import { describe, it, expect } from 'vitest';
import { findPythonEndpoints } from '../src/analyzers/lib/py-endpoints.js';
import { pythonAvailable } from '../src/analyzers/lib/py-edge-cases.js';
import { runContractAnalysis } from '../src/analyzers/advanced-analyzer.js';

const PY = pythonAvailable();

describe.skipIf(!PY)('findPythonEndpoints', () => {
  it('discovers FastAPI routes with method/path + response_model/status_code/body', () => {
    const src = `
from fastapi import APIRouter
from .schemas import UserOut, UserIn
router = APIRouter()

@router.get("/users/{uid}", response_model=UserOut)
async def get_user(uid: int):
    ...

@router.post("/users", status_code=201)
async def create_user(payload: UserIn):
    ...
`;
    const eps = findPythonEndpoints('app/api.py', src);
    const get = eps.find((e) => e.method === 'get');
    const post = eps.find((e) => e.method === 'post');
    expect(get).toMatchObject({ path: '/users/{uid}', responseModel: true });
    expect(post).toMatchObject({ path: '/users', responseModel: false, statusCode: true, hasBodyModel: true });
  });

  it('expands Flask @app.route methods list', () => {
    const src = `
from flask import Flask
app = Flask(__name__)
@app.route("/items", methods=["GET", "POST"])
def items():
    ...
`;
    const methods = findPythonEndpoints('app.py', src).map((e) => e.method).sort();
    expect(methods).toEqual(['get', 'post']);
  });

  it('ignores non-route decorators and non-path strings', () => {
    const src = `
@cache.get("redis-key")
def cached(): ...
@app.get("/ok")
def ok(): ...
`;
    const eps = findPythonEndpoints('app.py', src);
    expect(eps.map((e) => e.path)).toEqual(['/ok']);
  });
});

describe.skipIf(!PY)('runContractAnalysis — FastAPI aware', () => {
  it('counts Python endpoints and flags missing response_model instead of "no spec"', async () => {
    const files: Record<string, string> = {
      'app/main.py': `
from fastapi import FastAPI
app = FastAPI()
@app.get("/a")
def a(): ...
@app.get("/b")
def b(): ...
@app.get("/c", response_model=Thing)
def c(): ...
@app.post("/d")
def d(): ...
@app.get("/e")
def e(): ...
@app.get("/f")
def f(): ...
`,
    };
    const r = await runContractAnalysis(files, 0);
    expect(r.totalEndpoints).toBeGreaterThanOrEqual(6); // python endpoints counted
    const titles = r.findings.map((f) => f.title).join(' || ');
    expect(titles).toMatch(/without response_model/i);
    expect(titles).not.toMatch(/No API contract specification/i); // suppressed for FastAPI
    expect(r.documentedEndpoints).toBe(1); // only /c has response_model
  });
});
