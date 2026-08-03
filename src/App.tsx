import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import RequireLevel from '@/components/RequireLevel'
import Documents from '@/pages/Documents'
import Viewer from '@/pages/Viewer'
import Admin from '@/pages/Admin'
import AuthCallback from '@/pages/AuthCallback'
import Pages from '@/pages/Pages'
import PageEditor from '@/pages/PageEditor'
import PageTerms from '@/pages/PageTerms'
import PageDownload from '@/pages/PageDownload'

export default function App() {
  return (
    <Routes>
      {/* OAuth 回调页：独立全屏，不走 Layout */}
      <Route path="/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Documents />} />
        <Route path="/viewer/:id" element={<Viewer />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/pages/:id" element={<PageEditor />} />
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
  )
}
