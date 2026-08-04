import client from './client'

export interface Subscription {
  docId?: string
  pageId?: string
  subscribed: boolean
}

export async function fetchSubscription(docId?: string, pageId?: string): Promise<Subscription> {
  const params: Record<string, string> = {}
  if (docId) params.docId = docId
  if (pageId) params.pageId = pageId
  const { data } = await client.get<Subscription>('/subscriptions', { params })
  return data
}

export async function subscribe(docId?: string, pageId?: string): Promise<void> {
  await client.post('/subscriptions', { docId, pageId })
}

export async function unsubscribe(docId?: string, pageId?: string): Promise<void> {
  await client.delete('/subscriptions', { data: { docId, pageId } })
}
