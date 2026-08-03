import { Link } from 'react-router-dom'
import type { Document } from '@/types/document'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'
import FileTypeIcon from './FileTypeIcon'
import BookmarkButton from './BookmarkButton'

// 文档卡片
export default function DocumentCard({ doc }: { doc: Document }) {
  return (
    <div className="doc-card-wrapper">
      <Link to={`/viewer/${doc.id}`} className="doc-card">
        <div className="doc-card-thumb">
          {doc.type === 'image' ? (
            <img src={doc.uri} alt={doc.title} loading="lazy" />
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
        </div>
      </Link>
      <BookmarkButton docId={doc.id} />
    </div>
  )
}
