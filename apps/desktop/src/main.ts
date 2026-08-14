/**
 * Electron main process: spawn `dsh web` on an OS-assigned loopback port, open
 * a BrowserWindow at the readiness URL, and tear the child down with the app.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { app, BrowserWindow, shell } from 'electron'
import { resolveNodePath, spawnWeb, type WebChild } from './spawn-web.ts'

/** Keep a strong reference so GC cannot close the window while the app runs. */
let mainWindow: BrowserWindow | undefined
/** Live web child; killed on quit. */
let webChild: WebChild | undefined

/**
 * Create the product window and load the announced loopback URL.
 * @param url - readiness URL from `dsh web`.
 */
function openWindow(url: string): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    show: false,
    webPreferences: {
      // The page is the same origin as loopback `dsh web`; no preload bridge.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  window.once('ready-to-show', () => {
    window.show()
  })
  // Keep navigation inside the harness origin; open other http(s) in the OS browser.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      const parsed = new URL(target)
      if (parsed.origin === new URL(url).origin) return { action: 'allow' }
    } catch {
      // Fall through to external open.
    }
    void shell.openExternal(target)
    return { action: 'deny' }
  })
  void window.loadURL(url)
}

/**
 * Boot the web child, then the window. Failures exit nonzero so packagers and
 * supervisors see a failed launch rather than a blank shell.
 */
async function boot(): Promise<void> {
  const child = await spawnWeb({
    nodePath: resolveNodePath(),
    cwd: process.cwd(),
  })
  webChild = child
  openWindow(child.url)
}

app.whenReady().then(() => {
  void boot().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    app.exit(1)
  })
})

app.on('window-all-closed', () => {
  // Match ordinary desktop apps on every platform: last window closes the app.
  app.quit()
})

app.on('before-quit', () => {
  const child = webChild?.process
  if (child === undefined || child.killed) return
  child.kill('SIGTERM')
})
