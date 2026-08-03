import client from './client'

export interface AdminStats {
  documents: number
  users: number
  admins: number
  totalSize: number
}

export interface AdminDocument {
  id: string
  title: string
  fileName: string
  uri: string
  type: string
  size: number
  updatedAt: string
  thumbnail: string | null
  visibility: 'public' | 'private'
  ownerId: number | null
  ownerName: string | null
}

export interface AdminUser {
  id: number
  xuanjianId: number
  username: string
  avatar: string | null
  level: number
  contribution: number
  createdAt: string
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await client.get<AdminStats>('/admin/stats')
  return data
}

export async function fetchAdminDocuments(): Promise<AdminDocument[]> {
  const { data } = await client.get<AdminDocument[]>('/admin/documents')
  return data
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await client.get<AdminUser[]>('/admin/users')
  return data
}

export async function updateDocumentVisibility(
  id: string,
  visibility: 'public' | 'private',
): Promise<void> {
  await client.put(`/admin/documents/${id}/visibility`, { visibility })
}

export async function deleteDocument(id: string): Promise<void> {
  await client.delete(`/admin/documents/${id}`)
}
