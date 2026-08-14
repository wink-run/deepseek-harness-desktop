/**
 * Resolve the Node binary and `dsh` bin for development vs packaged Electron.
 * @module @deepseek-ai/dsh-desktop/runtime-paths
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDshBin, resolveNodePath } from './spawn-web.ts'

/** Absolute paths used to spawn the nested `dsh web` process. */
export interface DesktopRuntimePaths {
  /** System or bundled Node binary (never Electron's execPath). */
  readonly nodePath: string
  /** Absolute path of `dsh`'s `lib/bin.js`. */
  readonly dshBin: string
}

/**
 * Resolve runtime paths for the current process.
 * @param packaged - whether Electron is running from an electron-builder install.
 * @param resourcesPath - `process.resourcesPath` when packaged; ignored otherwise.
 * @param env - environment for npm's Node path in development.
 * @returns absolute Node and dsh bin paths.
 */
export function resolveDesktopRuntimePaths(
  packaged: boolean,
  resourcesPath: string,
  env: NodeJS.ProcessEnv = process.env,
): DesktopRuntimePaths {
  if (!packaged) {
    return { nodePath: resolveNodePath(env), dshBin: resolveDshBin() }
  }
  const nodePath = process.platform === 'win32'
    ? join(resourcesPath, 'node', 'node.exe')
    : join(resourcesPath, 'node', 'bin', 'node')
  const dshBin = join(resourcesPath, 'dsh', 'lib', 'bin.js')
  if (!existsSync(nodePath)) {
    throw new Error(`dsh-desktop: packaged Node missing at ${nodePath}`)
  }
  if (!existsSync(dshBin)) {
    throw new Error(`dsh-desktop: packaged dsh bin missing at ${dshBin}`)
  }
  return { nodePath, dshBin }
}
