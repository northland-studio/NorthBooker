const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron')
const path = require('path')

// 生产站点 URL，可通过环境变量覆盖
const SITE_URL = process.env.NB_SITE_URL || 'https://northbooker.xuanjian.top'

let mainWindow

function createMenu() {
  const template = [
    {
      label: '北牖',
      submenu: [
        { label: '关于北牖', role: 'about' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '访问网站',
          click: () => shell.openExternal(SITE_URL),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '北牖 NorthBooker',
    icon: path.join(__dirname, 'icon.png'),
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

app.whenReady().then(() => {
  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: 获取当前站点 URL
ipcMain.handle('get-site-url', () => SITE_URL)

// 触发构建用标记
