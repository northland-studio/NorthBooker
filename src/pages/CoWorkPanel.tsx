// 协作控制面板（2.6.2）：/pages/:id/cowork_set — 文档协作权限系统的管理入口
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPage, updatePage, updateCoworkSet } from '@/api/pages'
import { fetchSubscriptions, subscribe, unsubscribe } from '@/api/subscriptions'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'
import { formatDate } from '@/utils/fileType'

interface PageInfo {
  id: string
  title: string
  content?: string
  visibility: string
  cowork_policy?: string
  author_id: number
  author_name?: string
  author_avatar?: string | null
  created_at?: string
  updated_at?: string
}

export default function CoWorkPanel() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const t = useT()
  const user = useAuthStore((s) => s.user)

  const [page, setPage] = useState<PageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [policy, setPolicy] = useState<'open' | 'author'>('open')
  const [visibility, setVisibility] = useState('public')
  const [saving, setSaving] = useState<'policy' | 'visibility' | null>(null)
  const [savedTip, setSavedTip] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const isAuthor = !!user && !!page && page.author_id === user.id

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetchPage(id)
      .then((p) => {
        setPage(p)
        setPolicy(p.cowork_policy === 'author' ? 'author' : 'open')
        setVisibility(p.visibility ?? 'public')
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  // 当前用户订阅状态
  useEffect(() => {
    if (!id || !user) return
    fetchSubscriptions()
      .then((list) => {
        const hit = (list || []).find((s: any) => s.target_type === 'page' && s.target_id === id)
        setSubscribed(!!hit)
      })
      .catch(() => setSubscribed(false))
  }, [id, user])

  const handleSavePolicy = async (next: 'open' | 'author') => {
    if (!id || !isAuthor) return
    setSaving('policy')
    setSavedTip('')
    try {
      await updateCoworkSet(id, next)
      setPolicy(next)
      setSavedTip(t('cowork.saved'))
    } catch {
      setSavedTip(t('cowork.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  const handleToggleVisibility = async () => {
    if (!id || !isAuthor) return
    const next = visibility === 'public' ? 'private' : 'public'
    setSaving('visibility')
    setSavedTip('')
    try {
      await updatePage(id, { visibility: next })
      setVisibility(next)
      setSavedTip(t('cowork.saved'))
    } catch {
      setSavedTip(t('cowork.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  const toggleSubscribe = async () => {
    if (!id) return
    try {
      if (subscribed) {
        await unsubscribe('page', id)
        setSubscribed(false)
      } else {
        await subscribe('page', id)
        setSubscribed(true)
      }
    } catch {
      /* ignore */
    }
  }

  if (loading) return <div className="viewer-status">加载中...</div>
  if (error || !page) {
    return (
      <div className="viewer-status-wrap">
        <div className="viewer-status-card">
          <h2>{t('viewer.notFound')}</h2>
          <button className="btn-primary" onClick={() => navigate('/pages')}>
            {t('viewer.backToList')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cowork-page">
      <div className="cowork-header">
        <button className="viewer-back" onClick={() => navigate(`/pages/${page.id}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {t('viewer.back')}
        </button>
        <div className="cowork-title-wrap">
          <h2 className="cowork-title">{page.title}</h2>
          <span className="cowork-subtitle">{t('cowork.pageTitle')}</span>
        </div>
        <button className="btn-ghost" onClick={() => navigate(`/pages/${page.id}`)}>
          {t('cowork.openDoc')}
        </button>
      </div>

      <div className="cowork-body">
        {/* 文档信息 */}
        <section className="cowork-card">
          <h3 className="cowork-card-title">{t('cowork.docInfo')}</h3>
          <div className="cowork-info-row">
            <span className="cowork-info-label">{t('cowork.author')}</span>
            <span className="cowork-info-value">
              {page.author_name && page.author_id > 0 && (
                <button
                  className="user-link"
                  title={page.author_name}
                  onClick={() => navigate(`/profile/${page.author_id}`)}
                >
                  {page.author_avatar && <img className="user-link-avatar" src={page.author_avatar} alt="" />}
                  {page.author_name}
                </button>
              )}
              {!page.author_name && <span>{t('common.unknownUser')}</span>}
            </span>
          </div>
          <div className="cowork-info-row">
            <span className="cowork-info-label">{t('cowork.visibility')}</span>
            <span className="cowork-info-value">
              {visibility === 'public' ? t('editor.public') : t('editor.private')}
              {isAuthor && (
                <button className="link-btn" onClick={handleToggleVisibility} disabled={saving === 'visibility'}>
                  {saving === 'visibility' ? t('common.savingText') : t('cowork.toggleVisibility')}
                </button>
              )}
            </span>
          </div>
          <div className="cowork-info-row">
            <span className="cowork-info-label">{t('cowork.updatedAt')}</span>
            <span className="cowork-info-value">{page.updated_at ? formatDate(page.updated_at) : '-'}</span>
          </div>
        </section>

        {/* 协作编辑权限 */}
        <section className="cowork-card">
          <h3 className="cowork-card-title">{t('cowork.editPolicy')}</h3>
          <p className="cowork-card-desc">{t('cowork.editPolicyDesc')}</p>
          <div className="cowork-options">
            <label className={`cowork-option ${policy === 'open' ? 'cowork-option--active' : ''} ${!isAuthor ? 'cowork-option--disabled' : ''}`}>
              <input
                type="radio"
                name="cowork-policy"
                checked={policy === 'open'}
                disabled={!isAuthor}
                onChange={() => handleSavePolicy('open')}
              />
              <span className="cowork-option-title">{t('cowork.policyOpen')}</span>
              <span className="cowork-option-desc">{t('cowork.policyOpenDesc')}</span>
            </label>
            <label className={`cowork-option ${policy === 'author' ? 'cowork-option--active' : ''} ${!isAuthor ? 'cowork-option--disabled' : ''}`}>
              <input
                type="radio"
                name="cowork-policy"
                checked={policy === 'author'}
                disabled={!isAuthor}
                onChange={() => handleSavePolicy('author')}
              />
              <span className="cowork-option-title">{t('cowork.policyAuthor')}</span>
              <span className="cowork-option-desc">{t('cowork.policyAuthorDesc')}</span>
            </label>
          </div>
          {!isAuthor && <p className="cowork-hint">{t('cowork.readonlyHint')}</p>}
        </section>

        {/* 更新订阅 */}
        <section className="cowork-card">
          <h3 className="cowork-card-title">{t('cowork.subscription')}</h3>
          <p className="cowork-card-desc">
            {t('cowork.subscriptionDesc')}
            {!user?.email && <span className="cowork-hint"> {t('cowork.noEmailHint')}</span>}
          </p>
          <button className="btn-ghost" onClick={toggleSubscribe}>
            {subscribed ? t('editor.unsubscribe') : t('editor.subscribe')}
          </button>
        </section>

        {savedTip && <div className="cowork-tip">{savedTip}</div>}
      </div>
    </div>
  )
}
