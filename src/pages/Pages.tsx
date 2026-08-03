import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchPageTree, createPage, deletePage } from '@/api/pages'
import { useAuthStore } from '@/store/auth'

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

// 在线文档列表页
export default function Pages() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [tree, setTree] = useState<PageNode[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'my'>('all')

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

  // API 返回蛇形命名，统一映射
  const getField = (node: any, camel: string, snake: string) =>
    node[camel] ?? node[snake] ?? ''

  const canDelete = (node: PageNode) => {
    if (!user) return false
    const aid = getField(node, 'authorId', 'author_id')
    return Number(aid) === user.id || (user.level ?? 0) >= 1
  }

  const renderNode = (node: PageNode, depth: number) => (
    <li key={node.id} className="page-tree-item" style={{ paddingLeft: `${depth * 16}px` }}>
      <div className="page-tree-row">
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
          <span>{formatDate(getField(node, 'createdAt', 'created_at') || getField(node, 'updatedAt', 'updated_at'))}</span>
        </span>
        {canDelete(node) && (
          <button className="page-tree-del" onClick={() => handleDelete(node.id)} title="删除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      {node.children?.map((child) => renderNode(child, depth + 1))}
    </li>
  )

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
        {user && (
          <button className="btn-create-page" onClick={handleCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建文档
          </button>
        )}
      </div>

      {/* 标签切换 */}
      <div className="pages-tabs">
        <button className={`pages-tab ${tab === 'all' ? 'pages-tab--active' : ''}`} onClick={() => setTab('all')}>
          全部文档
        </button>
        {user && (
          <button className={`pages-tab ${tab === 'my' ? 'pages-tab--active' : ''}`} onClick={() => setTab('my')}>
            我的文档
          </button>
        )}
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
        <ul className="page-tree">{tree.map((node) => renderNode(node, 0))}</ul>
      )}
    </div>
  )
}
