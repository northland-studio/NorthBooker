import client from './client'
import type { User } from '@/types/user'

// 获取当前登录用户（需已携带 token）
export async function fetchMe(): Promise<User | null> {
  const { data } = await client.get<{ user: User | null }>('/auth/me')
  return data.user ?? null
}

// 登出（清除后端 token 缓存）
export async function logout(): Promise<void> {
  try {
    await client.post('/auth/logout')
  } catch {
    // 忽略网络错误，前端仍清理本地状态
  }
}

// 跳转到玄剑官网授权登录
// redirect 为登录成功后回跳的前端路径
export function redirectToLogin(redirect = window.location.pathname + window.location.search): void {
  const url = `/api/auth/login?redirect=${encodeURIComponent(redirect)}`
  window.location.href = url
}
