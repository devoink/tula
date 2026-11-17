import { BrowserWindow } from 'electron'
import { fileURLToPath } from 'node:url'
import { APP_NAME } from '../shared/appName'
import { resolvePreload } from './runtime'
import { APPEARANCE_COLOR, currentAppearance } from './theme'

const aboutWindows = new WeakSet<BrowserWindow>()
let aboutWindow: BrowserWindow | null = null

export function isAboutWindow(win: BrowserWindow): boolean {
  return aboutWindows.has(win)
}

export function mainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find((win) => !win.isDestroyed() && !aboutWindows.has(win))
}

export function openAbout(): void {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    if (aboutWindow.isMinimized()) aboutWindow.restore()
    aboutWindow.show()
    aboutWindow.focus()
    return
  }

  const win = new BrowserWindow({
    width: 300,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: `关于${APP_NAME}`,
    backgroundColor: APPEARANCE_COLOR[currentAppearance()],
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      preload: resolvePreload(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  aboutWindows.add(win)
  aboutWindow = win
  win.on('closed', () => {
    if (aboutWindow === win) aboutWindow = null
  })
  win.webContents.on('page-title-updated', (event) => event.preventDefault())
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.once('ready-to-show', () => {
    place(win)
    win.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('about', '1')
    void win.loadURL(url.toString())
  } else {
    void win.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)), {
      query: { about: '1' }
    })
  }
}

function place(win: BrowserWindow): void {
  const parent = mainWindow()
  if (!parent) {
    win.center()
    return
  }
  const bounds = parent.getBounds()
  const size = win.getBounds()
  win.setPosition(
    Math.round(bounds.x + (bounds.width - size.width) / 2),
    Math.round(bounds.y + (bounds.height - size.height) / 2)
  )
}
