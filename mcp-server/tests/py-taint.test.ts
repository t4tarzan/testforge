// Python intra-procedural taint tests. Gated on python3 (the engine runs via a
// subprocess); skipped cleanly when python3 is absent. Fixtures are template
// literals — Python f-strings use {name} (no `${`), so nothing interpolates.
import { describe, it, expect } from 'vitest';
import { findPythonTaint } from '../src/analyzers/lib/py-taint.js';
import { pythonAvailable } from '../src/analyzers/lib/py-edge-cases.js';

const PY = pythonAvailable();
const rules = (src: string) => findPythonTaint('app/api.py', src).map((h) => h.rule);

describe.skipIf(!PY)('findPythonTaint — true positives', () => {
  it('SQLi: f-string from a route param into execute()', () => {
    const src = `
from fastapi import APIRouter, Depends
router = APIRouter()
@router.get("/u/{name}")
async def get_user(name: str, db = Depends(get_db)):
    return db.execute(f"SELECT * FROM users WHERE name = '{name}'")
`;
    expect(rules(src)).toContain('py-taint-sqli');
  });

  it('SQLi: request.args source through concatenation (Flask, non-decorated)', () => {
    const src = `
from flask import request
def search(cursor):
    q = request.args.get("q")
    cursor.execute("SELECT * FROM t WHERE x = '" + q + "'")
`;
    expect(rules(src)).toContain('py-taint-sqli');
  });

  it('RCE: os.system + subprocess(shell=True) on tainted input', () => {
    const src = `
import os, subprocess
@app.post("/run")
def run(cmd: str):
    os.system(cmd)
    subprocess.run(cmd, shell=True)
`;
    expect(rules(src)).toContain('py-taint-rce');
  });

  it('Path traversal: tainted param into open()', () => {
    const src = `
@app.get("/f")
def f(path: str):
    return open(path).read()
`;
    expect(rules(src)).toContain('py-taint-path');
  });

  it('SSRF: tainted url into requests.get()', () => {
    const src = `
import requests
@app.get("/fetch")
def fetch(url: str):
    return requests.get(url).text
`;
    expect(rules(src)).toContain('py-taint-ssrf');
  });
});

describe.skipIf(!PY)('findPythonTaint — no false positives', () => {
  it('parameterized execute (sql string + params tuple) is safe', () => {
    const src = `
@app.get("/u")
def get_user(name: str, db = Depends(get_db)):
    return db.execute("SELECT * FROM users WHERE name = %s", (name,))
`;
    expect(findPythonTaint('app/api.py', src)).toHaveLength(0);
  });

  it('int() coercion sanitizes before SQL', () => {
    const src = `
@app.get("/p")
def p(uid: str, db = Depends(get_db)):
    return db.execute(f"SELECT * FROM t WHERE id = {int(uid)}")
`;
    expect(findPythonTaint('app/api.py', src)).toHaveLength(0);
  });

  it('FastAPI-validated int param is not a string-injection source', () => {
    const src = `
@app.get("/l")
def l(limit: int, db = Depends(get_db)):
    return db.execute(f"SELECT * FROM t LIMIT {limit}")
`;
    expect(findPythonTaint('app/api.py', src)).toHaveLength(0);
  });

  it('non-handler helper params are not tainted (intra-procedural, precise)', () => {
    const src = `
def helper(x, db):
    return db.execute(f"SELECT {x}")
`;
    expect(findPythonTaint('app/api.py', src)).toHaveLength(0);
  });

  it('syntax-error file returns [] (no crash)', () => {
    expect(findPythonTaint('app/api.py', 'def broken(:\n  pass')).toEqual([]);
  });
});
