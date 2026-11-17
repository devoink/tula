import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../shared/errors'
import type { ImageFormat } from '../shared/types'

export function extensionFor(format: ImageFormat): string {
  return format === 'jpeg' ? '.jpg' : `.${format}`
}

export function safeStem(inputFile: string): string {
  const stem = path.parse(inputFile).name.replace(/[\\/]/g, '').trim()
  if (!stem || stem === '.' || stem === '..') return 'image'
  return stem
}

export async function allocateOutputPath(inputFile: string, format: ImageFormat): Promise<string> {
  const directory = path.join(path.dirname(inputFile), 'compressed')
  await fs.mkdir(directory, { recursive: true })
  const root = await fs.realpath(directory)
  const stem = safeStem(inputFile)
  const extension = extensionFor(format)
  const resolvedInput = path.resolve(inputFile)

  for (let index = 1; index < 5000; index += 1) {
    const fileName = index === 1 ? `${stem}${extension}` : `${stem}-${index}${extension}`
    const candidate = path.join(root, fileName)
    if (!candidate.startsWith(`${root}${path.sep}`)) throw new AppError('输出路径无效')
    if (path.resolve(candidate) === resolvedInput) continue
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }

  throw new AppError('同名文件过多')
}

export function partialPath(outputFile: string): string {
  return path.join(path.dirname(outputFile), `.partial-${randomUUID()}`)
}
