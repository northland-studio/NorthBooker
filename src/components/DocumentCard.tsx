import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Document } from '@/types/document'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'
import FileTypeIcon from './FileTypeIcon'
import BookmarkButton from './BookmarkButton'

// 文档卡片
export default function DocumentCard({ doc, showCheckbox, checked, onToggle }: {
  doc: Document
  showCheckbox?: boolean
  checked?: boolean
  onToggle?: () => void
}) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()
  const hasThumb = !!doc.thumbnail
  const showThumb = hasThumb && !imgError && doc.type !== 'image'
  const showImagePreview = doc.type === 'image'

  // 点击上传者跳转其个人主页（卡片本身是 Link，阻止冒泡避免跳转到文档）
  const openOwner = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (doc.owner) navigate(`/profile/${doc.owner.id}`)
  }

  return (
    <div className="doc-card-wrapper">
      <Link to={`/viewer/${doc.id}`} className="doc-card" draggable={false}>
        <div className="doc-card-thumb">
          {showImagePreview ? (
            <img src={doc.uri} alt={doc.title} loading="lazy" draggable={false} />
          ) : showThumb ? (
            <>
              {!imgLoaded && <div className="doc-card-thumb-skeleton" />}
              <img
                src={doc.thumbnail}
                alt={doc.title}
                loading="lazy"
                draggable={false}
                style={{ display: imgLoaded ? undefined : 'none' }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </>
          ) : (
            <FileTypeIcon type={doc.type} />
          )}
        </div>
        <div className="doc-card-body">
          <h3 className="doc-card-title" title={doc.title}>
            {doc.title}
          </h3>
          <div className="doc-card-meta">
            <span className="doc-tag">{getFileTypeLabel(doc.type)}</span>
            <span>{formatSize(doc.size)}</span>
            <span>{formatDate(doc.updatedAt)}</span>
          </div>
          {doc.owner && (
            <button className="doc-card-owner user-link" onClick={openOwner} title={doc.owner.username}>
              {doc.owner.avatar ? (
                <img className="user-link-avatar" src={doc.owner.avatar} alt="" />
              ) : (
                <span className="user-link-avatar-fallback">{doc.owner.username.slice(0, 1).toUpperCase()}</span>
              )}
              {doc.owner.username}
            </button>
          )}
          {doc.tags && doc.tags.length > 0 && (
            <div className="doc-card-tags">
              {doc.tags.slice(0, 3).map((t) => (
                <span key={t} className="doc-card-tag">{t}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
      {showCheckbox && (
        <label className="doc-card-check" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={onToggle} />
          <span className="doc-card-check-mark" />
        </label>
      )}
      {!showCheckbox && <BookmarkButton docId={doc.id} />}
    </div>
  )
}
