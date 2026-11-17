import { BrowserWindow, nativeTheme } from 'electron'
import { IPC } from '../shared/channels'
import type { Appearance, ThemePreference } from '../shared/types'
import { getSettings } from './config'

export const APPEARANCE_COLOR: Record<Appearance, string> = {
  dark: '#1e1e1e',
  light: '#ffffff'
}

export function currentAppearance(): Appearance {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

export function applyThemePreference(theme: ThemePreference): Appearance {
  nativeTheme.themeSource = theme
  const appearance = currentAppearance()
  const color = APPEARANCE_COLOR[appearance]
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.setBackgroundColor(color)
    win.webContents.send(IPC.theme, appearance)
  }
  return appearance
}

export function watchSystemTheme(): void {
  nativeTheme.on('updated', () => {
    if (getSettings().theme !== 'system') return
    applyThemePreference('system')
  })
}
