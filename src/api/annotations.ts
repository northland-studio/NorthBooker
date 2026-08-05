import client from './client'

export interface Annotation {
  id: number
  page_id: string
  user_id: number
  start_pos: number
  end_pos: number
  text: string
  content: string
  created_at: string
  username?: string
  avatar?: string | null
}

// 获取在线文档的批注列表
export async function fetchAnnotations(pageId: string): Promise<Annotation[]> {
  const { data } = await client.get(`/annotations/${pageId}`)
  return data
}

// 添加批注
export async function addAnnotation(
  pageId: string,
  body: { start_pos: number; end_pos: number; text: string; content: string },
): Promise<Annotation> {
  const { data } = await client.post(`/annotations/${pageId}`, body)
  return data
}

// 删除批注
export async function deleteAnnotation(id: number): Promise<void> {
  await client.delete(`/annotations/${id}`)
}
