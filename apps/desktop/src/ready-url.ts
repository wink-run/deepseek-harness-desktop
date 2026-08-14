/**
 * Parse the readiness line printed by `dsh web` once the Loader tree settles.
 * Supervisors (and this Electron shell) treat that line as the signal to open
 * the UI; the format is owned by `@deepseek-ai/dsh-web-app`.
 * @module @deepseek-ai/dsh-desktop/ready-url
 */

/** Prefix of the readiness line, including the trailing space. */
export const DSH_WEB_READY_PREFIX = 'dsh web: '

/**
 * Extract the canonical local URL from one stdout line.
 * @param line - one newline-delimited chunk from the web process.
 * @returns the local `http://127.0.0.1:<port>` URL, or `undefined` when the
 *   line is not a readiness announcement.
 */
export function parseWebReadyUrl(line: string): string | undefined {
  const trimmed = line.trim()
  if (!trimmed.startsWith(DSH_WEB_READY_PREFIX)) return undefined
  // "dsh web: http://127.0.0.1:3080" or with an optional " (LAN: …)" suffix.
  const rest = trimmed.slice(DSH_WEB_READY_PREFIX.length)
  const local = rest.split(/\s+/, 1)[0]
  if (local === undefined || local === '') return undefined
  try {
    const url = new URL(local)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.href.replace(/\/$/, '') === url.origin ? url.origin : url.href
  } catch {
    // Malformed readiness text — keep waiting for a later line.
    return undefined
  }
}
