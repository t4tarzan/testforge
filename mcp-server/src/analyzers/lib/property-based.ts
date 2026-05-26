// AST-aware property-based-testing signal detection.
//
// True property-based testing requires a generator library AND test
// cases that exercise invariants over generated inputs. Statically we
// can detect:
//
//   - Imports of fast-check / @fast-check/* / jsverify / @hapi/joi /
//     property-test / proptest-js / quickcheck etc.
//   - fc.assert(...) / fc.property(...) call sites
//   - Type guards in source (`typeof x === 'string'`, `Array.isArray(x)`,
//     `x instanceof Class`) — these express invariants
//   - assert(...) / invariant(...) / throw-on-failure patterns
//
// We don't ATTEMPT to detect "pure functions" via static analysis —
// the old version's heuristic ("function body has this.* > 1 → impure")
// fires on basically every class method, even legitimate ones, and is
// too noisy to be useful.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

export interface PropertyBasedSignals {
  /** Imports of property-test framework modules. */
  frameworkImports: string[];
  /** Number of `fc.property(...)` / `fc.assert(...)` call sites. */
  propertyCalls: number;
  /** Number of runtime invariant calls: assert() / invariant(). */
  invariantCalls: number;
  /** Number of type-guard expressions detected. */
  typeGuards: number;
}

const PROPERTY_FRAMEWORK_MODULES = new Set([
  'fast-check', '@fast-check/jest', '@fast-check/vitest',
  'jsverify', 'fluent-checker', 'quickcheck', 'property-test', 'proptest-js',
]);

export function findPropertyBasedSignals(ast: File): PropertyBasedSignals {
  const frameworkImports: string[] = [];
  let propertyCalls = 0;
  let invariantCalls = 0;
  let typeGuards = 0;

  walk(ast, (node) => {
    // Imports
    if (t.isImportDeclaration(node) && PROPERTY_FRAMEWORK_MODULES.has(node.source.value)) {
      frameworkImports.push(node.source.value);
    }
    if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'require' })
      && node.arguments.length >= 1 && t.isStringLiteral(node.arguments[0])
      && PROPERTY_FRAMEWORK_MODULES.has(node.arguments[0].value)) {
      frameworkImports.push(node.arguments[0].value);
    }

    // fc.property(...) / fc.assert(...) / fc.check(...) — receiver named fc OR fastCheck
    if (t.isCallExpression(node)
      && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.object)
      && (node.callee.object.name === 'fc' || node.callee.object.name === 'fastCheck')
      && t.isIdentifier(node.callee.property)
      && (node.callee.property.name === 'property' || node.callee.property.name === 'assert' || node.callee.property.name === 'check')
    ) {
      propertyCalls++;
    }

    // assert(...) / invariant(...) — bare or namespaced
    if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
      if (node.callee.name === 'assert' || node.callee.name === 'invariant') invariantCalls++;
    }
    if (t.isCallExpression(node) && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.object, { name: 'assert' })) {
      // assert.ok / assert.equal / ... — still counts as an invariant call
      invariantCalls++;
    }

    // Type guards: `typeof x === 'string'`, `Array.isArray(x)`, `x instanceof Class`
    if (t.isBinaryExpression(node)
      && (node.operator === '===' || node.operator === '!==')
      && t.isUnaryExpression(node.left, { operator: 'typeof' })
      && t.isStringLiteral(node.right)
    ) {
      typeGuards++;
    }
    if (t.isCallExpression(node)
      && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.object, { name: 'Array' })
      && t.isIdentifier(node.callee.property, { name: 'isArray' })
    ) {
      typeGuards++;
    }
    if (t.isBinaryExpression(node) && node.operator === 'instanceof') {
      typeGuards++;
    }

    return true;
  });

  return { frameworkImports, propertyCalls, invariantCalls, typeGuards };
}
