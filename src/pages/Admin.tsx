import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchAdminStats,
  fetchAdminDocuments,
  fetchAdminUsers,
  fetchAuditLogs,
  fetchLoginLogs,
  downloadBackup,
  exportAll,
  updateDocumentVisibility,
  deleteDocument,
  type AdminStats,
  type AdminDocument,
  type AdminUser,
  type AuditLogRow,
  type LoginLogRow,
} from '@/api/admin'
import { updateDocumentTitle } from '@/api/uploads'
import { fetchTrash, restoreDocument, permanentDeleteDocument } from '@/api/documents'
import { useT } from '@/i18n'
import type { Document } from '@/types/document'

type Tab = 'documents' | 'users' | 'trash' | 'audit' | 'login' | 'backup'

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

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 审计动作中文映射
const ACTION_LABELS: Record<string, string> = {
  trash_document: '移入回收站',
  restore_document: '恢复文档',
  permanent_delete: '永久删除',
  delete_page: '删除在线文档',
  upload_document: '上传文档',
  update_page: '更新在线文档',
  login: '登录',
}

// 管理后台
export default function Admin() {
  const t = useT()
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [docs, setDocs] = useState<AdminDocument[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [trash, setTrash] = useState<Document[]>([])
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([])
  const [loginRows, setLoginRows] = useState<LoginLogRow[]>([])
  const [tab, setTab] = useState<Tab>('documents')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [s, d, u, t, a, l] = await Promise.all([
        fetchAdminStats(),
        fetchAdminDocuments(),
        fetchAdminUsers(),
        fetchTrash(),
        fetchAuditLogs(100, 0),
        fetchLoginLogs(100, 0),
      ])
      setStats(s)
      setDocs(d)
      setUsers(u)
      setTrash(t)
      setAuditRows(a.rows)
      setLoginRows(l.rows)
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
    if (!confirm(`确定删除文档「${doc.title}」吗？（七牛文件同步删除）`)) return
    try {
      await deleteDocument(doc.id)
      setDocs((list) => list.filter((d) => d.id !== doc.id))
      setStats((s) => (s ? { ...s, documents: s.documents - 1 } : s))
    } catch {
      alert('删除失败')
    }
  }

  const handleTrashRestore = async (id: string) => {
    try { await restoreDocument(id); loadAll() } catch { alert('恢复失败') }
  }

  const handleTrashPermanent = async (doc: Document) => {
    if (!confirm(`永久删除「${doc.title}」？此操作不可恢复。`)) return
    try { await permanentDeleteDocument(doc.id); loadAll() } catch { alert('删除失败') }
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

  if (loading) return <div className="documents-status">{t('doc.loading')}</div>
  if (error) return <div className="documents-status">{t('doc.loadFailed')}</div>

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">{t('admin.title')}</h1>
        <button className="btn-refresh" onClick={loadAll}>
          {t('admin.refresh')}
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
        <button className={`admin-tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>{t('admin.documents')}</button>
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>{t('admin.users')}</button>
        <button className={`admin-tab ${tab === 'trash' ? 'active' : ''}`} onClick={() => setTab('trash')}>{t('admin.trash')}</button>
        <button className={`admin-tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>{t('admin.audit')}</button>
        <button className={`admin-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>{t('admin.loginLogs')}</button>
        <button className={`admin-tab ${tab === 'backup' ? 'active' : ''}`} onClick={() => setTab('backup')}>{t('admin.backup')}</button>
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
                <th>上传者</th>
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
                        <button className="link-btn" onClick={() => saveEdit(d)}>保存</button>
                        <button className="link-btn" onClick={cancelEdit}>取消</button>
                      </div>
                    ) : (
                      d.title
                    )}
                  </td>
                  <td><span className="doc-tag">{d.type}</span></td>
                  <td>{formatSize(d.size)}</td>
                  <td className="cell-owner">
                    {d.ownerName && d.ownerId ? (
                      <button className="user-link" onClick={() => navigate(`/profile/${d.ownerId}`)} title={d.ownerName}>
                        {d.ownerName}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{formatDate(d.updatedAt)}</td>
                  <td>
                    <span className={`visibility-badge ${d.visibility === 'public' ? 'public' : 'private'}`}>
                      {d.visibility === 'public' ? '公开' : '私有'}
                    </span>
                  </td>
                  <td className="cell-actions">
                    {editingId !== d.id && (
                      <>
                        <button className="link-btn" onClick={() => startEdit(d)}>重命名</button>
                        <button className="link-btn" onClick={() => handleToggleVisibility(d)}>
                          {d.visibility === 'public' ? '设为私有' : '设为公开'}
                        </button>
                        <button className="link-btn danger" onClick={() => handleDelete(d)}>删除</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr><td colSpan={7} className="empty-row">暂无文档</td></tr>
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
                    <button className="user-link" onClick={() => navigate(`/profile/${u.id}`)} title={u.username}>
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.username} className="row-avatar" />
                      ) : (
                        <span className="row-avatar-fallback">{u.username.slice(0, 1).toUpperCase()}</span>
                      )}
                      {u.username}
                    </button>
                  </td>
                  <td>#{u.xuanjianId}</td>
                  <td><span className={`level-badge level-${u.level}`}>L{u.level}</span></td>
                  <td>{u.contribution}</td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="empty-row">暂无用户</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 回收站 */}
      {tab === 'trash' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>类型</th>
                <th>大小</th>
                <th>删除时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {trash.map((d) => (
                <tr key={d.id}>
                  <td className="cell-title">{d.title}</td>
                  <td><span className="doc-tag">{d.type}</span></td>
                  <td>{formatSize(d.size)}</td>
                  <td>{formatDateTime(d.deletedAt || '')}</td>
                  <td className="cell-actions">
                    <button className="link-btn" onClick={() => handleTrashRestore(d.id)}>恢复</button>
                    <button className="link-btn danger" onClick={() => handleTrashPermanent(d)}>永久删除</button>
                  </td>
                </tr>
              ))}
              {trash.length === 0 && (
                <tr><td colSpan={5} className="empty-row">回收站为空</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 审计日志 */}
      {tab === 'audit' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>用户</th>
                <th>动作</th>
                <th>目标</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>{r.username || `#${r.user_id ?? '?'}`}</td>
                  <td><span className="doc-tag">{ACTION_LABELS[r.action] || r.action}</span></td>
                  <td>{r.target || '-'}</td>
                  <td className="cell-detail">{r.detail || '-'}</td>
                </tr>
              ))}
              {auditRows.length === 0 && (
                <tr><td colSpan={5} className="empty-row">暂无审计记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 登录日志 */}
      {tab === 'login' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>用户</th>
                <th>IP</th>
                <th>User-Agent</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {loginRows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>{r.username || `#${r.user_id ?? '?'}`}</td>
                  <td>{r.ip || '-'}</td>
                  <td className="cell-detail">{r.ua ? r.ua.slice(0, 60) : '-'}</td>
                  <td>
                    <span className={`visibility-badge ${r.success ? 'public' : 'private'}`}>
                      {r.success ? '成功' : '失败'}
                    </span>
                  </td>
                </tr>
              ))}
              {loginRows.length === 0 && (
                <tr><td colSpan={5} className="empty-row">暂无登录记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 数据备份与迁移 */}
      {tab === 'backup' && (
        <div className="backup-panel">
          <div className="backup-card">
            <h3>SQLite 数据库备份</h3>
            <p>导出当前数据库完整快照（VACUUM INTO），包含所有表结构与数据，可离线保存用于恢复。</p>
            <button className="btn-upload" onClick={() => downloadBackup().catch(() => alert('备份失败'))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              下载数据库备份
            </button>
          </div>
          <div className="backup-card">
            <h3>导出全部数据（JSON）</h3>
            <p>导出全部用户、文件夹、托管文档与在线文档为 JSON，可用于迁移到其他实例或归档。</p>
            <button className="btn-upload" onClick={() => exportAll().catch(() => alert('导出失败'))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              导出全部数据
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
