#!/usr/bin/env node
/**
 * Prepare Electron extraResources: a `pnpm deploy` of `@deepseek-ai/dsh` plus the
 * platform `node` executable only (not the full Node dist with npm/npx/corepack).
 * Run from the repository root after `pnpm run build`.
 *
 * Usage: node apps/desktop/scripts/prepare-resources.mjs
 */
import {
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { chmod, cp, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(here, '..')
const repoRoot = resolve(join(desktopRoot, '..', '..'))
const packRoot = join(desktopRoot, '.pack')
// Nest under `runtime/` so electron-builder's extraResources copy keeps
// `dsh/node_modules`. createFilter always drops a top-level `node_modules`
// relative to `from` (app-builder-lib util/filter.js).
const runtimeRoot = join(packRoot, 'runtime')
const dshOut = join(runtimeRoot, 'dsh')
const nodeOut = join(runtimeRoot, 'node')

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
  const home = process.env.PNPM_HOME
  if (home) {
    const candidate = join(home, 'pnpm')
    if (existsSync(candidate)) return candidate
  }
  for (const candidate of ['/opt/homebrew/bin/pnpm', '/usr/local/bin/pnpm']) {
    if (existsSync(candidate)) return candidate
  }
  return 'pnpm'
}

/**
 * Resolve a symlink that may be a broken relative embedding of an absolute
 * monorepo path (pnpm deploy to /tmp writes `../.../Users/.../vendor/pkg`).
 * @param {string} linkPath
 * @returns {string | undefined}
 */
function resolveSymlinkTarget(linkPath) {
  const raw = readlinkSync(linkPath)
  if (raw.includes(repoRoot)) {
    const candidate = repoRoot + raw.slice(raw.indexOf(repoRoot) + repoRoot.length)
    if (existsSync(candidate)) return candidate
  }
  try {
    return realpathSync(linkPath)
  } catch {
    return undefined
  }
}

/**
 * Replace symlinks that point outside `root` with real copies so the tree stays
 * runnable after electron-builder copies it into an `.app` / installer.
 * Package `node_modules` are omitted: peers/deps must already live in the
 * deploy virtual store (`auto-install-peers` during prepare). Nested
 * node_modules copies explode size and can loop.
 * @param {string} root - deploy directory (absolute).
 */
async function materializeOutboundSymlinks(root) {
  const rootReal = realpathSync(root)
  /** @type {string[]} */
  const outbound = []

  /**
   * @param {string} dir
   */
  function collect(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      let st
      try {
        st = lstatSync(full)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) {
        const target = resolveSymlinkTarget(full)
        if (target === undefined) {
          throw new Error(`prepare-resources: unresolvable symlink ${relative(root, full)}`)
        }
        if (target === rootReal || target.startsWith(rootReal + sep)) continue
        outbound.push(full)
      } else if (st.isDirectory()) {
        collect(full)
      }
    }
  }

  collect(root)
  outbound.sort((a, b) => b.length - a.length)
  for (const link of outbound) {
    const target = resolveSymlinkTarget(link)
    if (target === undefined) {
      throw new Error(`prepare-resources: unresolvable symlink ${link}`)
    }
    unlinkSync(link)
    if (existsSync(link)) {
      throw new Error(`prepare-resources: failed to unlink ${link}`)
    }
    await cp(target, link, {
      recursive: true,
      filter: (src) => {
        const rel = relative(target, src)
        if (rel === 'node_modules' || rel.startsWith(`node_modules${sep}`)) return false
        if (rel === 'apps' || rel.startsWith(`apps${sep}`)) return false
        return true
      },
    })
  }
  console.log(`prepare-resources: materialized ${outbound.length} outbound symlinks`)
}

/**
 * Ensure every workspace `@deepseek-ai/*` package is reachable from the deploy
 * top-level `node_modules/@deepseek-ai/`. Prefer symlinking into the existing
 * `.pnpm` virtual-store copy (keeps sibling deps like `zod`); only copy from
 * the monorepo source when deploy omitted the package entirely (common for
 * peer-only Service Definitions such as `dsh-timeout`).
 * @param {string} deployRoot
 */
