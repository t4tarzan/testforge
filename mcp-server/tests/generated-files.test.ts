import { describe, it, expect } from 'vitest';
import { isGeneratedOrVendored } from '../src/analyzers/lib/parse.js';

// Guards the cry-wolf fix: generated/vendored files must be excluded from
// risk-hotspot and dead-export reporting (you regenerate them, not refactor
// them), while ordinary source must NOT be excluded.
describe('isGeneratedOrVendored', () => {
  it('flags generated codegen / client files', () => {
    for (const p of [
      'frontend/src/client/schemas.gen.ts',
      'frontend/src/client/types.gen.ts',
      'src/api/foo.generated.ts',
      'internal/foo.pb.go',
      'app/grpc/service_pb2.py',
      'app/grpc/service_pb2_grpc.py',
    ]) {
      expect(isGeneratedOrVendored(p), p).toBe(true);
    }
  });

  it('flags vendored / build-output / minified trees', () => {
    for (const p of [
      'vendor/github.com/x/y.go',
      'third_party/lib/a.js',
      'dist/index.js',
      'build/bundle.js',
      'src/generated/client.ts',
      'src/__generated__/gql.ts',
      'public/app.min.js',
      'types/index.d.ts',
    ]) {
      expect(isGeneratedOrVendored(p), p).toBe(true);
    }
  });

  it('does NOT flag ordinary hand-written source', () => {
    for (const p of [
      'src/components/Sidebar.tsx',
      'backend/app/utils.py',
      'internal/server/handler.go',
      'src/lib/genuinely.ts', // "gen" substring but not a generated marker
      'src/generator.ts',
      'src/build-tools/helper.ts',
    ]) {
      expect(isGeneratedOrVendored(p), p).toBe(false);
    }
  });
});
