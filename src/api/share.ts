import client from './client'

export interface ShareLinkResponse {
  url: string
}

export async function createShareLink(params: {
  docId?: string
  pageId?: string
  password?: string
  expiration?: string
}): Promise<ShareLinkResponse> {
  const { data } = await client.post<ShareLinkResponse>('/share', params)
  return data
}
