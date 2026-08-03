import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import RequireLevel from '@/components/RequireLevel'
import Documents from '@/pages/Documents'
import Viewer from '@/pages/Viewer'
import Admin from '@/pages/Admin'
import AuthCallback from '@/pages/AuthCallback'

export default function App() {
  return (
    <Routes>
      {/* OAuth 回调页：独立全屏，不走 Layout */}
      <Route path="/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Documents />} />
        <Route path="/viewer/:id" element={<Viewer />} />
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
  )
}
