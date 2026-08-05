import client from './client'

// 个人主页数据（2.6.3）
export async function fetchProfile(userId: number | string) {
  const { data } = await client.get(`/profile/${userId}`)
  return data
}
