import { defineConfig } from 'tsdown'

/**
 * Electron main + CLI alias: two entries. Declarations come from `tsc -b`
 * (dts: false), matching apps/cli.
 */
export default defineConfig({
  entry: ['lib/types/main.js', 'lib/types/bin.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  // electron is resolved by the Electron binary at runtime, not bundled.
  deps: {
    neverBundle: ['electron'],
  },
})
