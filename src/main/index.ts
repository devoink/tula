import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, powerSaveBlocker } from 'electron'
import { APP_NAME } from '../shared/appName'
import { getSettings, getWindowBounds, initConfig, setWindowBounds } from './config'
import { broadcast, registerIpc } from './ipc'
import { mainWindow } from './about'
import { installMenu } from './menu'
import { resolvePreload } from './runtime'
import { Supervisor } from './supervisor'
import { APPEARANCE_COLOR, applyThemePreference, currentAppearance, watchSystemTheme } from './theme'

app.setName(APP_NAME)

const legacyUserData = join(app.getPath('appData'), '图片压缩')
const userData = join(app.getPath('appData'), APP_NAME)
if (!existsSync(userData) && existsSync(legacyUserData)) {
  try {
    renameSync(legacyUserData, userData)
  } catch (error) {
    console.error('配置目录改名失败', error)
    app.setPath('userData', legacyUserData)
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let blocker: number | null = null
  let inflight = 0
  const supervisor = new Supervisor(() => getSettings().concurrency, (event) => {
    broadcast(event)
    if (event.type === 'started') inflight += 1
    if (event.type === 'done' || event.type === 'failed' || event.type === 'cancelled') {
      inflight = Math.max(0, inflight - 1)
    }
    if (event.type === 'engine-error') inflight = 0
    if (inflight > 0 && blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension')
    if (inflight === 0 && blocker !== null) {
      powerSaveBlocker.stop(blocker)
      blocker = null
    }
  })

  app.whenReady().then(() => {
    const icon = join(app.getAppPath(), 'resources/icon.png')
    if (process.platform === 'darwin' && existsSync(icon)) app.dock?.setIcon(icon)
    initConfig()
    applyThemePreference(getSettings().theme)
    watchSystemTheme()
    installMenu()
    registerIpc(supervisor)
    createWindow()

    app.on('activate', () => {
      if (!mainWindow()) createWindow()
    })
  })

  app.on('second-instance', () => {
    const win = mainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.on('before-quit', () => {
    supervisor.shutdown()
    if (blocker !== null) powerSaveBlocker.stop(blocker)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

function createWindow(): void {
  const bounds = getWindowBounds()
  const win = new BrowserWindow({
    ...(bounds
      ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      : { width: 1180, height: 760 }),
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: APPEARANCE_COLOR[currentAppearance()],
    title: APP_NAME,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  if (!bounds) win.center()
  win.webContents.setBackgroundThrottling(false)

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('预加载失败', preloadPath, error)
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.once('ready-to-show', () => win.show())

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const remember = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized() || win.isMaximized() || win.isFullScreen()) return
      setWindowBounds(win.getBounds())
    }, 400)
  }
  win.on('resize', remember)
  win.on('move', remember)
  win.on('close', () => {
    if (!win.isMinimized() && !win.isMaximized() && !win.isFullScreen()) setWindowBounds(win.getBounds())
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)))
  }
}
