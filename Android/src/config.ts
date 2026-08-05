// 北牖 Android 应用配置
// 所有运行时下载（TTS 模型 / APK 更新包）一律走服务器 CDN 代理（七牛私有空间签名 URL），
// 不直接使用 GitHub Releases。

export const API_BASE = 'https://northbooker.xuanjian.top/api'

export const WEB_BASE = 'https://northbooker.xuanjian.top'

// 服务器 /api/updates/files/:key 代理七牛私有空间签名下载（key 前缀 releases/）
export const CDN_FILE_PROXY = `${API_BASE}/updates/files/`

// Android APK 更新包：七牛 key 为 releases/android/<file>
export const ANDROID_APK_PROXY = `${API_BASE}/updates/files/android/`

// Android 更新元数据（服务器从七牛读取 releases/android/latest.json）
export const ANDROID_UPDATE_META = `${API_BASE}/updates/android/latest.json`

// 当前应用版本（与 android/app/build.gradle 中 versionName/versionCode 保持一致）
export const APP_VERSION_NAME = '1.0.0'
export const APP_VERSION_CODE = 1

// OAuth 登录：服务器端发起玄剑官网授权，最终回跳到 /callback#access_token=xxx
export const OAUTH_LOGIN_URL = `${API_BASE}/auth/login?redirect=${encodeURIComponent('/callback')}`

// WebView 中注入的登录态（SPA 用 localStorage 的 nb_token）
export function tokenInjectScript(token: string): string {
  const safe = token.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `try {
    localStorage.setItem('nb_token', '${safe}');
    localStorage.removeItem('nb_auth_error');
  } catch (e) {}
  true;`
}

// WebView 登录页回调探测：hash 中带 access_token 时回传 RN
export const OAUTH_HASH_PROBE = `(function () {
  try {
    if (window.location.hash && window.location.hash.indexOf('access_token') >= 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'oauth',
        hash: window.location.hash
      }));
    }
  } catch (e) {}
  true;
})();`
