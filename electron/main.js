const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

// 生产站点 URL
const SITE_URL = process.env.NB_SITE_URL || 'https://northbooker.xuanjian.top'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '北牖 NorthBooker',
    icon: path.join(__dirname, 'icon.png'),
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#1a1b1d',
      symbolColor: '#f3f4f6',
      height: 36,
    } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(SITE_URL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 外部链接在浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(SITE_URL)) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// 窗口控制 IPC
ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
  return mainWindow?.isMaximized()
})
ipcMain.handle('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized())

// 监听窗口最大化状态变化
function setupMaximizeListener() {
  if (!mainWindow) return
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-change', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-change', false)
  })
}

// 自动更新（GitHub Releases）
function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress.percent)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message)
  })
}

// 检查更新（IPC 触发）
ipcMain.handle('check-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return { updateAvailable: !!result?.updateInfo }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

// 移除系统菜单栏
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  createWindow()
  setupMaximizeListener()
  setupAutoUpdater()

  // 启动后自动检查更新
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: 获取当前站点 URL 和平台
ipcMain.handle('get-site-url', () => SITE_URL)
ipcMain.handle('get-platform', () => process.platform)
