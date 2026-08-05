// 邮箱绑定弹窗（2.6.1）：检测到用户未绑定邮箱时全局弹出，邮件链接一键验证
import { useState } from 'react'
import { sendVerificationEmail } from '@/api/email'
import { useAuthStore } from '@/store/auth'
import { useT } from '@/i18n'

interface EmailBindModalProps {
  open: boolean
  onClose: () => void
}

export default function EmailBindModal({ open, onClose }: EmailBindModalProps) {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleSend = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('email.invalid'))
      return
    }
    setSending(true)
    setError('')
    try {
      await sendVerificationEmail(email.trim())
      setSent(true)
    } catch {
      setError(t('email.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="dialog-mask">
      <div className="dialog-card" style={{ maxWidth: 420 }}>
        <div className="dialog-header">
          <h3>{t('email.bindTitle')}</h3>
          <button className="dialog-close" onClick={onClose} aria-label={t('common.close')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="share-dialog-body">
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, margin: '0 0 14px' }}>
            {t('email.bindDesc')}
          </p>
          {!sent ? (
            <>
              <label className="form-label">{t('email.emailLabel')}</label>
              <input
                className="form-input"
                type="email"
                placeholder={t('email.emailPlaceholder')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              {error && <div className="form-error">{error}</div>}
              <button className="btn-primary" style={{ width: '100%', margin: '14px 0 0' }} onClick={handleSend} disabled={sending}>
                {sending ? t('email.sending') : t('email.send')}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#f0f7ff', border: '1px solid #cce5ff', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#1e4e8c', lineHeight: 1.7 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" />
                </svg>
                <span>{t('email.sentHint')}</span>
              </div>
              <button className="btn-ghost" style={{ width: '100%', margin: '14px 0 0' }} onClick={onClose}>
                {t('email.later')}
              </button>
            </>
          )}
          {user && (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '14px 0 0', textAlign: 'center' }}>
              {t('email.currentUser')}：{user.username}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
