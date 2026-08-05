import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchPageTree, createPage, deletePage } from '@/api/pages'
import { useAuthStore } from '@/store/auth'
import ShareDialog from '@/components/ShareDialog'

interface PageNode {
  id: string
  title: string
  parentId: string | null
  sortOrder: number
  visibility: string
  authorId: number
  authorName: string
  createdAt: string
  updatedAt: string
  children: PageNode[]
}

interface ContextMenuState {
  x: number
  y: number
  id: string
  title: string
}

// 在线文档列表页
export default function Pages() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [tree, setTree] = useState<PageNode[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'my'>('all')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')

  // 多选
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  // 分享
  const [shareDocId, setShareDocId] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchPageTree(tab === 'my')
      .then(setTree)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!user) {
      login()
      return
    }
    try {
      const { id } = await createPage({ title: '无标题文档' })
      navigate(`/pages/${id}`)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        login()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此文档？')) return
    await deletePage(id)
    load()
  }

  const formatDate = (s: string) => {
    if (!s) return ''
    const d = new Date(s)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('zh-CN')
  }

  const getField = (node: any, camel: string, snake: string) =>
    node[camel] ?? node[snake] ?? ''

  const canDelete = (node: PageNode) => {
    if (!user) return false
    const aid = getField(node, 'authorId', 'author_id')
    return Number(aid) === user.id || (user.level ?? 0) >= 1
  }

  // 右键菜单
  const closeCtxMenu = () => setCtxMenu(null)
  useEffect(() => {
    const handler = () => closeCtxMenu()
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, node: PageNode) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, id: node.id, title: node.title })
  }

  // 多选
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个文档吗？`)) return
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => deletePage(id)))
      load()
      clearSelection()
    } catch { alert('删除失败') }
  }

  // 收集所有树节点为扁平列表并排序
  const flattenTree = useCallback((nodes: PageNode[], depth: number = 0): Array<PageNode & { _depth: number }> => {
    const result: Array<PageNode & { _depth: number }> = []
    for (const node of nodes) {
      result.push({ ...node, _depth: depth })
      if (node.children?.length) {
        result.push(...flattenTree(node.children, depth + 1))
      }
    }
    return result
  }, [])

  const sortedNodes = useMemo(() => {
    const flat = flattenTree(tree)
    if (sort === 'title') {
      flat.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
    }
    return flat
  }, [tree, sort, flattenTree])

  const canDeleteNode = (node: PageNode) => {
    if (!user) return false
    const aid = getField(node, 'authorId', 'author_id')
    return Number(aid) === user.id || (user.level ?? 0) >= 1
  }

  return (
    <div className="pages-page">
      <div className="pages-header">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          在线文档
        </h2>
        <div className="pages-header-actions">
          {user && (
            <>
              {selectMode ? (
                <>
                  <button className="btn-create-page btn-create-page--danger" onClick={handleBatchDelete} disabled={selectedIds.size === 0}>
                    删除选中 ({selectedIds.size})
                  </button>
                  <button className="btn-create-page" onClick={clearSelection}>取消</button>
                </>
              ) : (
                <>
                  <button className="btn-create-page" onClick={() => setSelectMode(true)}>多选</button>
                  <button className="btn-create-page" onClick={handleCreate}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    新建文档
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 标签切换 + 排序 */}
      <div className="pages-tabs">
        <button className={`pages-tab ${tab === 'all' ? 'pages-tab--active' : ''}`} onClick={() => setTab('all')}>
          全部文档
        </button>
        {user && (
          <button className={`pages-tab ${tab === 'my' ? 'pages-tab--active' : ''}`} onClick={() => setTab('my')}>
            我的文档
          </button>
        )}
        <div className="pages-sort">
          <button
            className={`pages-sort-btn ${sort === 'updated' ? 'pages-sort-btn--active' : ''}`}
            onClick={() => setSort('updated')}
          >
            按更新时间
          </button>
          <button
            className={`pages-sort-btn ${sort === 'title' ? 'pages-sort-btn--active' : ''}`}
            onClick={() => setSort('title')}
          >
            按文档名
          </button>
        </div>
      </div>

      {loading ? (
        <div className="pages-status">加载中...</div>
      ) : tree.length === 0 ? (
        <div className="pages-status">
          <p>
            {tab === 'my' ? '你还没有创建文档' : '暂无公开文档'}
          </p>
          {user && (
            <button className="btn-primary" onClick={handleCreate}>
              创建第一篇文档
            </button>
          )}
        </div>
      ) : (
        <ul className="page-tree">
          {sortedNodes.map((node) => (
            <li key={node.id} className="page-tree-item" style={{ paddingLeft: `${node._depth * 16}px` }}>
              <div
                className={`page-tree-row ${selectMode ? 'page-tree-row--selectable' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, node)}
              >
                {selectMode && (
                  <label className="page-tree-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(node.id)}
                      onChange={() => toggleSelect(node.id)}
                    />
                  </label>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <Link to={`/pages/${node.id}`} className="page-tree-link">
                  {node.title}
                </Link>
                <span className="page-tree-meta">
                  <span>{getField(node, 'authorName', 'author_name')}</span>
                  <span className={`page-vis-badge ${getField(node, 'visibility', 'visibility') === 'public' ? 'vis-public' : 'vis-private'}`}>
                    {getField(node, 'visibility', 'visibility') === 'public' ? '公开' : '私有'}
                  </span>
                  {Number(getField(node, 'wordCount', 'word_count') || 0) > 0 && (
                    <span>共 {getField(node, 'wordCount', 'word_count')} 字</span>
                  )}
                  <span>{formatDate(getField(node, 'updatedAt', 'updated_at'))}</span>
                </span>
                {canDeleteNode(node) && (
                  <button className="page-tree-del" onClick={() => handleDelete(node.id)} title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 右键菜单 */}
      {ctxMenu && (
        <div
          className="doc-ctx-menu"
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="ctx-menu-item" onClick={() => { navigate(`/pages/${ctxMenu.id}`); closeCtxMenu() }}>
            打开
          </button>
          <button className="ctx-menu-item" onClick={() => { setShareDocId(ctxMenu.id); setShareOpen(true); closeCtxMenu() }}>
            分享
          </button>
          {canDelete({ id: ctxMenu.id, title: ctxMenu.title } as PageNode) && (
            <button className="ctx-menu-item ctx-menu-item--danger" onClick={() => { handleDelete(ctxMenu.id); closeCtxMenu() }}>
              删除
            </button>
          )}
        </div>
      )}

      {shareOpen && shareDocId && (
        <ShareDialog docId={shareDocId} onClose={() => { setShareOpen(false); setShareDocId('') }} />
      )}
    </div>
  )
}
