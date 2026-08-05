import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  const hasThumb = !!doc.thumbnail
  const showThumb = hasThumb && !imgError && doc.type !== 'image'
  const showImagePreview = doc.type === 'image'

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
