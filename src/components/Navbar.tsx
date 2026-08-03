import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import iconPng from '@/../icon.png'

// 顶部导航栏
export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand">
          <img src={iconPng} alt="北牖" />
          <span>北牖 NorthBooker</span>
        </Link>
        <nav className="navbar-links">
          <Link to="/pages" className="navbar-link">在线文档</Link>
          <Link to="/download" className="navbar-link">应用下载</Link>
          <Link to="/terms" className="navbar-link">用户协议</Link>
        </nav>
      </div>
      <div className="navbar-actions">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
