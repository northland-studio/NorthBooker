const { app, BrowserWindow, shell, ipcMain, Menu, Tray, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const Store = require('electron-store')
const path = require('path')
const http = require('http')
const https = require('https')
const fs = require('fs')
const url = require('url')

const SITE_URL = 'https://northbooker.xuanjian.top'
const CDN_URL = 'https://northbooker.xuanjian.top/api/updates/'

let mainWindow
let httpServer
let tray

// 持久化存储
const store = new Store({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    isMaximized: false,
    viewMode: 'grid',
    autoLaunch: false,
    minimizeToTray: true,
    fonts: { ui: '', title: '', content: '' },
  },
})

const iconPath = path.join(__dirname, 'icon.png')

// ===== 字体 CSS 注入 =====
function buildFontCSS() {
  const fonts = store.get('fonts')
  const rules = []
  if (fonts.ui) rules.push(`body,button,input,select,textarea{font-family:"${fonts.ui}",system-ui,sans-serif!important}`)
  if (fonts.title) rules.push(`h1,h2,h3,.doc-card-title,.doc-list-title{font-family:"${fonts.title}",system-ui,sans-serif!important}`)
  if (fonts.content) rules.push(`p,.doc-card-body,.viewer-content{font-family:"${fonts.content}",system-ui,sans-serif!important}`)
  return rules.length ? `<style id="nb-font-css">${rules.join('')}</style>` : ''
}

// 标题栏 HTML + CSS
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
  document.body.insertBefore(tb,document.body.firstChild);
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
  delete opts.headers['accept-encoding']

  const proxyReq = https.request(opts, (proxyRes) => {
    console.log('[北牖-Proxy]  response:', proxyRes.statusCode, urlPath)
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

  if (clientReq.method !== 'GET' && clientReq.method !== 'HEAD') {
    clientReq.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
}

// 提供本地文件（含标题栏 + 字体注入）
function serveLocalFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME[ext] || 'application/octet-stream'
    let data = fs.readFileSync(filePath)
    if (ext === '.html') {
      data = data.toString().replace('</head>', buildFontCSS() + '</head>')
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
    const fullPath = req.url
    const localPath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)

    console.log('[北牖-Proxy]', req.method, fullPath)

    if (fs.existsSync(localPath) && !fs.statSync(localPath).isDirectory()) {
      console.log('[北牖-Proxy]  serve local:', localPath)
      serveLocalFile(res, localPath)
      return
    }

    console.log('[北牖-Proxy]  proxy to:', SITE_URL + fullPath)
    proxyToProduction(req, res, fullPath)
  })

  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      resolve(srv.address().port)
    })
  })
}

// ===== 窗口创建（含尺寸/位置恢复） =====
function createWindow(port) {
  const bounds = store.get('windowBounds')
  const isMaximized = store.get('isMaximized')

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: '北牖 NorthBooker',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isMaximized) mainWindow.maximize()

  // 保存窗口变化
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      const [w, h] = mainWindow.getSize()
      store.set('windowBounds', { width: w, height: h })
    }
    store.set('isMaximized', mainWindow.isMaximized())
  })
  mainWindow.on('maximize', () => store.set('isMaximized', true))
  mainWindow.on('unmaximize', () => store.set('isMaximized', false))
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      const [x, y] = mainWindow.getPosition()
      store.set('windowBounds', { ...store.get('windowBounds'), x, y })
    }
  })

  // 关闭行为：最小化到托盘则隐藏
  mainWindow.on('close', (e) => {
    if (store.get('minimizeToTray') && tray) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.loadURL(`http://127.0.0.1:${port}`)
  setupAutoUpdater()
}

// ===== 托盘 =====
function createTray() {
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('北牖 NorthBooker')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) mainWindow.show()
        else createWindow(app.port)
      },
    },
    {
      label: '检查更新',
      click: () => checkUpdatesDualSource(),
    },
    { type: 'separator' },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: store.get('autoLaunch'),
      click: (mi) => {
        const enabled = mi.checked
        app.setLoginItemSettings({ openAtLogin: enabled })
        store.set('autoLaunch', enabled)
      },
    },
    {
      label: '退出',
      click: () => {
        store.set('minimizeToTray', false)
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    else createWindow(app.port)
  })
}

// ===== 窗口控制 =====
ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) { mainWindow.unmaximize() } else { mainWindow?.maximize() }
  return mainWindow?.isMaximized()
})
ipcMain.handle('window-close', () => {
  if (store.get('minimizeToTray') && tray) {
    mainWindow?.hide()
  } else {
    mainWindow?.close()
  }
})
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized())

// ===== 设置 IPC =====
ipcMain.handle('get-settings', () => store.store)
ipcMain.handle('set-setting', (_, key, value) => {
  store.set(key, value)
  // 字体变更时刷新注入的 CSS
  if (key === 'fonts' && mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      var el=document.getElementById('nb-font-css');
      if(el)el.remove();
      var s=document.createElement('style');
      s.id='nb-font-css';
      s.textContent=${JSON.stringify(buildFontCSS().replace(/<\/?style[^>]*>/g, ''))};
      document.head.appendChild(s);
    `)
  }
  // 开机自启动
  if (key === 'autoLaunch') {
    app.setLoginItemSettings({ openAtLogin: value })
  }
  return store.get(key)
})

// ===== OAuth 登录 =====
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

// ===== 自动更新 =====
function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info)
    console.log('[更新] 发现新版本:', info.version)
  })
  autoUpdater.on('update-not-available', () => mainWindow?.webContents.send('update-not-available'))
  autoUpdater.on('download-progress', (p) => mainWindow?.webContents.send('update-progress', p.percent))
  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
    console.log('[更新] 下载完成')
  })
  autoUpdater.on('error', (err) => {
    console.error('[更新] Github 源检查失败:', err.message)
    mainWindow?.webContents.send('update-error', err.message)
  })
}

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

async function checkUpdatesDualSource() {
  const currentVer = app.getVersion()
  console.log('[更新] 当前版本:', currentVer, '| 检查更新...')

  try {
    const release = await httpsGetJson('https://api.github.com/repos/northland-studio/NorthBooker/releases/latest')
    const ghVer = (release.tag_name || '').replace(/^v/, '')
    console.log('[更新] GitHub 最新:', ghVer)
    if (ghVer && ghVer !== currentVer) {
      const result = await autoUpdater.checkForUpdates().catch(() => null)
      if (result?.updateInfo) return
      console.log('[更新] GitHub provider 未检测到，改用 CDN 源下载')
    } else {
      console.log('[更新] GitHub 已是最新')
      mainWindow?.webContents.send('update-not-available')
      return
    }
  } catch (e) {
    console.log('[更新] GitHub API 不可用:', e.message)
  }

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

// ===== 应用生命周期 =====
Menu.setApplicationMenu(null)

app.whenReady().then(async () => {
  const port = await startServer()
  app.port = port
  createTray()
  createWindow(port)
  setTimeout(() => checkUpdatesDualSource(), 5000)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(port) })
})

app.on('window-all-closed', () => { /* 托盘模式下不退出 */ })
