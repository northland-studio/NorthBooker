import { useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import UserMenu from './UserMenu'
import SettingsPanel from './SettingsPanel'
import { useI18n, useT } from '@/i18n'
import iconPng from '@/../icon.png'

// 顶部导航栏
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const isElectron = !!(window as any).electronAPI?.isElectron
  const t = useT()
  const lang = useI18n((s) => s.lang)
  const setLang = useI18n((s) => s.setLang)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <img src={iconPng} alt="北牖" />
          <span>北牖 NorthBooker</span>
        </Link>
        <nav className={`navbar-links ${menuOpen ? 'navbar-links--open' : ''}`}>
          <Link to="/pages" className="navbar-link" onClick={closeMenu}>{t('nav.onlineDocs')}</Link>
          {!isElectron && <Link to="/download" className="navbar-link" onClick={closeMenu}>{t('nav.download')}</Link>}
          {!isElectron && <Link to="/guide" className="navbar-link" onClick={closeMenu}>{t('nav.guide')}</Link>}
          <Link to="/terms" className="navbar-link" onClick={closeMenu}>{t('nav.terms')}</Link>
        </nav>
      </div>
      <div className="navbar-actions">
        <button
          className="navbar-lang-btn"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          title={t('settings.language')}
        >
          {lang === 'zh' ? 'EN' : '中'}
        </button>
        <ThemeToggle />
        {isElectron && (
          <button className="navbar-icon-btn" title={t('nav.settings')} onClick={() => setSettingsOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        <UserMenu />
        <button
          className={`navbar-menu-btn ${menuOpen ? 'navbar-menu-btn--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={t('nav.menu')}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* 移动端遮罩 */}
      {menuOpen && <div className="navbar-overlay" onClick={closeMenu} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  )
}
