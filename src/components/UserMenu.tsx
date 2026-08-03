import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { isAdmin } from '@/types/user'

// 用户菜单：未登录显示登录按钮；已登录显示头像下拉
export default function UserMenu() {
  const { user, login, logout, refresh } = useAuthStore()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // 首次挂载若有 token 则拉取最新用户信息
  useEffect(() => {
    if (localStorage.getItem('nb_token') && !user) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 点击外部关闭菜单
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) {
    return (
      <button className="btn-login" onClick={login}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
        登录
      </button>
    )
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-avatar-btn" onClick={() => setOpen((v) => !v)}>
        {user.avatar ? (
          <img src={user.avatar} alt={user.username} />
        ) : (
          <span className="user-avatar-fallback">{user.username.slice(0, 1).toUpperCase()}</span>
        )}
      </button>
      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <div className="user-dropdown-name">{user.username}</div>
            <div className="user-dropdown-level">
              等级 {user.level}
              {user.title && <span className="user-title"> · {user.title}</span>}
            </div>
          </div>
          {isAdmin(user) && (
            <Link to="/admin" className="user-dropdown-item" onClick={() => setOpen(false)}>
              管理后台
            </Link>
          )}
          <button
            className="user-dropdown-item"
            onClick={() => {
              setOpen(false)
              logout().then(() => navigate('/'))
            }}
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
