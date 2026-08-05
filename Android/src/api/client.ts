// 统一 API 客户端：Bearer token + 401 处理
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE } from '../config'

export const TOKEN_KEY = 'nb_token'
export const USER_KEY = 'nb_user'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token)
  else await AsyncStorage.removeItem(TOKEN_KEY)
}

export async function getUser(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function setUser(user: any | null): Promise<void> {
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
  else await AsyncStorage.removeItem(USER_KEY)
}

// onUnauthorized：token 失效回调（由 App 层注册，用于跳转登录）
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

interface RequestOptions {
  method?: string
  body?: any
  params?: Record<string, string | number | undefined>
  auth?: boolean
  timeout?: number
}

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, auth = true, timeout = 20000 } = options
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) url += `?${qs}`
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (auth) {
    const token = await getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await resp.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (resp.status === 401) {
      if (onUnauthorized) onUnauthorized()
      throw new ApiError(401, data?.error || '登录已失效，请重新登录')
    }
    if (!resp.ok) {
      throw new ApiError(resp.status, data?.error || `请求失败 (${resp.status})`)
    }
    return data as T
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ApiError(0, '请求超时')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
