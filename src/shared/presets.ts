import type { Preset } from './types'

export const DEFAULT_PRESET_ID = 'builtin-web-hq'

export const builtinPresets: Preset[] = [
  {
    id: 'builtin-web-hq',
    name: '网页高质量',
    builtin: true,
    format: 'original',
    quality: 86,
    resize: { mode: 'none' }
  },
  {
    id: 'builtin-web-balanced',
    name: '网页均衡',
    builtin: true,
    format: 'original',
    quality: 76,
    resize: { mode: 'long-edge', longEdge: 2560 }
  },
  {
    id: 'builtin-small',
    name: '极致体积',
    builtin: true,
    format: 'webp',
    quality: 62,
    resize: { mode: 'long-edge', longEdge: 1920 }
  }
]

export function describePreset(preset: Preset): string {
  const formatLabel = {
    original: '原格式',
    jpeg: 'JPEG',
    webp: 'WebP',
    png: 'PNG'
  }[preset.format]
  const size =
    preset.resize.mode === 'long-edge'
      ? `长边 ${preset.resize.longEdge}`
      : preset.resize.mode === 'short-edge'
        ? `短边 ${preset.resize.shortEdge}`
        : '不缩放'
  return `${formatLabel} · 质量 ${preset.quality} · ${size}`
}

export function uniquePresetName(base: string, names: string[]): string {
  if (!names.includes(base)) return base
  let index = 2
  while (names.includes(`${base} ${index}`)) index += 1
  return `${base} ${index}`
}
