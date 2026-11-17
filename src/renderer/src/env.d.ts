import type { DesktopBridge } from '../../shared/bridge'

declare global {
  interface Window {
    desktop?: DesktopBridge
  }
}

declare module '*.png' {
  const src: string
  export default src
}

export {}
