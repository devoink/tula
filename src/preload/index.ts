import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/channels'
import type { DesktopBridge } from '../shared/bridge'

type IpcSuccess<T> = { ok: true; data: T }
type IpcFailure = { ok: false; error: string }

const desktop: DesktopBridge = {
  pathForFile: (file) => webUtils.getPathForFile(file),
  getBootstrap: () => invoke(IPC.bootstrap),
  pickFiles: () => invoke(IPC.pickFiles),
  pickFolder: () => invoke(IPC.pickFolder),
  importPaths: (paths) => invoke(IPC.importPaths, paths),
  startCompress: (jobs) => invoke(IPC.start, jobs),
  pauseCompress: () => invoke(IPC.pause),
  resumeCompress: () => invoke(IPC.resume),
  cancelCompress: (ids) => invoke(IPC.cancel, ids),
  showItem: (targetPath) => invoke(IPC.showItem, targetPath),
  setSettings: (patch) => invoke(IPC.setSettings, patch),
  savePreset: (preset) => invoke(IPC.savePreset, preset),
  deletePreset: (id) => invoke(IPC.deletePreset, id),
  onCompressEvent: (listener) => subscribe(IPC.compressEvent, listener),
  onMenu: (listener) => subscribe(IPC.menu, listener),
  onTheme: (listener) => subscribe(IPC.theme, listener)
}

contextBridge.exposeInMainWorld('desktop', desktop)

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const response = (await ipcRenderer.invoke(channel, payload)) as IpcSuccess<T> | IpcFailure
  if (!response.ok) throw new Error(response.error)
  return response.data
}
