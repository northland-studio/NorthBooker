import client from './client'
import type { Comment } from '@/types/document'

// 获取文档评论列表
export async function fetchComments(docId: string): Promise<Comment[]> {
  const { data } = await client.get(`/comments/${docId}`)
  return data
}

// 发表评论
export async function postComment(docId: string, content: string): Promise<Comment> {
  const { data } = await client.post(`/comments/${docId}`, { content })
  return data
}

// 删除评论
export async function deleteComment(commentId: number) {
  await client.delete(`/comments/${commentId}`)
}
