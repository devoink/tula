import type { ImageFormat, Preset } from '../shared/types'

export type FrameSource = {
  format: ImageFormat
  width: number
  height: number
  pages: number
}

export type CompressionPlan = {
  outputFormat: ImageFormat
  animated: boolean
  flattened: boolean
  resize: { width: number; height: number } | null
}

export function asImageFormat(format: string | undefined): ImageFormat | null {
  if (format === 'jpg' || format === 'jpeg') return 'jpeg'
  if (format === 'png' || format === 'webp' || format === 'gif') return format
  return null
}

function scaleToEdge(
  width: number,
  height: number,
  limit: number,
  edge: number
): { width: number; height: number } | null {
  if (width <= 0 || height <= 0 || edge <= 0) return null
  if (edge <= limit) return null
  const scale = limit / edge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

export function longEdgeResize(
  width: number,
  height: number,
  longEdge: number
): { width: number; height: number } | null {
  return scaleToEdge(width, height, longEdge, Math.max(width, height))
}

export function shortEdgeResize(
  width: number,
  height: number,
  shortEdge: number
): { width: number; height: number } | null {
  return scaleToEdge(width, height, shortEdge, Math.min(width, height))
}

export function planCompression(source: FrameSource, preset: Preset): CompressionPlan {
  const outputFormat = preset.format === 'original' ? source.format : preset.format
  const animatedInput = source.pages > 1 && (source.format === 'gif' || source.format === 'webp')
  const flattened = animatedInput && (outputFormat === 'jpeg' || outputFormat === 'png')
  const animated = animatedInput && !flattened && (outputFormat === 'gif' || outputFormat === 'webp')
  const resize =
    preset.resize.mode === 'long-edge'
      ? longEdgeResize(source.width, source.height, preset.resize.longEdge)
      : preset.resize.mode === 'short-edge'
        ? shortEdgeResize(source.width, source.height, preset.resize.shortEdge)
        : null
  return { outputFormat, animated, flattened, resize }
}

export function gifColours(quality: number): number {
  return Math.max(16, Math.min(256, Math.round((quality / 100) * 256)))
}
