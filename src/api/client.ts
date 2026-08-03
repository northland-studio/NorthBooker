import axios from 'axios'

// 北牖前端统一 axios 实例
// - baseURL: /api 由 Vite 代理转发到后端（生产由 Nginx 转发）
// - 自动携带玄剑 OAuth access_token
const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截：附加 Bearer token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('nb_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：统一错误处理
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // token 失效，清理本地登录态并跳转登录
      localStorage.removeItem('nb_token')
      localStorage.removeItem('nb_user')
      // 非登录/回调类的请求才跳转（避免死循环）
      const url = error.config?.url ?? ''
      if (!url.includes('/auth/') && !url.includes('/callback')) {
        window.location.href = '/api/auth/login?redirect=' + encodeURIComponent(window.location.pathname)
      }
    }
    return Promise.reject(error)
  },
)

export default client
