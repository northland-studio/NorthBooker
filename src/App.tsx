import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Documents from '@/pages/Documents'
import Viewer from '@/pages/Viewer'
import AuthCallback from '@/pages/AuthCallback'

export default function App() {
  return (
    <Routes>
      {/* OAuth 回调页：独立全屏，不走 Layout */}
      <Route path="/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Documents />} />
        <Route path="/viewer/:id" element={<Viewer />} />
      </Route>
    </Routes>
  )
}
