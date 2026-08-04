import client from './client'

export interface SearchResult {
  id: string
  type: 'document' | 'page'
  title: string
  snippet: string // HTML with <mark> tags
}

export async function searchDocuments(q: string): Promise<SearchResult[]> {
  const { data } = await client.get<SearchResult[]>('/search', { params: { q } })
  return data
}
