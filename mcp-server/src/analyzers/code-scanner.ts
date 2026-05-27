import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface CodebaseInfo {
  files: Array<{ path: string; lines: number }>;
  totalFiles: number;
  totalLines: number;
  endpoints: number;
  middleware: number;
  dependencies: string[];
  devDependencies: string[];
  techStack: string[];
  /** Map of filename -> array of function names found */
  functions: Record<string, string[]>;
  /** Raw file content map for downstream analyzers */
  fileContents: Record<string, string>;
  /**
   * How much of the repo's source code the analyzer natively understands.
   *
   * `natively-analyzed` = JS, TS, JSX, TSX, MJS, CJS, MTS, CTS, PY.
   * `unsupported` = source files in other languages we counted but did not
   * actually parse (Go, Ruby, Rust, Java, etc.). Surfaced so the report can
   * be honest about coverage instead of pretending "0 endpoints" means
   * "no endpoints" when really we just didn't read the files.
   */
  languageCoverage: {
    nativelyAnalyzedFiles: number;
    unsupportedFiles: number;
    /** 0–100. 100 = every source file is in a supported language. */
    coveragePercent: number;
    /** Languages we noticed but can't parse, with file counts. */
    unsupportedLanguages: Array<{ language: string; files: number }>;
  };
}

