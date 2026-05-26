import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'mcp-server/dist', '**/dist/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow `_foo` for deliberately-unused params (common pattern when
      // matching a callback / interface signature).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // This rule fires on the perfectly valid load-and-setState pattern
      // (e.g. fetching data inside useEffect and storing it in state).
      // Surface as warning, not error.
      'react-hooks/set-state-in-effect': 'warn',
      // Same — useEffect that depends on a small subset of a derived
      // structure (e.g. pipelineStages.length) is legitimate.
      'react-hooks/exhaustive-deps': 'warn',
      // These three trigger on legitimate "component-defined-inside-component"
      // patterns we use sparingly for scoped sub-renders. They're warnings,
      // not bugs.
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      // HMR fast-refresh hint, not a production bug. Many files
      // legitimately co-locate small helpers with the component they
      // serve; the cost of splitting them outweighs the marginal HMR win.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
