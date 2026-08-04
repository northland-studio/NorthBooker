import client from './client'

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

export async function fetchFolders(parentId?: string | null): Promise<Folder[]> {
  const { data } = await client.get('/folders', { params: parentId !== undefined ? { parent_id: parentId || '' } : {} })
  return data
}

export async function createFolder(name: string, parentId?: string | null): Promise<Folder> {
  const { data } = await client.post('/folders', { name, parent_id: parentId || null })
  return data
}

export async function deleteFolder(id: string): Promise<void> {
  await client.delete(`/folders/${id}`)
}
