// Kubernetes dimension — the biggest depth gap the dimension audit surfaced:
// 16 of 21 dimensions wanted k8s-manifest analysis, yet nothing parsed YAML.
// For a Kubernetes PLATFORM (manifests + Helm + CRDs), the real risk lives in
// the YAML, not the app code. This parses every manifest once and runs concrete
// security / resilience / scalability checks against the PodSpecs and RBAC.
//
// Helm templates contain Go-template `{{ ... }}` that breaks a plain YAML parse,
// so we stub those to a placeholder and parse documents individually (skipping
// any that are still unparseable) rather than failing the whole file.
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';

export interface K8sFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  filePath: string;
  fixSuggestion: string;
  category: 'Kubernetes';
}

export interface K8sReport {
  applicable: boolean;
  score: number;
  manifestsParsed: number;
  documents: number;
  /** Quick inventory for the report's "TESTED" disclosure. */
  kinds: Record<string, number>;
  findings: K8sFinding[];
  naReason?: string;
}

type Doc = Record<string, unknown>;
const SEV_COST: Record<K8sFinding['severity'], number> = { critical: 30, high: 18, medium: 9, low: 3 };

const MANIFEST_GLOBS = ['**/*.yaml', '**/*.yml', '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**'];
const WORKLOAD_KINDS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'ReplicaSet', 'Pod']);

/** Strip Helm/Go templating so the structural YAML still parses. */
function stubTemplates(src: string): string {
  return src
    .replace(/\{\{-?\s*(?:if|else|end|range|with|define|template|block)[^}]*-?\}\}/g, '') // control blocks → nothing
    .replace(/\{\{[^}]*\}\}/g, 'tfsim_placeholder'); // value expressions → scalar
}

/** Parse one file into 0+ documents, skipping individually-unparseable docs. */
function parseDocs(src: string): Doc[] {
  const out: Doc[] = [];
  for (const chunk of stubTemplates(src).split(/^---\s*$/m)) {
    if (!chunk.trim()) continue;
    try {
      const d = yaml.load(chunk);
      if (d && typeof d === 'object' && (d as Doc).kind) out.push(d as Doc);
    } catch { /* skip unparseable doc (heavy templating) */ }
  }
  return out;
}

function podSpecOf(doc: Doc): Doc | null {
  const kind = String(doc.kind);
  const spec = doc.spec as Doc | undefined;
  if (!spec) return null;
  if (kind === 'Pod') return spec;
  if (kind === 'CronJob') {
    const jt = ((spec.jobTemplate as Doc)?.spec as Doc)?.template as Doc | undefined;
    return (jt?.spec as Doc) ?? null;
  }
  const tmpl = (spec.template as Doc)?.spec as Doc | undefined; // Deployment/StatefulSet/DaemonSet/Job/ReplicaSet
  return tmpl ?? null;
}

function containersOf(podSpec: Doc): Doc[] {
  const c = (podSpec.containers as Doc[]) ?? [];
  const ic = (podSpec.initContainers as Doc[]) ?? [];
  return [...c, ...ic].filter((x) => x && typeof x === 'object');
}

