import fs from 'node:fs/promises'
import path from 'node:path'
import type { FileInfo, ImportResult } from '../shared/types'

const INPUT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const SKIP_DIRECTORIES = new Set(['compressed', 'node_modules'])
const MAX_DEPTH = 8

export async function collectInputs(inputs: string[], options?: { limit?: number }): Promise<ImportResult> {
  const limit = options?.limit ?? 2000
  const files: FileInfo[] = []
  const seenFiles = new Set<string>()
  const seenDirs = new Set<string>()
  let skipped = 0
  let truncated = false

  async function addFile(filePath: string) {
    if (truncated) return
    const real = await fs.realpath(filePath).catch(() => null)
    if (!real || seenFiles.has(real)) return
    const extension = path.extname(real).toLowerCase()
    if (!INPUT_EXTENSIONS.has(extension)) {
      skipped += 1
      return
    }
    const stat = await fs.stat(real).catch(() => null)
    if (!stat?.isFile() || stat.size <= 0) {
      skipped += 1
      return
    }
    seenFiles.add(real)
    files.push({ path: real, name: path.basename(filePath), bytes: stat.size })
    if (files.length >= limit) truncated = true
  }

  async function walk(directory: string, depth: number) {
    if (truncated || depth > MAX_DEPTH) return
    const realDir = await fs.realpath(directory).catch(() => null)
    if (!realDir || seenDirs.has(realDir)) return
    seenDirs.add(realDir)
    const entries = await fs.readdir(realDir, { withFileTypes: true }).catch(() => null)
    if (!entries) return

    for (const entry of entries) {
      if (truncated) return
      if (entry.name.startsWith('.')) continue
      const full = path.join(realDir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue
        await walk(full, depth + 1)
        continue
      }
      if (entry.isFile()) {
        await addFile(full)
        continue
      }
      if (entry.isSymbolicLink()) {
        const stat = await fs.stat(full).catch(() => null)
        if (stat?.isFile()) await addFile(full)
      }
    }
  }

  for (const input of inputs) {
    if (truncated) break
    const stat = await fs.stat(input).catch(() => null)
    if (!stat) {
      skipped += 1
      continue
    }
    if (stat.isDirectory()) await walk(input, 0)
    else if (stat.isFile()) await addFile(input)
    else skipped += 1
  }

  files.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }))
  return { files, skipped, truncated }
}
