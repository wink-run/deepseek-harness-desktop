/**
 * Spawn the shipped `dsh web` profile as a child Node process and resolve
 * when its readiness URL appears on stdout.
 * @module @deepseek-ai/dsh-desktop/spawn-web
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseWebReadyUrl } from './ready-url.ts'

/** Handle for a live `dsh web` child and the URL it announced. */
export interface WebChild {
  /** Child process running the web profile. */
  readonly process: ChildProcess
  /** Canonical loopback URL printed after Loader settlement. */
  readonly url: string
}

/** Options for {@link spawnWeb}. */
export interface SpawnWebOptions {
  /** Absolute path to the Node binary that runs `dsh` (never Electron's execPath). */
  nodePath: string
  /** Extra argv after `web` (for example `--patch`). */
  extraArgs?: readonly string[]
  /** Environment for the child; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv
  /** Working directory for the child (becomes the default workspace root). */
  cwd?: string
  /**
   * Absolute path of `dsh`'s `lib/bin.js`. When omitted, resolves from the
   * `@deepseek-ai/dsh` dependency next to this package.
   */
  dshBin?: string
}

/**
 * Resolve the built `dsh` bin next to this package's dependency.
 * @returns absolute path of `lib/bin.js`.
 */
export function resolveDshBin(): string {
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('@deepseek-ai/dsh/package.json')
  return join(dirname(manifest), 'lib', 'bin.js')
}

/**
 * Resolve a system Node binary suitable for spawning harness native addons.
 * Electron's `process.execPath` is the Chromium shell and must not run `dsh`.
 * @param env - environment used for the npm-injected Node path.
 * @returns absolute path or the bare `node` name for PATH lookup.
 */
export function resolveNodePath(env: NodeJS.ProcessEnv = process.env): string {
  const fromNpm = env.npm_node_execpath
  if (typeof fromNpm === 'string' && fromNpm !== '') return fromNpm
  return 'node'
}

/**
 * Start `dsh web --port 0` and wait for its readiness URL.
 * @param options - Node path, optional bin override, and child env/cwd.
 * @returns the child handle and announced URL.
 */
export function spawnWeb(options: SpawnWebOptions): Promise<WebChild> {
  const bin = options.dshBin ?? resolveDshBin()
  const args = [bin, 'web', '--port', '0', ...(options.extraArgs ?? [])]
  const child = spawn(options.nodePath, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return new Promise<WebChild>((resolve, reject) => {
    let settled = false
    let stdout = ''

    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(error)
    }

    const tryLine = (chunk: string): void => {
      stdout += chunk
      const lines = stdout.split(/\r?\n/)
      // Keep the incomplete trailing fragment for the next chunk.
      stdout = lines.pop() ?? ''
      for (const line of lines) {
        const url = parseWebReadyUrl(line)
        if (url === undefined) continue
        if (settled) return
        settled = true
        resolve({ process: child, url })
        return
      }
    }

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      process.stdout.write(chunk)
      tryLine(chunk)
    })
    child.stderr?.on('data', (chunk: string) => {
      process.stderr.write(chunk)
    })
    child.on('error', (error) => {
      fail(error instanceof Error ? error : new Error(String(error)))
    })
    child.on('exit', (code, signal) => {
      if (settled) return
      fail(new Error(
        `dsh web exited before readiness (code=${String(code)}, signal=${String(signal)})`,
      ))
    })
  })
}

/**
 * Directory of this package (works from both `src/` and bundled `lib/`).
 * @returns absolute package root.
 */
export function packageRoot(): string {
  return fileURLToPath(new URL('..', import.meta.url))
}
