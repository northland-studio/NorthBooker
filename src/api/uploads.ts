import client from './client'
import type { Document } from '@/types/document'

// 七牛上传凭证响应
export interface UploadToken {
  uploadToken: string
  key: string
  uploadUrl: string
  cdnDomain: string
}

// 七牛上传成功后的响应体
interface QiniuUploadResponse {
  key: string
  hash: string
  fsize: number
  bucket: string
}

// 获取七牛上传凭证（前端直传七牛，带真实进度）
export async function fetchUploadToken(fileName: string): Promise<UploadToken> {
  const { data } = await client.get<UploadToken>('/uploads/token', {
    params: { fileName },
  })
  console.log('[北牖] 获取上传凭证:', {
    fileName,
    key: data.key,
    uploadUrl: data.uploadUrl,
    tokenLen: data.uploadToken?.length,
    tokenHead: data.uploadToken?.slice(0, 24),
  })
  return data
}

// 上传完成后回调后端，记录文档
export async function uploadCallback(params: {
  key: string
  fileName: string
  title?: string
  size: number
  hash: string
  folder_id?: string | null
}): Promise<Document> {
  const { data } = await client.post<Document>('/uploads/callback', params)
  return data
}

/**
 * 直传文件到七牛对象存储（使用 XMLHttpRequest 获取真实上传进度）
 * @param file 文件
 * @param onProgress 上传进度回调（0-100）
 * @returns 七牛响应（key/hash/fsize）
 */
export function uploadToQiniu(
  file: File,
  uploadUrl: string,
  uploadToken: string,
  key: string,
  onProgress?: (percent: number) => void,
): Promise<QiniuUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('token', uploadToken)
    formData.append('key', key)
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      console.log('[北牖] 七牛上传响应:', {
        status: xhr.status,
        response: xhr.responseText?.slice(0, 300),
        tokenLen: uploadToken?.length,
        tokenHead: uploadToken?.slice(0, 24),
        key,
        uploadUrl,
      })
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText) as QiniuUploadResponse)
        } catch {
          reject(new Error('七牛响应解析失败'))
        }
      } else {
        reject(new Error(`上传失败: HTTP ${xhr.status} ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.onabort = () => reject(new Error('上传已取消'))

    xhr.open('POST', uploadUrl)
    xhr.send(formData)
  })
}

/**
 * 完整上传流程：获取凭证 → 直传七牛 → 回调记录
 * @param file 文件
 * @param title 文档标题
 * @param onProgress 进度回调（0-100）
 */
export async function uploadDocument(
  file: File,
  title: string,
  onProgress?: (percent: number) => void,
  folderId?: string | null,
): Promise<Document> {
  // 1. 获取上传凭证
  const token = await fetchUploadToken(file.name)

  // 2. 直传七牛（带进度）
  const qiniuResp = await uploadToQiniu(
    file,
    token.uploadUrl,
    token.uploadToken,
    token.key,
    onProgress,
  )

  // 3. 回调后端记录文档
  const doc = await uploadCallback({
    key: qiniuResp.key,
    fileName: file.name,
    title,
    size: qiniuResp.fsize || file.size,
    hash: qiniuResp.hash,
    folder_id: folderId || null,
  })
  return doc
}

// 更新文档标题
export async function updateDocumentTitle(id: string, title: string): Promise<Document> {
  const { data } = await client.put<Document>(`/documents/${id}`, { title })
  return data
}
