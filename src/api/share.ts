import client from './client'

export interface ShareLinkResponse {
  url: string
}

// 分享文档对象（后端 toShareDoc：kind = 'document' | 'page'）
export interface ShareDoc {
  id: string
  title: string
  visibility: string
  kind: 'document' | 'page'
  fileName?: string
  uri?: string
  thumbnail?: string | null
  type?: string
  size?: number
  updated_at?: string
  owner_id?: number | null
  content?: string
  author_id?: number | null
}

export interface ShareInfo {
  hasPassword: boolean
  doc: ShareDoc
}

export async function createShareLink(params: {
  doc_id: string
  password?: string
  expires_in_hours?: number
}): Promise<ShareLinkResponse> {
  const { data } = await client.post<ShareLinkResponse>('/share', params)
  return data
}

// 获取分享信息（是否设密码 + 文档概要）
export async function fetchShareInfo(token: string): Promise<ShareInfo> {
  const { data } = await client.get<ShareInfo>(`/share/${token}`)
  return data
}

// 验证密码（或无密码直接获取）完整文档内容
export async function verifyShare(token: string, password?: string): Promise<{ doc: ShareDoc }> {
  const { data } = await client.post<{ doc: ShareDoc }>(`/share/${token}/verify`, { password })
  return data
}
