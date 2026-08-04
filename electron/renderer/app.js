const { electronAPI } = window

// === 日志系统 ===
function formatTime() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

function log(msg, data) {
  const line = data !== undefined
    ? `[${formatTime()}] [INFO] [electron] ${msg} ${JSON.stringify(data)}`
    : `[${formatTime()}] [INFO] [electron] ${msg}`
  console.log(`%c[NorthBooker]%c ${line}`, 'color:#004AAD', 'color:inherit')
}

function err(msg, data) {
  const line = data !== undefined
    ? `[${formatTime()}] [ERROR] [electron] ${msg} ${JSON.stringify(data)}`
    : `[${formatTime()}] [ERROR] [electron] ${msg}`
  console.error(`%c[NorthBooker]%c ${line}`, 'color:#e81123', 'color:inherit')
}

function dbg(msg, data) {
  const line = data !== undefined
    ? `[${formatTime()}] [DEBUG] [electron] ${msg} ${JSON.stringify(data)}`
    : `[${formatTime()}] [DEBUG] [electron] ${msg}`
  console.log(`%c[NorthBooker]%c ${line}`, 'color:#6b7280', 'color:inherit')
}

const SITE_URL = 'https://northbooker.xuanjian.top'
const loadingEl = document.getElementById('loading')
const webview = document.getElementById('webview')

// === 状态显示 ===
function showLoading(text) {
  loadingEl.style.display = 'flex'
  const p = loadingEl.querySelector('p')
  if (p) p.textContent = text || '加载中...'
}

function hideLoading() {
  loadingEl.style.display = 'none'
}

// === webview 事件监听 ===
if (webview) {
  webview.addEventListener('did-start-loading', () => {
    log('webview 开始加载', { url: webview.src })
    showLoading('正在加载...')
  })

  webview.addEventListener('did-stop-loading', () => {
    dbg('webview did-stop-loading')
    hideLoading()
  })

  webview.addEventListener('dom-ready', () => {
    log('webview DOM 就绪')
    hideLoading()
  })

  webview.addEventListener('did-fail-load', (e) => {
    err('webview 加载失败', {
      errorCode: e.errorCode,
      errorDescription: e.errorDescription,
      validatedURL: e.validatedURL,
      isMainFrame: e.isMainFrame,
    })
    if (e.isMainFrame) {
      showLoading('加载失败: ' + (e.errorDescription || '未知错误'))
    }
  })

  webview.addEventListener('did-finish-load', () => {
    log('webview 完成加载', { url: webview.src })
    hideLoading()
  })

  // 捕获 webview 内部控制台消息
  webview.addEventListener('console-message', (e) => {
    dbg('webview console: ' + e.message, { level: e.level, line: e.line, sourceId: e.sourceId })
  })

  // 8 秒超时兜底
  setTimeout(() => {
    if (loadingEl.style.display !== 'none') {
      err('webview 加载超时，强制隐藏 loading')
      hideLoading()
    }
  }, 8000)
} else {
  err('webview 元素未找到！')
  showLoading('初始化错误: webview 未找到')
}

log('NorthBooker Electron 2.0 启动')

// === 窗口控制 ===
document.getElementById('btn-min').onclick = () => electronAPI.minimize()
document.getElementById('btn-max').onclick = async () => {
  const m = await electronAPI.maximize()
  document.getElementById('btn-max').innerHTML = m ? '&#x2752;' : '&#x25a1;'
}
document.getElementById('btn-close').onclick = () => electronAPI.close()
document.getElementById('btn-refresh').onclick = () => {
  if (webview) {
    log('手动刷新 webview')
    webview.reload()
  }
}
electronAPI.isMaximized().then((m) => {
  document.getElementById('btn-max').innerHTML = m ? '&#x2752;' : '&#x25a1;'
})

// === 登录 ===
document.getElementById('btn-login').onclick = async () => {
  document.getElementById('btn-login').textContent = '登录中...'
  log('开始 OAuth 登录')
  try {
    const token = await electronAPI.oauthLogin()
    if (token) {
      log('登录成功，token: ' + token.slice(0, 10) + '...')
      localStorage.setItem('nb_token', token)
      document.getElementById('btn-login').textContent = '已登录'
      if (webview) {
        webview.executeJavaScript(`localStorage.setItem('nb_token','${token}');location.reload()`)
      }
    } else {
      log('登录取消')
      document.getElementById('btn-login').textContent = '登录'
    }
  } catch (e) {
    err('登录异常: ' + e.message)
    document.getElementById('btn-login').textContent = '登录'
  }
}

// === 侧边栏导航 ===
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    const page = btn.dataset.page
    const url = page === 'home' ? SITE_URL : SITE_URL + '/' + page
    log('导航到: ' + url)
    if (webview) webview.loadURL(url)
  }
})
