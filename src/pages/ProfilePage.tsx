// 个人主页（2.6.3）：/profile/:user — 展示贡献总字数、上传文件数、邮箱绑定与订阅情况
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchProfile } from '@/api/profile'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { formatDate } from '@/utils/fileType'

interface ProfileData {
  user: {
    id: number
    username: string
    avatar: string | null
    level: number
    title: string | null
    contribution: number
    createdAt: string
    emailBound: boolean
    email: string | null
  }
  stats: { totalChars: number; docCount: number; uploadCount: number; subCount: number }
  subscriptions: { page_id: string; title: string; updated_at: string }[]
}

function formatChars(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)} 千`
  return String(n)
}

export default function ProfilePage() {
  const { user: userId } = useParams<{ user: string }>()
  const navigate = useNavigate()
  const t = useT()
  const me = useAuthStore((s) => s.user)

  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isMe = !!me && data != null && me.id === data.user.id

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError(false)
    fetchProfile(userId)
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [userId, me?.id])

  if (loading) return <div className="viewer-status">{t('common.loading')}</div>
  if (error || !data) {
    return (
      <div className="viewer-status-wrap">
        <div className="viewer-status-card">
          <h2>{t('profile.notFound')}</h2>
          <button className="btn-primary" onClick={() => navigate('/')}>
            {t('viewer.backToList')}
          </button>
        </div>
      </div>
    )
  }

  const { user, stats, subscriptions } = data

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="viewer-back" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {t('viewer.back')}
        </button>
      </div>

      <div className="profile-card profile-card--me">
        <div className="profile-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.username} />
          ) : (
            <span>{user.username.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name">
            {user.username}
            {isMe && <span className="profile-me-badge">{t('profile.me')}</span>}
          </div>
          <div className="profile-meta">
            {t('profile.level')} {user.level}
            {user.title && <span className="user-title"> · {user.title}</span>}
            <span> · {t('profile.joined')} {formatDate(user.createdAt)}</span>
          </div>
          {/* 邮箱绑定状态（本人可见完整，他人仅显示是否绑定） */}
          <div className={`profile-email ${user.emailBound ? 'profile-email--bound' : 'profile-email--unbound'}`}>
            {user.emailBound ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" />
                </svg>
                {t('profile.emailBound')}
                {user.email && <span className="profile-email-value"> · {user.email}</span>}
              </>
            ) : (
              <>{t('profile.emailUnbound')} {isMe && <Link className="link-btn" to="/">{t('profile.bindNow')}</Link>}</>
            )}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat-value">{formatChars(stats.totalChars)}</div>
          <div className="profile-stat-label">{t('profile.totalChars')}</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{stats.docCount}</div>
          <div className="profile-stat-label">{t('profile.docCount')}</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{stats.uploadCount}</div>
          <div className="profile-stat-label">{t('profile.uploadCount')}</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{stats.subCount}</div>
          <div className="profile-stat-label">{t('profile.subCount')}</div>
        </div>
      </div>

      {/* 订阅情况（仅本人/管理员可见） */}
      {subscriptions.length > 0 && (
        <div className="cowork-card">
          <h3 className="cowork-card-title">{t('profile.subscriptions')}</h3>
          <div className="profile-sub-list">
            {subscriptions.map((s) => (
              <Link key={s.page_id} to={`/pages/${s.page_id}`} className="profile-sub-item">
                <span className="profile-sub-title">{s.title || t('common.unknownUser')}</span>
                <span className="profile-sub-time">{formatDate(s.updated_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {subscriptions.length === 0 && isMe && (
        <div className="cowork-card">
          <h3 className="cowork-card-title">{t('profile.subscriptions')}</h3>
          <p className="cowork-card-desc">{t('profile.noSubs')}</p>
        </div>
      )}
    </div>
  )
}
