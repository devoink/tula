import { describe, expect, it } from 'vitest'
import { describePreset, builtinPresets, DEFAULT_PRESET_ID } from './presets'
import { defaultSettings, presetSchema, settingsSchema } from './schema'
import { formatBytes, formatRatio, formatSaved } from './format'

describe('builtin presets', () => {
  it('keeps unique ids inside the quality range', () => {
    const ids = builtinPresets.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_PRESET_ID)
    for (const preset of builtinPresets) {
      expect(preset.builtin).toBe(true)
      expect(presetSchema.safeParse(preset).success).toBe(true)
    }
  })

  it('describes the long-edge preset', () => {
    const preset = builtinPresets.find((item) => item.id === 'builtin-web-balanced')
    expect(preset).toBeDefined()
    expect(describePreset(preset!)).toContain('2560')
  })
})

describe('settings', () => {
  it('follows the system when an older config has no theme', () => {
    const parsed = settingsSchema.parse({ defaultPresetId: DEFAULT_PRESET_ID, concurrency: 2 })
    expect(parsed.theme).toBe('system')
    expect(defaultSettings().theme).toBe('system')
  })
})

describe('formatters', () => {
  it('formats bytes, ratios and savings', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatRatio(1000, 400)).toBe('−60%')
    expect(formatRatio(100, 130)).toBe('+30%')
    expect(formatSaved(2048)).toBe('节省 2.0 KB')
    expect(formatSaved(-1024)).toBe('增加 1.0 KB')
  })
})
