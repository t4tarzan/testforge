// Tests for the Kubernetes dimension — manifest parsing + the security/
// resilience checks. Drives runKubernetesAnalysis against on-disk fixtures.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runKubernetesAnalysis } from '../src/analyzers/k8s-analyzer.js';

function tmpManifests(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tf-k8s-'));
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

const ratsNest = `
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  template:
    spec:
      containers:
        - name: api
          image: myorg/api:latest
          securityContext:
            privileged: true
`;

const cleanDeploy = `
apiVersion: apps/v1
kind: Deployment
metadata: { name: worker }
spec:
  template:
    spec:
      automountServiceAccountToken: false
      containers:
        - name: worker
          image: myorg/worker:1.4.2
          securityContext: { runAsNonRoot: true, runAsUser: 1000, allowPrivilegeEscalation: false }
          resources: { requests: { cpu: 100m, memory: 128Mi }, limits: { cpu: 500m, memory: 256Mi } }
          livenessProbe: { httpGet: { path: /health, port: 8080 } }
          readinessProbe: { httpGet: { path: /ready, port: 8080 } }
`;

const wildcardRole = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: god }
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
`;

const secretCM = `
apiVersion: v1
kind: ConfigMap
metadata: { name: app-config }
data: { LOG_LEVEL: info, DB_PASSWORD: hunter2 }
`;

const titles = (fs: { title: string }[]) => fs.map((f) => f.title).join(' || ');

describe('runKubernetesAnalysis', () => {
  it('flags privileged, root, :latest, no-resources, no-probes on a bad Deployment', async () => {
    const dir = tmpManifests({ 'k8s/api.yaml': ratsNest });
    try {
      const r = await runKubernetesAnalysis(dir);
      expect(r.applicable).toBe(true);
      expect(r.kinds.Deployment).toBe(1);
      const t = titles(r.findings);
      expect(t).toMatch(/Privileged container/i);
      expect(t).toMatch(/run as root/i);
      expect(t).toMatch(/resource requests\/limits/i);
      expect(t).toMatch(/liveness\/readiness probe/i);
      expect(t).toMatch(/Mutable image tag/i);
      expect(r.findings.some((f) => f.severity === 'critical')).toBe(true); // privileged
      expect(r.score).toBeLessThan(80);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('a hardened Deployment produces no container-security findings', async () => {
    const dir = tmpManifests({ 'k8s/worker.yaml': cleanDeploy, 'k8s/np.yaml': 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: { name: deny }\nspec: { podSelector: {} }\n' });
    try {
      const r = await runKubernetesAnalysis(dir);
      const t = titles(r.findings);
      expect(t).not.toMatch(/Privileged|run as root|resource requests|probe|Mutable image|auto-mounted/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('flags wildcard RBAC and secrets-in-ConfigMap', async () => {
    const dir = tmpManifests({ 'rbac.yaml': wildcardRole, 'cm.yaml': secretCM });
    try {
      const r = await runKubernetesAnalysis(dir);
      const t = titles(r.findings);
      expect(t).toMatch(/Wildcard RBAC/i);
      expect(t).toMatch(/Secret-like key "DB_PASSWORD"/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('flags missing NetworkPolicy when workloads exist', async () => {
    const dir = tmpManifests({ 'd.yaml': cleanDeploy });
    try {
      expect(titles((await runKubernetesAnalysis(dir)).findings)).toMatch(/No NetworkPolicy/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('parses Helm templates by stubbing {{ }} expressions', async () => {
    const helm = 'apiVersion: apps/v1\nkind: Deployment\nmetadata: { name: {{ .Release.Name }} }\nspec:\n  replicas: {{ .Values.replicas }}\n  template:\n    spec:\n      containers:\n        - name: app\n          image: "{{ .Values.image }}:latest"\n';
    const dir = tmpManifests({ 'charts/app/templates/deploy.yaml': helm, 'charts/app/Chart.yaml': 'name: app\nversion: 0.1.0\n' });
    try {
      const r = await runKubernetesAnalysis(dir);
      expect(r.applicable).toBe(true);
      expect(r.kinds.Deployment).toBe(1); // parsed despite templating
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('is N/A when there are no manifests', async () => {
    const dir = tmpManifests({ 'README.md': '# hi' });
    try {
      const r = await runKubernetesAnalysis(dir);
      expect(r.applicable).toBe(false);
      expect(r.naReason).toMatch(/no kubernetes manifests/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
