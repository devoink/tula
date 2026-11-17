import { useEffect, useRef, useState } from 'react'
import { describePreset, uniquePresetName } from '../../../shared/presets'
import { LONG_EDGE_MAX, LONG_EDGE_MIN, presetSchema, QUALITY_MAX, QUALITY_MIN } from '../../../shared/schema'
import type { OutputFormat, Preset, Resize } from '../../../shared/types'
import { SegmentedControl } from '../components/SegmentedControl'
import { SelectField } from '../components/SelectField'
import { Copy, Plus } from 'lucide-react'
import { useApp } from '../store'

function parseEdge(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  if (value < LONG_EDGE_MIN || value > LONG_EDGE_MAX) return null
  return value
}

function samePreset(a: Preset, b: Preset): boolean {
  return a.name === b.name && a.format === b.format && a.quality === b.quality && JSON.stringify(a.resize) === JSON.stringify(b.resize)
}

function resizeEdge(resize: Resize): number | null {
  if (resize.mode === 'long-edge') return resize.longEdge
  if (resize.mode === 'short-edge') return resize.shortEdge
  return null
}

export function PresetsView() {
  const presets = useApp((state) => state.presets)
  const settings = useApp((state) => state.settings)
  const savePreset = useApp((state) => state.savePreset)
  const deletePreset = useApp((state) => state.deletePreset)
  const updateSettings = useApp((state) => state.updateSettings)
  const [selectedId, setSelectedId] = useState(settings.defaultPresetId)
  const [confirming, setConfirming] = useState(false)
  const selected = presets.find((preset) => preset.id === selectedId) ?? null

  useEffect(() => {
    if (selected) return
    setSelectedId(settings.defaultPresetId)
  }, [selected, settings.defaultPresetId])

  async function createPreset(source?: Preset) {
    const preset: Preset = source
      ? {
          ...source,
          id: crypto.randomUUID(),
          builtin: false,
          name: uniquePresetName(`${source.name} 副本`, presets.map((item) => item.name)),
          resize: source.resize.mode === 'none' ? { mode: 'none' } : { ...source.resize }
        }
      : {
          id: crypto.randomUUID(),
          name: uniquePresetName('未命名预设', presets.map((item) => item.name)),
          builtin: false,
          format: 'original',
          quality: 82,
          resize: { mode: 'none' }
        }
    await savePreset(preset)
    setSelectedId(preset.id)
  }

  return (
    <div className="preset-layout">
      <div className="preset-list">
        <div className="preset-scroll">
          {([
            ['内置', presets.filter((preset) => preset.builtin)],
            ['自定义', presets.filter((preset) => !preset.builtin)]
          ] as const).map(([label, items]) => items.length === 0 ? null : (
            <div className="preset-group" key={label}>
              <p>{label}</p>
              {items.map((preset) => (
                <PresetButton
                  key={preset.id}
                  preset={preset}
                  current={preset.id === selected?.id}
                  isDefault={preset.id === settings.defaultPresetId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="ghost wide with-icon" onClick={() => void createPreset()}><Plus />新建预设</button>
      </div>
      {selected ? (
        <PresetEditor
          key={selected.id}
          preset={selected}
          isDefault={selected.id === settings.defaultPresetId}
          confirming={confirming}
          onConfirm={setConfirming}
          onMakeDefault={() => void updateSettings({ defaultPresetId: selected.id })}
          onSave={savePreset}
          onDuplicate={() => void createPreset(selected)}
          onDelete={async () => {
            await deletePreset(selected.id)
            setConfirming(false)
            setSelectedId(useApp.getState().settings.defaultPresetId)
          }}
        />
      ) : null}
    </div>
  )
}

function PresetButton({
  preset,
  current,
  isDefault,
  onSelect
}: {
  preset: Preset
  current: boolean
  isDefault: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      className="preset-item"
      aria-current={current ? 'true' : undefined}
      onClick={() => onSelect(preset.id)}
    >
      <span className="preset-title">
        <span className="ellipsis">{preset.name}</span>
        {isDefault ? <span className="preset-default">默认</span> : null}
      </span>
      <small>{describePreset(preset)}</small>
    </button>
  )
}

function PresetEditor({
  preset,
  isDefault,
  confirming,
  onConfirm,
  onMakeDefault,
  onSave,
  onDuplicate,
  onDelete
}: {
  preset: Preset
  isDefault: boolean
  confirming: boolean
  onConfirm: (open: boolean) => void
  onMakeDefault: () => void
  onSave: (preset: Preset) => Promise<void>
  onDuplicate: () => void
  onDelete: () => Promise<void>
}) {
  const [draft, setDraft] = useState(preset)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const draftRef = useRef(draft)
  const presetRef = useRef(preset)
  draftRef.current = draft
  presetRef.current = preset
  const changed = !preset.builtin && !samePreset(draft, preset)

  useEffect(() => {
    return () => {
      const current = presetRef.current
      if (current.builtin) return
      const parsed = presetSchema.safeParse(draftRef.current)
      if (!parsed.success || samePreset(parsed.data, current)) return
      void onSave(parsed.data).catch(() => undefined)
    }
  }, [onSave])

  function update(next: Preset) {
    setError('')
    setDraft(next)
  }

  async function save() {
    if (draft.resize.mode !== 'none' && parseEdge(edgeText ?? String(edge)) === null) {
      setError(`尺寸需在 ${LONG_EDGE_MIN} 到 ${LONG_EDGE_MAX} 之间`)
      return
    }
    const parsed = presetSchema.safeParse(draft)
    if (!parsed.success) {
      setError('请检查名称、质量和尺寸')
      return
    }
    setSaving(true)
    try {
      await onSave(parsed.data)
      setDraft(parsed.data)
      setError('')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : '没有保存')
    } finally {
      setSaving(false)
    }
  }

  const edgeMemory = useRef(resizeEdge(draft.resize) ?? 2048)
  const edge = resizeEdge(draft.resize) ?? edgeMemory.current
  const [edgeText, setEdgeText] = useState<string | null>(null)
  const edgeLabel = draft.resize.mode === 'short-edge' ? '短边' : '长边'
  const edgeInvalid = draft.resize.mode !== 'none' && edgeText !== null && parseEdge(edgeText) === null

  function commitEdge(raw: string) {
    const value = parseEdge(raw)
    if (value === null || draft.resize.mode === 'none') return false
    if (resizeEdge(draft.resize) !== value) setResize(draft.resize.mode, value)
    return true
  }

  function setResize(mode: 'none' | 'long-edge' | 'short-edge', edgeValue = edgeMemory.current) {
    if (mode !== 'none') edgeMemory.current = edgeValue
    update({
      ...draft,
      resize:
        mode === 'none'
          ? { mode: 'none' }
          : mode === 'long-edge'
            ? { mode: 'long-edge', longEdge: edgeValue }
            : { mode: 'short-edge', shortEdge: edgeValue }
    })
  }

  return (
    <div className="editor">
      <div className="editor-scroll">
      <label className="field-label" htmlFor="preset-name">名称</label>
      <input
        id="preset-name"
        className="field"
        value={draft.name}
        maxLength={40}
        disabled={preset.builtin}
        spellCheck={false}
        onChange={(event) => update({ ...draft, name: event.target.value })}
      />

      <label className="field-label" htmlFor="preset-format">输出格式</label>
      <SelectField
        id="preset-format"
        value={draft.format}
        disabled={preset.builtin}
        onChange={(event) => update({ ...draft, format: event.target.value as OutputFormat })}
      >
        <option value="original">原格式</option>
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP</option>
        <option value="png">PNG</option>
      </SelectField>

      <div className="slider-row">
        <label className="field-label" htmlFor="preset-quality">质量</label>
        <span className="mono">{draft.quality}</span>
      </div>
      <input
        id="preset-quality"
        className="slider"
        type="range"
        min={QUALITY_MIN}
        max={QUALITY_MAX}
        step={1}
        value={draft.quality}
        disabled={preset.builtin}
        style={{ ['--fill' as string]: `${((draft.quality - QUALITY_MIN) / (QUALITY_MAX - QUALITY_MIN)) * 100}%` }}
        onChange={(event) => update({ ...draft, quality: Number(event.target.value) })}
      />
      <p className="field-label">缩放</p>
      <SegmentedControl
        label="缩放"
        disabled={preset.builtin}
        value={draft.resize.mode}
        options={[
          { value: 'none', label: '不缩放' },
          { value: 'long-edge', label: '限制长边' },
          { value: 'short-edge', label: '限制短边' }
        ]}
        onChange={setResize}
      />
      {draft.resize.mode === 'none' ? null : (
        <>
          <p className="field-label">{edgeLabel}</p>
          <div className="edge-figure" data-edge={draft.resize.mode === 'short-edge' ? 'short' : 'long'}>
              <span className="edge-body" aria-hidden="true" />
              <span className="dim" aria-hidden="true">
                <span className="dim-ext dim-ext-a" />
                <span className="dim-ext dim-ext-b" />
                <span className="dim-line dim-line-a" />
                <span className="dim-line dim-line-b" />
                <span className="dim-arrow dim-arrow-a" />
                <span className="dim-arrow dim-arrow-b" />
              </span>
              <div className="resize-number">
                <input
                  className="field"
                  type="text"
                  inputMode="numeric"
                  aria-label={edgeLabel}
                  value={edgeText ?? String(edge)}
                  disabled={preset.builtin}
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw !== '' && !/^\d+$/.test(raw)) {
                      event.target.value = edgeText ?? String(edge)
                      return
                    }
                    setEdgeText(raw)
                    setError('')
                    commitEdge(raw)
                  }}
                  onBlur={(event) => {
                    const raw = event.currentTarget.value.trim()
                    if (commitEdge(raw)) {
                      setEdgeText(String(parseEdge(raw)))
                      setError('')
                      return
                    }
                    setEdgeText(raw)
                    setError(`尺寸需在 ${LONG_EDGE_MIN} 到 ${LONG_EDGE_MAX} 之间`)
                  }}
                />
                <span className="resize-unit">像素</span>
              </div>
          </div>
        </>
      )}

      {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="editor-actions">
        {isDefault ? null : (
          <button type="button" className="ghost" onClick={onMakeDefault}>设为默认</button>
        )}
        <button type="button" className="ghost with-icon" onClick={onDuplicate}><Copy />复制为自定义</button>
        {preset.builtin ? null : (
          <button type="button" className="danger" onClick={() => onConfirm(true)}>删除预设</button>
        )}
        {preset.builtin ? null : (
          <button type="button" className="primary" disabled={!changed || saving || edgeInvalid} onClick={() => void save()}>保存</button>
        )}
      </div>

      {confirming ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">删除「{preset.name}」？</h2>
            <div className="modal-actions">
              <button type="button" className="ghost" autoFocus onClick={() => onConfirm(false)}>取消</button>
              <button type="button" className="danger" onClick={() => void onDelete()}>删除</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

