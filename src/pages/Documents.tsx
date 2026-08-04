import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchDocumentsByFolder, moveDocument } from '@/api/documents'
import { fetchBookmarks } from '@/api/bookmarks'
import { fetchFolders, createFolder, deleteFolder } from '@/api/folders'
import type { Folder } from '@/api/folders'
import type { Document, FileType } from '@/types/document'
import { resolveUri } from '@/utils/url'
import DocumentCard from '@/components/DocumentCard'
import FolderCard from '@/components/FolderCard'
import PathBar from '@/components/PathBar'
import FileTypeIcon from '@/components/FileTypeIcon'
import BookmarkButton from '@/components/BookmarkButton'
import UploadDialog from '@/components/UploadDialog'
import { useAuthStore } from '@/store/auth'
import { isAdmin } from '@/types/user'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'

type FilterType = FileType | 'all' | 'bookmarks'

interface PathItem {
  id: string | null
  name: string
}

interface ContextMenuState {
  x: number
  y: number
  type: 'doc' | 'folder' | 'empty'
  id: string
  title: string
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'bookmarks', label: '书签' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pptx', label: 'PPT' },
  { value: 'image', label: '图片' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: '文本' },
]

// 文档列表页（含文件夹功能 + 键盘导航 + 拖拽 + 右键菜单）
export default function Documents() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<Document[]>([])
  const [bookmarkDocs, setBookmarkDocs] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')
  const [showUpload, setShowUpload] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // 文件夹导航
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [pathStack, setPathStack] = useState<PathItem[]>([{ id: null, name: '全部文档' }])

  // 键盘导航
  const [focusIndex, setFocusIndex] = useState(-1)

  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  const user = useAuthStore((s) => s.user)
  const canUpload = isAdmin(user)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    Promise.all([
      fetchDocumentsByFolder(currentFolderId).catch(() => []),
      fetchFolders(currentFolderId).catch(() => []),
      user ? fetchBookmarks().catch(() => []) : Promise.resolve([]),
    ])
      .then(([docList, folderList, bmList]) => {
        setDocs(docList)
        setFolders(folderList)
        setBookmarkDocs(bmList)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [currentFolderId, user])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = filter === 'bookmarks' ? bookmarkDocs : docs
    if (filter !== 'all' && filter !== 'bookmarks') list = list.filter((d) => d.type === filter)
    const kw = keyword.trim()
    if (kw) list = list.filter((d) => d.title.includes(kw))
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh')
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [docs, bookmarkDocs, filter, keyword, sort])

  const filteredFolders = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return folders
    return folders.filter((f) => f.name.includes(kw))
  }, [folders, keyword])

  const showFolders = filter === 'all' || filter === 'bookmarks'

  // 所有可导航项（文件夹 + 文档）
  const navItems = useMemo(() => {
    const items: Array<{ type: 'folder' | 'doc'; id: string; name: string }> = []
    if (showFolders) filteredFolders.forEach((f) => items.push({ type: 'folder', id: f.id, name: f.name }))
    filtered.forEach((d) => items.push({ type: 'doc', id: d.id, name: d.title }))
    return items
  }, [showFolders, filteredFolders, filtered])

  const enterFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id)
    setPathStack((prev) => [...prev, { id: folder.id, name: folder.name }])
    setFocusIndex(-1)
  }

  const navigateTo = (id: string | null) => {
    const idx = pathStack.findIndex((item) => item.id === id)
    if (idx >= 0) {
      setCurrentFolderId(id)
      setPathStack(pathStack.slice(0, idx + 1))
      setFocusIndex(-1)
    }
  }

  const goBack = () => {
    if (currentFolderId) {
      const parent = pathStack[pathStack.length - 2]
      navigateTo(parent?.id ?? null)
    }
  }

  const handleCreateFolder = async () => {
    const name = prompt('请输入文件夹名称：')
    if (!name?.trim()) return
    try { await createFolder(name.trim(), currentFolderId); load() }
    catch { alert('创建文件夹失败') }
  }

  const handleDeleteFolder = async (folder: Folder) => {
    if (!confirm(`确定要删除文件夹「${folder.name}」吗？其中的所有内容也会被删除。`)) return
    try { await deleteFolder(folder.id); load() }
    catch { alert('删除文件夹失败') }
  }

  const handleDeleteDoc = async (doc: Document) => {
    if (!confirm(`确定要删除文档「${doc.title}」吗？`)) return
    try {
      const client = (await import('@/api/client')).default
      await client.delete(`/admin/documents/${doc.id}`)
      load()
    } catch { alert('删除失败') }
  }

  const handleToggleVisibility = async (doc: Document) => {
    try {
      const client = (await import('@/api/client')).default
      await client.put(`/admin/documents/${doc.id}/visibility`, { visibility: 'private' })
      load()
    } catch { alert('操作失败') }
  }

  const handleShareDoc = (doc: Document) => {
    const url = `${window.location.origin}/viewer/${doc.id}`
    navigator.clipboard.writeText(`【${doc.title}】${url}`).then(() => {
      alert('分享链接已复制到剪贴板')
    })
  }

  // === 键盘导航 ===
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (ctxMenu) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusIndex((prev) => Math.min(prev + 1, navItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (navItems[focusIndex]) {
          const item = navItems[focusIndex]
          if (item.type === 'folder') enterFolder(folders.find((f) => f.id === item.id)!)
          else navigate(`/viewer/${item.id}`)
        }
        break
      case 'Backspace':
        e.preventDefault()
        goBack()
        break
      case 'Delete':
        if (navItems[focusIndex] && canUpload) {
          const item = navItems[focusIndex]
          if (item.type === 'folder') {
            const f = folders.find((x) => x.id === item.id)
            if (f) handleDeleteFolder(f)
          } else {
            const d = filtered.find((x) => x.id === item.id)
            if (d) handleDeleteDoc(d)
          }
        }
        break
    }
  }, [focusIndex, navItems, folders, filtered, canUpload, navigate, ctxMenu])

  // === 拖拽到文件夹 ===
  const handleDragStart = (e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('text/plain', docId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnFolder = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    const docId = e.dataTransfer.getData('text/plain')
    if (docId) {
      try { await moveDocument(docId, folderId); load() }
      catch {}
    }
  }

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault()
    const docId = e.dataTransfer.getData('text/plain')
    if (docId) {
      try { await moveDocument(docId, null); load() }
      catch {}
    }
  }

  // === 右键菜单 ===
  const closeCtxMenu = () => setCtxMenu(null)

  useEffect(() => {
    const handler = () => closeCtxMenu()
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, type: 'doc' | 'folder' | 'empty', id: string, title: string) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, type, id, title })
  }

  return (
    <div
      className="documents-page"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDrop={handleDropOnRoot}
      ref={containerRef}
    >
      <PathBar path={pathStack} onNavigate={navigateTo} />

      <div className="documents-toolbar">
        <input
          className="search-input"
          placeholder="搜索文档..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setFocusIndex(-1) }}
        />
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`filter-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'updated' | 'title')}
        >
          <option value="updated">最近更新</option>
          <option value="title">标题排序</option>
        </select>
        <div className="view-toggle">
          <button className={`vt-btn ${viewMode === 'grid' ? 'vt-btn--active' : ''}`} onClick={() => setViewMode('grid')} title="网格视图">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button className={`vt-btn ${viewMode === 'list' ? 'vt-btn--active' : ''}`} onClick={() => setViewMode('list')} title="列表视图">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
        {canUpload && (
          <>
            <button className="btn-ghost" onClick={handleCreateFolder} title="新建文件夹">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              新建文件夹
            </button>
            <button className="btn-upload" onClick={() => setShowUpload(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              上传
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="documents-status">加载中...</div>
      ) : error ? (
        <div className="documents-status">文档加载失败，请稍后重试</div>
      ) : filtered.length === 0 && filteredFolders.length === 0 ? (
        <div className="documents-status">未找到匹配的内容</div>
      ) : viewMode === 'list' ? (
        <div className="doc-list">
          <div className="doc-list-header">
            <span className="doc-list-cell doc-list-cell--name">名称</span>
            <span className="doc-list-cell doc-list-cell--type">类型</span>
            <span className="doc-list-cell doc-list-cell--size">大小</span>
            <span className="doc-list-cell doc-list-cell--date">更新时间</span>
            <span className="doc-list-cell doc-list-cell--actions" />
          </div>
          {showFolders && filteredFolders.map((f, fi) => (
            <div
              key={f.id}
              className={`doc-list-row ${focusIndex === fi ? 'doc-list-row--focus' : ''}`}
              onClick={() => enterFolder(f)}
              onContextMenu={(e) => handleContextMenu(e, 'folder', f.id, f.name)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnFolder(e, f.id)}
            >
              <div className="doc-list-cell doc-list-cell--name" style={{ cursor: 'pointer' }}>
                <span className="doc-list-thumb doc-list-thumb--icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" color="#f59e0b">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className="doc-list-title">{f.name}</span>
              </div>
              <span className="doc-list-cell doc-list-cell--type"><span className="doc-tag">文件夹</span></span>
              <span className="doc-list-cell doc-list-cell--size">-</span>
              <span className="doc-list-cell doc-list-cell--date">{formatDate(f.created_at)}</span>
              <span className="doc-list-cell doc-list-cell--actions" />
            </div>
          ))}
          {filtered.map((d, di) => {
            const globalIdx = showFolders ? filteredFolders.length + di : di
            return (
              <div
                key={d.id}
                className={`doc-list-row ${focusIndex === globalIdx ? 'doc-list-row--focus' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, 'doc', d.id, d.title)}
                draggable
                onDragStart={(e) => handleDragStart(e, d.id)}
              >
                <Link to={`/viewer/${d.id}`} className="doc-list-cell doc-list-cell--name"
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleContextMenu(e, 'doc', d.id, d.title) }}>
                  {d.type === 'image' ? (
                    <img className="doc-list-thumb" src={resolveUri(d.uri)} alt={d.title} />
                  ) : (
                    <span className="doc-list-thumb doc-list-thumb--icon"><FileTypeIcon type={d.type} /></span>
                  )}
                  <span className="doc-list-title">{d.title}</span>
                </Link>
                <span className="doc-list-cell doc-list-cell--type"><span className="doc-tag">{getFileTypeLabel(d.type)}</span></span>
                <span className="doc-list-cell doc-list-cell--size">{formatSize(d.size)}</span>
                <span className="doc-list-cell doc-list-cell--date">{formatDate(d.updatedAt)}</span>
                <span className="doc-list-cell doc-list-cell--actions"><BookmarkButton docId={d.id} /></span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="doc-grid">
          {showFolders && filteredFolders.map((f) => (
            <div key={f.id} onContextMenu={(e) => handleContextMenu(e, 'folder', f.id, f.name)}
              onDragOver={handleDragOver} onDrop={(e) => handleDropOnFolder(e, f.id)}>
              <FolderCard folder={f} onClick={() => enterFolder(f)} />
            </div>
          ))}
          {filtered.map((d, di) => {
            const globalIdx = showFolders ? filteredFolders.length + di : di
            return (
              <div key={d.id} className={focusIndex === globalIdx ? 'doc-card-focus' : ''}
                onContextMenu={(e) => handleContextMenu(e, 'doc', d.id, d.title)}
                draggable onDragStart={(e) => handleDragStart(e, d.id)}>
                <DocumentCard doc={d} />
              </div>
            )
          })}
        </div>
      )}

      {showUpload && (
        <UploadDialog onClose={() => setShowUpload(false)} onUploaded={() => load()} folderId={currentFolderId} />
      )}

      {/* 右键菜单 */}
      {ctxMenu && (
        <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          {ctxMenu.type === 'doc' ? (
            <>
              <button className="ctx-menu-item" onClick={() => { navigate(`/viewer/${ctxMenu.id}`); closeCtxMenu() }}>
                打开
              </button>
              <button className="ctx-menu-item" onClick={() => { handleShareDoc({ id: ctxMenu.id, title: ctxMenu.title } as Document); closeCtxMenu() }}>
                分享
              </button>
              {canUpload && (
                <>
                  <div className="ctx-menu-sep" />
                  <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => {
                    handleToggleVisibility({ id: ctxMenu.id, title: ctxMenu.title } as Document)
                    closeCtxMenu()
                  }}>
                    设为私有
                  </button>
                  <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => {
                    handleDeleteDoc({ id: ctxMenu.id, title: ctxMenu.title } as Document)
                    closeCtxMenu()
                  }}>
                    删除
                  </button>
                </>
              )}
            </>
          ) : ctxMenu.type === 'folder' ? (
            <>
              <button className="ctx-menu-item" onClick={() => {
                const f = folders.find((x) => x.id === ctxMenu.id)
                if (f) enterFolder(f)
                closeCtxMenu()
              }}>
                打开
              </button>
              {canUpload && (
                <>
                  <div className="ctx-menu-sep" />
                  <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => {
                    const f = folders.find((x) => x.id === ctxMenu.id)
                    if (f) handleDeleteFolder(f)
                    closeCtxMenu()
                  }}>
                    删除文件夹
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {canUpload && (
                <>
                  <button className="ctx-menu-item" onClick={() => { handleCreateFolder(); closeCtxMenu() }}>
                    新建文件夹
                  </button>
                  <button className="ctx-menu-item" onClick={() => { setShowUpload(true); closeCtxMenu() }}>
                    上传文档
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
