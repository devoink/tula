import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectInputs } from './files'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('collectInputs', () => {
  it('walks images and skips hidden files, notes, and previous output', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tula-files-'))
    directories.push(root)
    await fs.mkdir(path.join(root, 'album'))
    await fs.mkdir(path.join(root, 'compressed'))
    await fs.mkdir(path.join(root, '.hidden'))
    await fs.writeFile(path.join(root, 'one.jpg'), Buffer.from([1]))
    await fs.writeFile(path.join(root, 'note.txt'), 'no')
    await fs.writeFile(path.join(root, 'album', 'two.png'), Buffer.from([2]))
    await fs.writeFile(path.join(root, 'compressed', 'old.jpg'), Buffer.from([3]))
    await fs.writeFile(path.join(root, '.hidden', 'skip.gif'), Buffer.from([4]))

    const result = await collectInputs([root])
    expect(result.files.map((file) => file.name).sort()).toEqual(['one.jpg', 'two.png'])
    expect(result.skipped).toBe(1)
    expect(result.truncated).toBe(false)
  })

  it('stops at the requested limit', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tula-limit-'))
    directories.push(root)
    await fs.writeFile(path.join(root, 'a.jpg'), Buffer.from([1]))
    await fs.writeFile(path.join(root, 'b.png'), Buffer.from([2]))
    const result = await collectInputs([root], { limit: 1 })
    expect(result.files).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })
})
