import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * Bundles the server entry point for PocketBase's goja engine.
 *
 * Target is es2015, not the es5 the PocketBase docs name: esbuild cannot lower
 * const or class to es5 at all, and goja does accept class, const, arrow
 * functions and Number.isSafeInteger — proven by the journey that runs this
 * bundle inside PocketBase.
 *
 * platform is "neutral" so that importing a node builtin fails the build.
 * Under "node" esbuild marks builtins external and emits require("node:fs"),
 * which goja cannot resolve — turning a build error into a runtime one.
 *
 * The output is .cjs because the root package.json declares "type": "module",
 * and tooling would otherwise read this CommonJS bundle as ESM.
 */
export async function buildDomain() {
  await build({
    absWorkingDir: packageRoot,
    entryPoints: ['src/server.ts'],
    outfile: '../../pb_hooks/lib/domain.cjs',
    bundle: true,
    format: 'cjs',
    target: 'es2015',
    platform: 'neutral',
    logLevel: 'silent',
  })
}

// Also runnable as a script, via `pnpm domain:build`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildDomain()
  console.log('Bundled packages/domain to pb_hooks/lib/domain.cjs')
}
