import { useLayoutEffect, useState, type RefObject } from 'react'

export type Thumb = { x: number; y: number; w: number; h: number; on: boolean }

const empty: Thumb = { x: 0, y: 0, w: 0, h: 0, on: false }

export function useThumb(
  ref: RefObject<HTMLElement | null>,
  watch: unknown,
  selector = '[aria-current="page"], [aria-pressed="true"]'
): Thumb {
  const [thumb, setThumb] = useState<Thumb>(empty)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const place = () => {
      const current = root.querySelector<HTMLElement>(selector)
      if (!current) {
        setThumb((prev) => (prev.on ? { ...prev, on: false } : prev))
        return
      }
      setThumb({
        x: current.offsetLeft,
        y: current.offsetTop,
        w: current.offsetWidth,
        h: current.offsetHeight,
        on: true
      })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(root)
    return () => observer.disconnect()
  }, [ref, watch, selector])
  return thumb
}
