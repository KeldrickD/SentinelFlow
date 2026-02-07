/**
 * Copies patched CRE SDK files into node_modules so Windows (EEXIST + paths with spaces) works.
 * Run after bun install (postinstall).
 */
const fs = require('fs');
const path = require('path');

const workflowDir = path.resolve(__dirname, '..');
const patchesDir = path.join(workflowDir, 'patches', 'cre-sdk');
const sdkDir = path.join(workflowDir, 'node_modules', '@chainlink', 'cre-sdk');

const files = [
  'scripts/src/compile-workflow.ts',
  'scripts/src/compile-to-js.ts',
  'scripts/src/compile-to-wasm.ts',
];

if (!fs.existsSync(sdkDir)) {
  console.warn('apply-cre-patches: @chainlink/cre-sdk not found, skipping');
  process.exit(0);
}

for (const rel of files) {
  const src = path.join(patchesDir, rel);
  const dest = path.join(sdkDir, rel);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, dest);
  console.log('Patched:', rel);
}