async function hoistWorkspacePackages(deployRoot) {
  const destRoot = join(deployRoot, 'node_modules', '@deepseek-ai')
  mkdirSync(destRoot, { recursive: true })
  const pnpmRoot = join(deployRoot, 'node_modules', '.pnpm')
  /** @type {Map<string, string>} short name -> absolute package dir inside .pnpm */
  const pnpmPackages = new Map()
  if (existsSync(pnpmRoot)) {
    for (const entry of readdirSync(pnpmRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const scoped = join(pnpmRoot, entry.name, 'node_modules', '@deepseek-ai')
      if (!existsSync(scoped)) continue
      for (const pkg of readdirSync(scoped, { withFileTypes: true })) {
        if (!pkg.isDirectory() && !pkg.isSymbolicLink()) continue
        const full = join(scoped, pkg.name)
        if (!existsSync(join(full, 'package.json'))) continue
        const existing = pnpmPackages.get(pkg.name)
        // Prefer the package's own virtual-store folder (`@deepseek-ai+name@...`);
        // nested copies under other packages often lack sibling deps like zod.
        const ownStore = entry.name.startsWith(`@deepseek-ai+${pkg.name}@`)
          || entry.name.startsWith(`${pkg.name}@`)
        if (existing === undefined || ownStore) {
          pnpmPackages.set(pkg.name, full)
        }
      }
    }
  }

  /** @type {string[]} */
  const searchRoots = [
    join(repoRoot, 'packages'),
    join(repoRoot, 'vendor'),
    join(repoRoot, 'apps', 'cli'),
    join(repoRoot, 'apps', 'web'),
    join(repoRoot, 'native'),
  ]
  /** @type {Promise<void>[]} */
  const pendingCopies = []
  let linked = 0
  let copied = 0

  /**
   * @param {string} short
   * @param {string} sourceDir
   */
  function ensureTopLevel(short, sourceDir) {
    const dest = join(destRoot, short)
    if (existsSync(dest)) return
    const fromPnpm = pnpmPackages.get(short)
    if (fromPnpm !== undefined) {
      // Relative symlink so the tree survives being moved into Electron Resources.
      symlinkSync(relative(destRoot, fromPnpm), dest)
      linked += 1
      return
    }
    pendingCopies.push(
      cp(sourceDir, dest, {
        recursive: true,
        filter: (src) => {
          const rel = relative(sourceDir, src)
          if (rel === 'node_modules' || rel.startsWith(`node_modules${sep}`)) return false
          if (rel === 'apps' || rel.startsWith(`apps${sep}`)) return false
          return true
        },
      }).then(() => {
        copied += 1
      }),
    )
  }

  /**
   * @param {string} dir
   */
  function walk(dir) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === 'src') continue
      const full = join(dir, entry.name)
      const manifestPath = join(full, 'package.json')
      if (existsSync(manifestPath)) {
        let name
        try {
          name = JSON.parse(readFileSync(manifestPath, 'utf8')).name
        } catch {
          walk(full)
          continue
        }
        if (typeof name === 'string' && name.startsWith('@deepseek-ai/')) {
          ensureTopLevel(name.slice('@deepseek-ai/'.length), full)
          continue
        }
      }
      walk(full)
    }
  }
  for (const root of searchRoots) {
    if (existsSync(root)) walk(root)
  }
  await Promise.all(pendingCopies)
  console.log(`prepare-resources: hoisted ${linked} from .pnpm, copied ${copied} missing peers`)
}

