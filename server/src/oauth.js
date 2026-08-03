// 北牖 OAuth 配置（对接玄剑官网）
// 玄剑端点：/api/oauth/authorize、/api/oauth/token、/api/oauth/verify、/api/oauth/userinfo

export const oauthConfig = {
  providerUrl: process.env.OAUTH_PROVIDER_URL || 'https://www.xuanjian.top',
  clientId: process.env.OAUTH_CLIENT_ID || 'northbooker',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
  // redirect_uri 必须指向后端的 /api/auth/callback（由后端处理 code 换 token）
  redirectUri:
    process.env.OAUTH_REDIRECT_URI ||
    'https://northbooker.xuanjian.top/api/auth/callback',
}

// 玄剑 verify 接口的本地缓存（避免每次请求都远程校验）
// 结构: token -> { user, expiresAt }
const verifyCache = new Map()
const CACHE_TTL = 60 * 1000 // 60 秒

/**
 * 调用玄剑 /api/oauth/verify 校验 access_token 并获取用户信息
 * @returns { id, username, avatar, level, title, contribution } 或 null
 */
export async function verifyXuanjianToken(token) {
  // 命中缓存且未过期
  const cached = verifyCache.get(token)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user
  }

  try {
    const resp = await fetch(`${oauthConfig.providerUrl}/api/oauth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const data = await resp.json()
    if (!data.valid || !data.user) return null

    verifyCache.set(token, { user: data.user, expiresAt: Date.now() + CACHE_TTL })
    return data.user
  } catch (err) {
    console.error('[北牖] 玄剑 token 校验失败:', err.message)
    return null
  }
}

// 主动失效某个 token 的缓存（登出、权限变更时调用）
export function invalidateToken(token) {
  if (token) verifyCache.delete(token)
}
