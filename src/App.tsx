import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import RequireLevel from '@/components/RequireLevel'
import Documents from '@/pages/Documents'
import Viewer from '@/pages/Viewer'
import Admin from '@/pages/Admin'
import AuthCallback from '@/pages/AuthCallback'
import Pages from '@/pages/Pages'
import PageEditor from '@/pages/PageEditor'
import CoWorkPanel from '@/pages/CoWorkPanel'
import ProfilePage from '@/pages/ProfilePage'
import PageTerms from '@/pages/PageTerms'
import PageDownload from '@/pages/PageDownload'
import { useAuthStore } from '@/store/auth'
import UpdatePopup from '@/components/UpdatePopup'
import DownloadNotification from '@/components/DownloadNotification'

// 应用启动时，若有 token 但无缓存用户，自动拉取用户信息
// （Electron 浏览器登录后 reload 的场景）
function AuthInit() {
  const refresh = useAuthStore((s) => s.refresh)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const token = localStorage.getItem('nb_token')
    if (token && !user) {
      refresh()
    }
    // 邮箱验证成功回跳（/?email_verified=1）：刷新用户信息并清理参数
    if (token && new URLSearchParams(window.location.search).get('email_verified') === '1') {
      refresh().then(() => {
        window.history.replaceState({}, '', window.location.pathname)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function App() {
  const [showUpdatePopup, setShowUpdatePopup] = useState(false)

  return (
    <>
      <AuthInit />
      <DownloadNotification onShowUpdatePopup={() => setShowUpdatePopup(true)} />
      <UpdatePopup visible={showUpdatePopup} onClose={() => setShowUpdatePopup(false)} />
      <Routes>
        {/* OAuth 回调页：独立全屏，不走 Layout */}
        <Route path="/callback" element={<AuthCallback />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Documents />} />
          <Route path="/viewer/:id" element={<Viewer />} />
          <Route path="/pages" element={<Pages />} />
          <Route path="/pages/:id" element={<PageEditor />} />
          {/* 个人主页（公开可看，订阅详情仅本人/管理员可见） */}
          <Route path="/profile/:user" element={<ProfilePage />} />
          {/* 协作控制面板：要求登录（文档作者可管理权限，访客只读） */}
          <Route
            path="/pages/:id/cowork_set"
            element={
              <RequireLevel minLevel={0}>
                <CoWorkPanel />
              </RequireLevel>
            }
          />
          <Route path="/terms" element={<PageTerms />} />
          <Route path="/download" element={<PageDownload />} />
          {/* 管理后台：要求登录且 level >= 1 */}
          <Route
            path="/admin"
            element={
              <RequireLevel minLevel={1}>
                <Admin />
              </RequireLevel>
            }
          />
        </Route>
      </Routes>
    </>
  )
}
