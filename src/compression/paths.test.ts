import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { allocateOutputPath, extensionFor } from './paths'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('allocateOutputPath', () => {
  it('writes beside the original and suffixes collisions', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tula-path-'))
    directories.push(directory)
    const input = path.join(directory, 'photo.jpg')
    await fs.writeFile(input, 'x')

    const first = await allocateOutputPath(input, 'jpeg')
    const expectedDir = await fs.realpath(path.join(directory, 'compressed'))
    expect(first).toBe(path.join(expectedDir, 'photo.jpg'))
    expect(extensionFor('webp')).toBe('.webp')

    await fs.writeFile(first, 'x')
    const second = await allocateOutputPath(input, 'jpeg')
    expect(second).toBe(path.join(expectedDir, 'photo-2.jpg'))
  })
})
