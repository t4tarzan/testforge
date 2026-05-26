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
}

/**
 * Scan a project directory and extract structural information.
 * Uses real file system operations — this runs locally on the user's machine.
 */
export async function scanCodebase(projectPath: string): Promise<CodebaseInfo> {
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  // 1. Find all source files. Spec/config files (yaml/yml/json) are
  //    included so the contract analyzer can parse OpenAPI/Swagger.
  //    Extensionless config files (Dockerfile, CODEOWNERS, Procfile) are
  //    matched explicitly. `.github/` is hidden but its contents are
  //    needed for the DORA dimension — glob's `dot:true` lets us see it.
  //    We skip package-lock.json and similar large generated artifacts
  //    via separate exclude patterns below.
  const patterns = [
    '**/*.{ts,js,tsx,jsx,mjs,cjs,mts,cts,yaml,yml,json,md}',
    '**/{Dockerfile,Procfile,CODEOWNERS}',
    '**/.github/**/*',
    '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**',
    '!**/.next/**', '!**/coverage/**',
    '!**/package-lock.json', '!**/yarn.lock', '!**/pnpm-lock.yaml',
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

      // Extract function names (heuristic: look for function declarations, arrow functions, method definitions)
      const fnNames = extractFunctionNames(content);
      if (fnNames.length > 0) {
        functions[f] = fnNames;
      }
    } catch {
      // Skip unreadable files
    }
  }

  // 3. Count endpoints and middleware (heuristic: look for route patterns)
  let endpointCount = 0;
  let middlewareCount = 0;
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;

    // Match patterns like router.get('/path'), app.post('/path'), etc.
    const routeMatches = content.match(/\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`][^'"`]*['"`]/g);
    if (routeMatches) endpointCount += routeMatches.length;

    // Match middleware patterns: app.use(...)
    const middlewareMatches = content.match(/\.(use)\s*\(/g);
    if (middlewareMatches) middlewareCount += middlewareMatches.length;

    // Also match Fastify patterns: fastify.get('/path', ...)
    const fastifyRouteMatches = content.match(/fastify\.(get|post|put|delete|patch|head|options)\s*\(/g);
    if (fastifyRouteMatches) endpointCount += fastifyRouteMatches.length;

    // Match Express Router patterns
    const routerRouteMatches = content.match(/router\.(get|post|put|delete|patch|head|options)\s*\(/g);
    if (routerRouteMatches) endpointCount += routerRouteMatches.length;
  }

  // 4. Parse package.json
  let dependencies: string[] = [];
  let devDependencies: string[] = [];
  const techStack: string[] = [];
  try {
    const pkgPath = join(projectPath, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    dependencies = Object.keys(pkg.dependencies || {});
    devDependencies = Object.keys(pkg.devDependencies || {});

    // Detect tech stack from dependencies
    const all = [...dependencies, ...devDependencies];
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
  } catch {
    // No package.json — maybe not a Node project
  }

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
  };
}

/**
 * Extract function names from JavaScript/TypeScript source code.
 * Heuristic — not a full AST parse, but good enough for analysis.
 */
function extractFunctionNames(content: string): string[] {
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
