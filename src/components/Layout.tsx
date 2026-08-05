import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import EmailBindModal from './EmailBindModal'
import { useAuthStore } from '@/store/auth'

// 全局布局：导航栏 + 内容区 + 邮箱绑定提示
export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const [showEmailBind, setShowEmailBind] = useState(false)

  // 登录用户未绑定邮箱时，弹出绑定提示（验证成功后关闭）
  useEffect(() => {
    setShowEmailBind(!!user && !user.email)
  }, [user?.email, user])

  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <Outlet />
      </main>
      <EmailBindModal
        open={showEmailBind}
        onClose={() => setShowEmailBind(false)}
      />
    </div>
  )
}
