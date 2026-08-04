import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import type { UserLevel } from '@/types/user'

// 路由守卫：要求登录且 level >= minLevel
// - 未登录：跳转 OAuth 登录（带回跳地址）
// - 权限不足：渲染无权限提示
export default function RequireLevel({
  minLevel,
  children,
}: {
  minLevel: UserLevel
  children: ReactNode
}) {
  const { user, loading } = useAuthStore()
  const location = useLocation()
  const [electronLoginPending, setElectronLoginPending] = useState(false)

  // Electron 桌面端：打开默认浏览器登录，通过本地回调服务器接收 token
  useEffect(() => {
    const electronAPI = (window as any).electronAPI
    if (!user && !loading && !electronLoginPending && electronAPI?.isElectron) {
      setElectronLoginPending(true)
      electronAPI.oauthLogin().then((token: string | null) => {
        if (token) {
          localStorage.setItem('nb_token', token)
          window.location.reload()
        } else {
          setElectronLoginPending(false)
        }
      })
    }
  }, [user, loading, electronLoginPending])

  // 初始化中（若有 token 正在拉取用户）
  if (loading) {
    return <div className="documents-status">加载中...</div>
  }

  // 未登录
  if (!user) {
    const isElectron = !!(window as any).electronAPI?.isElectron
    if (isElectron) {
      return <div className="documents-status">请在浏览器中完成登录，然后返回应用...</div>
    }
    const redirect = encodeURIComponent(location.pathname + location.search)
    window.location.href = `/api/auth/login?redirect=${redirect}`
    return <div className="documents-status">正在跳转登录...</div>
  }

  // 权限不足
  if (user.level < minLevel) {
    return (
      <div className="admin-forbidden">
        <div className="admin-forbidden-card">
          <h2>权限不足</h2>
          <p>该页面需要权限等级达到 {minLevel}，当前等级为 {user.level}。</p>
          <a className="btn-primary" href="/">
            返回首页
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
