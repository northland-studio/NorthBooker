import client from './client'
import type { Document } from '@/types/document'

// 上传文档（multipart/form-data）
// onProgress 可选，用于上报上传进度
export async function uploadDocument(
  file: File,
  title: string,
  onProgress?: (percent: number) => void,
): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  if (title.trim()) form.append('title', title.trim())

  const { data } = await client.post<Document>('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

// 更新文档标题
export async function updateDocumentTitle(id: string, title: string): Promise<Document> {
  const { data } = await client.put<Document>(`/documents/${id}`, { title })
  return data
}