// File extensions the analyzer parses natively (regex-based, AST-based, or
// both depending on dimension).
const NATIVE_EXTS = new Set(['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'py']);

// Source-code extensions we'll count even though we don't natively parse
// them. Used purely to compute language coverage — the bigger this list,
// the more honest the "we only analyzed N%" warning is for polyglot repos.
const UNSUPPORTED_EXT_TO_LANG: Record<string, string> = {
  go: 'Go',
  rb: 'Ruby',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  scala: 'Scala',
  swift: 'Swift',
  php: 'PHP',
  cs: 'C#',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  c: 'C',
  h: 'C/C++ header',
  hpp: 'C++ header',
  ex: 'Elixir',
  exs: 'Elixir',
  erl: 'Erlang',
  clj: 'Clojure',
  ml: 'OCaml',
  dart: 'Dart',
};

/**
 * Scan a project directory and extract structural information.
 * Uses real file system operations — this runs locally on the user's machine.
 */
export async function scanCodebase(projectPath: string): Promise<CodebaseInfo> {
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  // 1. Find all source files. Spec/config files (yaml/yml/json/toml) are
  //    included so the contract analyzer can parse OpenAPI/Swagger and so
  //    pyproject.toml is readable. .py is now native. Extensionless config
  //    files (Dockerfile, CODEOWNERS, Procfile) are matched explicitly.
  //    .github/ is hidden but its contents are needed for the DORA
  //    dimension — glob's `dot:true` lets us see it. Lockfiles are excluded
  //    via separate exclude patterns.
  const patterns = [
    '**/*.{ts,js,tsx,jsx,mjs,cjs,mts,cts,py,yaml,yml,json,toml,md}',
    '**/{Dockerfile,Procfile,CODEOWNERS,requirements.txt,requirements-dev.txt,Pipfile}',
    '**/.github/**/*',
    '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**',
    '!**/.next/**', '!**/coverage/**', '!**/__pycache__/**', '!**/.venv/**',
    '!**/venv/**', '!**/.tox/**', '!**/.pytest_cache/**',
    '!**/package-lock.json', '!**/yarn.lock', '!**/pnpm-lock.yaml', '!**/poetry.lock',
  ];
  const files = await glob(patterns, { cwd: projectPath, absolute: false, dot: true });

  // 2. Read each file, count lines, extract function names
  const fileInfos: Array<{ path: string; lines: number }> = [];
  const fileContents: Record<string, string> = {};
  const functions: Record<string, string[]> = {};

  for (const f of files) {
    const fullPath = join(projectPath, f);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      fileInfos.push({ path: f, lines });
      fileContents[f] = content;

      // Function-name extraction: JS/TS vs Python vs skip
      const ext = extOf(f);
      let fnNames: string[] = [];
      if (NATIVE_EXTS.has(ext) && ext !== 'py') {
        fnNames = extractJsFunctionNames(content);
      } else if (ext === 'py') {
        fnNames = extractPyFunctionNames(content);
      }
      if (fnNames.length > 0) {
        functions[f] = fnNames;
      }
    } catch {
      // Skip unreadable files
    }
  }

  // 3. Count endpoints and middleware. JS/TS patterns (Express/Fastify/
  //    generic router) AND Python patterns (FastAPI/Flask) both contribute.
  let endpointCount = 0;
  let middlewareCount = 0;
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;
    const ext = extOf(filePath);

    if (ext === 'py') {
      // FastAPI / Starlette / similar: @router.get("/path"), @app.post("/path"),
      // @api.delete(...), @blueprint.put(...). Match the @ + verb decorator
      // anchored to a route call.
      const fastapiMatches = content.match(
        /@\s*\w+\s*\.\s*(get|post|put|delete|patch|head|options|api_route|websocket)\s*\(/gi
      );
      if (fastapiMatches) endpointCount += fastapiMatches.length;

      // Flask: @app.route("/path") and @bp.route("/path"). Methods list is
      // inside the call; we count one route per decorator (a route with
      // methods=[GET, POST] is still one endpoint in flask's model).
      const flaskMatches = content.match(/@\s*\w+\s*\.\s*route\s*\(/g);
      if (flaskMatches) endpointCount += flaskMatches.length;

      // Django URL patterns (urls.py): path("foo/", view) / re_path("...", view).
      const djangoMatches = content.match(/\b(?:path|re_path|url)\s*\(\s*['"]/g);
      if (djangoMatches) endpointCount += djangoMatches.length;

      continue;
    }

    // JS/TS path. router.get('/path'), app.post('/path'), etc.
    const routeMatches = content.match(/\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`][^'"`]*['"`]/g);
    if (routeMatches) endpointCount += routeMatches.length;

    // Middleware patterns: app.use(...). JS/TS only.
    const middlewareMatches = content.match(/\.(use)\s*\(/g);
    if (middlewareMatches) middlewareCount += middlewareMatches.length;

    // Fastify: fastify.get('/path', ...)
    const fastifyRouteMatches = content.match(/fastify\.(get|post|put|delete|patch|head|options)\s*\(/g);
    if (fastifyRouteMatches) endpointCount += fastifyRouteMatches.length;

    // Express Router: router.get(...)
    const routerRouteMatches = content.match(/router\.(get|post|put|delete|patch|head|options)\s*\(/g);
    if (routerRouteMatches) endpointCount += routerRouteMatches.length;
  }

  // 4. Parse dependency manifests. package.json (Node), requirements.txt
  //    + pyproject.toml (Python). All sources are unioned into the same
  //    `dependencies` / `devDependencies` arrays — downstream analyzers
  //    look for known names regardless of language.
  let dependencies: string[] = [];
  let devDependencies: string[] = [];
  const techStack: string[] = [];

  // 4a. Node — package.json
  try {
    const pkgPath = join(projectPath, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    dependencies.push(...Object.keys(pkg.dependencies || {}));
    devDependencies.push(...Object.keys(pkg.devDependencies || {}));
  } catch {
    // No package.json — maybe not a Node project
  }

  // 4b. Python — requirements.txt (and dev variants). Lines like
  //     `fastapi>=0.110.0`, `pkg==1.2`, `pkg[extra]==1.0`, `pkg @ git+...`,
  //     comments (#), -r includes, env-markers (`; python_version<...`).
  for (const reqFile of ['requirements.txt', 'requirements-dev.txt', 'requirements-test.txt', 'dev-requirements.txt']) {
    try {
      const content = readFileSync(join(projectPath, reqFile), 'utf-8');
      const parsed = parsePyRequirements(content);
      if (reqFile.includes('dev') || reqFile.includes('test')) {
        devDependencies.push(...parsed);
      } else {
        dependencies.push(...parsed);
      }
    } catch {
      // file absent — fine
    }
  }
  // Also check common backend/ requirements (dclaw-monitor pattern).
  for (const subdir of ['backend', 'server', 'api']) {
    try {
      const content = readFileSync(join(projectPath, subdir, 'requirements.txt'), 'utf-8');
      dependencies.push(...parsePyRequirements(content));
    } catch {
      // skip
    }
  }

  // 4c. Python — pyproject.toml. Minimal regex parse (no toml lib
  //     dependency); handles PEP 621 [project] and Poetry [tool.poetry].
  try {
    const content = readFileSync(join(projectPath, 'pyproject.toml'), 'utf-8');
    const { runtime, dev } = parsePyProjectToml(content);
    dependencies.push(...runtime);
    devDependencies.push(...dev);
  } catch {
    // No pyproject.toml — fine
  }

  // Dedupe across sources.
  dependencies = [...new Set(dependencies)];
  devDependencies = [...new Set(devDependencies)];

  // 5. Tech-stack detection — checks unioned deps for known names.
  const all = [...dependencies, ...devDependencies];
  // JS/TS stacks
  if (all.includes('express')) techStack.push('Express');
  if (all.includes('fastify')) techStack.push('Fastify');
  if (all.includes('next')) techStack.push('Next.js');
  if (all.includes('react')) techStack.push('React');
  if (all.includes('typescript') || all.includes('ts-node')) techStack.push('TypeScript');
  if (all.includes('mongoose') || all.includes('mongodb')) techStack.push('MongoDB');
  if (all.includes('prisma')) techStack.push('Prisma');
  if (all.includes('drizzle-orm')) techStack.push('Drizzle');
  if (all.includes('jest') || all.includes('vitest')) techStack.push('Testing');
  if (all.includes('stripe')) techStack.push('Stripe');
  if (all.includes('jsonwebtoken') || all.includes('jwt')) techStack.push('JWT');
  if (all.includes('passport')) techStack.push('Passport.js');
  if (all.includes('bcrypt') || all.includes('bcryptjs')) techStack.push('Bcrypt');
  if (all.includes('redis') || all.includes('ioredis')) techStack.push('Redis');
  if (all.includes('docker') || all.includes('docker-compose')) techStack.push('Docker');
  if (all.includes('zod')) techStack.push('Zod');
  if (all.includes('tailwindcss')) techStack.push('TailwindCSS');
  if (all.includes('socket.io')) techStack.push('Socket.IO');
  if (all.includes('bull') || all.includes('bullmq')) techStack.push('Queue/Bull');
  if (all.includes('playwright')) techStack.push('Playwright');
  if (all.includes('cypress')) techStack.push('Cypress');
  // Python stacks
  if (all.includes('fastapi')) techStack.push('FastAPI');
  if (all.includes('flask')) techStack.push('Flask');
  if (all.includes('django')) techStack.push('Django');
  if (all.includes('starlette')) techStack.push('Starlette');
  if (all.includes('sqlalchemy')) techStack.push('SQLAlchemy');
  if (all.includes('pydantic')) techStack.push('Pydantic');
  if (all.includes('alembic')) techStack.push('Alembic');
  if (all.includes('celery')) techStack.push('Celery');
  if (all.includes('pytest')) techStack.push('pytest');
  if (all.includes('httpx') || all.includes('requests')) techStack.push('HTTP client (httpx/requests)');
  if (all.includes('asyncpg') || all.includes('psycopg2') || all.includes('psycopg2-binary') || all.includes('psycopg')) techStack.push('PostgreSQL');
  if (all.includes('redis-py') || (all.includes('redis') && all.some((d) => d.startsWith('fastapi') || d === 'asyncpg'))) techStack.push('Redis');
  if (all.includes('uvicorn') || all.includes('gunicorn')) techStack.push('Uvicorn/Gunicorn');
  if (all.includes('apscheduler')) techStack.push('APScheduler');
  if (all.includes('opentelemetry-api') || all.some((d) => d.startsWith('opentelemetry'))) techStack.push('OpenTelemetry');

  // 6. Language coverage — what fraction of source files did we actually
  //    understand? Helps the report avoid claiming "0 endpoints" for a
  //    repo whose backend we couldn't read.
  let nativelyAnalyzedFiles = 0;
  const unsupportedCounts: Record<string, number> = {};
  for (const f of fileInfos) {
    const ext = extOf(f.path);
    if (NATIVE_EXTS.has(ext)) {
      nativelyAnalyzedFiles++;
    } else if (UNSUPPORTED_EXT_TO_LANG[ext]) {
      const lang = UNSUPPORTED_EXT_TO_LANG[ext];
      unsupportedCounts[lang] = (unsupportedCounts[lang] || 0) + 1;
    }
  }
  // Re-scan to count unsupported source files that the main glob missed
  // entirely (because their ext wasn't in the pattern). We do a second,
  // separate glob restricted to those extensions so we don't bloat
  // fileContents with files we won't read.
  const unsupportedExts = Object.keys(UNSUPPORTED_EXT_TO_LANG);
  if (unsupportedExts.length > 0) {
    const extraGlob = [
      `**/*.{${unsupportedExts.join(',')}}`,
      '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**',
      '!**/.next/**', '!**/coverage/**', '!**/__pycache__/**', '!**/.venv/**',
      '!**/venv/**', '!**/vendor/**',
    ];
    const extraFiles = await glob(extraGlob, { cwd: projectPath, absolute: false, dot: true });
    for (const ef of extraFiles) {
      const ext = extOf(ef);
      const lang = UNSUPPORTED_EXT_TO_LANG[ext];
      if (lang) {
        unsupportedCounts[lang] = (unsupportedCounts[lang] || 0) + 1;
      }
    }
  }
  const unsupportedFiles = Object.values(unsupportedCounts).reduce((a, b) => a + b, 0);
  const sourceTotal = nativelyAnalyzedFiles + unsupportedFiles;
  const coveragePercent =
    sourceTotal === 0 ? 100 : Math.round((nativelyAnalyzedFiles / sourceTotal) * 100);
  const unsupportedLanguages = Object.entries(unsupportedCounts)
    .map(([language, files]) => ({ language, files }))
    .sort((a, b) => b.files - a.files);

  return {
    files: fileInfos,
    totalFiles: fileInfos.length,
    totalLines: fileInfos.reduce((sum, f) => sum + f.lines, 0),
    endpoints: endpointCount,
    middleware: middlewareCount,
    dependencies,
    devDependencies,
    techStack,
    functions,
    fileContents,
    languageCoverage: {
      nativelyAnalyzedFiles,
      unsupportedFiles,
      coveragePercent,
      unsupportedLanguages,
    },
  };
}

function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  if (i < 0) return '';
  return path.slice(i + 1).toLowerCase();
}

/**
 * Extract function names from JavaScript/TypeScript source code.
 * Heuristic — not a full AST parse, but good enough for analysis.
 */
function extractJsFunctionNames(content: string): string[] {
  const names: string[] = [];

  // function foo(...) or export function foo(...)
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(content)) !== null) {
    names.push(match[1]);
  }

  // const foo = (...) => or const foo = async (...) =>
  const arrowFnRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
  while ((match = arrowFnRegex.exec(content)) !== null) {
    names.push(match[1]);
  }

  // foo(...) { } in class or object
  const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
  while ((match = methodRegex.exec(content)) !== null) {
    if (!['if', 'while', 'for', 'switch', 'catch', 'await'].includes(match[1])) {
      names.push(match[1]);
    }
  }

  return [...new Set(names)];
}

/**
 * Extract function names from Python source code.
 * Heuristic regex — handles `def foo(...)`, `async def foo(...)`, and
 * methods at any indent level. Not a real AST.
 */
function extractPyFunctionNames(content: string): string[] {
  const names: string[] = [];
  const re = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

/**
 * Parse the package names out of a requirements.txt-style file.
 * Handles version specifiers, extras, env markers, comments, and the
 * common include directives (-r, -c). Returns canonical lowercase names.
 */
function parsePyRequirements(content: string): string[] {
  const names: string[] = [];
  for (const raw of content.split('\n')) {
    let line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    // Strip inline env markers (`pkg==1.0 ; python_version < "3.10"`)
    const semi = line.indexOf(';');
    if (semi >= 0) line = line.slice(0, semi).trim();
    // Strip inline comments (`pkg==1.0  # some note`)
    const hash = line.indexOf('#');
    if (hash >= 0) line = line.slice(0, hash).trim();
    if (!line) continue;
    // `pkg @ git+https://…` — name is everything before the @
    // `pkg[extra]==1.0` — name is everything before [
    // `pkg==1.0`, `pkg>=1`, `pkg~=1.0`, `pkg<2,>=1` — name is before any of < > = ~ ! [
    const nameMatch = line.match(/^([A-Za-z0-9_.\-]+)/);
    if (nameMatch && nameMatch[1]) {
      names.push(nameMatch[1].toLowerCase());
    }
  }
  return names;
}

/**
 * Parse dependency names out of a pyproject.toml file.
 * No TOML library — uses regexes that handle both PEP 621
 * (`[project] dependencies = [...]`) and Poetry
 * (`[tool.poetry.dependencies]` table). Good enough for tech-stack
 * detection; doesn't need version accuracy.
 */
function parsePyProjectToml(content: string): { runtime: string[]; dev: string[] } {
  const runtime: string[] = [];
  const dev: string[] = [];

  // PEP 621: dependencies = ["fastapi>=0.110", "pydantic"]
  const pep621Block = content.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
  if (pep621Block && pep621Block[1]) {
    for (const m of pep621Block[1].matchAll(/["']([^"']+)["']/g)) {
      const name = m[1].match(/^([A-Za-z0-9_.\-]+)/);
      if (name) runtime.push(name[1].toLowerCase());
    }
  }
  // PEP 621 optional-dependencies (treat each group as dev for our purposes)
  const optBlock = content.match(/\[project\.optional-dependencies\]([\s\S]*?)(?=\n\[|$)/);
  if (optBlock && optBlock[1]) {
    for (const m of optBlock[1].matchAll(/["']([^"']+)["']/g)) {
      const name = m[1].match(/^([A-Za-z0-9_.\-]+)/);
      if (name) dev.push(name[1].toLowerCase());
    }
  }

  // Poetry: [tool.poetry.dependencies] / [tool.poetry.dev-dependencies] /
  // [tool.poetry.group.dev.dependencies]. Each line under the table is
  // `name = "version"` or `name = { ... }`.
  const poetrySections = [
    { re: /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/, bucket: runtime },
    { re: /\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?=\n\[|$)/, bucket: dev },
    { re: /\[tool\.poetry\.group\.[^\]]+\.dependencies\]([\s\S]*?)(?=\n\[|$)/g, bucket: dev },
  ];
  for (const { re, bucket } of poetrySections) {
    const matches = typeof re.exec === 'function' && !(re as RegExp).global
      ? [content.match(re as RegExp)].filter(Boolean) as RegExpMatchArray[]
      : [...content.matchAll(re as RegExp)];
    for (const sec of matches) {
      const body = sec?.[1] ?? '';
      for (const lineMatch of body.matchAll(/^\s*([A-Za-z0-9_\-]+)\s*=/gm)) {
        const name = lineMatch[1].toLowerCase();
        if (name === 'python') continue; // not a package
        bucket.push(name);
      }
    }
  }

  return { runtime, dev };
}
