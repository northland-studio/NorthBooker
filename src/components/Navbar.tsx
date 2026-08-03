import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

// 顶部导航栏
export default function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src="/icon.png" alt="北牖" />
        <span>北牖 NorthBooker</span>
      </Link>
      <div className="navbar-actions">
        <ThemeToggle />
      </div>
    </header>
  )
}
