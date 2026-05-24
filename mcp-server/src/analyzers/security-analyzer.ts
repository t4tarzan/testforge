import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  id?: string;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  codeSnippet: string;
  fixSuggestion: string;
  category: string;
}

interface SecurityConfig {
  projectPath: string;
  fileContents: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

/**
 * Run security analysis on the codebase.
 * Uses regex-based pattern matching to detect common vulnerabilities.
 * This runs entirely locally — no code ever leaves the machine.
 */
export async function runSecurityAnalysis(config: SecurityConfig): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const allDeps = [...config.dependencies, ...config.devDependencies];

  // Ensure we have file contents to analyze
  let fileContents = config.fileContents;
  if (!fileContents || Object.keys(fileContents).length === 0) {
    fileContents = await loadFileContents(config.projectPath);
  }

  const files = Object.entries(fileContents);

  for (const [filePath, content] of files) {
    const lines = content.split('\n');

    // 1. SQL Injection
    checkSqlInjection(lines, filePath, findings);

    // 2. Authentication Bypass
    checkAuthBypass(lines, filePath, findings);

    // 3. XSS (Cross-Site Scripting)
    checkXSS(lines, filePath, findings);

    // 4. Sensitive Data Exposure
    checkSensitiveDataExposure(lines, filePath, findings);

    // 5. CORS Misconfiguration
    checkCORSMisconfiguration(lines, filePath, findings);

    // 6. Hardcoded Secrets
    checkHardcodedSecrets(lines, filePath, findings);

    // 7. Insecure Direct Object References
    checkIDOR(lines, filePath, findings);

    // 8. Path Traversal
    checkPathTraversal(lines, filePath, findings);

    // 9. eval() / new Function() usage
    checkDangerousFunctions(lines, filePath, findings);

    // 10. Unvalidated Redirects
    checkUnvalidatedRedirects(lines, filePath, findings);
  }

  // 11. Missing Rate Limiting (project-level check)
  checkMissingRateLimit(allDeps, findings, config.projectPath);

  // 12. Insecure Dependencies (project-level check)
  checkInsecureDependencies(allDeps, findings);

  // 13. Missing Security Headers (project-level check)
  checkMissingSecurityHeaders(fileContents, findings);

  // Deduplicate findings by (title + filePath + lineNumber)
  const seen = new Set<string>();
  const deduped = findings.filter((f) => {
    const key = `${f.title}|${f.filePath}|${f.lineNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}

/* -------------------------------------------------------------------------- */
/*                              Check Functions                               */
/* -------------------------------------------------------------------------- */

function checkSqlInjection(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /\.\s*(find|findOne|findMany|query|exec|raw|execute)\s*\([^)]*[\+`$]/, title: 'Potential SQL/NoSQL Injection', desc: 'User input may be concatenated directly into a database query.' },
    { regex: /(?:query|execute|raw)\s*\(\s*(?:`[^`]*\$\{|[^)]*\+[^)]*\+[^)]*)/, title: 'String Concatenation in DB Query', desc: 'Database query uses string concatenation or template literals with variables.' },
    { regex: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+.*\+/, title: 'SQL Query String Concatenation', desc: 'SQL query built via string concatenation — vulnerable to injection.' },
    { regex: /db\.[\w]+\s*\(\s*\{.*\$where\s*:/, title: 'NoSQL $where Injection', desc: 'Using $where operator with user input in MongoDB query.' },
    { regex: /\$\{[^}]*\w+[^(]?\}.*\b(?:query|find|select)\b/, title: 'Template Literal in DB Query', desc: 'Template literal used in database query construction.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'critical',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Use parameterized queries (prepared statements) or an ORM. Never concatenate user input into SQL/NoSQL queries.',
          category: 'SQL Injection',
        });
        break; // One finding per line max
      }
    }
  }
}

function checkAuthBypass(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /(?:router|app|fastify)\.(get|post|put|delete|patch)\s*\([^)]*\)\s*,?\s*(?!.*auth)(?!.*middleware)/, title: 'Route Without Auth Middleware', desc: 'Route handler does not appear to use authentication middleware.' },
    { regex: /(?:req\.user|req\.session)\s*===?\s*(?:undefined|null)\s*\?\s*(?:next|res\.)/, title: 'Manual Auth Check with Early Return', desc: 'Authentication check may be bypassed due to incomplete validation.' },
    { regex: /if\s*\(\s*!req\.(user|session|isAuthenticated)/, title: 'Conditional Auth Check', desc: 'Route has conditional authentication that may be bypassed.' },
    { regex: /passport\.(authenticate)\s*\(\s*['"]jwt['"]\s*\)\s*,?\s*\(?\s*\)?\s*=>/, title: 'JWT Auth Route', desc: 'Route uses JWT authentication — verify token expiration and secret handling.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        // Skip test files and type definitions
        if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.endsWith('.d.ts')) continue;
        findings.push({
          severity: 'high',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Add authentication middleware (e.g., passport.authenticate, custom auth middleware) to all protected routes. Ensure consistent auth enforcement.',
          category: 'Authentication Bypass',
        });
        break;
      }
    }
  }
}

