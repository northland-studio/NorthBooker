const { electronAPI } = window
const SITE_URL = 'https://northbooker.xuanjian.top'

// 窗口控制
document.getElementById('btn-min').onclick = () => electronAPI.minimize()
document.getElementById('btn-max').onclick = async () => { const m = await electronAPI.maximize(); updateMaxBtn(m) }
document.getElementById('btn-close').onclick = () => electronAPI.close()
document.getElementById('btn-refresh').onclick = () => { const wv = document.getElementById('webview'); if(wv) wv.reload() }
async function updateMaxBtn(isMax) { document.getElementById('btn-max').innerHTML = isMax ? '&#x2752;' : '&#x25a1;' }
electronAPI.isMaximized().then(updateMaxBtn)

// 登录
document.getElementById('btn-login').onclick = async () => {
  document.getElementById('btn-login').textContent = '登录中...'
  const token = await electronAPI.oauthLogin()
  if (token) {
    localStorage.setItem('nb_token', token)
    document.getElementById('btn-login').textContent = '已登录'
    const wv = document.getElementById('webview')
    if (wv) {
      wv.executeJavaScript(`localStorage.setItem('nb_token','${token}');location.reload()`)
    }
  } else {
    document.getElementById('btn-login').textContent = '登录'
  }
}

// 侧边栏导航
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const page = btn.dataset.page
    const wv = document.getElementById('webview')
    if (wv) {
      if (page === 'home') wv.loadURL(SITE_URL)
      else wv.loadURL(SITE_URL + '/' + page)
    }
  }
})

// 隐藏加载动画
setTimeout(() => { document.getElementById('loading').style.display = 'none' }, 1500)
