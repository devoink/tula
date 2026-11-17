import { useEffect, useState } from 'react'
import { formatBytes, formatRatio, formatSaved } from '../../../shared/format'
import { Pause, Play, Trash2 } from 'lucide-react'
import logo from '../../../../resources/logo.png'
import { ContextMenu, type ContextMenuEntry } from '../components/ContextMenu'
import { SelectField } from '../components/SelectField'
import { Kbd } from '../components/Kbd'
import { describePreset } from '../../../shared/presets'
import type { Preset } from '../../../shared/types'
import { parentName, shortOutput, STATUS_LABEL } from '../text'
import { useApp, type QueueItem } from '../store'

export function QueueView() {
  const items = useApp((state) => state.items)
  const presets = useApp((state) => state.presets)
  const selectedId = useApp((state) => state.selectedId)
  const selectedIds = useApp((state) => state.selectedIds)
  const phase = useApp((state) => state.phase)
  const select = useApp((state) => state.select)
  const setItemPreset = useApp((state) => state.setItemPreset)
  const applyPresetToQueued = useApp((state) => state.applyPresetToQueued)
  const removeSelected = useApp((state) => state.removeSelected)
  const clearFinished = useApp((state) => state.clearFinished)
  const start = useApp((state) => state.start)
  const togglePause = useApp((state) => state.togglePause)
  const showItem = (target: string) => {
    void window.desktop?.showItem(target).catch((error: unknown) => {
      useApp.getState().notify(error instanceof Error ? error.message : '无法显示文件')
    })
  }
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  const chosen = items.filter((item) => selectedIds.includes(item.id))
  const selected = items.find((item) => item.id === selectedId) ?? chosen[0] ?? null
  const allInflight = chosen.length > 0 && chosen.every((item) => item.status === 'running' || (item.status === 'queued' && item.submitted))
  const done = items.filter((item) => item.status === 'done' && item.bytesOut != null)
  const saved = done.reduce((sum, item) => sum + (item.bytesIn - (item.bytesOut ?? 0)), 0)
  const running = items.filter((item) => item.status === 'running').length
  const finished = items.filter((item) => item.status === 'done' || item.status === 'failed' || item.status === 'cancelled').length
  const queuedOpen = items.filter((item) => item.status === 'queued' && !item.submitted)
  const primaryLabel = phase === 'running' ? '暂停压缩' : phase === 'paused' ? '继续压缩' : '开始压缩'
  const primaryDisabled = phase === 'idle' && queuedOpen.length === 0 && items.every((item) => item.status !== 'queued')

  useEffect(() => {
    if (!selectedId || menu) return
    document.getElementById(`job-${selectedId}`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, menu])

  return (
    <div className={items.length === 0 ? 'queue-layout is-empty' : 'queue-layout'}>
      <section className="list-pane">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rows" role="listbox" aria-multiselectable="true" aria-label="压缩队列">
            <div className="cols sheet-head">
              <span>文件</span>
              <span>预设</span>
              <span>状态</span>
              <span className="end">体积</span>
            </div>
            {items.map((item) => {
              const preset = presets.find((entry) => entry.id === item.presetId)
              const selectedRow = selectedIds.includes(item.id)
              return (
                <div
                  id={`job-${item.id}`}
                  key={item.id}
                  role="option"
                  aria-selected={selectedRow}
                  className={item.status === 'running' ? 'cols row is-running' : 'cols row'}
                  tabIndex={item.id === selectedId ? 0 : -1}
                  onMouseDown={(event) => {
                    if (event.shiftKey || event.metaKey || event.ctrlKey) event.preventDefault()
                  }}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey) select(item.id, 'toggle')
                    else if (event.shiftKey) select(item.id, 'range')
                    else select(item.id)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    if (!useApp.getState().selectedIds.includes(item.id)) select(item.id)
                    setMenu({ id: item.id, x: event.clientX, y: event.clientY })
                  }}
                >
                  <span className="file-cell">
                    <span className="ellipsis name" title={item.name}>{item.name}</span>
                    <span className="ellipsis folder">{parentName(item.path)}</span>
                  </span>
                  <span className="ellipsis preset-name">{preset?.name ?? '预设已删除'}</span>
                  <span className={`status status-${item.status}`}>
                    <span>{STATUS_LABEL[item.status]}</span>
                    {item.flattened ? <small>已变为静图</small> : null}
                  </span>
                  <span className="end volume">
                    {item.status === 'done' && item.bytesOut != null ? (
                      <>
                        <span className="figure">{formatRatio(item.bytesIn, item.bytesOut)}</span>
                        <span className="figure-sub">{formatBytes(item.bytesOut)}</span>
                      </>
                    ) : (
                      <span className="figure">{formatBytes(item.bytesIn)}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <footer className="actionbar">
          <div className="action-row">
            <div className="action-buttons">
              <button type="button" className="primary with-icon" disabled={primaryDisabled} onClick={() => void (phase === 'running' ? togglePause() : start())}>
                {phase === 'running' ? <Pause fill="currentColor" strokeWidth={0} /> : <Play fill="currentColor" strokeWidth={0} />}
                {primaryLabel}
              </button>
              <button type="button" className="ghost with-icon" disabled={finished === 0} onClick={clearFinished}>
                <Trash2 />
                清除已完成
              </button>
            </div>
            <div className="action-meta">
              {items.length > 0 ? (
                <>
                  <span>{running > 0 ? `正在处理 ${running} 张 · ${done.length}/${items.length}` : `${done.length}/${items.length}`}</span>
                  {done.length > 0 ? <span className="mono">{formatSaved(saved)}</span> : null}
                </>
              ) : null}
            </div>
          </div>
        </footer>
      </section>
      {items.length > 0 ? <Inspector
        presets={presets}
        selected={chosen.length > 1 ? null : selected}
        selectedCount={chosen.length}
        removeLabel={chosen.length > 1 ? (allInflight ? '取消所选' : '移除所选') : undefined}
        canApply={chosen.length <= 1 && queuedOpen.length > 1 && selected != null && selected.status === 'queued' && !selected.submitted}
        onPreset={(presetId) => selected && setItemPreset(selected.id, presetId)}
        onApply={() => selected && applyPresetToQueued(selected.presetId)}
        onRemove={() => void removeSelected()}
        onReveal={showItem}
      /> : null}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(items.find((item) => item.id === menu.id), queuedOpen.length, chosen.length > 1 && selectedIds.includes(menu.id), {
            showItem,
            apply: applyPresetToQueued,
            remove: () => void removeSelected()
          }, allInflight)}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  )
}

function menuItems(
  item: QueueItem | undefined,
  queuedCount: number,
  multi: boolean,
  actions: {
    showItem: (target: string) => void
    apply: (presetId: string) => void
    remove: () => void
  },
  allInflight: boolean
): ContextMenuEntry[] {
  if (!item) return []
  const cancel = item.status === 'running' || (item.status === 'queued' && item.submitted)
  const entries: ContextMenuEntry[] = [
    { id: 'reveal', label: '在 Finder 中显示', onSelect: () => actions.showItem(item.path) }
  ]
  if (item.outputPath) {
    entries.push({ id: 'result', label: '显示压缩结果', onSelect: () => actions.showItem(item.outputPath!) })
  }
  if (item.status === 'queued' && !item.submitted && queuedCount > 1) {
    entries.push({ id: 'apply', label: '应用到全部等待', onSelect: () => actions.apply(item.presetId) })
  }
  entries.push(
    { id: 'sep', separator: true },
    { id: 'remove', label: multi ? (allInflight ? '取消所选' : '移除所选') : cancel ? '取消这张' : '从队列移除', danger: true, onSelect: actions.remove }
  )
  return entries
}

function byteParts(bytes: number) {
  const text = formatBytes(bytes)
  const split = text.lastIndexOf(' ')
  if (split < 0) return { value: text, unit: '' }
  return { value: text.slice(0, split), unit: text.slice(split + 1) }
}

function ratioParts(before: number, after: number) {
  const text = formatRatio(before, after)
  if (!text.endsWith('%')) return { value: text, unit: '' }
  return { value: text.slice(0, -1), unit: '%' }
}

function tailPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 3) return path
  return `…/${parts.slice(-3).join('/')}`
}

function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-tray">
        <img className="empty-mark" src={logo} alt="" />
        <h2>把图片放到工作台上</h2>
        <p className="hint">拖进来，或使用<Kbd keys={['⌘', 'O']} /></p>
      </div>
    </div>
  )
}

