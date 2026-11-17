import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import type { Preset } from '../shared/types'
import { compressFile } from './pipeline'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

const jpegPreset: Preset = {
  id: '0123456789',
  name: '测试',
  builtin: false,
  format: 'jpeg',
  quality: 50,
  resize: { mode: 'long-edge', longEdge: 160 }
}

describe('compressFile', () => {
  it('shrinks a jpeg and drops metadata', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tula-jpeg-'))
    directories.push(directory)
    const input = path.join(directory, 'noise.jpg')
    const raw = Buffer.alloc(320 * 200 * 3)
    for (let index = 0; index < raw.length; index += 1) raw[index] = (index * 17) % 256
    await sharp(raw, { raw: { width: 320, height: 200, channels: 3 } })
      .jpeg({ quality: 95 })
      .withMetadata({ density: 144 })
      .toFile(input)

    const result = await compressFile(input, jpegPreset, new AbortController().signal)
    const meta = await sharp(result.outputPath).metadata()
    expect(result.flattened).toBe(false)
    expect(result.bytesOut).toBeLessThan(result.bytesIn)
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(160)
    expect(meta.height).toBe(100)
    expect(meta.exif).toBeUndefined()
    expect(meta.density).not.toBe(144)
    expect(path.dirname(result.outputPath)).toBe(await fs.realpath(path.join(directory, 'compressed')))
  })

  it('keeps gif frames and flattens them for png', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tula-gif-'))
    directories.push(directory)
    const input = path.join(directory, 'blink.gif')
    const red = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 220, g: 48, b: 36 } }
    }).png().toBuffer()
    const blue = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 36, g: 86, b: 210 } }
    }).png().toBuffer()
    await sharp([red, blue], { join: { animated: true } }).gif({ delay: [80, 80] }).toFile(input)

    const keep: Preset = {
      ...jpegPreset,
      format: 'original',
      resize: { mode: 'long-edge', longEdge: 20 }
    }
    const kept = await compressFile(input, keep, new AbortController().signal)
    const keptMeta = await sharp(kept.outputPath, { animated: true }).metadata()
    expect(kept.flattened).toBe(false)
    expect(keptMeta.pages).toBe(2)
    expect(keptMeta.width).toBe(20)
    expect(keptMeta.pageHeight).toBe(10)

    const flat: Preset = { ...jpegPreset, format: 'png', resize: { mode: 'none' }, quality: 95 }
    const flattened = await compressFile(input, flat, new AbortController().signal)
    const flatMeta = await sharp(flattened.outputPath, { animated: true }).metadata()
    expect(flattened.flattened).toBe(true)
    expect(flatMeta.format).toBe('png')
    expect(flatMeta.pages ?? 1).toBe(1)
  })
})
