/**
 * Resolve packaged vs development runtime paths for the desktop shell.
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveDesktopRuntimePaths } from '../src/runtime-paths.ts'

describe('resolveDesktopRuntimePaths', () => {
  it('uses workspace resolution when not packaged', () => {
    const paths = resolveDesktopRuntimePaths(false, '/unused', { npm_node_execpath: '/opt/node' })
    expect(paths.nodePath).toBe('/opt/node')
    expect(paths.dshBin.endsWith(`${join('lib', 'bin.js')}`)).toBe(true)
  })

  it('reads Electron resources when packaged', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-runtime-'))
    const nodeDir = process.platform === 'win32' ? join(root, 'node') : join(root, 'node', 'bin')
    mkdirSync(nodeDir, { recursive: true })
    mkdirSync(join(root, 'dsh', 'lib'), { recursive: true })
    const nodePath = process.platform === 'win32'
      ? join(root, 'node', 'node.exe')
      : join(root, 'node', 'bin', 'node')
    writeFileSync(nodePath, '')
    writeFileSync(join(root, 'dsh', 'lib', 'bin.js'), '')
    const paths = resolveDesktopRuntimePaths(true, root)
    expect(paths.nodePath).toBe(nodePath)
    expect(paths.dshBin).toBe(join(root, 'dsh', 'lib', 'bin.js'))
  })
})