function Inspector({
  presets,
  selected,
  selectedCount,
  removeLabel,
  canApply,
  onPreset,
  onApply,
  onRemove,
  onReveal
}: {
  presets: Preset[]
  selected: QueueItem | null
  selectedCount: number
  removeLabel?: string
  canApply: boolean
  onPreset: (presetId: string) => void
  onApply: () => void
  onRemove: () => void
  onReveal: (target: string) => void
}) {
  if (selectedCount > 1) {
    return (
      <aside className="inspector" aria-label="检查器">
        <div className="inspector-bar">已选择</div>
        <section className="inspector-section">
          <div className="inspector-figure">
            <span className="savings-figure">{selectedCount}</span>
            <span className="inspector-unit">张</span>
          </div>
        </section>
        <div className="inspector-actions">
          <button type="button" className="danger wide" onClick={onRemove}>{removeLabel}</button>
        </div>
      </aside>
    )
  }

  if (!selected) {
    return (
      <aside className="inspector is-empty" aria-label="检查器">
        <div className="inspector-bar">当前</div>
        <p className="inspector-empty">未选择</p>
      </aside>
    )
  }

  const preset = presets.find((item) => item.id === selected.presetId)
  const locked = selected.status !== 'queued' || selected.submitted
  const itemRemoveLabel = selected.status === 'running' || (selected.status === 'queued' && selected.submitted) ? '取消这张' : '从队列移除'
  const bytesOut = selected.bytesOut
  const done = selected.status === 'done' && bytesOut != null
  const grew = done && bytesOut > selected.bytesIn
  const size = done ? ratioParts(selected.bytesIn, bytesOut) : byteParts(selected.bytesIn)
  const statusLine = [STATUS_LABEL[selected.status], selected.flattened ? '静图' : ''].filter(Boolean).join(' · ')

  return (
    <aside className="inspector" aria-label="检查器">
      <div className="inspector-bar">当前</div>
      <section className="inspector-section">
        <div className="inspector-identity">
          <h2 className="inspector-title" title={selected.name}>{selected.name}</h2>
          <p className="path" title={selected.path}>{tailPath(selected.path)}</p>
        </div>
        <div className="inspector-summary">
          <div className="size-line">
            <span className={grew ? 'size-value grew' : 'size-value'}>{size.value}</span>
            {size.unit ? <span className="size-unit">{size.unit}</span> : null}
            <span className={`size-status status-${selected.status}`}>{statusLine}</span>
          </div>
          {done ? <p className="size-compare">{formatBytes(selected.bytesIn)} → {formatBytes(bytesOut)}</p> : null}
          {selected.error ? <p className="error-text">{selected.error}</p> : null}
          {selected.outputPath ? <p className="path">{shortOutput(selected.outputPath)}</p> : null}
        </div>
      </section>
      <section className="inspector-section">
        <label className="field-label" htmlFor="item-preset">预设</label>
        <SelectField
          id="item-preset"
          value={selected.presetId}
          disabled={locked}
          onChange={(event) => onPreset(event.target.value)}
        >
          {presets.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </SelectField>
        <p className="field-hint">{preset ? describePreset(preset) : '这个预设已经不在了'}</p>
        {canApply ? (
          <button type="button" className="ghost wide" onClick={onApply}>应用到全部等待</button>
        ) : null}
      </section>
      <div className="inspector-actions">
        {selected.outputPath ? (
          <button type="button" className="ghost" onClick={() => onReveal(selected.outputPath!)}>在 Finder 中显示</button>
        ) : null}
        <button type="button" className="danger wide" onClick={onRemove}>{itemRemoveLabel}</button>
      </div>
    </aside>
  )
}
