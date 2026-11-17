import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuEntry =
  | { id: string; label: string; danger?: boolean; onSelect: () => void }
  | { id: string; separator: true }

export function ContextMenu({
  x,
  y,
  items,
  onClose
}: {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [point, setPoint] = useState({ x, y })

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    const margin = 8
    setPoint({
      x: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      y: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin))
    })
  }, [x, y, items])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={{ left: point.x, top: point.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        'separator' in item ? (
          <div key={item.id} className="context-sep" role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={item.danger ? 'context-item is-danger' : 'context-item'}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      ))}
    </div>,
    document.body
  )
}
