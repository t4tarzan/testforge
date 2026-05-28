// OSV supply-chain: lockfile parsers (pure, no network) + cache behavior.
// The live queryOsvBatch network path is opt-in (opts.osv) and not exercised
// here — these cover the version-extraction that feeds it.
import { describe, it, expect } from 'vitest';
import {
  parseRequirementsTxt, parsePoetryLock, parsePipfileLock, parseGoSum, osvKey,
} from '../src/analyzers/lib/osv.js';

describe('OSV lockfile parsers', () => {
  it('requirements.txt: takes == pins, normalizes name, skips ranges/comments/flags', () => {
    const r = parseRequirementsTxt([
      'Django==4.2.1',
      'requests >= 2.0   # a range — skipped',
      'PyYAML==6.0  # comment',
      'flask_login==0.6.2',
      '-r other.txt',
      '',
    ].join('\n'));
    expect(r).toEqual([
      { name: 'django', version: '4.2.1' },
      { name: 'pyyaml', version: '6.0' },
      { name: 'flask-login', version: '0.6.2' },
    ]);
  });

  it('poetry.lock: extracts name+version per [[package]] block', () => {
    const r = parsePoetryLock([
      '[[package]]',
      'name = "fastapi"',
      'version = "0.110.0"',
      'description = "x"',
      '',
      '[[package]]',
      'name = "Pydantic"',
      'version = "2.6.1"',
    ].join('\n'));
    expect(r).toEqual([
      { name: 'fastapi', version: '0.110.0' },
      { name: 'pydantic', version: '2.6.1' },
    ]);
  });

  it('Pipfile.lock: reads default + develop versions', () => {
    const r = parsePipfileLock(JSON.stringify({
      default: { requests: { version: '==2.31.0' } },
      develop: { pytest: { version: '==8.0.0' } },
    }));
    expect(r).toContainEqual({ name: 'requests', version: '2.31.0' });
    expect(r).toContainEqual({ name: 'pytest', version: '8.0.0' });
  });

  it('go.sum: dedups, strips /go.mod, keeps module@vX', () => {
    const r = parseGoSum([
      'github.com/gin-gonic/gin v1.9.1 h1:abc=',
      'github.com/gin-gonic/gin v1.9.1/go.mod h1:def=',
      'golang.org/x/text v0.14.0 h1:ghi=',
      'not a module line',
    ].join('\n'));
    expect(r).toEqual([
      { name: 'github.com/gin-gonic/gin', version: 'v1.9.1' },
      { name: 'golang.org/x/text', version: 'v0.14.0' },
    ]);
  });

  it('osvKey is ecosystem-scoped', () => {
    expect(osvKey({ ecosystem: 'PyPI', name: 'django', version: '4.2.1' })).toBe('PyPI:django@4.2.1');
  });
});
