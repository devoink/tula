import { BrowserWindow, Menu, app } from 'electron'
import { APP_NAME } from '../shared/appName'
import type { MenuAction } from '../shared/types'
import { IPC } from '../shared/channels'
import { mainWindow, openAbout } from './about'

export function installMenu(): void {
  const send = (action: MenuAction) => {
    const win = mainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IPC.menu, action)
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { label: `关于${APP_NAME}`, click: () => openAbout() },
        { type: 'separator' },
        { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: `退出${APP_NAME}` }
      ]
    },
    {
      label: '文件',
      submenu: [
        { label: '添加文件', accelerator: 'CmdOrCtrl+O', click: () => send('add-files') },
        { label: '添加文件夹', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('add-folder') },
        { type: 'separator' },
        { label: '开始压缩', accelerator: 'CmdOrCtrl+Return', click: () => send('start') },
        { label: '暂停或继续', accelerator: 'CmdOrCtrl+.', click: () => send('toggle-pause') },
        { type: 'separator' },
        { role: 'close', label: '关闭窗口' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '拷贝' },
        { role: 'paste', label: '粘贴' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', click: () => send('select-all') }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { type: 'separator' },
        { role: 'front', label: '全部置于前面' },
        ...(!app.isPackaged
          ? [{ type: 'separator' as const }, { label: '开发者工具', accelerator: 'Alt+Cmd+I', click: () => {
              const win = BrowserWindow.getFocusedWindow()
              win?.webContents.toggleDevTools()
            } }]
          : [])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
