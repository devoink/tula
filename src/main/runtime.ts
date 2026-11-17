import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { AppError } from '../shared/errors'

export function resolvePreload(): string {
  return resolveSibling('../preload', ['index.js', 'index.mjs', 'index.cjs'])
}

export function resolveWorker(): string {
  return resolveSibling('.', ['worker.js', 'worker.mjs'])
}

export function forkEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value
  }
  env.SHARP_IGNORE_GLOBAL_LIBVIPS = '1'
  return env
}

function resolveSibling(directory: string, names: string[]): string {
  const base = path.join(path.dirname(fileURLToPath(import.meta.url)), directory)
  for (const name of names) {
    const candidate = path.join(base, name)
    if (fs.existsSync(candidate)) return candidate
  }
  throw new AppError('应用文件缺失')
}
