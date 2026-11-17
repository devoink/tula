import fs from 'node:fs'
import path from 'node:path'
import { app, screen } from 'electron'
import { ZodError } from 'zod'
import { builtinPresets, DEFAULT_PRESET_ID } from '../shared/presets'
import { defaultSettings, knownPresetId, presetSchema, settingsSchema } from '../shared/schema'
import type { Catalog, Preset, Settings, WindowBounds } from '../shared/types'
import { AppError } from '../shared/errors'

type Persisted = {
  settings: Settings
  presets: Preset[]
  windowBounds?: WindowBounds
}

let persisted: Persisted = {
  settings: defaultSettings(),
  presets: []
}

function configFile(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function write(): void {
  const file = configFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(persisted, null, 2))
  fs.renameSync(temporary, file)
}

function presetIdExists(id: string): boolean {
  return knownPresetId(id, persisted.presets.map((preset) => preset.id))
}

function ensureDefault(): void {
  if (!presetIdExists(persisted.settings.defaultPresetId)) {
    persisted.settings = { ...persisted.settings, defaultPresetId: DEFAULT_PRESET_ID }
  }
}

export function initConfig(): void {
  const file = configFile()
  if (!fs.existsSync(file)) return
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Persisted>
    const settings = settingsSchema.safeParse({ ...defaultSettings(), ...(raw.settings ?? {}) })
    const custom = Array.isArray(raw.presets)
      ? raw.presets.flatMap((item) => {
          const parsed = presetSchema.safeParse(item)
          if (!parsed.success || parsed.data.builtin) return []
          if (builtinPresets.some((preset) => preset.id === parsed.data.id)) return []
          return [{ ...parsed.data, builtin: false }]
        })
      : []
    persisted = {
      settings: settings.success ? settings.data : defaultSettings(),
      presets: custom,
      windowBounds: visibleBounds(raw.windowBounds)
    }
    ensureDefault()
  } catch (error) {
    console.error(error)
    const broken = `${file}.broken`
    fs.rmSync(broken, { force: true })
    fs.renameSync(file, broken)
    persisted = { settings: defaultSettings(), presets: [] }
  }
}

function visibleBounds(value: unknown): WindowBounds | undefined {
  if (!value || typeof value !== 'object') return undefined
  const bounds = value as Partial<WindowBounds>
  if (
    typeof bounds.x !== 'number' ||
    typeof bounds.y !== 'number' ||
    typeof bounds.width !== 'number' ||
    typeof bounds.height !== 'number'
  ) {
    return undefined
  }
  if (bounds.width < 800 || bounds.height < 600 || bounds.width > 4000 || bounds.height > 3000) return undefined
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea
    const overlapX = Math.min(bounds.x! + bounds.width!, area.x + area.width) - Math.max(bounds.x!, area.x)
    const overlapY = Math.min(bounds.y! + bounds.height!, area.y + area.height) - Math.max(bounds.y!, area.y)
    return overlapX > 80 && overlapY > 80
  })
  if (!visible) return undefined
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
}

export function getSettings(): Settings {
  return { ...persisted.settings }
}

export function getWindowBounds(): WindowBounds | undefined {
  return persisted.windowBounds ? { ...persisted.windowBounds } : undefined
}

export function setWindowBounds(bounds: WindowBounds): void {
  persisted.windowBounds = bounds
  write()
}

export function listPresets(): Preset[] {
  return [...builtinPresets, ...persisted.presets].map((preset) => structuredClone(preset))
}

export function getCatalog(): Catalog {
  return { presets: listPresets(), settings: getSettings() }
}

export function updateSettings(patch: unknown): Settings {
  const current = getSettings()
  const parsed = settingsSchema.safeParse({ ...current, ...(patch as object) })
  if (!parsed.success) throw invalid(parsed.error)
  if (!presetIdExists(parsed.data.defaultPresetId)) throw new AppError('默认预设不存在')
  persisted.settings = parsed.data
  write()
  return getSettings()
}

export function savePreset(input: unknown): Catalog {
  const parsed = presetSchema.safeParse(input)
  if (!parsed.success) throw invalid(parsed.error)
  if (parsed.data.builtin || builtinPresets.some((preset) => preset.id === parsed.data.id)) {
    throw new AppError('内置预设不能修改')
  }
  const next = { ...parsed.data, builtin: false }
  const exists = persisted.presets.some((preset) => preset.id === next.id)
  if (!exists && persisted.presets.length >= 50) throw new AppError('自定义预设最多 50 个')
  persisted.presets = persisted.presets.filter((preset) => preset.id !== next.id)
  persisted.presets.push(next)
  write()
  return getCatalog()
}

export function deletePreset(id: string): Catalog {
  if (builtinPresets.some((preset) => preset.id === id)) throw new AppError('内置预设不能删除')
  persisted.presets = persisted.presets.filter((preset) => preset.id !== id)
  if (persisted.settings.defaultPresetId === id) {
    persisted.settings = { ...persisted.settings, defaultPresetId: DEFAULT_PRESET_ID }
  }
  write()
  return getCatalog()
}

function invalid(error: ZodError): AppError {
  console.error(error.flatten())
  return new AppError('提交的内容无效')
}
