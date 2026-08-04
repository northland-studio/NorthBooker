import axios from 'axios'
import logger from '../utils/logger'

// Electron 环境下使用相对路径 /api，由本地 HTTP 服务器代理到生产服务器
// （避免跨域请求和 CORS 问题）
const isElectron = !!(window as any).electronAPI?.isElectron
const API_BASE = isElectron ? '/api' : '/api'

// 北牖前端统一 axios 实例
const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

// 请求拦截：附加 Bearer token + 开发日志
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('nb_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (import.meta.env.DEV) {
    ;(config as any)._startTime = Date.now()
  }
  return config
})

// 响应拦截：统一错误处理 + 开发日志
client.interceptors.response.use(
  (res) => {
    if (import.meta.env.DEV && (res.config as any)._startTime) {
      const ms = Date.now() - (res.config as any)._startTime
      logger.debug('api', `${res.config.method?.toUpperCase()} ${res.config.url} ${res.status} ${ms}ms`)
    }
    return res
  },
  (error) => {
    if (import.meta.env.DEV && (error.config as any)?._startTime) {
      const ms = Date.now() - (error.config as any)._startTime
      logger.error('api', `${error.config?.method?.toUpperCase()} ${error.config?.url} ${error.response?.status || 'ERR'} ${ms}ms`, {
        error: error.message,
        data: error.response?.data,
      })
    }
    if (error.response?.status === 401) {
      // token 失效，清理本地登录态并跳转登录
      localStorage.removeItem('nb_token')
      localStorage.removeItem('nb_user')
      // 非登录/回调类的请求才跳转（避免死循环）
      const url = error.config?.url ?? ''
      if (!url.includes('/auth/') && !url.includes('/callback')) {
        if (isElectron) {
          const electronAPI = (window as any).electronAPI
          electronAPI.oauthLogin().then((token: string | null) => {
            if (token) {
              localStorage.setItem('nb_token', token)
              window.location.reload()
            }
          })
        } else {
          window.location.href = '/api/auth/login?redirect=' + encodeURIComponent(window.location.pathname)
        }
      }
    }
    return Promise.reject(error)
  },
)

export default client
