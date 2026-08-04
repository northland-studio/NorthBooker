const { app, BrowserWindow, shell, ipcMain, Menu, protocol } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

const SITE_URL = 'https://northbooker.xuanjian.top'
const API_URL = SITE_URL + '/api'

let mainWindow
let authWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: '北牖 NorthBooker',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.on('closed', () => { mainWindow = null })
  setupAutoUpdater()
}

// 窗口控制
ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) { mainWindow.unmaximize() } else { mainWindow?.maximize() }
  return mainWindow?.isMaximized()
})
ipcMain.handle('window-close', () => mainWindow?.close())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized())

// OAuth 登录 - 使用嵌入式 BrowserWindow
ipcMain.handle('oauth-login', async () => {
  return new Promise((resolve) => {
    authWindow = new BrowserWindow({
      width: 800, height: 700, title: '玄剑登录',
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    authWindow.loadURL(SITE_URL + '/api/auth/login?redirect=electron')
    authWindow.on('closed', () => { authWindow = null; resolve(null) })
    // 监听回调
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.includes('/callback') || url.includes('access_token=')) {
        event.preventDefault()
        try {
          const u = new URL(url)
          const token = u.searchParams.get('access_token') || u.hash.replace('#access_token=', '')
          if (token) {
            // 通过 API 获取用户信息
            authWindow?.close()
            resolve(token)
          }
        } catch { authWindow?.close(); resolve(null) }
      }
    })
    // 降级：页面加载完成后检查 URL
    authWindow.webContents.on('did-navigate', (event, url) => {
      if (url.includes('access_token=')) {
        try {
          const token = new URL(url).searchParams.get('access_token') || url.split('access_token=')[1]?.split('&')[0]
          if (token) { authWindow?.close(); resolve(token) }
        } catch {}
      }
    })
  })
})

// 外部链接
ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
ipcMain.handle('get-platform', () => process.platform)
ipcMain.handle('get-site-url', () => SITE_URL)

// 自动更新
function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => mainWindow?.webContents.send('update-available', info))
  autoUpdater.on('update-not-available', () => mainWindow?.webContents.send('update-not-available'))
  autoUpdater.on('download-progress', (p) => mainWindow?.webContents.send('update-progress', p.percent))
  autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded'))
  autoUpdater.on('error', (err) => mainWindow?.webContents.send('update-error', err.message))
}
ipcMain.handle('check-update', async () => { try { const r = await autoUpdater.checkForUpdates(); return { updateAvailable: !!r?.updateInfo } } catch(e) { return { error: e.message } } })
ipcMain.handle('download-update', () => autoUpdater.downloadUpdate())
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall())

Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  createWindow()
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 5000)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
