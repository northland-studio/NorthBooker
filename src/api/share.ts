import client from './client'

export interface ShareLinkResponse {
  url: string
}

export async function createShareLink(params: {
  doc_id: string
  password?: string
  expires_in_hours?: number
}): Promise<ShareLinkResponse> {
  const { data } = await client.post<ShareLinkResponse>('/share', params)
  return data
}
