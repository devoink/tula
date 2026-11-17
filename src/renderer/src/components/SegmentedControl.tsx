import { useEffect, useRef, useState } from 'react'
import { useThumb } from './useThumb'

export type SegmentedOption<T extends string | number> = {
  value: T
  label: string
}

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const thumb = useThumb(ref, `${String(value)}:${options.length}`, '[data-selected="true"]')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!thumb.on || ready) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [thumb.on, ready])

  function move(delta: number) {
    if (disabled || options.length === 0) return
    const index = options.findIndex((option) => option.value === value)
    const next = options[(Math.max(index, 0) + delta + options.length) % options.length]
    if (!next || next.value === value) return
    onChange(next.value)
    ref.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(String(next.value))}"]`)?.focus()
  }

  const selectedIndex = options.findIndex((option) => option.value === value)

  return (
    <div
      ref={ref}
      className={ready ? 'segmented is-set' : 'segmented'}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          move(1)
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          move(-1)
        }
      }}
    >
      <span
        className="segmented-thumb"
        aria-hidden="true"
        style={{
          width: thumb.w,
          height: thumb.h,
          transform: `translate(${thumb.x}px, ${thumb.y}px)`,
          opacity: thumb.on ? 1 : 0
        }}
      />
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            className="segment"
            role="radio"
            data-value={String(option.value)}
            data-selected={selected ? 'true' : undefined}
            aria-checked={selected}
            disabled={disabled}
            tabIndex={selected || (selectedIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => {
              if (!disabled && option.value !== value) onChange(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
