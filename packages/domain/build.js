// Bundles the server entry point for PocketBase's goja engine: CommonJS, single
// file. Uses the esbuild JS API rather than its CLI, whose pnpm shim tries to
// run the native binary through node.
//
// Target is es2015, not the es5 the PocketBase docs name: esbuild cannot lower
// const or class to es5 at all, and goja does implement most of ES6. What goja
// actually accepts is settled by the journey that loads this bundle, not here.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/server.ts'],
  // .cjs, not .js: the root package.json declares "type": "module", so tooling
  // would otherwise read this CommonJS bundle as ESM and see no exports.
  outfile: '../../pb_hooks/lib/domain.cjs',
  bundle: true,
  format: 'cjs',
  target: 'es2015',
  // "neutral" builds the module but never assigns module.exports, leaving the
  // bundle inert. Nothing here imports a node builtin.
  platform: 'node',
  logLevel: 'info',
})
