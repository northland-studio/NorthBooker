const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const http = require('http')
const https = require('https')
const fs = require('fs')
const url = require('url')

const SITE_URL = 'https://northbooker.xuanjian.top'

let mainWindow
let authWindow
let httpServer

// 标题栏 HTML + CSS，注入到每个 index.html 中
const TITLEBAR = `
<style>
body{padding-top:38px!important}
#nb-titlebar{position:fixed;top:0;left:0;right:0;height:38px;background:#1a1b1d;color:#fff;z-index:99999;display:flex;align-items:center;justify-content:space-between;-webkit-app-region:drag;user-select:none}
.nb-drag{display:flex;align-items:center;gap:8px;padding:0 12px;height:100%;flex:1}
.nb-title{font-size:12px;opacity:.9}
.nb-ctrls{display:flex;height:100%;-webkit-app-region:no-drag}
.nb-btn{width:42px;height:100%;border:none;background:transparent;color:#ccc;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s}
.nb-btn:hover{background:rgba(255,255,255,.1);color:#fff}
.nb-close:hover{background:#e81123}
</style>
<div id="nb-titlebar">
  <div class="nb-drag"><span class="nb-title">北牖 NorthBooker</span></div>
  <div class="nb-ctrls">
    <button class="nb-btn" title="检查更新" onclick="window.electronAPI.checkUpdate().then(function(r){if(r.error){alert('更新检查失败: '+r.error)}else if(r.updateAvailable){alert('发现新版本，准备下载...');window.electronAPI.downloadUpdate()}else{alert('已是最新版本')}})">⇑</button>
    <button class="nb-btn" title="最小化" onclick="window.electronAPI.minimize()">—</button>
    <button class="nb-btn" title="最大化" onclick="var t=this;window.electronAPI.maximize().then(function(m){t.textContent=m?'❐':'□'})">□</button>
    <button class="nb-btn nb-close" title="关闭" onclick="window.electronAPI.close()">✕</button>
  </div>
</div>
`

// MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// 代理请求到生产服务器
function proxyToProduction(clientReq, clientRes, urlPath) {
  const target = SITE_URL + urlPath
  const parsed = url.parse(target)
  const opts = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.path,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: parsed.hostname },
  }
  // 移除 hop-by-hop 头
  delete opts.headers['accept-encoding']

  const proxyReq = https.request(opts, (proxyRes) => {
    console.log('[北牖-Proxy]  response:', proxyRes.statusCode, urlPath)
    // 生产服务器返回 404 → 回退到 SPA index.html
    if (proxyRes.statusCode === 404) {
      serveLocalFile(clientRes, path.join(__dirname, 'renderer-dist', 'index.html'))
      return
    }
    const headers = { ...proxyRes.headers }
    headers['access-control-allow-origin'] = '*'
    clientRes.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(clientRes)
  })

  proxyReq.on('error', (e) => {
    console.error('[北牖-Proxy]  error:', e.message, urlPath)
    serveLocalFile(clientRes, path.join(__dirname, 'renderer-dist', 'index.html'))
  })

  // 转发请求体（POST/PUT 等）
  if (clientReq.method !== 'GET' && clientReq.method !== 'HEAD') {
    clientReq.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
}

// 提供本地文件（含标题栏注入）
function serveLocalFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME[ext] || 'application/octet-stream'
    let data = fs.readFileSync(filePath)
    if (ext === '.html') {
      data = data.toString().replace('</head>', TITLEBAR + '</head>')
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

// 启动内置 HTTP 服务器
function startServer() {
  const distDir = path.join(__dirname, 'renderer-dist')

  const srv = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0]
    const localPath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)

    console.log('[北牖-Proxy]', req.method, urlPath)

    // 1. 本地文件
    if (fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
      console.log('[北牖-Proxy]  serve local:', localPath)
      serveLocalFile(res, localPath)
      return
    }

    // 2. 代理到生产服务器
    console.log('[北牖-Proxy]  proxy to:', SITE_URL + urlPath)
    proxyToProduction(req, res, urlPath)
  })

  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      resolve(srv.address().port)
    })
  })
}

function createWindow(port) {
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
    },
  })

  // 开发模式：打开 DevTools
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.loadURL(`http://127.0.0.1:${port}`)
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

// OAuth 登录
ipcMain.handle('oauth-login', async () => {
  return new Promise((resolve) => {
    authWindow = new BrowserWindow({
      width: 800, height: 700, title: '玄剑登录',
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    authWindow.loadURL(SITE_URL + '/api/auth/login?redirect=electron')
    authWindow.on('closed', () => { authWindow = null; resolve(null) })
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.includes('/callback') || url.includes('access_token=')) {
        event.preventDefault()
        try {
          const u = new URL(url)
          const token = u.searchParams.get('access_token') || u.hash.replace('#access_token=', '')
          if (token) { authWindow?.close(); resolve(token) }
        } catch { authWindow?.close(); resolve(null) }
      }
    })
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

// 自动更新（双源：GitHub 主源 + CDN 备用源）
function setupAutoUpdater() {
  const CDN_URL = 'https://cdn.northbooker.xuanjian.top/releases/'

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // 更新事件
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info)
    console.log('[更新] 发现新版本:', info.version)
  })
  autoUpdater.on('update-not-available', () => mainWindow?.webContents.send('update-not-available'))
  autoUpdater.on('download-progress', (p) => mainWindow?.webContents.send('update-progress', p.percent))
  autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded'))
  autoUpdater.on('error', (err) => {
    console.error('[更新] GitHub 检查失败:', err.message)
    mainWindow?.webContents.send('update-error', err.message)
  })
}

// 双源检查更新：先 GitHub，失败则 CDN
async function checkUpdatesDualSource() {
  console.log('[更新] 检查 GitHub Release...')
  const ghResult = await autoUpdater.checkForUpdates().catch((e) => {
    console.log('[更新] GitHub 不可用:', e.message)
    return null
  })
  if (ghResult?.updateInfo) return

  // GitHub 失败 → CDN
  console.log('[更新] 回退到 CDN 源')
  const { NsisUpdater } = require('electron-updater')
  const cdnUpdater = new NsisUpdater({
    provider: 'generic',
    url: CDN_URL,
  })
  cdnUpdater.autoDownload = true
  cdnUpdater.autoInstallOnAppQuit = true
  cdnUpdater.on('update-available', (info) => mainWindow?.webContents.send('update-available', info))
  cdnUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded'))
  cdnUpdater.on('error', (err) => console.error('[更新] CDN 源也失败:', err.message))
  cdnUpdater.checkForUpdates().catch(() => {})
}

ipcMain.handle('check-update', checkUpdatesDualSource)
ipcMain.handle('download-update', () => autoUpdater.downloadUpdate())
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall())

Menu.setApplicationMenu(null)

app.whenReady().then(async () => {
  const port = await startServer()
  createWindow(port)
  setTimeout(() => checkUpdatesDualSource(), 5000)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(port) })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
