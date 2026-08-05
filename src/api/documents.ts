import client from './client'
import type { Document } from '@/types/document'

// 获取文档列表（来自后端 /api/documents）
export async function fetchDocuments(): Promise<Document[]> {
  const { data } = await client.get<Document[]>('/documents')
  return data
}

// 按文件夹获取文档
export async function fetchDocumentsByFolder(folderId?: string | null): Promise<Document[]> {
  const params = folderId !== undefined ? { folder_id: folderId || '' } : {}
  const { data } = await client.get<Document[]>('/documents', { params })
  return data
}

// 移动文档到文件夹
export async function moveDocument(id: string, folderId: string | null): Promise<void> {
  await client.put(`/documents/${id}`, { folder_id: folderId })
}

// 按 id 获取单个文档
export async function fetchDocumentById(id: string): Promise<Document | null> {
  try {
    const { data } = await client.get<Document>(`/documents/${id}`)
    return data
  } catch (err: unknown) {
    // 404 等错误视为不存在
    if (
      typeof err === 'object' &&
      err !== null &&
      'response' in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      return null
    }
    throw err
  }
}

// 更新文档（标题 / 可见性 / 标签等）
export async function updateDocument(
  id: string,
  patch: { title?: string; visibility?: 'public' | 'private'; tags?: string[] },
): Promise<Document> {
  const { data } = await client.put<Document>(`/documents/${id}`, patch)
  return data
}

// 软删除：移入回收站
export async function trashDocument(id: string): Promise<void> {
  await client.delete(`/documents/${id}`)
}

// 回收站列表
export async function fetchTrash(): Promise<Document[]> {
  const { data } = await client.get<Document[]>('/documents/trash')
  return data
}

// 从回收站恢复
export async function restoreDocument(id: string): Promise<void> {
  await client.post(`/documents/${id}/restore`)
}

// 永久删除（回收站内彻底删除）
export async function permanentDeleteDocument(id: string): Promise<void> {
  await client.delete(`/documents/${id}/permanent`)
}
