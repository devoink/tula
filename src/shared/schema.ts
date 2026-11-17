import { z } from 'zod'
import { builtinPresets, DEFAULT_PRESET_ID } from './presets'
import type { Settings } from './types'

export const QUALITY_MIN = 30
export const QUALITY_MAX = 100
export const LONG_EDGE_MIN = 1
export const LONG_EDGE_MAX = 16384
export const PNG_LOSSLESS_FROM = 90
export const CONCURRENCY_MIN = 1
export const CONCURRENCY_MAX = 10

const resizeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({
    mode: z.literal('long-edge'),
    longEdge: z.number().int().min(LONG_EDGE_MIN).max(LONG_EDGE_MAX)
  }),
  z.object({
    mode: z.literal('short-edge'),
    shortEdge: z.number().int().min(LONG_EDGE_MIN).max(LONG_EDGE_MAX)
  })
])

export const presetSchema = z.object({
  id: z.string().trim().min(8).max(80),
  name: z.string().trim().min(1).max(40),
  builtin: z.boolean(),
  format: z.enum(['original', 'jpeg', 'webp', 'png']),
  quality: z.number().int().min(QUALITY_MIN).max(QUALITY_MAX),
  resize: resizeSchema
})

export const settingsSchema = z.object({
  defaultPresetId: z.string().trim().min(1).max(80),
  concurrency: z.number().int().min(CONCURRENCY_MIN).max(CONCURRENCY_MAX),
  theme: z.enum(['system', 'light', 'dark']).default('system')
})

export const compressRequestSchema = z.object({
  id: z.string().trim().min(8).max(100),
  inputPath: z.string().min(1).max(4096),
  preset: presetSchema
})

export const importPathsSchema = z.array(z.string().min(1).max(4096)).max(5000)

export function defaultSettings(): Settings {
  return {
    defaultPresetId: DEFAULT_PRESET_ID,
    concurrency: 2,
    theme: 'system'
  }
}

export function knownPresetId(id: string, customIds: string[]): boolean {
  return builtinPresets.some((preset) => preset.id === id) || customIds.includes(id)
}
