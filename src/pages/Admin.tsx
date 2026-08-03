import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminStats,
  fetchAdminDocuments,
  fetchAdminUsers,
  updateDocumentVisibility,
  deleteDocument,
  type AdminStats,
  type AdminDocument,
  type AdminUser,
} from '@/api/admin'
import { updateDocumentTitle } from '@/api/uploads'

type Tab = 'documents' | 'users'

// 字节大小可读化
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// 时间格式化
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// 管理后台
export default function Admin() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [docs, setDocs] = useState<AdminDocument[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [tab, setTab] = useState<Tab>('documents')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [s, d, u] = await Promise.all([
        fetchAdminStats(),
        fetchAdminDocuments(),
        fetchAdminUsers(),
      ])
      setStats(s)
      setDocs(d)
      setUsers(u)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleToggleVisibility = async (doc: AdminDocument) => {
    const next = doc.visibility === 'public' ? 'private' : 'public'
    try {
      await updateDocumentVisibility(doc.id, next)
      setDocs((list) => list.map((d) => (d.id === doc.id ? { ...d, visibility: next } : d)))
    } catch {
      alert('更新失败')
    }
  }

  const handleDelete = async (doc: AdminDocument) => {
    if (!confirm(`确定删除文档「${doc.title}」吗？`)) return
    try {
      await deleteDocument(doc.id)
      setDocs((list) => list.filter((d) => d.id !== doc.id))
      setStats((s) => (s ? { ...s, documents: s.documents - 1 } : s))
    } catch {
      alert('删除失败')
    }
  }

  const startEdit = (doc: AdminDocument) => {
    setEditingId(doc.id)
    setEditTitle(doc.title)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const saveEdit = async (doc: AdminDocument) => {
    const t = editTitle.trim()
    if (!t) {
      alert('标题不能为空')
      return
    }
    try {
      const updated = await updateDocumentTitle(doc.id, t)
      setDocs((list) => list.map((d) => (d.id === doc.id ? { ...d, title: updated.title, updatedAt: updated.updatedAt } : d)))
      cancelEdit()
    } catch {
      alert('重命名失败')
    }
  }

  if (loading) return <div className="documents-status">加载中...</div>
  if (error) return <div className="documents-status">数据加载失败，请确认权限后重试</div>

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">管理后台</h1>
        <button className="btn-refresh" onClick={loadAll}>
          刷新
        </button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.documents}</div>
            <div className="stat-label">文档总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.users}</div>
            <div className="stat-label">用户总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.admins}</div>
            <div className="stat-label">管理员数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatSize(stats.totalSize)}</div>
            <div className="stat-label">文档总大小</div>
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'documents' ? 'active' : ''}`}
          onClick={() => setTab('documents')}
        >
          文档管理
        </button>
        <button
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          用户管理
        </button>
      </div>

      {/* 文档管理表格 */}
      {tab === 'documents' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>类型</th>
                <th>大小</th>
                <th>更新时间</th>
                <th>可见性</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="cell-title">
                    {editingId === d.id ? (
                      <div className="inline-edit">
                        <input
                          className="inline-edit-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                        />
                        <button className="link-btn" onClick={() => saveEdit(d)}>
                          保存
                        </button>
                        <button className="link-btn" onClick={cancelEdit}>
                          取消
                        </button>
                      </div>
                    ) : (
                      d.title
                    )}
                  </td>
                  <td>
                    <span className="doc-tag">{d.type}</span>
                  </td>
                  <td>{formatSize(d.size)}</td>
                  <td>{formatDate(d.updatedAt)}</td>
                  <td>
                    <span
                      className={`visibility-badge ${
                        d.visibility === 'public' ? 'public' : 'private'
                      }`}
                    >
                      {d.visibility === 'public' ? '公开' : '私有'}
                    </span>
                  </td>
                  <td className="cell-actions">
                    {editingId !== d.id && (
                      <>
                        <button className="link-btn" onClick={() => startEdit(d)}>
                          重命名
                        </button>
                        <button className="link-btn" onClick={() => handleToggleVisibility(d)}>
                          {d.visibility === 'public' ? '设为私有' : '设为公开'}
                        </button>
                        <button className="link-btn danger" onClick={() => handleDelete(d)}>
                          删除
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    暂无文档
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 用户管理表格 */}
      {tab === 'users' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>玄剑ID</th>
                <th>等级</th>
                <th>贡献</th>
                <th>注册时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="cell-user">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.username} className="row-avatar" />
                    ) : (
                      <span className="row-avatar-fallback">
                        {u.username.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {u.username}
                  </td>
                  <td>#{u.xuanjianId}</td>
                  <td>
                    <span className={`level-badge level-${u.level}`}>L{u.level}</span>
                  </td>
                  <td>{u.contribution}</td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
