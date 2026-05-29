import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadEnvFile } from '../src/load-env.js';

describe('loadEnvFile', () => {
  const created: string[] = [];
  const mkEnv = (contents: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'tf-env-'));
    created.push(dir);
    const f = join(dir, '.env');
    writeFileSync(f, contents);
    return f;
  };
  afterEach(() => {
    for (const d of created) try { rmSync(d, { recursive: true, force: true }); } catch { /* noop */ }
    created.length = 0;
    delete process.env.TF_TEST_A;
    delete process.env.TF_TEST_B;
    delete process.env.TF_TEST_QUOTED;
  });

  it('loads simple KEY=VALUE pairs', () => {
    const f = mkEnv('TF_TEST_A=hello\nTF_TEST_B=42\n');
    const r = loadEnvFile(f);
    expect(r.loaded).toBe(true);
    expect(process.env.TF_TEST_A).toBe('hello');
    expect(process.env.TF_TEST_B).toBe('42');
  });

  it('does NOT override variables already set in the real environment', () => {
    process.env.TF_TEST_A = 'from-real-env';
    const f = mkEnv('TF_TEST_A=from-file\n');
    loadEnvFile(f);
    expect(process.env.TF_TEST_A).toBe('from-real-env'); // real env wins
  });

  it('skips comments/blank lines and strips surrounding quotes', () => {
    const f = mkEnv('# a comment\n\nTF_TEST_QUOTED="quoted value"\n');
    loadEnvFile(f);
    expect(process.env.TF_TEST_QUOTED).toBe('quoted value');
  });

  it('returns loaded:false when the file is absent', () => {
    expect(loadEnvFile(join(tmpdir(), 'definitely-missing-tf.env')).loaded).toBe(false);
  });
});
