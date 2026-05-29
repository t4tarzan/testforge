// Side-effect module: loads ~/.testforge/.env into process.env. Imported as the
// VERY FIRST import in index.ts so it fully evaluates before any other module
// (llm-client, etc.) reads process.env — ESM evaluates imported modules in
// source order, depth-first, before the importing module's own body runs.
import { loadEnvFile } from './load-env.js';

loadEnvFile();
