#!/usr/bin/env node
/**
 * Prepare Electron extraResources: a `pnpm deploy` of `@deepseek-ai/dsh` plus the
 * platform `node` executable only (not the full Node dist with npm/npx/corepack).
 * Run from the repository root after `pnpm run build`.
 *
 * Usage: node apps/desktop/scripts/prepare-resources.mjs
 */
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { chmod, cp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(here, '..')
const repoRoot = join(desktopRoot, '..', '..')
const packRoot = join(desktopRoot, '.pack')
const dshOut = join(packRoot, 'dsh')
const nodeOut = join(packRoot, 'node')

/** Pinned Node line matching CI / engines (`^22.19 || >=24`). */
const NODE_VERSION = process.env.DSH_DESKTOP_NODE_VERSION ?? '24.19.0'

/**
 * @returns {{ platform: string, arch: string, ext: string, binaryRel: string }}
 */
function nodeDistSpec() {
  const platform = process.platform
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  if (platform === 'darwin') {
    return { platform: 'darwin', arch, ext: 'tar.gz', binaryRel: join('bin', 'node') }
  }
  if (platform === 'linux') {
    return { platform: 'linux', arch, ext: 'tar.xz', binaryRel: join('bin', 'node') }
  }
  if (platform === 'win32') {
    return { platform: 'win', arch: arch === 'arm64' ? 'arm64' : 'x64', ext: 'zip', binaryRel: 'node.exe' }
  }
  throw new Error(`prepare-resources: unsupported platform ${platform}`)
}

/**
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
  const response = await fetch(url)
  if (!response.ok || response.body === null) {
    throw new Error(`prepare-resources: download failed ${url} (${response.status})`)
  }
  await pipeline(response.body, createWriteStream(dest))
}

function resolvePnpmCli() {
  // Windows GitHub Actions puts pnpm on PATH as pnpm.CMD; spawnSync('pnpm') is ENOENT.
  if (process.platform === 'win32') {
    const home = process.env.PNPM_HOME
    if (home) {
      for (const name of ['pnpm.CMD', 'pnpm.exe', 'pnpm.cmd']) {
        const candidate = join(home, name)
        if (existsSync(candidate)) return candidate
      }
    }
    return 'pnpm.cmd'
  }
  return 'pnpm'
}

function prepareDsh() {
  rmSync(dshOut, { recursive: true, force: true })
  mkdirSync(packRoot, { recursive: true })
  // shell:true on win32 so .cmd shims resolve the same way the runner shell does.
  execFileSync(
    resolvePnpmCli(),
    ['--filter', '@deepseek-ai/dsh', 'deploy', '--prod', '--legacy', dshOut],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    },
  )
  if (!existsSync(join(dshOut, 'lib', 'bin.js'))) {
    throw new Error(`prepare-resources: missing ${join(dshOut, 'lib', 'bin.js')}`)
  }
}

async function prepareNode() {
  rmSync(nodeOut, { recursive: true, force: true })
  mkdirSync(packRoot, { recursive: true })
  const spec = nodeDistSpec()
  const base = `node-v${NODE_VERSION}-${spec.platform}-${spec.arch}`
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${base}.${spec.ext}`
  const staging = join(tmpdir(), `dsh-desktop-node-${process.pid}`)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  const archive = join(staging, `node.${spec.ext}`)
  console.log(`prepare-resources: downloading ${url}`)
  await download(url, archive)

  if (spec.ext === 'zip') {
    // Windows runners have PowerShell; local macOS/Linux can use unzip when present.
    if (process.platform === 'win32') {
      execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${archive}' -DestinationPath '${staging}'`],
        { stdio: 'inherit' },
      )
    } else {
      execFileSync('unzip', ['-q', archive, '-d', staging], { stdio: 'inherit' })
    }
  } else {
    execFileSync('tar', ['-xf', archive, '-C', staging], { stdio: 'inherit' })
  }

  const extracted = join(staging, base)
  const extractedBinary = join(extracted, spec.binaryRel)
  if (!existsSync(extractedBinary)) {
    throw new Error(`prepare-resources: expected extracted binary ${extractedBinary}`)
  }
  // Ship only the Node executable. Official dist trees ship npm/npx/corepack as
  // relative symlinks that electron-builder / Gatekeeper paths break, and the
  // desktop shell only needs `node` to run the bundled dsh bin.
  const binary = join(nodeOut, spec.binaryRel)
  mkdirSync(dirname(binary), { recursive: true })
  await cp(extractedBinary, binary)
  if (process.platform !== 'win32') {
    await chmod(binary, 0o755)
  }
  await rm(staging, { recursive: true, force: true })
  console.log(`prepare-resources: node ready at ${binary}`)
}

prepareDsh()
await prepareNode()
console.log('prepare-resources: done')
