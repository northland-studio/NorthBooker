import client from './client'

// 获取页面树（?my=1 只看自己的）
export async function fetchPageTree(myOnly?: boolean) {
  const { data } = await client.get('/pages/tree', {
    params: myOnly ? { my: '1' } : {},
  })
  return data
}

// 获取单个页面
export async function fetchPage(id: string) {
  const { data } = await client.get(`/pages/${id}`)
  return data
}

// 创建页面
export async function createPage(body: { title: string; parentId?: string; content?: string }) {
  const { data } = await client.post('/pages', body)
  return data
}

// 更新页面
export async function updatePage(
  id: string,
  body: { title?: string; content?: string; parentId?: string; visibility?: string },
) {
  const { data } = await client.put(`/pages/${id}`, body)
  return data
}

// 删除页面
export async function deletePage(id: string) {
  const { data } = await client.delete(`/pages/${id}`)
  return data
}

// 移动页面
export async function movePage(id: string, body: { parentId?: string; sortOrder?: number }) {
  const { data } = await client.patch(`/pages/${id}/move`, body)
  return data
}

// 获取页面版本历史
export async function fetchPageVersions(id: string) {
  const { data } = await client.get(`/pages/${id}/versions`)
  return data
}

// 恢复版本
export async function restorePageVersion(id: string, versionId: number | string) {
  const { data } = await client.post(`/pages/${id}/versions/${versionId}/restore`)
  return data
}
