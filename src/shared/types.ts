export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif'

export type OutputFormat = 'original' | 'jpeg' | 'webp' | 'png'

export type Resize =
  | { mode: 'none' }
  | { mode: 'long-edge'; longEdge: number }
  | { mode: 'short-edge'; shortEdge: number }

export type Preset = {
  id: string
  name: string
  builtin: boolean
  format: OutputFormat
  quality: number
  resize: Resize
}

export type ThemePreference = 'system' | 'light' | 'dark'

export type Appearance = 'light' | 'dark'

export type Settings = {
  defaultPresetId: string
  concurrency: number
  theme: ThemePreference
}

export type Catalog = {
  presets: Preset[]
  settings: Settings
}

export type Bootstrap = Catalog & {
  version: string
  appearance: Appearance
}

export type SettingsUpdate = {
  settings: Settings
  appearance: Appearance
}

export type FileInfo = {
  path: string
  name: string
  bytes: number
}

export type ImportResult = {
  files: FileInfo[]
  skipped: number
  truncated: boolean
}

export type CompressRequest = {
  id: string
  inputPath: string
  preset: Preset
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type MenuAction = 'add-files' | 'add-folder' | 'start' | 'toggle-pause' | 'settings'

export type CompressEvent =
  | { type: 'started'; id: string }
  | {
      type: 'done'
      id: string
      outputPath: string
      bytesIn: number
      bytesOut: number
      flattened: boolean
    }
  | { type: 'failed'; id: string; message: string }
  | { type: 'cancelled'; id: string }
  | { type: 'engine-error'; message: string }

export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
}
