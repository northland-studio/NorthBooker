import { useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import iconPng from '@/../icon.png'

// 顶部导航栏
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <img src={iconPng} alt="北牖" />
          <span>北牖 NorthBooker</span>
        </Link>
        <nav className={`navbar-links ${menuOpen ? 'navbar-links--open' : ''}`}>
          <Link to="/pages" className="navbar-link" onClick={closeMenu}>在线文档</Link>
          <Link to="/download" className="navbar-link" onClick={closeMenu}>应用下载</Link>
          <Link to="/terms" className="navbar-link" onClick={closeMenu}>用户协议</Link>
        </nav>
      </div>
      <div className="navbar-actions">
        <ThemeToggle />
        <UserMenu />
        <button
          className={`navbar-menu-btn ${menuOpen ? 'navbar-menu-btn--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="菜单"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* 移动端遮罩 */}
      {menuOpen && <div className="navbar-overlay" onClick={closeMenu} />}
    </header>
  )
}