async function prepareDsh() {
  rmSync(dshOut, { recursive: true, force: true })
  mkdirSync(runtimeRoot, { recursive: true })
  // Deploy outside the monorepo. In-tree deploy into apps/desktop/.pack can
  // mkdir pollution under vendor/* via rewritten relative workspace links.
  const deployStaging = join(tmpdir(), `dsh-desktop-deploy-${process.pid}`)
  rmSync(deployStaging, { recursive: true, force: true })
  const deployEnv = {
    ...process.env,
    npm_config_confirm_modules_purge: 'false',
    npm_config_production: 'false',
    // Peer Service Definitions (dsh-timeout, dsh-scope, ...) are not plain
    // dependencies of most providers; without this, deploy --prod omits them
    // and packaged imports fail inside the .pnpm virtual store.
    npm_config_auto_install_peers: 'true',
    NODE_ENV: 'development',
    // Skip install-lefthook (needs tsx/esbuild in a git worktree). Do not set
    // CI=true: that made pnpm prune the repo root node_modules during deploy.
    GITHUB_ACTIONS: 'true',
  }
  delete deployEnv.CI
  execFileSync(
    resolvePnpmCli(),
    ['--filter', '@deepseek-ai/dsh', 'deploy', '--prod', '--legacy', deployStaging],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: deployEnv,
    },
  )
  await materializeOutboundSymlinks(deployStaging)
  await hoistWorkspacePackages(deployStaging)
  try {
    renameSync(deployStaging, dshOut)
  } catch {
    await cp(deployStaging, dshOut, { recursive: true })
    rmSync(deployStaging, { recursive: true, force: true })
  }
  if (!existsSync(join(dshOut, 'lib', 'bin.js'))) {
    throw new Error(`prepare-resources: missing ${join(dshOut, 'lib', 'bin.js')}`)
  }
  if (!existsSync(join(dshOut, 'node_modules'))) {
    throw new Error(`prepare-resources: missing ${join(dshOut, 'node_modules')}`)
  }
  // Peers that crash packaged `dsh web` when missing after deploy --prod.
  for (const pkg of ['dsh-app-boot', 'dsh-timeout', 'dsh-scope', 'dsh-atomic-write']) {
    const path = join(dshOut, 'node_modules', '@deepseek-ai', pkg, 'package.json')
    if (!existsSync(path)) {
      throw new Error(`prepare-resources: missing hoisted peer @deepseek-ai/${pkg}`)
    }
  }
  // Fail loud if the packaged CLI cannot even print help.
  execFileSync(process.execPath, [join(dshOut, 'lib', 'bin.js'), '--help'], {
    cwd: dshOut,
    stdio: 'inherit',
    env: process.env,
  })
  // Fail loud if `dsh web` cannot load its plugin tree (missing peers/deps).
  await smokeDshWeb(dshOut)
}

/**
 * Start packaged `dsh web --port 0` and require a readiness URL.
 * @param {string} dshRoot
 */
function smokeDshWeb(dshRoot) {
  const smokeHome = join(tmpdir(), `dsh-desktop-web-smoke-${process.pid}`)
  rmSync(smokeHome, { recursive: true, force: true })
  mkdirSync(join(smokeHome, '.dsh'), { recursive: true })
  const bin = join(dshRoot, 'lib', 'bin.js')
  const child = spawn(process.execPath, [bin, 'web', '--port', '0'], {
    cwd: smokeHome,
    env: { ...process.env, HOME: smokeHome, DSH_HOME: join(smokeHome, '.dsh') },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      finish(new Error('prepare-resources: dsh web smoke timed out (no readiness URL)'))
    }, 60_000)
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGTERM')
      rmSync(smokeHome, { recursive: true, force: true })
      if (error) reject(error)
      else resolve(undefined)
    }
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
      if (/dsh web: http:\/\//.test(stdout)) finish(undefined)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => finish(error))
    child.on('exit', (code) => {
      if (settled) return
      finish(
        new Error(
          `prepare-resources: dsh web smoke exited ${code}\n${stderr || stdout}`.trim(),
        ),
      )
    })
  })
}

async function prepareNode() {
  rmSync(nodeOut, { recursive: true, force: true })
  mkdirSync(runtimeRoot, { recursive: true })
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

await prepareDsh()
await prepareNode()
console.log('prepare-resources: done')
