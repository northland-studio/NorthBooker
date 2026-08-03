import client from './client'
import type { Document } from '@/types/document'

// 获取文档列表（来自后端 /api/documents）
export async function fetchDocuments(): Promise<Document[]> {
  const { data } = await client.get<Document[]>('/documents')
  return data
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
