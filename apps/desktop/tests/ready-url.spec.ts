/**
 * Readiness-URL parsing for the desktop shell's `dsh web` supervisor.
 */
import { describe, expect, it } from 'vitest'
import { parseWebReadyUrl } from '../src/ready-url.ts'

describe('parseWebReadyUrl', () => {
  it('extracts the local URL from the readiness line', () => {
    expect(parseWebReadyUrl('dsh web: http://127.0.0.1:4567')).toBe('http://127.0.0.1:4567')
  })

  it('strips the optional LAN advertisement suffix', () => {
    expect(parseWebReadyUrl('dsh web: http://127.0.0.1:4567 (LAN: http://192.168.1.5:4567)'))
      .toBe('http://127.0.0.1:4567')
  })

  it('ignores unrelated stdout', () => {
    expect(parseWebReadyUrl('loading plugins')).toBeUndefined()
    expect(parseWebReadyUrl('dsh web:not-a-url')).toBeUndefined()
  })

  it('rejects non-http schemes', () => {
    expect(parseWebReadyUrl('dsh web: file:///tmp/index.html')).toBeUndefined()
  })
})
