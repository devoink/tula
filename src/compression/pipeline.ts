import fs from 'node:fs/promises'
import sharp from 'sharp'
import { AppError } from '../shared/errors'
import { PNG_LOSSLESS_FROM } from '../shared/schema'
import type { Preset } from '../shared/types'
import { Cancelled } from './errors'
import { allocateOutputPath, partialPath } from './paths'
import { asImageFormat, gifColours, planCompression } from './plan'

export type CompressOutput = {
  outputPath: string
  bytesIn: number
  bytesOut: number
  flattened: boolean
}

export async function compressFile(inputPath: string, preset: Preset, signal: AbortSignal): Promise<CompressOutput> {
  if (signal.aborted) throw new Cancelled()

  const sourceStat = await fs.stat(inputPath).catch(() => null)
  if (!sourceStat?.isFile()) throw new AppError('找不到原图')

  const meta = await sharp(inputPath, { animated: true, pages: -1 }).metadata()
  if (signal.aborted) throw new Cancelled()

  const format = asImageFormat(meta.format)
  if (!format || !meta.width || !meta.height) throw new AppError('无法识别这张图片')

  const pages = meta.pages && meta.pages > 1 ? meta.pages : 1
  const frameHeight = pages > 1 && meta.pageHeight ? meta.pageHeight : meta.height
  const plan = planCompression({ format, width: meta.width, height: frameHeight, pages }, preset)

  let image = sharp(inputPath, plan.animated ? { animated: true, pages: -1 } : { sequentialRead: true })
  const stop = () => image.destroy()
  signal.addEventListener('abort', stop, { once: true })

  let temporary: string | null = null
  let committed = false

  try {
    if (plan.resize) {
      // sharp applies resize to each frame of an animated image.
      image = image.resize({
        width: plan.resize.width,
        height: plan.resize.height,
        fit: 'fill'
      })
    }
    if (!plan.animated) image = image.rotate()

    image = encode(image, plan.outputFormat, preset, plan.animated, meta.delay)

    const outputPath = await allocateOutputPath(inputPath, plan.outputFormat)
    if (signal.aborted) throw new Cancelled()
    temporary = partialPath(outputPath)
    await image.toFile(temporary)
    if (signal.aborted) throw new Cancelled()
    await fs.rename(temporary, outputPath)
    committed = true
    const bytesOut = (await fs.stat(outputPath)).size
    return {
      outputPath,
      bytesIn: sourceStat.size,
      bytesOut,
      flattened: plan.flattened
    }
  } finally {
    signal.removeEventListener('abort', stop)
    if (temporary && !committed) await fs.rm(temporary, { force: true }).catch(() => undefined)
  }
}

function encode(
  image: ReturnType<typeof sharp>,
  format: 'jpeg' | 'png' | 'webp' | 'gif',
  preset: Preset,
  animated: boolean,
  delay: number[] | undefined
): ReturnType<typeof sharp> {
  if (format === 'jpeg') {
    return image.flatten({ background: '#ffffff' }).jpeg({
      quality: preset.quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: preset.quality >= PNG_LOSSLESS_FROM ? '4:4:4' : '4:2:0',
      force: true
    })
  }

  if (format === 'png') {
    if (preset.quality >= PNG_LOSSLESS_FROM) {
      return image.png({ compressionLevel: 9, effort: 8, force: true })
    }
    return image.png({
      quality: preset.quality,
      palette: true,
      effort: 8,
      compressionLevel: 9,
      force: true
    })
  }

  if (format === 'gif') {
    return image.gif({
      effort: 7,
      colours: gifColours(preset.quality),
      dither: 0.8,
      loop: 0,
      delay,
      force: true
    })
  }

  return image.webp({
    quality: preset.quality,
    effort: preset.quality >= 85 ? 5 : 4,
    smartSubsample: !animated && preset.quality < PNG_LOSSLESS_FROM,
    loop: animated ? 0 : undefined,
    delay: animated ? delay : undefined,
    force: true
  })
}
