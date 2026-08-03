import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { checkBookmark, addBookmark, removeBookmark } from '@/api/bookmarks'

// 书签收藏按钮
export default function BookmarkButton({ docId }: { docId: string }) {
  const user = useAuthStore((s) => s.user)
  const [bookmarked, setBookmarked] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setBookmarked(false)
      return
    }
    checkBookmark(docId).then(setBookmarked).catch(() => {})
  }, [docId, user])

  const toggle = async () => {
    if (!user) return
    setLoading(true)
    try {
      if (bookmarked) {
        await removeBookmark(docId)
        setBookmarked(false)
      } else {
        await addBookmark(docId)
        setBookmarked(true)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <button
      className={`bookmark-btn ${bookmarked ? 'bookmarked' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      disabled={loading}
      aria-label={bookmarked ? '取消收藏' : '添加收藏'}
      title={bookmarked ? '取消收藏' : '添加收藏'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}
