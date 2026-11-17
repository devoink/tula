import type { Appearance, Bootstrap, Catalog, CompressEvent, CompressRequest, ImportResult, MenuAction, Settings, SettingsUpdate } from './types'

export type SettingsPatch = Partial<Pick<Settings, 'defaultPresetId' | 'concurrency' | 'theme'>>

export type DesktopBridge = {
  pathForFile: (file: File) => string
  getBootstrap: () => Promise<Bootstrap>
  pickFiles: () => Promise<string[]>
  pickFolder: () => Promise<string[]>
  importPaths: (paths: string[]) => Promise<ImportResult>
  startCompress: (jobs: CompressRequest[]) => Promise<void>
  pauseCompress: () => Promise<void>
  resumeCompress: () => Promise<void>
  cancelCompress: (ids: string[]) => Promise<void>
  showItem: (targetPath: string) => Promise<void>
  setSettings: (patch: SettingsPatch) => Promise<SettingsUpdate>
  savePreset: (preset: CompressRequest['preset']) => Promise<Catalog>
  deletePreset: (id: string) => Promise<Catalog>
  onCompressEvent: (listener: (event: CompressEvent) => void) => () => void
  onMenu: (listener: (action: MenuAction) => void) => () => void
  onTheme: (listener: (appearance: Appearance) => void) => () => void
}
