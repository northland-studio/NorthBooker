import client from './client'

export async function fetchSubscriptions() {
  const { data } = await client.get('/subscriptions')
  return data
}

export async function subscribe(target_type: string, target_id: string): Promise<void> {
  await client.post('/subscriptions', { target_type, target_id })
}

export async function unsubscribe(target_type: string, target_id: string): Promise<void> {
  await client.delete(`/subscriptions/${target_type}/${target_id}`)
}
