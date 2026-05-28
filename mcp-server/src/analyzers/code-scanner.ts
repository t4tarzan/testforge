import { glob } from 'glob';
import { readFileSync, existsSync, statSync } from 'fs';
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
    /** Files skipped because they exceeded the per-file size cap (generated/
     *  minified/data blobs). They aren't analyzable source. */
    skippedLargeFiles?: number;
    /** True if the total source budget was hit and later files were not read
     *  into memory — the analysis is partial-but-honest, not a crash. */
    analysisTruncated?: boolean;
  };
}

// File extensions the analyzer parses natively (regex-based, AST-based, or
// both depending on dimension).
const NATIVE_EXTS = new Set(['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'py', 'go']);

// Source-code extensions we'll count even though we don't natively parse
// them. Used purely to compute language coverage — the bigger this list,
// the more honest the "we only analyzed N%" warning is for polyglot repos.
const UNSUPPORTED_EXT_TO_LANG: Record<string, string> = {
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
    '**/*.{ts,js,tsx,jsx,mjs,cjs,mts,cts,py,go,yaml,yml,json,toml,md}',
    '**/{Dockerfile,Procfile,CODEOWNERS,requirements.txt,requirements-dev.txt,Pipfile,go.mod,go.sum}',
    '**/.github/**/*',
    '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**',
    '!**/.next/**', '!**/coverage/**', '!**/__pycache__/**', '!**/.venv/**',
    '!**/venv/**', '!**/.tox/**', '!**/.pytest_cache/**',
    '!**/vendor/**',  // Go's go.mod vendor dir
    '!**/package-lock.json', '!**/yarn.lock', '!**/pnpm-lock.yaml', '!**/poetry.lock', '!**/go.sum',
  ];
  const files = await glob(patterns, { cwd: projectPath, absolute: false, dot: true });

  // 2. Read each file, count lines, extract function names.
  //
  // Memory guards (added after microsoft/TypeScript OOM-crashed a 2 GB host):
  // every file's content is held in `fileContents` AND later parsed into an
  // AST that's held simultaneously, so an unbounded read on a mega-repo blows
  // the heap. We (a) skip individual files over MAX_FILE_BYTES (generated /
  // minified / data blobs — not analyzable source), and (b) stop reading once
  // the total content budget is hit, marking the analysis truncated rather
  // than crashing. statSync first so we never read a huge file just to drop it.
  // Total source held in memory is what drives the V8 heap (every stored file
  // is also AST'd and the ASTs are held together for cross-file analysis).
  // 50 MB / 8000 files fits a 2 GB host's default heap. A bigger box raises
  // these via env (the managed VPS sets a higher cap + --max-old-space-size).
  // Hitting any cap → honest truncation, never an OOM crash.
  const MAX_FILE_BYTES = Number(process.env.TESTFORGE_MAX_FILE_BYTES) || 1_000_000;
  const MAX_TOTAL_BYTES = Number(process.env.TESTFORGE_MAX_TOTAL_BYTES) || 50_000_000;
  const MAX_FILES = Number(process.env.TESTFORGE_MAX_FILES) || 8_000;
  let totalBytes = 0;
  let storedFiles = 0;
  let skippedLargeFiles = 0;
  let analysisTruncated = false;

  const fileInfos: Array<{ path: string; lines: number }> = [];
  const fileContents: Record<string, string> = {};
  const functions: Record<string, string[]> = {};

  for (const f of files) {
    const fullPath = join(projectPath, f);
    try {
      let size = 0;
      try { size = statSync(fullPath).size; } catch { continue; }
      if (size > MAX_FILE_BYTES) { skippedLargeFiles++; continue; }
      if (totalBytes + size > MAX_TOTAL_BYTES || storedFiles >= MAX_FILES) { analysisTruncated = true; continue; }
      const content = readFileSync(fullPath, 'utf-8');
      totalBytes += size;
      storedFiles++;
      const lines = content.split('\n').length;
      fileInfos.push({ path: f, lines });
      fileContents[f] = content;

      // Function-name extraction: JS/TS vs Python vs Go vs skip
      const ext = extOf(f);
      let fnNames: string[] = [];
      if (ext === 'py') {
        fnNames = extractPyFunctionNames(content);
      } else if (ext === 'go') {
        fnNames = extractGoFunctionNames(content);
      } else if (NATIVE_EXTS.has(ext)) {
        fnNames = extractJsFunctionNames(content);
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

    if (ext === 'go') {
      // Gin / Echo / Chi / Gorilla Mux / Fiber — all use
      // `<router>.<METHOD>("/path", handler)`. Examples:
      //   r.GET("/users", h)        (Gin, Echo)
      //   router.HandleFunc("/x", h).Methods("GET")  (Gorilla)
      //   app.Get("/x", h)          (Fiber)
      // Verbs vary by case (Go community is title-case). We match
      // both cases anchored to a string-arg call to keep this tight.
      const ginEchoChiFiber = content.match(
        /\.(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Get|Post|Put|Delete|Patch|Head|Options|Handle|HandleFunc)\s*\(\s*"[^"]*"/g
      );
      if (ginEchoChiFiber) endpointCount += ginEchoChiFiber.length;
      // net/http stdlib: http.HandleFunc("/path", h) / mux.HandleFunc(...)
      const stdHttp = content.match(/\bhttp\.HandleFunc\s*\(\s*"[^"]*"/g);
      if (stdHttp) endpointCount += stdHttp.length;
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
  //
  //    Monorepos (uv workspaces / npm/yarn/bun/pnpm workspaces) are
  //    recursed: a root manifest that only declares workspace members
  //    typically has no runtime deps itself, so we follow each member
  //    and pull its manifest too. Without this, modern templates like
  //    tiangolo/full-stack-fastapi-template would report `dependencies:
  //    0, techStack: []` even though all the real deps live in
  //    backend/pyproject.toml and frontend/package.json.
  let dependencies: string[] = [];
  let devDependencies: string[] = [];
  const techStack: string[] = [];

  // Discover workspace members (paths relative to projectPath). Always
  // includes '' (the root itself) so we read root manifests too.
  // Conventional-monorepo discovery covers projects that don't declare
  // workspaces at root but still nest sub-packages under known directories
  // (LangChain ships `libs/<each-package>/pyproject.toml`; many JS repos
  // use `packages/<name>/package.json` without a workspaces field).
  const pyMemberDirs = [
    '',
    ...(await discoverUvWorkspaceMembers(projectPath)),
    ...(await discoverConventionalMembers(projectPath, 'pyproject.toml')),
  ];
  const nodeMemberDirs = [
    '',
    ...(await discoverNodeWorkspaceMembers(projectPath)),
    ...(await discoverConventionalMembers(projectPath, 'package.json')),
  ];
  // Same convention applies to requirements.txt subdirs.
  const reqSubdirs = [
    'backend', 'server', 'api',
    ...(await discoverConventionalMembers(projectPath, 'requirements.txt')),
  ];

  // 4a. Node — package.json across root + every workspace member.
  for (const subdir of nodeMemberDirs) {
    try {
      const pkgPath = join(projectPath, subdir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      dependencies.push(...Object.keys(pkg.dependencies || {}));
      devDependencies.push(...Object.keys(pkg.devDependencies || {}));
      // peerDependencies often signal the framework being targeted
      // (React/Vue/Svelte) — count them as runtime so techStack tagging
      // catches them.
      dependencies.push(...Object.keys(pkg.peerDependencies || {}));
    } catch {
      // file absent / malformed — fine
    }
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
  // Also check requirements.txt across known subdirs (backend / server /
  // api covers the dclaw-monitor pattern; libs/* / packages/* / apps/* /
  // services/* via discoverConventionalMembers above).
  for (const subdir of reqSubdirs) {
    try {
      const content = readFileSync(join(projectPath, subdir, 'requirements.txt'), 'utf-8');
      dependencies.push(...parsePyRequirements(content));
    } catch {
      // skip
    }
  }

  // 4c. Python — pyproject.toml across root + every uv workspace member.
  //     Handles PEP 621 [project], Poetry [tool.poetry.*], and PEP 735
  //     [dependency-groups] (which the tiangolo full-stack template uses
  //     at the root for dev tooling).
  for (const subdir of pyMemberDirs) {
    try {
      const content = readFileSync(join(projectPath, subdir, 'pyproject.toml'), 'utf-8');
      const { runtime, dev } = parsePyProjectToml(content);
      dependencies.push(...runtime);
      devDependencies.push(...dev);
    } catch {
      // No pyproject.toml at this member — fine
    }
  }

  // 4d. Go — go.mod at root + every conventional member. The module path
  //     itself isn't a dep; we extract `require` block entries. Each entry
  //     is full module path (`github.com/gin-gonic/gin v1.10.0`) — we
  //     normalize to the short package name (last path segment) so the
  //     tech-stack tagger can match it ("gin" instead of full path).
  const goMemberDirs = [
    '',
    ...(await discoverConventionalMembers(projectPath, 'go.mod')),
  ];
  for (const subdir of goMemberDirs) {
    try {
      const content = readFileSync(join(projectPath, subdir, 'go.mod'), 'utf-8');
      dependencies.push(...parseGoMod(content));
    } catch {
      // No go.mod at this member — fine
    }
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
  if (all.includes('playwright') || all.includes('@playwright/test')) techStack.push('Playwright');
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
  // Go stacks. go.mod entries arrive as short package names
  // (`gin`, `echo`, `chi`, `fiber`, `mux`, `cobra`, `viper`, etc.) via
  // parseGoMod() which strips the module path down to the last segment.
  if (all.includes('gin')) techStack.push('Gin');
  if (all.includes('echo')) techStack.push('Echo');
  if (all.includes('chi')) techStack.push('Chi');
  if (all.includes('fiber')) techStack.push('Fiber');
  if (all.includes('mux')) techStack.push('Gorilla Mux');
  if (all.includes('gorm') || all.includes('sqlx')) techStack.push('GORM/sqlx');
  if (all.includes('cobra')) techStack.push('Cobra');
  if (all.includes('viper')) techStack.push('Viper');
  if (all.includes('grpc-go') || all.includes('grpc')) techStack.push('gRPC');
  if (all.includes('zap') || all.includes('zerolog') || all.includes('logrus')) techStack.push('Structured Go logging');
  if (all.includes('testify') || all.includes('ginkgo')) techStack.push('Go testing (testify/ginkgo)');
  if (all.includes('pgx') || all.includes('pq')) techStack.push('PostgreSQL');

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
      skippedLargeFiles,
      analysisTruncated,
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
 * Extract function names from Go source. Matches both:
 *   - `func Name(...) ...` (package-level)
 *   - `func (r *Receiver) Name(...) ...` (methods)
 * Captures the name token after `func` or after the receiver group.
 */
function extractGoFunctionNames(content: string): string[] {
  const names: string[] = [];
  // Package-level + methods. The receiver `(r *T)` is optional.
  const re = /^\s*func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([A-Za-z_]\w*)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]);
  }
  return [...new Set(names)];
}

/**
 * Parse `require` blocks out of a go.mod file. Handles both:
 *   require github.com/foo/bar v1.0.0
 *   require (
 *     github.com/foo/bar v1.0.0
 *     github.com/baz/qux v2.0.0
 *   )
 * Returns the SHORT package name (last path segment) lowercased, e.g.
 * `gin`, `echo`, `chi`. This matches our existing tech-stack tagging
 * convention (which checks short names) and avoids needing to maintain a
 * full module-path→tag mapping. Indirect deps (// indirect) are skipped.
 */
function parseGoMod(content: string): string[] {
  const names: string[] = [];
  const lines = content.split('\n');
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('module ') || line.startsWith('go ') || line.startsWith('toolchain ')) continue;

    if (line.startsWith('require (')) { inBlock = true; continue; }
    if (inBlock && line === ')') { inBlock = false; continue; }

    let body = '';
    if (inBlock) {
      body = line;
    } else if (line.startsWith('require ')) {
      body = line.slice('require '.length).trim();
    } else {
      continue;
    }

    // Skip `// indirect` deps to focus on what the project actively uses.
    if (body.includes('// indirect')) continue;
    // body looks like: "github.com/foo/bar v1.0.0" — first token is path
    const path = body.split(/\s+/)[0];
    if (!path) continue;
    // Short name = last path segment, lowercased. Strip "v\d+" major-version
    // suffix that some modules append (`gopkg.in/foo.v2` → `foo.v2`; keep
    // it for now since it's still a stable identifier).
    const short = path.split('/').pop()!.toLowerCase();
    // Skip "v\d+" path-only segments (modules sometimes end in /v2, /v3 for
    // semantic-import-versioning); take the previous segment instead.
    if (/^v\d+$/.test(short)) {
      const parts = path.split('/');
      const prev = parts[parts.length - 2];
      if (prev) names.push(prev.toLowerCase());
    } else {
      names.push(short);
    }
  }
  return names;
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
    const nameMatch = line.match(/^([A-Za-z0-9_.-]+)/);
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

  // PEP 621: dependencies = ["fastapi>=0.110", "pydantic[extra]>=2"]
  // The naive non-greedy `\[([\s\S]*?)\]` terminates at the FIRST `]`,
  // which is wrong for entries with [extras] like `fastapi[standard]`.
  // Use a string-aware bracket scan instead.
  const pep621Body = extractTomlArrayBody(content, 'dependencies');
  if (pep621Body) {
    for (const m of pep621Body.matchAll(/["']([^"']+)["']/g)) {
      const name = m[1].match(/^([A-Za-z0-9_.-]+)/);
      if (name) runtime.push(name[1].toLowerCase());
    }
  }
  // PEP 621 optional-dependencies (treat each group as dev for our purposes)
  const optBlock = content.match(/\[project\.optional-dependencies\]([\s\S]*?)(?=\n\[|$)/);
  if (optBlock && optBlock[1]) {
    for (const m of optBlock[1].matchAll(/["']([^"']+)["']/g)) {
      const name = m[1].match(/^([A-Za-z0-9_.-]+)/);
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
      for (const lineMatch of body.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)) {
        const name = lineMatch[1].toLowerCase();
        if (name === 'python') continue; // not a package
        bucket.push(name);
      }
    }
  }

  // PEP 735: [dependency-groups] table with named arrays
  //   [dependency-groups]
  //   dev = ["pytest>=8", "mypy"]
  //   docs = [...]
  //
  // Every named group is treated as dev for our purposes — they're
  // tooling groups (dev / test / docs / lint / typecheck), not runtime
  // deps. The tiangolo full-stack-fastapi-template root pyproject.toml
  // uses exactly this shape for `zizmor` and `smokeshow`.
  const depGroupsBlock = content.match(/^\s*\[dependency-groups\]([\s\S]*?)(?=^\s*\[|$(?![\s\S]))/m);
  if (depGroupsBlock && depGroupsBlock[1]) {
    // Find each `name = [` inside the block. Use the string-aware
    // extractor for the same `fastapi[standard]` reason as PEP 621.
    for (const keyM of depGroupsBlock[1].matchAll(/^\s*([A-Za-z0-9_-]+)\s*=\s*\[/gm)) {
      const groupName = keyM[1];
      const body = extractTomlArrayBody(depGroupsBlock[1], groupName);
      if (!body) continue;
      for (const m of body.matchAll(/["']([^"']+)["']/g)) {
        const name = m[1].match(/^([A-Za-z0-9_.-]+)/);
        if (name) dev.push(name[1].toLowerCase());
      }
    }
  }

  return { runtime, dev };
}

/**
 * Extract the body of a TOML array assigned to `key`, returning the text
 * between the `[` and its matching `]`. String-aware: brackets inside
 * single- or double-quoted strings (e.g. `"fastapi[standard]"`) are
 * skipped. Returns null if the key isn't found.
 *
 * The previous non-greedy regex (`key\s*=\s*\[([\s\S]*?)\]`) silently
 * truncated arrays at the first `]` inside the first entry's extras
 * marker, which broke parsing of any real-world Python project using
 * `pkg[extra]` syntax (fastapi/sqlalchemy/psycopg/etc.).
 */
function extractTomlArrayBody(content: string, key: string): string | null {
  const re = new RegExp(`^\\s*${key}\\s*=\\s*\\[`, 'm');
  const m = re.exec(content);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  let inStr = false;
  let strCh = '';
  while (i < content.length) {
    const c = content[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === strCh) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
    } else if (c === '[') {
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0) return content.slice(start, i);
    }
    i++;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                          Workspace recursion                                */
/* -------------------------------------------------------------------------- */

/**
 * Discover uv workspace members. Reads `[tool.uv.workspace] members = [...]`
 * from the root pyproject.toml. Members are subdirectory names; uv supports
 * globs but the common case is an explicit list. Returns relative paths
 * (no leading slash); empty array if none.
 */
async function discoverUvWorkspaceMembers(rootPath: string): Promise<string[]> {
  let content: string;
  try {
    content = readFileSync(join(rootPath, 'pyproject.toml'), 'utf-8');
  } catch {
    return [];
  }
  const block = content.match(/\[tool\.uv\.workspace\]([\s\S]*?)(?=\n\[|$)/);
  if (!block) return [];
  const membersLine = block[1].match(/members\s*=\s*\[([\s\S]*?)\]/);
  if (!membersLine) return [];
  const out = new Set<string>();
  for (const m of membersLine[1].matchAll(/["']([^"']+)["']/g)) {
    const pattern = m[1];
    if (pattern.includes('*')) {
      // uv supports globs; expand them.
      try {
        const matches = await glob(pattern, { cwd: rootPath, absolute: false });
        for (const x of matches) out.add(x);
      } catch {
        // skip bad pattern
      }
    } else {
      out.add(pattern);
    }
  }
  return [...out];
}

// Common monorepo directories where each subdir often holds its own
// pyproject.toml / package.json / requirements.txt WITHOUT a workspace
// declaration at the project root. LangChain ships its packages under
// `libs/`; many JS repos use `packages/` or `apps/`; microservice
// templates use `services/`. Order doesn't matter — we dedupe in the
// returned Set.
const CONVENTIONAL_MONOREPO_DIRS = ['libs', 'packages', 'apps', 'services'];

/**
 * Look for `<dir>/*\/<manifest>` matches under the well-known monorepo
 * directory names. Returns the relative parent dirs (e.g. `libs/langchain`)
 * that actually contain the manifest. Skips one-level only — we don't
 * recurse into nested monorepos.
 */
async function discoverConventionalMembers(rootPath: string, manifest: string): Promise<string[]> {
  const out = new Set<string>();
  for (const dir of CONVENTIONAL_MONOREPO_DIRS) {
    try {
      const matches = await glob(`${dir}/*/${manifest}`, {
        cwd: rootPath,
        absolute: false,
        ignore: [
          '**/node_modules/**', '**/.venv/**', '**/venv/**', '**/__pycache__/**',
          '**/.git/**', '**/dist/**', '**/build/**',
        ],
      });
      for (const m of matches) {
        // m is like `libs/langchain/pyproject.toml` — strip the manifest
        // suffix to get the member directory.
        out.add(m.slice(0, -(manifest.length + 1)));
      }
    } catch {
      // skip bad pattern
    }
  }
  return [...out];
}

/**
 * Discover Node workspace members (npm / yarn / bun / pnpm). Reads either:
 *   - `"workspaces": ["packages/*", ...]` from root package.json (npm/yarn/bun)
 *   - `"workspaces": { "packages": [...] }` (rarer object form)
 *   - `pnpm-workspace.yaml` with top-level `packages:` list
 * Patterns can be globs; results are unique subdirectory paths that
 * actually contain a package.json. Empty array if no workspace declared.
 */
async function discoverNodeWorkspaceMembers(rootPath: string): Promise<string[]> {
  const patterns: string[] = [];

  // package.json "workspaces"
  try {
    const pkg = JSON.parse(readFileSync(join(rootPath, 'package.json'), 'utf-8'));
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) patterns.push(...ws);
    else if (ws && typeof ws === 'object' && Array.isArray(ws.packages)) patterns.push(...ws.packages);
  } catch {
    // no/invalid root package.json — fine
  }

  // pnpm-workspace.yaml
  try {
    const yaml = await import('js-yaml');
    const content = readFileSync(join(rootPath, 'pnpm-workspace.yaml'), 'utf-8');
    const parsed = yaml.load(content) as { packages?: string[] } | null;
    if (parsed && Array.isArray(parsed.packages)) patterns.push(...parsed.packages);
  } catch {
    // file absent / parse error — fine
  }

  if (patterns.length === 0) return [];

  const out = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Glob expansion. Use the glob package to expand the pattern, then
      // filter to those that have a package.json (a workspace pattern can
      // legally match directories without package.json — we skip those).
      try {
        const matches = await glob(pattern, {
          cwd: rootPath,
          absolute: false,
          dot: false,
        });
        for (const m of matches) {
          try {
            readFileSync(join(rootPath, m, 'package.json'), 'utf-8');
            out.add(m);
          } catch {
            // not a real workspace package
          }
        }
      } catch {
        // skip bad pattern
      }
    } else {
      // literal path
      try {
        readFileSync(join(rootPath, pattern, 'package.json'), 'utf-8');
        out.add(pattern);
      } catch {
        // skip — listed but missing
      }
    }
  }
  return [...out];
}
