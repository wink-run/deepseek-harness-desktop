#!/usr/bin/env node
/**
 * `dsh-desktop` — launch the Electron shell over a workspace or installed
 * Electron binary. The shell itself starts `dsh web` on loopback.
 * @module @deepseek-ai/dsh-desktop/bin
 */

/* v8 ignore file -- built-bin acceptance would exercise Electron; unit tests cover readiness parsing. */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const main = join(here, 'main.js')
const require = createRequire(import.meta.url)

/** Resolve the `electron` binary from this package's install. */
function resolveElectron(): string {
  // electron's package exports the path string as its main.
  return require('electron') as string
}

const child = spawn(resolveElectron(), [main, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
