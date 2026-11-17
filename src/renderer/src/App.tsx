import type { ReactElement } from 'react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { FilePlus, FolderPlus, Images, Settings, SlidersHorizontal } from 'lucide-react'
import logo from '../../../resources/logo.png'
import { useThumb } from './components/useThumb'
import { useApp, type View } from './store'
import { PresetsView } from './views/PresetsView'
import { QueueView } from './views/QueueView'
import { SettingsView } from './views/SettingsView'

function selectAllInPlace() {
  const target = document.activeElement
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select()
    return
  }
  useApp.getState().selectAll()
}

const NAV: { id: View; label: string; icon: ReactElement }[] = [
  { id: 'queue', label: '队列', icon: <Images /> },
  { id: 'presets', label: '预设', icon: <SlidersHorizontal /> },
  { id: 'settings', label: '设置', icon: <Settings /> }
]

function Toast() {
  const notice = useApp((state) => state.notice)
  const [text, setText] = useState('')

  useEffect(() => {
    if (notice) setText(notice)
  }, [notice])

  return (
    <p className={notice ? 'toast is-open' : 'toast'} role="status" aria-live="polite" aria-hidden={notice ? undefined : true}>
      {text}
    </p>
  )
}

export function App() {
  const ready = useApp((state) => state.ready)
  const bootError = useApp((state) => state.bootError)
  const appearance = useApp((state) => state.appearance)
  const view = useApp((state) => state.view)
  const items = useApp((state) => state.items)
  const version = useApp((state) => state.version)
  const setView = useApp((state) => state.setView)
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const navRef = useRef<HTMLElement>(null)
  const thumb = useThumb(navRef, ready ? view : null)
  const [pillReady, setPillReady] = useState(false)

  useEffect(() => {
    if (!thumb.on || pillReady) return
    const id = requestAnimationFrame(() => setPillReady(true))
    return () => cancelAnimationFrame(id)
  }, [thumb.on, pillReady])
  const finished = items.filter((item) => item.status === 'done' || item.status === 'failed' || item.status === 'cancelled').length
  const meter = items.length === 0 ? 0 : finished / items.length

  useEffect(() => {
    if (!window.desktop) {
      useApp.setState({ bootError: '请在桌面应用里打开' })
      return
    }
    void useApp.getState().bootstrap()
    const offEvent = window.desktop.onCompressEvent((event) => useApp.getState().applyEvent(event))
    const offTheme = window.desktop.onTheme?.((next) => useApp.setState({ appearance: next })) ?? (() => {})
    const offMenu = window.desktop.onMenu((action) => {
      const store = useApp.getState()
      if (action === 'settings') store.setView('settings')
      if (action === 'add-files') void store.addFromDialog('files')
      if (action === 'add-folder') void store.addFromDialog('folder')
      if (action === 'start') void store.start()
      if (action === 'toggle-pause') void store.togglePause()
      if (action === 'select-all') selectAllInPlace()
    })
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !event.shiftKey && !event.altKey) {
        if (useApp.getState().view !== 'queue') return
        event.preventDefault()
        useApp.getState().selectAll()
        return
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        void useApp.getState().removeSelected()
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        useApp.getState().moveSelection(event.key === 'ArrowDown' ? 1 : -1, event.shiftKey)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      offEvent()
      offTheme()
      offMenu()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = appearance
  }, [appearance])

  if (!ready) {
    return (
      <div className="boot">
        <img className="boot-mark" src={logo} alt="" />
        {bootError ? (
          <>
            <p>{bootError}</p>
            <button type="button" className="ghost" onClick={() => void useApp.getState().bootstrap()}>重试</button>
          </>
        ) : (
          <p>正在准备</p>
        )}
      </div>
    )
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault()
    depth.current += 1
    setDragging(true)
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault()
    depth.current -= 1
    if (depth.current <= 0) {
      depth.current = 0
      setDragging(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    depth.current = 0
    setDragging(false)
    const files = [...event.dataTransfer.files]
    const paths = files.map((file) => window.desktop?.pathForFile(file) ?? '').filter(Boolean)
    if (paths.length) void useApp.getState().importPaths(paths)
  }

  const title = view === 'queue' ? '队列' : view === 'presets' ? '预设' : '设置'

  return (
    <div
      className="app"
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <aside className="sidebar">
        <div className="sidebar-top" />
        <nav ref={navRef} className={pillReady ? 'is-set' : undefined}>
          <span
            className="nav-pill"
            aria-hidden="true"
            style={{
              width: thumb.w,
              height: thumb.h,
              transform: `translate(${thumb.x}px, ${thumb.y}px)`,
              opacity: thumb.on ? 1 : 0
            }}
          />
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-button"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        {version ? <p className="sidebar-meta">版本 {version}</p> : null}
      </aside>
      <main className="workspace">
        <header className="topbar">
          <h1>{title}</h1>
          {view === 'queue' ? (
            <div className="top-actions">
              <button type="button" className="ghost with-icon" onClick={() => void useApp.getState().addFromDialog('files')}><FilePlus />添加文件</button>
              <button type="button" className="ghost with-icon" onClick={() => void useApp.getState().addFromDialog('folder')}><FolderPlus />添加文件夹</button>
            </div>
          ) : null}
        </header>
        {view === 'queue' ? (
          <div className="meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${meter})` }} />
          </div>
        ) : null}
        <div className="stage">
          <div className="stage-view">
            {view === 'queue' ? <QueueView /> : null}
            {view === 'presets' ? <PresetsView /> : null}
            {view === 'settings' ? <SettingsView /> : null}
          </div>
        </div>
      </main>
      <Toast />
      {dragging ? (
        <div className="drop-veil">
          <strong>松开以加入队列</strong>
          <span>JPEG、PNG、WebP、GIF</span>
        </div>
      ) : null}
    </div>
  )
}
