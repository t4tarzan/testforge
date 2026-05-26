// OpenAPI / Swagger schema extraction.
//
// What the prior contract analyzer did: substring-check filenames for
// "openapi" / "swagger". That tells you nothing about which routes are
// documented vs. which are not — it just reveals whether a file with
// that string in the name exists.
//
// What this module does: take the file content map, find OpenAPI /
// Swagger spec candidates, parse them (JSON or YAML), and return the
// set of documented (path, method) endpoint tuples. The contract
// analyzer then compares against the AST-discovered endpoints from
// the source code and emits findings on the diff.
//
// Out of scope:
//   - $ref resolution across files. We handle inline schemas only;
//     a future pass can follow $ref pointers.
//   - GraphQL schema extraction. Different shape; handled in a
//     companion module if/when we add it.

import * as yaml from 'js-yaml';

export interface OpenApiEndpoint {
  /** Path as written in the spec, e.g. "/users/{id}". */
  path: string;
  /** Lowercased HTTP method, e.g. "get". */
  method: string;
  /** OperationId if declared (handy for cross-linking). */
  operationId?: string;
  /** Where the spec lived. */
  sourceFile: string;
}

export interface OpenApiInfo {
  /** Files that look like OpenAPI/Swagger specs (or that we attempted to parse). */
  candidateFiles: string[];
  /** Files that parsed cleanly and looked like a valid spec. */
  validFiles: string[];
  /** Detected version family, when present. */
  versions: string[];
  /** Flat list of (path, method) tuples found across all parseable specs. */
  endpoints: OpenApiEndpoint[];
}

const SPEC_FILENAME_RE = /(?:^|\/)(?:openapi|swagger|api[-_.]?spec)\.(?:ya?ml|json)$/i;

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']);

export function extractOpenApi(fileContents: Record<string, string>): OpenApiInfo {
  const candidates = Object.keys(fileContents).filter((p) => SPEC_FILENAME_RE.test(p));
  const valid: string[] = [];
  const versions: string[] = [];
  const endpoints: OpenApiEndpoint[] = [];

  for (const file of candidates) {
    const content = fileContents[file];
    if (!content || content.length > 2 * 1024 * 1024) continue; // 2 MB ceiling
    let parsed: unknown;
    try {
      parsed = file.endsWith('.json') ? JSON.parse(content) : yaml.load(content);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;

    const spec = parsed as Record<string, unknown>;
    // Sanity check it looks like an OpenAPI doc.
    const isOpenApi = typeof spec.openapi === 'string' || typeof spec.swagger === 'string';
    if (!isOpenApi) continue;

    valid.push(file);
    if (typeof spec.openapi === 'string') versions.push(`openapi-${spec.openapi}`);
    if (typeof spec.swagger === 'string') versions.push(`swagger-${spec.swagger}`);

    const paths = spec.paths;
    if (!paths || typeof paths !== 'object') continue;

    for (const [routePath, methods] of Object.entries(paths as Record<string, unknown>)) {
      if (!methods || typeof methods !== 'object') continue;
      for (const [methodKey, op] of Object.entries(methods as Record<string, unknown>)) {
        const method = methodKey.toLowerCase();
        if (!HTTP_METHODS.has(method)) continue;
        let operationId: string | undefined;
        if (op && typeof op === 'object' && typeof (op as Record<string, unknown>).operationId === 'string') {
          operationId = (op as Record<string, unknown>).operationId as string;
        }
        endpoints.push({ path: routePath, method, operationId, sourceFile: file });
      }
    }
  }

  return { candidateFiles: candidates, validFiles: valid, versions, endpoints };
}

/**
 * Normalize a spec path or a discovered route path for set matching.
 * `/users/{id}` and `/users/:id` should compare equal.
 */
export function canonicalPath(p: string): string {
  return p
    .replace(/^\/+/, '/')
    .replace(/\/+$/, '')
    .replace(/\{([^}]+)\}/g, ':__P__')   // {id} → :__P__
    .replace(/:[A-Za-z0-9_]+/g, ':__P__')  // :anyName → :__P__
    .toLowerCase() || '/';
}
