import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

// OAuth 授权回调页
// 后端重定向到 /callback#access_token=xxx&redirect=/path&username=xxx&level=0
export default function AuthCallback() {
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const refresh = useAuthStore((s) => s.refresh)
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    const redirect = params.get('redirect') || '/'

    if (!token) {
      setError('未收到授权令牌')
      return
    }

    setToken(token)
    // 拉取完整用户信息（含本地 id、avatar、level 等）
    refresh().finally(() => {
      navigate(redirect, { replace: true })
    })
  }, [setToken, refresh, navigate])

  if (error) {
    return (
      <div className="auth-callback">
        <div className="auth-callback-card">
          <h2>登录失败</h2>
          <p>{error}</p>
          <a className="btn-primary" href="/">
            返回首页
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-callback">
      <div className="auth-callback-card">
        <div className="auth-spinner" />
        <p>正在完成登录...</p>
      </div>
    </div>
  )
}
