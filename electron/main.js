const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const http = require('http')
const https = require('https')
const fs = require('fs')
const url = require('url')

const SITE_URL = 'https://northbooker.xuanjian.top'
const CDN_URL = 'https://northbooker.xuanjian.top/api/updates/'

let mainWindow
let httpServer

// 标题栏 HTML + CSS，注入到每个 index.html 中
const TITLEBAR = `
<style>
body{padding-top:38px!important;margin:0!important}::-webkit-scrollbar{display:none!important}html{scrollbar-width:none;-ms-overflow-style:none}
#nb-titlebar{position:fixed!important;top:0!important;left:0!important;right:0!important;height:38px!important;background:#1a1b1d!important;color:#fff!important;z-index:99999!important;display:flex!important;align-items:center!important;justify-content:space-between!important;-webkit-app-region:drag;user-select:none}
.nb-drag{display:flex!important;align-items:center;gap:8px;padding:0 12px;height:100%;flex:1}
.nb-title{font-size:12px;opacity:.9}
.nb-ctrls{display:flex;height:100%;-webkit-app-region:no-drag}
.nb-btn{width:42px;height:100%;border:none;background:transparent;color:#ccc;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .15s}
.nb-btn:hover{background:rgba(255,255,255,.1)!important;color:#fff!important}
.nb-close:hover{background:#e81123!important}
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
<script>
(function(){
  var tb=document.getElementById('nb-titlebar');
  if(!tb)return;
  // 将标题栏移到 body 最前面（因为注入在 </body> 前，此时它在底部）
  document.body.insertBefore(tb,document.body.firstChild);
  // 监听 DOM 变化，防止标题栏被移除
  new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      for(var i=0;i<m.removedNodes.length;i++){
        if(m.removedNodes[i]===tb){
          document.body.insertBefore(tb,document.body.firstChild);
          document.body.style.paddingTop='38px';
        }
      }
    })
  }).observe(document.body,{childList:true});
  // 确保 padding 常驻
  setInterval(function(){
    if(document.body.style.paddingTop!=='38px')document.body.style.paddingTop='38px';
  },1000);
})();
</script>`

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
      data = data.toString().replace('</body>', TITLEBAR + '</body>')
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
    const fullPath = req.url // 保留 query 参数，用于代理转发
    const localPath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)

    console.log('[北牖-Proxy]', req.method, fullPath)

    // 1. 本地文件
    if (fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
      console.log('[北牖-Proxy]  serve local:', localPath)
      serveLocalFile(res, localPath)
      return
    }

    // 2. 代理到生产服务器（保留完整 query string）
    console.log('[北牖-Proxy]  proxy to:', SITE_URL + fullPath)
    proxyToProduction(req, res, fullPath)
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

// OAuth 登录：打开默认浏览器登录，本地回调服务器接收 token
ipcMain.handle('oauth-login', async () => {
  return new Promise((resolve) => {
    const callbackServer = http.createServer((req, res) => {
      const reqUrl = url.parse(req.url, true)
      if (reqUrl.pathname === '/auth/callback') {
        const token = reqUrl.query.access_token
        if (token) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1b1d;color:#fff}div{text-align:center}h2{color:#4ade80;font-size:24px;margin-bottom:8px}p{opacity:.7;font-size:16px}</style></head><body><div><h2>登录成功</h2><p>请返回北牖应用继续操作</p></div></body></html>')
          callbackServer.close()
          resolve(token)
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h2>登录失败</h2></body></html>')
          callbackServer.close()
          resolve(null)
        }
      }
    })

    callbackServer.listen(0, '127.0.0.1', () => {
      const port = callbackServer.address().port
      console.log('[北牖-登录] 本地回调服务器已启动，端口:', port)
      shell.openExternal(`${SITE_URL}/api/auth/login?redirect=http://127.0.0.1:${port}/auth/callback`)
    })

    // 超时保护（5 分钟）
    setTimeout(() => {
      callbackServer.close()
      resolve(null)
    }, 5 * 60 * 1000)
  })
})

// 外部链接
ipcMain.handle('open-external', (_, url) => shell.openExternal(url))
ipcMain.handle('get-platform', () => process.platform)
ipcMain.handle('get-site-url', () => SITE_URL)

// 自动更新（双源：GitHub 主源 + CDN 备用源）
function setupAutoUpdater() {
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
    console.error('[更新] Github 源检查失败:', err.message)
    mainWindow?.webContents.send('update-error', err.message)
  })
}

// HTTPS GET 工具
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NorthBooker-Updater/1.0', 'Accept': 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGetJson(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))) }
          catch (e) { reject(e) }
        } else {
          reject(new Error('HTTP ' + res.statusCode))
        }
      })
    }).on('error', reject).setTimeout(15000, () => reject(new Error('timeout')))
  })
}

// 双源检查更新：直接 HTTPS 检测版本号，再触发下载
async function checkUpdatesDualSource() {
  const currentVer = app.getVersion()
  console.log('[更新] 当前版本:', currentVer, '| 检查更新...')

  // 源1: GitHub Release
  try {
    const release = await httpsGetJson('https://api.github.com/repos/northland-studio/NorthBooker/releases/latest')
    const ghVer = (release.tag_name || '').replace(/^v/, '')
    console.log('[更新] GitHub 最新:', ghVer)
    if (ghVer && ghVer !== currentVer) {
      // 有新版本，用 electron-updater 下载
      const result = await autoUpdater.checkForUpdates().catch(() => null)
      if (result?.updateInfo) return
      // autoUpdater 检查失败但版本确实更新 → 直接用 CDN 源
      console.log('[更新] GitHub provider 未检测到，改用 CDN 源下载')
    } else {
      console.log('[更新] GitHub 已是最新')
      mainWindow?.webContents.send('update-not-available')
      return
    }
  } catch (e) {
    console.log('[更新] GitHub API 不可用:', e.message)
  }

  // 源2: CDN 后端代理
  console.log('[更新] 使用 CDN 源...')
  try {
    const { NsisUpdater } = require('electron-updater')
    const cdnUpdater = new NsisUpdater({ provider: 'generic', url: CDN_URL })
    cdnUpdater.autoDownload = true
    cdnUpdater.autoInstallOnAppQuit = true
    cdnUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-available', info)
      console.log('[更新] CDN 发现新版本:', info.version)
    })
    cdnUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded'))
    cdnUpdater.on('error', (err) => console.error('[更新] CDN 源失败:', err.message))
    const cdnResult = await cdnUpdater.checkForUpdates().catch(() => null)
    if (!cdnResult?.updateInfo) {
      mainWindow?.webContents.send('update-not-available')
    }
  } catch (e) {
    console.error('[更新] CDN 源异常:', e.message)
    mainWindow?.webContents.send('update-not-available')
  }
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
