import fs from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { z, ZodError } from 'zod'
import { IPC } from '../shared/channels'
import { AppError } from '../shared/errors'
import { compressRequestSchema, importPathsSchema } from '../shared/schema'
import type { CompressEvent } from '../shared/types'
import { deletePreset, getCatalog, savePreset, updateSettings } from './config'
import { collectInputs } from './files'
import type { Supervisor } from './supervisor'
import { mainWindow } from './about'
import { applyThemePreference, currentAppearance } from './theme'

const cancelSchema = z.array(z.string().min(8).max(100)).max(2000)

export function registerIpc(supervisor: Supervisor): void {
  handle(IPC.bootstrap, () => ({
    ...getCatalog(),
    version: app.getVersion(),
    appearance: currentAppearance()
  }))

  handle(IPC.pickFiles, async () => {
    const result = await chooseFiles({
      title: '添加图片',
      buttonLabel: '添加',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
    })
    return result.canceled ? [] : result.filePaths
  })

  handle(IPC.pickFolder, async () => {
    const result = await chooseFiles({
      title: '添加文件夹',
      buttonLabel: '添加',
      properties: ['openDirectory']
    })
    return result.canceled ? [] : result.filePaths
  })

  handle(IPC.importPaths, (payload) => collectInputs(importPathsSchema.parse(payload)))

  handle(IPC.start, (payload) => {
    const jobs = z.array(compressRequestSchema).max(2000).parse(payload)
    for (const job of jobs) {
      if (!path.isAbsolute(job.inputPath)) throw new AppError('图片路径无效')
    }
    supervisor.enqueue(jobs)
  })

  handle(IPC.pause, () => {
    supervisor.pause()
  })

  handle(IPC.resume, () => {
    supervisor.resume()
    supervisor.pump()
  })

  handle(IPC.cancel, (payload) => {
    supervisor.cancel(cancelSchema.parse(payload))
  })

  handle(IPC.showItem, async (payload) => {
    const target = z.string().min(1).max(4096).parse(payload)
    if (!path.isAbsolute(target)) throw new AppError('路径无效')
    await fs.access(target)
    shell.showItemInFolder(target)
  })

  handle(IPC.setSettings, (payload) => {
    const settings = updateSettings(payload)
    const appearance = applyThemePreference(settings.theme)
    supervisor.pump()
    return { settings, appearance }
  })

  handle(IPC.savePreset, (payload) => savePreset(payload))
  handle(IPC.deletePreset, (payload) => deletePreset(z.string().min(8).max(80).parse(payload)))
}

export function broadcast(event: CompressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.compressEvent, event)
  }
}

function chooseFiles(options: OpenDialogOptions) {
  const win = mainWindow()
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function handle<T>(channel: string, fn: (payload: unknown) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return { ok: true as const, data: await fn(payload) }
    } catch (error) {
      return { ok: false as const, error: toMessage(error) }
    }
  })
}

function toMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof ZodError) return '提交的内容无效'
  console.error(error)
  return '操作没有完成'
}
