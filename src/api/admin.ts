import client from './client'

export interface AdminStats {
  documents: number
  users: number
  admins: number
  totalSize: number
}

export interface AdminDocument {
  id: string
  title: string
  fileName: string
  uri: string
  type: string
  size: number
  updatedAt: string
  thumbnail: string | null
  visibility: 'public' | 'private'
  ownerId: number | null
  ownerName: string | null
}

export interface AdminUser {
  id: number
  xuanjianId: number
  username: string
  avatar: string | null
  level: number
  contribution: number
  createdAt: string
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await client.get<AdminStats>('/admin/stats')
  return data
}

export async function fetchAdminDocuments(): Promise<AdminDocument[]> {
  const { data } = await client.get<AdminDocument[]>('/admin/documents')
  return data
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await client.get<AdminUser[]>('/admin/users')
  return data
}

export async function updateDocumentVisibility(
  id: string,
  visibility: 'public' | 'private',
): Promise<void> {
  await client.put(`/admin/documents/${id}/visibility`, { visibility })
}

export async function deleteDocument(id: string): Promise<void> {
  await client.delete(`/admin/documents/${id}`)
}

export interface AuditLogRow {
  id: number
  user_id: number | null
  username: string | null
  action: string
  target: string | null
  detail: string | null
  created_at: string
}

export interface LoginLogRow {
  id: number
  user_id: number | null
  username: string | null
  ip: string | null
  ua: string | null
  success: number
  created_at: string
}

// 审计日志（分页）
export async function fetchAuditLogs(limit = 50, offset = 0): Promise<{ rows: AuditLogRow[]; total: number }> {
  const { data } = await client.get('/admin/audit-logs', { params: { limit, offset } })
  return data
}

// 登录日志（分页）
export async function fetchLoginLogs(limit = 50, offset = 0): Promise<{ rows: LoginLogRow[]; total: number }> {
  const { data } = await client.get('/admin/login-logs', { params: { limit, offset } })
  return data
}

// 下载 SQLite 备份
export async function downloadBackup(): Promise<void> {
  const res = await client.get('/admin/backup', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `northbooker-backup-${new Date().toISOString().slice(0, 10)}.sqlite`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 导出全部数据（文档 + 在线文档 JSON）
export async function exportAll(): Promise<void> {
  const res = await client.get('/admin/export-all', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `northbooker-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
