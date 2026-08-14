/**
 * Node-path resolution for the desktop shell's `dsh web` child.
 */
import { describe, expect, it } from 'vitest'
import { resolveNodePath } from '../src/spawn-web.ts'

describe('resolveNodePath', () => {
  it('prefers npm_node_execpath when set', () => {
    expect(resolveNodePath({ npm_node_execpath: '/opt/node' })).toBe('/opt/node')
  })

  it('falls back to PATH lookup via the bare node name', () => {
    expect(resolveNodePath({})).toBe('node')
  })
})
