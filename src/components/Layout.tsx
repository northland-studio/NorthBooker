import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

// 全局布局：导航栏 + 内容区
export default function Layout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