function checkXSS(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /res\.(send|json|render|write)\s*\(\s*(?:req\.(body|query|params)|.*\+.*req\.)/, title: 'Unsanitized User Input in Response', desc: 'User input is reflected in the response without sanitization.' },
    { regex: /innerHTML\s*=\s*(?:req\.|[^'"]*\+[^'"]*req\.)/, title: 'innerHTML with User Input', desc: 'Setting innerHTML with user-controlled data enables XSS attacks.' },
    { regex: /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*(?:req\.|[^}]*req\.)/, title: 'dangerouslySetInnerHTML with User Input', desc: 'React dangerouslySetInnerHTML used with potentially untrusted content.' },
    { regex: /eval\s*\(\s*(?:req\.|[^)]*req\.)/, title: 'eval() with User Input', desc: 'User input passed to eval() — critical XSS vulnerability.' },
    { regex: /document\.(write|writeln)\s*\(\s*(?:req\.|location|[^)]*req\.)/, title: 'document.write with User Input', desc: 'document.write with user input enables DOM-based XSS.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'high',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Sanitize all user input before rendering. Use libraries like DOMPurify for HTML, escape output with template engines, or use React/Vue built-in escaping.',
          category: 'XSS',
        });
        break;
      }
    }
  }
}

function checkSensitiveDataExposure(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /res\.json\s*\(\s*\{[^}]*password/, title: 'Password Field in API Response', desc: 'Password or hash returned in API response — sensitive data exposure.' },
    { regex: /res\.json\s*\(\s*\{[^}]*secret/, title: 'Secret in API Response', desc: 'Secret or key returned in API response.' },
    { regex: /res\.json\s*\(\s*\{[^}]*token/, title: 'Token in API Response', desc: 'Authentication token returned alongside other user data.' },
    { regex: /console\.(log|warn|error)\s*\(.*(?:password|secret|token|key)/, title: 'Sensitive Data in Logs', desc: 'Sensitive values logged to console.' },
    { regex: /\.select\s*\(\s*['"]`?[^'"`]*['"`]*\)/, title: 'Database Field Selection', desc: 'Verify that password fields are excluded from select queries.' },
    { regex: /return\s+\{[^}]*password[^}]*\}/, title: 'Password in Return Object', desc: 'Password field included in returned object.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'high',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Exclude sensitive fields (password, secret, token) from API responses. Use projection/select to omit fields from DB queries. Never log sensitive data.',
          category: 'Sensitive Data Exposure',
        });
        break;
      }
    }
  }
}

function checkCORSMisconfiguration(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /cors\s*\(\s*\{\s*origin\s*:\s*['"]\*['"]/, title: 'CORS Allowing All Origins', desc: 'CORS is configured to allow requests from any origin (origin: "*").' },
    { regex: /cors\s*\(\s*\)/, title: 'CORS with Default Config', desc: 'CORS middleware used without configuration — may allow all origins depending on version.' },
    { regex: /Access-Control-Allow-Origin\s*:\s*\*/, title: 'Wildcard CORS Header', desc: 'Response header allows any origin.' },
    { regex: /credentials\s*:\s*true[^,]*,?[^}]*origin\s*:\s*['"]\*['"]/, title: 'CORS Credentials with Wildcard Origin', desc: 'Using credentials: true with wildcard origin is invalid and dangerous.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'medium',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Configure CORS with explicit allowed origins. Use environment variables for origin whitelist. Never use origin: "*" with credentials: true.',
          category: 'CORS Misconfiguration',
        });
        break;
      }
    }
  }
}

function checkHardcodedSecrets(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i, title: 'Hardcoded API Key', desc: 'Potential hardcoded API key detected in source code.' },
    { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/i, title: 'Hardcoded Password', desc: 'Potential hardcoded password detected in source code.' },
    { regex: /(?:secret|private[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_\-/+]{20,}['"]/i, title: 'Hardcoded Secret/Private Key', desc: 'Potential hardcoded secret or private key.' },
    { regex: /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i, title: 'Hardcoded Bearer Token', desc: 'Hardcoded bearer token found in source.' },
    { regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/, title: 'AWS Access Key ID', desc: 'AWS access key ID pattern detected.' },
    { regex: /ghp_[a-zA-Z0-9]{36}/, title: 'GitHub Personal Access Token', desc: 'GitHub personal access token pattern found.' },
    { regex: /gho_[a-zA-Z0-9]{36}/, title: 'GitHub OAuth Token', desc: 'GitHub OAuth token pattern found.' },
    { regex: /sk-[a-zA-Z0-9]{20,}/, title: 'Potential API Secret Key', desc: 'API secret key pattern detected (e.g., Stripe, OpenAI).' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        // Skip environment variable defaults that are obviously placeholders
        if (line.includes('process.env.') || line.includes('process?.env')) continue;
        // Skip config files that reference env vars
        if (line.includes('${') && line.includes('}')) continue;

        findings.push({
          severity: 'critical',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Move secrets to environment variables (.env file). Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler). Never commit secrets to version control.',
          category: 'Hardcoded Secrets',
        });
        break;
      }
    }
  }
}

function checkIDOR(lines: string[], filePath: string, findings: SecurityFinding[]) {
  // Check for routes that access resources by ID without ownership verification
  const patterns = [
    { regex: /(?:get|find|findOne|findUnique)\s*\(\s*\{[^}]*id\s*:\s*(?:req\.(params|body|query)\.(id|userId))/, title: 'Potential IDOR — No Ownership Check', desc: 'Resource accessed by ID without verifying the requesting user owns it.' },
    { regex: /(?:delete|remove|destroy)\s*\(\s*\{[^}]*id\s*:\s*(?:req\.(params|body|query)\.(id|userId))/, title: 'Potential IDOR on Delete', desc: 'Delete operation by ID without ownership verification — IDOR vulnerability.' },
    { regex: /(?:update|patch|put)\s*\(\s*\{[^}]*where\s*:\s*\{[^}]*id\s*:\s*(?:req\.(params|body|query))/, title: 'Potential IDOR on Update', desc: 'Update operation by ID without verifying ownership.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'high',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Verify resource ownership before every read/update/delete. Add a WHERE clause with userId or check req.user.id matches resource.ownerId.',
          category: 'IDOR',
        });
        break;
      }
    }
  }
}

function checkPathTraversal(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /(?:readFile|readFileSync|createReadStream|sendFile)\s*\(\s*(?:req\.(body|params|query)|.*\+.*req\.)/, title: 'Path Traversal Risk', desc: 'File path constructed from user input without sanitization.' },
    { regex: /path\.(join|resolve)\s*\([^)]*(?:req\.(body|params|query)|.*\+.*req\.)/, title: 'Path Traversal via path.join', desc: 'User input used in path construction.' },
    { regex: /fs\.(?:readFile|readFileSync)\s*\(\s*[^)]*\+/, title: 'Dynamic File Path', desc: 'File path built via string concatenation — may allow directory traversal.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'high',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Sanitize file paths with path.normalize(), validate against an allowlist, and use a dedicated upload directory. Never use raw user input as a file path.',
          category: 'Path Traversal',
        });
        break;
      }
    }
  }
}

function checkDangerousFunctions(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /(?<!\w)eval\s*\(/, title: 'Dangerous eval() Usage', desc: 'eval() executes arbitrary code and is extremely dangerous.' },
    { regex: /new\s+Function\s*\(/, title: 'Dangerous Function Constructor', desc: 'new Function() creates functions from strings — arbitrary code execution risk.' },
    { regex: /child_process\.(exec|execSync)\s*\(/, title: 'Command Execution', desc: 'Shell command execution detected — potential command injection.' },
    { regex: /setTimeout\s*\(\s*['"`]/, title: 'String in setTimeout', desc: 'setTimeout with string argument is similar to eval().' },
    { regex: /setInterval\s*\(\s*['"`]/, title: 'String in setInterval', desc: 'setInterval with string argument is similar to eval().' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'critical',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Avoid eval() and new Function(). Use JSON.parse() for JSON, use safe alternatives for dynamic code. For command execution, use execFile() or spawn() with arrays instead of string commands.',
          category: 'Dangerous Functions',
        });
        break;
      }
    }
  }
}

function checkUnvalidatedRedirects(lines: string[], filePath: string, findings: SecurityFinding[]) {
  const patterns = [
    { regex: /res\.redirect\s*\(\s*(?:req\.(query|body|params)\.(?:redirect|url|to|next)|[^)]*req\.)/, title: 'Unvalidated Redirect', desc: 'Redirect URL from user input — open redirect vulnerability.' },
    { regex: /(?:window|document)\.location\s*=\s*(?:req\.|location\.(?:href|search)|[^'"]*req\.)/, title: 'Client-Side Open Redirect', desc: 'Client-side redirect using user-controlled URL.' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      if (p.regex.test(line)) {
        findings.push({
          severity: 'medium',
          title: p.title,
          description: p.desc,
          filePath,
          lineNumber: i + 1,
          codeSnippet: line.trim().slice(0, 120),
          fixSuggestion: 'Validate redirect URLs against an allowlist. Only redirect to known, trusted domains. Prefer internal route names over URL parameters.',
          category: 'Open Redirect',
        });
        break;
      }
    }
  }
}

function checkMissingRateLimit(allDeps: string[], findings: SecurityFinding[], projectPath: string) {
  const hasRateLimit = allDeps.some(d =>
    d.includes('rate-limit') || d.includes('express-rate-limit') || d.includes('fastify-rate-limit') || d.includes('fastify-ratelimit')
  );

  if (!hasRateLimit) {
    findings.push({
      severity: 'medium',
      title: 'Missing Rate Limiting',
      description: 'No rate limiting package detected in dependencies. API endpoints may be vulnerable to brute-force and DoS attacks.',
      filePath: `${projectPath}/package.json`,
      lineNumber: 1,
      codeSnippet: 'Dependencies: ' + allDeps.join(', '),
      fixSuggestion: 'Install express-rate-limit (Express) or @fastify/rate-limit (Fastify). Apply rate limiting to all API endpoints, especially auth routes.',
      category: 'Rate Limiting',
    });
  }
}

function checkInsecureDependencies(allDeps: string[], findings: SecurityFinding[]) {
  // Known vulnerable package versions (simplified check — in production use npm audit or Snyk)
  const vulnerablePackages: Record<string, { severity: Severity; reason: string }> = {
    'lodash': { severity: 'medium', reason: 'Versions < 4.17.21 have prototype pollution vulnerability CVE-2021-23337' },
    'minimist': { severity: 'medium', reason: 'Versions < 1.2.6 have prototype pollution vulnerability' },
    'axios': { severity: 'medium', reason: 'Versions < 0.21.1 have SSRF vulnerability CVE-2020-28168' },
    'jsonwebtoken': { severity: 'high', reason: 'Versions < 9.0.0 have algorithm confusion vulnerability' },
    'express': { severity: 'medium', reason: 'Versions < 4.17.3 have qs dependency vulnerability' },
    'node-fetch': { severity: 'low', reason: 'Versions < 2.6.7 have information disclosure vulnerability' },
    'semver': { severity: 'high', reason: 'Versions < 7.5.2 have ReDoS vulnerability CVE-2022-25883' },
    'word-wrap': { severity: 'medium', reason: 'Versions < 1.2.4 have ReDoS vulnerability' },
  };

  for (const dep of allDeps) {
    // Check exact match or starts with
    const vuln = vulnerablePackages[dep];
    if (vuln) {
      findings.push({
        severity: vuln.severity,
        title: `Potentially Vulnerable Dependency: ${dep}`,
        description: vuln.reason,
        filePath: 'package.json',
        lineNumber: 1,
        codeSnippet: `"${dep}": "..."`,
        fixSuggestion: `Run 'npm audit' or 'pnpm audit' to check exact versions. Update ${dep} to the latest patched version.`,
        category: 'Vulnerable Dependencies',
      });
    }
  }
}

function checkMissingSecurityHeaders(fileContents: Record<string, string>, findings: SecurityFinding[]) {
  // Check if helmet or similar security middleware is used
  const hasHelmet = Object.values(fileContents).some(content =>
    content.includes('helmet') || content.includes('hsts') || content.includes('X-Frame-Options')
  );

  if (!hasHelmet) {
    // Only flag if it's an Express/Fastify app
    const isWebApp = Object.values(fileContents).some(content =>
      content.includes('express()') || content.includes('fastify()') || content.includes('createServer')
    );

    if (isWebApp) {
      findings.push({
        severity: 'medium',
        title: 'Missing Security Headers',
        description: 'Security headers middleware (helmet) not detected. Application may be missing X-Frame-Options, HSTS, CSP, and other security headers.',
        filePath: 'app entry file',
        lineNumber: 1,
        codeSnippet: 'No helmet() or security header configuration found',
        fixSuggestion: 'Install helmet (Express) or @fastify/helmet and add as global middleware. Configure CSP, HSTS, and framing policies.',
        category: 'Security Headers',
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

async function loadFileContents(projectPath: string): Promise<Record<string, string>> {
  const fileContents: Record<string, string> = {};
  const patterns = ['**/*.{ts,js,tsx,jsx}', '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**'];
  const files = await glob(patterns, { cwd: projectPath, absolute: false });

  for (const f of files) {
    try {
      const content = readFileSync(join(projectPath, f), 'utf-8');
      fileContents[f] = content;
    } catch {
      // skip
    }
  }

  return fileContents;
}
