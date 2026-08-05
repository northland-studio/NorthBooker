import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import EmailBindModal from './EmailBindModal'
import { useAuthStore } from '@/store/auth'

const EMAIL_DISMISS_KEY = 'northbooker-email-dismissed'

// 全局布局：导航栏 + 内容区 + 邮箱绑定提示
export default function Layout() {
  const { user, refresh } = useAuthStore()
  const [showEmailBind, setShowEmailBind] = useState(false)

  // 挂载时若有 token 拉取最新用户信息（确保邮箱绑定状态为最新，绑定成功后不再重复弹窗）
  useEffect(() => {
    if (localStorage.getItem('nb_token')) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 未绑定邮箱才提示；用户手动关闭（稍后再说）后本次会话不再自动弹出
  useEffect(() => {
    const dismissed = sessionStorage.getItem(EMAIL_DISMISS_KEY)
    setShowEmailBind(!!user && !user.email && dismissed !== '1')
  }, [user?.email, user])

  const closeEmailBind = () => {
    sessionStorage.setItem(EMAIL_DISMISS_KEY, '1')
    setShowEmailBind(false)
  }

  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <Outlet />
      </main>
      <EmailBindModal
        open={showEmailBind}
        onClose={closeEmailBind}
      />
    </div>
  )
}
