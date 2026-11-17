import type { DesktopBridge } from '../../shared/bridge'

export function getDesktop(): DesktopBridge {
  if (!window.desktop) throw new Error('请在桌面应用里打开')
  return window.desktop
}
