import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchDocumentsByFolder, moveDocument, updateDocument, trashDocument, fetchTrash, restoreDocument, permanentDeleteDocument } from '@/api/documents'
import { fetchBookmarks } from '@/api/bookmarks'
import { fetchFolders, createFolder, deleteFolder } from '@/api/folders'
import ShareDialog from '@/components/ShareDialog'
import type { Folder } from '@/api/folders'
import type { Document, FileType } from '@/types/document'
import { resolveUri } from '@/utils/url'
import { searchDocuments, type SearchResult } from '@/api/search'
import DocumentCard from '@/components/DocumentCard'
import FolderCard from '@/components/FolderCard'
import PathBar from '@/components/PathBar'
import FileTypeIcon from '@/components/FileTypeIcon'
import BookmarkButton from '@/components/BookmarkButton'
import UploadDialog from '@/components/UploadDialog'
import { useAuthStore } from '@/store/auth'
import { isAdmin } from '@/types/user'
import { useT } from '@/i18n'
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
  moveToOpen?: boolean
}

// 文档列表页（含文件夹功能 + 键盘导航 + 拖拽 + 右键菜单）
export default function Documents() {
  const t = useT()
  const FILTERS: { value: FilterType; label: string }[] = [
    { value: 'all', label: t('doc.all') },
    { value: 'bookmarks', label: t('doc.bookmarks') },
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'Word' },
    { value: 'xlsx', label: 'Excel' },
    { value: 'pptx', label: 'PPT' },
    { value: 'image', label: '图片' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'text', label: '文本' },
  ]
  const navigate = useNavigate()
  const [docs, setDocs] = useState<Document[]>([])
  const [bookmarkDocs, setBookmarkDocs] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')
  // 标签筛选 + 最近文档（2.6.0）
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [recentOnly, setRecentOnly] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    // Electron 桌面端从持久化设置读取默认视图模式
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.isElectron) {
      electronAPI.getSettings().then((s: any) => {
        if (s?.viewMode) setViewMode(s.viewMode)
      })
    }
    return 'grid'
  })

  // 文件夹导航
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [pathStack, setPathStack] = useState<PathItem[]>([{ id: null, name: '全部文档' }])

  // 键盘导航
  const [focusIndex, setFocusIndex] = useState(-1)

  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  // 拖拽悬停高亮
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)

  const user = useAuthStore((s) => s.user)
  const canUpload = isAdmin(user)
  const containerRef = useRef<HTMLDivElement>(null)

  // 全文搜索
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // 批量选择
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveFolderOpen, setMoveFolderOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDocId, setShareDocId] = useState('')
  // 回收站
  const [showTrash, setShowTrash] = useState(false)
  const [trashDocs, setTrashDocs] = useState<Document[]>([])
  const [trashLoading, setTrashLoading] = useState(false)

  const loadTrash = useCallback(async () => {
    setTrashLoading(true)
    try {
      setTrashDocs(await fetchTrash())
    } catch { setTrashDocs([]) } finally { setTrashLoading(false) }
  }, [])

  const handleTrashRestore = async (id: string) => {
    try { await restoreDocument(id); loadTrash() } catch { alert('恢复失败') }
  }

  const handleTrashPermanent = async (doc: Document) => {
    if (!confirm(`永久删除「${doc.title}」？此操作不可恢复，七牛中的文件也会被删除。`)) return
    try { await permanentDeleteDocument(doc.id); loadTrash() } catch { alert('删除失败') }
  }

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
    if (tagFilter) list = list.filter((d) => d.tags?.includes(tagFilter))
    if (recentOnly) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      list = list.filter((d) => new Date(d.updatedAt).getTime() >= weekAgo)
    }
    const kw = keyword.trim()
    if (kw) list = list.filter((d) => d.title.includes(kw))
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh')
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [docs, bookmarkDocs, filter, keyword, sort, tagFilter, recentOnly])

  // 全部标签（智能分类：按文档上的标签自动聚合）
  const allTags = useMemo(() => {
    const set = new Set<string>()
    docs.forEach((d) => d.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'))
  }, [docs])

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
    if (!confirm(`确定要删除文档「${doc.title}」吗？将移入回收站。`)) return
    try {
      await trashDocument(doc.id)
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
    setShareDocId(doc.id)
    setShareOpen(true)
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

  const handleDragEnterFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    setDragOverFolder(folderId)
  }

  const handleDragLeaveFolder = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverFolder(null)
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

  // === 全文搜索 ===
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearching(true)
    setSearchOpen(true)
    try {
      const results = await searchDocuments(trimmed)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch(searchQuery)
    else if (e.key === 'Escape') { setSearchOpen(false); setSearchResults([]) }
  }

  // 搜索结果项点击
  const handleSearchResultClick = (r: SearchResult) => {
    setSearchOpen(false)
    setSearchResults([])
    setSearchQuery('')
    if (r.type === 'document') navigate(`/viewer/${r.id}`)
    else window.open(`/pages/${r.id}`, '_blank')
  }

  // 搜索外点击关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchResults([])
      }
    }
    if (searchOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [searchOpen])

  // === 批量操作 ===
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const allIds = new Set(filtered.map((d) => d.id))
    setSelectedIds(allIds)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const handleBatchMove = async (folderId: string | null) => {
    setMoveFolderOpen(false)
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => moveDocument(id, folderId)))
      load()
      clearSelection()
    } catch { alert('移动失败') }
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个文档吗？将移入回收站。`)) return
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => trashDocument(id)))
      load()
      clearSelection()
    } catch { alert('删除失败') }
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
        <div className="global-search-wrap" ref={searchRef}>
          <input
            className="search-input global-search-input"
            placeholder={t('doc.search')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) { setSearchResults([]); setSearchOpen(false) } }}
            onKeyDown={handleSearchKeyDown}
          />
          <button className="global-search-btn" onClick={() => handleSearch(searchQuery)} title="搜索">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          {searchOpen && (
            <div className="search-results-dropdown">
              {searching ? (
                <div className="search-results-empty">{t('doc.searching')}</div>
              ) : searchResults.length === 0 ? (
                <div className="search-results-empty">{t('doc.noResult')}</div>
              ) : (
                searchResults.map((r) => (
                  <button key={`${r.type}-${r.id}`} className="search-result-item" onClick={() => handleSearchResultClick(r)}>
                    <span className="search-result-icon">
                      {r.type === 'document' ? (
                        <FileTypeIcon type="other" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                    </span>
                    <span className="search-result-body">
                      <span className="search-result-title">{r.title}</span>
                      <span className="search-result-snippet" dangerouslySetInnerHTML={{ __html: r.snippet }} />
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          className={`btn-ghost ${selectMode ? 'btn-ghost--active' : ''}`}
          onClick={selectMode ? clearSelection : () => setSelectMode(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          {selectMode ? t('doc.cancelSelect') : t('doc.select')}
        </button>
        {selectMode && selectedIds.size > 0 && (
          <button className="btn-ghost" onClick={selectAll}>{t('doc.selectAll')}</button>
        )}
        <input
          className="search-input"
          placeholder={t('doc.filter')}
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
        {allTags.length > 0 && (
          <div className="tag-filter-row">
            {allTags.map((t) => (
              <button
                key={t}
                className={`tag-chip ${tagFilter === t ? 'tag-chip--active' : ''}`}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                #{t}
              </button>
            ))}
            {tagFilter && (
              <button className="tag-chip tag-chip--clear" onClick={() => setTagFilter(null)}>
                清除
              </button>
            )}
          </div>
        )}
        <button
          className={`btn-ghost ${recentOnly ? 'btn-ghost--active' : ''}`}
          onClick={() => setRecentOnly(!recentOnly)}
          title="最近 7 天更新的文档"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          最近
        </button>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'updated' | 'title')}
        >
          <option value="updated">{t('doc.sortRecent')}</option>
          <option value="title">{t('doc.sortTitle')}</option>
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
        {user && (
          <button
            className={`btn-ghost ${showTrash ? 'btn-ghost--active' : ''}`}
            onClick={() => { setShowTrash(!showTrash); if (!showTrash) loadTrash() }}
            title="回收站"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {t('doc.trash')}
          </button>
        )}
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

      {showTrash ? (
        <div className="doc-list">
          <div className="doc-list-header">
            <span className="doc-list-cell doc-list-cell--name">名称（回收站）</span>
            <span className="doc-list-cell doc-list-cell--type">类型</span>
            <span className="doc-list-cell doc-list-cell--size">大小</span>
            <span className="doc-list-cell doc-list-cell--date">删除时间</span>
            <span className="doc-list-cell doc-list-cell--actions" />
          </div>
          {trashLoading ? (
            <div className="documents-status">{t('doc.loading')}</div>
          ) : trashDocs.length === 0 ? (
            <div className="documents-status">{t('doc.trashEmpty')}</div>
          ) : (
            trashDocs.map((d) => (
              <div key={d.id} className="doc-list-row">
                <div className="doc-list-cell doc-list-cell--name">
                  {d.type === 'image' || d.thumbnail ? (
                    <img className="doc-list-thumb" src={d.thumbnail || resolveUri(d.uri)} alt={d.title} />
                  ) : (
                    <span className="doc-list-thumb doc-list-thumb--icon"><FileTypeIcon type={d.type} /></span>
                  )}
                  <span className="doc-list-title">{d.title}</span>
                </div>
                <span className="doc-list-cell doc-list-cell--type"><span className="doc-tag">{getFileTypeLabel(d.type)}</span></span>
                <span className="doc-list-cell doc-list-cell--size">{formatSize(d.size)}</span>
                <span className="doc-list-cell doc-list-cell--date">{formatDate(d.deletedAt || d.updatedAt)}</span>
                <span className="doc-list-cell doc-list-cell--actions">
                  <button className="link-btn" onClick={() => handleTrashRestore(d.id)}>恢复</button>
                  {isAdmin(user) && (
                    <button className="link-btn danger" onClick={() => handleTrashPermanent(d)}>永久删除</button>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      ) : loading ? (
        <div className="documents-status">{t('doc.loading')}</div>
      ) : error ? (
        <div className="documents-status">{t('doc.loadFailed')}</div>
      ) : filtered.length === 0 && filteredFolders.length === 0 ? (
        <div className="documents-status">{t('doc.empty')}</div>
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
              className={`doc-list-row${focusIndex === fi ? ' doc-list-row--focus' : ''}${dragOverFolder === f.id ? ' doc-list-row--drop' : ''}`}
              onClick={() => enterFolder(f)}
              onContextMenu={(e) => handleContextMenu(e, 'folder', f.id, f.name)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnterFolder(e, f.id)}
              onDragLeave={handleDragLeaveFolder}
              onDrop={(e) => { handleDropOnFolder(e, f.id); setDragOverFolder(null) }}
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
                className={`doc-list-row ${focusIndex === globalIdx ? 'doc-list-row--focus' : ''} ${selectMode ? 'doc-list-row--selectable' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, 'doc', d.id, d.title)}
                draggable
                onDragStart={(e) => handleDragStart(e, d.id)}
              >
                {selectMode && (
                  <label className="doc-list-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} />
                    <span className="doc-list-check-mark" />
                  </label>
                )}
                <Link to={`/viewer/${d.id}`} className="doc-list-cell doc-list-cell--name" draggable={false}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleContextMenu(e, 'doc', d.id, d.title) }}>
                  {d.type === 'image' || d.thumbnail ? (
                    <img className="doc-list-thumb" src={d.thumbnail || resolveUri(d.uri)} alt={d.title} />
                  ) : (
                    <span className="doc-list-thumb doc-list-thumb--icon"><FileTypeIcon type={d.type} /></span>
                  )}
                  <span className="doc-list-title">{d.title}</span>
                </Link>
                <span className="doc-list-cell doc-list-cell--type"><span className="doc-tag">{getFileTypeLabel(d.type)}</span></span>
                <span className="doc-list-cell doc-list-cell--size">{formatSize(d.size)}</span>
                <span className="doc-list-cell doc-list-cell--date">{formatDate(d.updatedAt)}</span>
                <span className="doc-list-cell doc-list-cell--actions">
                  {!selectMode && <BookmarkButton docId={d.id} />}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="doc-grid">
          {showFolders && filteredFolders.map((f) => (
            <div key={f.id} onContextMenu={(e) => handleContextMenu(e, 'folder', f.id, f.name)}
              className={dragOverFolder === f.id ? 'doc-card-wrapper doc-card-wrapper--drop' : ''}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnterFolder(e, f.id)}
              onDragLeave={handleDragLeaveFolder}
              onDrop={(e) => { handleDropOnFolder(e, f.id); setDragOverFolder(null) }}>
              <FolderCard folder={f} onClick={() => enterFolder(f)} />
            </div>
          ))}
          {filtered.map((d, di) => {
            const globalIdx = showFolders ? filteredFolders.length + di : di
            return (
              <div key={d.id} className={focusIndex === globalIdx ? 'doc-card-focus' : ''}
                onContextMenu={(e) => handleContextMenu(e, 'doc', d.id, d.title)}
                draggable onDragStart={(e) => handleDragStart(e, d.id)}>
                <DocumentCard
                  doc={d}
                  showCheckbox={selectMode}
                  checked={selectedIds.has(d.id)}
                  onToggle={() => toggleSelect(d.id)}
                />
              </div>
            )
          })}
        </div>
      )}

      {showUpload && (
        <UploadDialog onClose={() => setShowUpload(false)} onUploaded={() => load()} folderId={currentFolderId} />
      )}

      {/* 批量操作浮动栏 */}
      {selectMode && selectedIds.size > 0 && (
        <div className="batch-bar">
          <span className="batch-bar-count">已选择 {selectedIds.size} 项</span>
          <button className="btn-ghost" onClick={() => setMoveFolderOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            移动到文件夹
          </button>
          {canUpload && (
            <button className="btn-ghost" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleBatchDelete}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              删除
            </button>
          )}
        </div>
      )}

      {/* 移动到文件夹对话框 */}
      {moveFolderOpen && (
        <div className="dialog-mask" onClick={() => setMoveFolderOpen(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>移动到文件夹</h3>
              <button className="dialog-close" onClick={() => setMoveFolderOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              <button className="ctx-menu-item" onClick={() => handleBatchMove(null)}>
                📁 根目录（全部文档）
              </button>
              {folders.map((f) => (
                <button key={f.id} className="ctx-menu-item" onClick={() => handleBatchMove(f.id)}>
                  📁 {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
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
              <div className="ctx-menu-sep" />
              <button className="ctx-menu-item" onClick={() => {
                setCtxMenu({ ...ctxMenu, moveToOpen: !ctxMenu.moveToOpen })
              }}>
                移动至 ▸
              </button>
              {ctxMenu.moveToOpen && (
                <div className="ctx-submenu">
                  {folders.length === 0 ? (
                    <div className="ctx-submenu-empty">暂无文件夹</div>
                  ) : (
                    folders.map((f) => (
                      <button key={f.id} className="ctx-menu-item" onClick={async () => {
                        try { await moveDocument(ctxMenu.id, f.id); load(); closeCtxMenu() }
                        catch {}
                      }}>
                        {f.name}
                      </button>
                    ))
                  )}
                </div>
              )}
              {canUpload && (
                <>
                  <div className="ctx-menu-sep" />
                  <button className="ctx-menu-item" onClick={() => {
                    const tagsInput = prompt('编辑标签（用逗号分隔，最多 10 个）：')
                    if (tagsInput !== null) {
                      const tags = tagsInput.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
                      updateDocument(ctxMenu.id, { tags }).then(() => { load(); closeCtxMenu() }).catch(() => alert('设置标签失败'))
                    }
                  }}>
                    🏷️ 编辑标签
                  </button>
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

      {shareOpen && shareDocId && <ShareDialog docId={shareDocId} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
