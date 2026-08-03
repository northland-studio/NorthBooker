import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { fetchComments, postComment, deleteComment } from '@/api/comments'
import { formatDate } from '@/utils/fileType'
import type { Comment } from '@/types/document'

interface CommentPanelProps {
  docId: string
  open: boolean
  onClose: () => void
}

// 推入式评论区面板
export default function CommentPanel({ docId, open, onClose }: CommentPanelProps) {
  const user = useAuthStore((s) => s.user)
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      fetchComments(docId).then(setComments).catch(() => {})
    }
  }, [docId, open])

  const submit = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const c = await postComment(docId, text.trim())
      setComments((prev) => [...prev, c])
      setText('')
      setTimeout(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight), 100)
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  const remove = async (commentId: number) => {
    await deleteComment(commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  const canDelete = (c: Comment) => {
    if (!user) return false
    return c.userId === user.id || (user.level ?? 0) >= 1
  }

  return (
    <>
      {/* 遮罩 */}
      {open && <div className="comment-overlay" onClick={onClose} />}
      <div className={`comment-panel ${open ? 'comment-panel--open' : ''}`}>
        <div className="comment-panel-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            评论 ({comments.length})
          </h3>
          <button className="comment-panel-close" onClick={onClose} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="comment-panel-body">
          {user ? (
            <div className="comment-input-wrap">
              <textarea
                className="comment-input"
                placeholder="写下你的评论..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                maxLength={2000}
                rows={2}
              />
              <button className="comment-submit" onClick={submit} disabled={!text.trim() || sending}>
                {sending ? '发送中...' : '发表'}
              </button>
            </div>
          ) : (
            <div className="comment-login-hint">登录后即可发表评论</div>
          )}

          <div className="comment-list" ref={listRef}>
            {comments.length === 0 ? (
              <div className="comment-empty">暂无评论</div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className="comment-avatar">
                    {c.avatar ? (
                      <img src={c.avatar} alt={c.username} />
                    ) : (
                      <span className="comment-avatar-fallback">{c.username.charAt(0)}</span>
                    )}
                  </div>
                  <div className="comment-body">
                    <div className="comment-meta">
                      <span className="comment-username">{c.username}</span>
                      {c.level > 0 && <span className="comment-badge">管理员</span>}
                      <span className="comment-time">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="comment-content">{c.content}</div>
                  </div>
                  {canDelete(c) && (
                    <button className="comment-delete" onClick={() => remove(c.id)} title="删除">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
