import type { Folder } from '@/api/folders'

export default function FolderCard({ folder, onClick }: { folder: Folder; onClick?: () => void }) {
  return (
    <div className="doc-card-wrapper">
      <div className="doc-card folder-card" onClick={onClick} style={{ cursor: 'pointer' }}>
        <div className="doc-card-thumb folder-thumb">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" color="#f59e0b">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="doc-card-body">
          <h3 className="doc-card-title">{folder.name}</h3>
          <div className="doc-card-meta">
            <span className="doc-tag">文件夹</span>
          </div>
        </div>
      </div>
    </div>
  )
}