export async function runKubernetesAnalysis(projectPath: string): Promise<K8sReport> {
  let files: string[] = [];
  try { files = await glob(MANIFEST_GLOBS, { cwd: projectPath, absolute: false, nodir: true }); } catch { /* ignore */ }

  const findings: K8sFinding[] = [];
  const kinds: Record<string, number> = {};
  let manifestsParsed = 0;
  let documents = 0;
  let hasNetworkPolicy = false;
  let hasWorkload = false;

  for (const rel of files) {
    let docs: Doc[] = [];
    try { docs = parseDocs(readFileSync(join(projectPath, rel), 'utf8')); } catch { continue; }
    if (!docs.length) continue;
    manifestsParsed++;
    for (const doc of docs) {
      documents++;
      const kind = String(doc.kind);
      kinds[kind] = (kinds[kind] ?? 0) + 1;
      if (kind === 'NetworkPolicy') hasNetworkPolicy = true;

      // ── RBAC overbreadth ──
      if (kind === 'Role' || kind === 'ClusterRole') {
        const rules = (doc.rules as Doc[]) ?? [];
        for (const r of rules) {
          const verbs = (r.verbs as string[]) ?? [];
          const resources = (r.resources as string[]) ?? [];
          if (verbs.includes('*') || resources.includes('*')) {
            findings.push({
              severity: kind === 'ClusterRole' ? 'high' : 'medium',
              title: `Wildcard RBAC in ${kind} "${doc.metadata && (doc.metadata as Doc).name}"`,
              description: `${kind} grants wildcard ${verbs.includes('*') ? 'verbs' : 'resources'} (\`*\`) — violates least privilege; a compromised pod with this role can act broadly across the cluster.`,
              filePath: rel,
              fixSuggestion: 'Enumerate the exact verbs (get/list/watch) and resources the workload needs instead of `*`. Avoid cluster-admin bindings.',
              category: 'Kubernetes',
            });
          }
        }
      }

      // ── Secrets in ConfigMaps ──
      if (kind === 'ConfigMap') {
        const data = { ...(doc.data as Doc), ...(doc.stringData as Doc) };
        const leak = Object.keys(data).find((k) => /pass(word)?|secret|token|api[_-]?key|private[_-]?key|credential/i.test(k));
        if (leak) {
          findings.push({
            severity: 'high',
            title: `Secret-like key "${leak}" stored in a ConfigMap`,
            description: 'ConfigMaps are stored in plaintext and not treated as secrets (no encryption-at-rest, broader RBAC). Sensitive values belong in a Secret (or an external secret store).',
            filePath: rel,
            fixSuggestion: 'Move sensitive keys into a Secret object referenced via `valueFrom.secretKeyRef`, or an external secrets manager (Vault/ESO).',
            category: 'Kubernetes',
          });
        }
      }

      // ── Workload PodSpec checks ──
      if (WORKLOAD_KINDS.has(kind)) {
        const podSpec = podSpecOf(doc);
        if (!podSpec) continue;
        hasWorkload = true;
        const name = (doc.metadata as Doc)?.name ?? kind;
        const psCtx = (podSpec.securityContext as Doc) ?? {};
        if (podSpec.automountServiceAccountToken !== false) {
          findings.push({ severity: 'low', title: `ServiceAccount token auto-mounted in "${name}"`, description: 'automountServiceAccountToken is not disabled — the pod gets a cluster API token it likely does not need, widening blast radius.', filePath: rel, fixSuggestion: 'Set `automountServiceAccountToken: false` on the pod or ServiceAccount unless the workload calls the k8s API.', category: 'Kubernetes' });
        }
        for (const c of containersOf(podSpec)) {
          const cname = c.name ?? 'container';
          const ctx = { ...psCtx, ...((c.securityContext as Doc) ?? {}) };
          if (ctx.privileged === true) {
            findings.push({ severity: 'critical', title: `Privileged container "${cname}" in "${name}"`, description: 'A privileged container has full host access — a container escape becomes a host/cluster compromise.', filePath: rel, fixSuggestion: 'Remove `privileged: true`; grant only the specific Linux capabilities required.', category: 'Kubernetes' });
          }
          if (ctx.runAsNonRoot !== true && ctx.runAsUser !== 0 && !(typeof ctx.runAsUser === 'number' && ctx.runAsUser > 0)) {
            findings.push({ severity: 'medium', title: `Container "${cname}" in "${name}" may run as root`, description: 'No `runAsNonRoot: true` / non-zero `runAsUser` — the container can run as UID 0, so an exploit runs with root in the container.', filePath: rel, fixSuggestion: 'Set `securityContext.runAsNonRoot: true` and a non-zero `runAsUser`.', category: 'Kubernetes' });
          }
          if (ctx.allowPrivilegeEscalation !== false) {
            findings.push({ severity: 'low', title: `allowPrivilegeEscalation not disabled in "${cname}"`, description: 'Without `allowPrivilegeEscalation: false`, a process can gain more privileges than its parent (setuid binaries).', filePath: rel, fixSuggestion: 'Set `securityContext.allowPrivilegeEscalation: false`.', category: 'Kubernetes' });
          }
          const res = (c.resources as Doc) ?? {};
          if (!res.limits && !res.requests) {
            findings.push({ severity: 'medium', title: `No resource requests/limits on "${cname}" in "${name}"`, description: 'Without requests/limits the pod is BestEffort/Burstable QoS — it can be OOM-killed or evicted first under pressure, and can starve neighbors. Caps real capacity regardless of in-app rate limits.', filePath: rel, fixSuggestion: 'Set `resources.requests` and `resources.limits` for cpu and memory.', category: 'Kubernetes' });
          }
          if (!c.livenessProbe && !c.readinessProbe) {
            findings.push({ severity: 'medium', title: `No liveness/readiness probe on "${cname}" in "${name}"`, description: 'Without probes, k8s can route traffic to an unready pod and cannot detect/restart a hung one — directly hurts recovery time (MTTR).', filePath: rel, fixSuggestion: 'Add `readinessProbe` (gate traffic) and `livenessProbe` (auto-restart on hang).', category: 'Kubernetes' });
          }
          const image = String(c.image ?? '');
          if (image && (image.endsWith(':latest') || !image.includes(':'))) {
            findings.push({ severity: 'low', title: `Mutable image tag on "${cname}" (${image || 'untagged'})`, description: '`:latest`/untagged images are non-reproducible and can pull tampered/stale content; rollbacks become ambiguous.', filePath: rel, fixSuggestion: 'Pin a specific version tag or digest (`@sha256:…`).', category: 'Kubernetes' });
          }
        }
      }
    }
  }

  if (manifestsParsed === 0) {
    return { applicable: false, score: 0, manifestsParsed: 0, documents: 0, kinds: {}, findings: [], naReason: 'No Kubernetes manifests or Helm charts found in the repo.' };
  }

  // Project-level: workloads but no NetworkPolicy → default-allow east-west traffic.
  if (hasWorkload && !hasNetworkPolicy) {
    findings.push({ severity: 'medium', title: 'No NetworkPolicy defined', description: `${documents} manifest document(s) define workloads but no NetworkPolicy exists — by default all pods can talk to all pods (flat network), so one compromised pod can reach everything.`, filePath: '(cluster)', fixSuggestion: 'Add a default-deny NetworkPolicy and explicitly allow required flows.', category: 'Kubernetes' });
  }

  const score = Math.max(0, Math.min(100, 100 - findings.reduce((a, f) => a + SEV_COST[f.severity], 0)));
  return { applicable: true, score, manifestsParsed, documents, kinds, findings };
}
