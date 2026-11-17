import { describe, expect, it } from 'vitest'
import { planCompression } from './plan'
import type { Preset } from '../shared/types'

const base: Preset = {
  id: '0123456789',
  name: '测试',
  builtin: false,
  format: 'original',
  quality: 80,
  resize: { mode: 'none' }
}

describe('planCompression', () => {
  it('keeps a still photo in its original format', () => {
    const plan = planCompression({ format: 'jpeg', width: 4000, height: 3000, pages: 1 }, base)
    expect(plan).toMatchObject({ outputFormat: 'jpeg', animated: false, flattened: false, resize: null })
  })

  it('shrinks the long edge without enlarging smaller images', () => {
    const preset: Preset = { ...base, resize: { mode: 'long-edge', longEdge: 2048 } }
    expect(planCompression({ format: 'jpeg', width: 4000, height: 2000, pages: 1 }, preset).resize).toEqual({
      width: 2048,
      height: 1024
    })
    expect(planCompression({ format: 'png', width: 800, height: 600, pages: 1 }, preset).resize).toBeNull()
  })

  it('shrinks the short edge without enlarging smaller images', () => {
    const preset: Preset = { ...base, resize: { mode: 'short-edge', shortEdge: 1080 } }
    expect(planCompression({ format: 'jpeg', width: 4000, height: 2000, pages: 1 }, preset).resize).toEqual({
      width: 2160,
      height: 1080
    })
    expect(planCompression({ format: 'jpeg', width: 2000, height: 4000, pages: 1 }, preset).resize).toEqual({
      width: 1080,
      height: 2160
    })
    expect(planCompression({ format: 'png', width: 800, height: 600, pages: 1 }, preset).resize).toBeNull()
  })

  it('flattens an animated gif when the output cannot hold frames', () => {
    const source = { format: 'gif' as const, width: 40, height: 20, pages: 4 }
    expect(planCompression(source, { ...base, format: 'jpeg' })).toMatchObject({ flattened: true, animated: false, outputFormat: 'jpeg' })
    expect(planCompression(source, { ...base, format: 'png' })).toMatchObject({ flattened: true, animated: false })
  })

  it('keeps animation for gif and webp output', () => {
    const source = { format: 'gif' as const, width: 40, height: 20, pages: 4 }
    expect(planCompression(source, base)).toMatchObject({ outputFormat: 'gif', animated: true, flattened: false })
    expect(planCompression(source, { ...base, format: 'webp' })).toMatchObject({
      outputFormat: 'webp',
      animated: true,
      flattened: false
    })
  })
})
