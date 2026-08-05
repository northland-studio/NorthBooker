// 文档与页面 API
import { request } from './client'

export interface DocumentItem {
  id: string
  title: string
  fileName: string
  uri: string
  type: string
  size: number
  updatedAt: string
  thumbnail: string | null
  folder_id: string | null
  visibility: 'public' | 'private'
  owner_id: string
}

export interface PageNode {
  id: string
  title: string
  parent_id: string | null
  sort_order: number
  visibility: string
  created_at: string
  updated_at: string
  author_id: string
  author_name?: string
  children?: PageNode[]
}

export function fetchDocuments(): Promise<DocumentItem[]> {
  return request<DocumentItem[]>('/documents')
}

export function fetchDocument(id: string): Promise<DocumentItem> {
  return request<DocumentItem>(`/documents/${id}`)
}

export function fetchPageTree(myOnly = false): Promise<PageNode[]> {
  return request<PageNode[]>('/pages/tree', {
    params: myOnly ? { my: '1' } : undefined,
    auth: false,
  })
}

export function fetchPage(id: string): Promise<any> {
  return request<any>(`/pages/${id}`, { auth: false })
}

export function fetchMe(): Promise<{ user: any }> {
  return request<{ user: any }>('/auth/me')
}
