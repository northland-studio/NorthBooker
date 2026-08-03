import client from './client'

// 获取当前用户的所有书签（含文档信息）
export async function fetchBookmarks() {
  const { data } = await client.get('/bookmarks')
  return data
}

// 检查文档是否已收藏
export async function checkBookmark(docId: string): Promise<boolean> {
  const { data } = await client.get(`/bookmarks/check/${docId}`)
  return data.bookmarked
}

// 添加书签
export async function addBookmark(docId: string) {
  const { data } = await client.post(`/bookmarks/${docId}`)
  return data
}

// 移除书签
export async function removeBookmark(docId: string) {
  const { data } = await client.delete(`/bookmarks/${docId}`)
  return data
}
