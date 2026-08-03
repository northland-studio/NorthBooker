import { Router } from 'express'
import crypto from 'node:crypto'
import { oauthConfig, verifyXuanjianToken, invalidateToken } from '../oauth.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// state 临时存储（防 CSRF），有效期 10 分钟
const states = new Map()
const STATE_TTL = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of states) {
    if (v.expiresAt < now) states.delete(k)
  }
}, 5 * 60 * 1000)

/**
 * GET /api/auth/login
 * 跳转到玄剑官网授权页
 * 可选 query: redirect（登录后回跳的前端路径，默认 /）
 */
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex')
  const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : '/'
  states.set(state, { redirect, expiresAt: Date.now() + STATE_TTL })

  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    response_type: 'code',
    state,
  })
  const authorizeUrl = `${oauthConfig.providerUrl}/api/oauth/authorize?${params.toString()}`
  res.redirect(authorizeUrl)
})

/**
 * GET /api/auth/callback
 * 玄剑授权后回调：?code=xxx&state=xxx
 * 后端用 code 换 access_token，然后重定向回前端（带 token）
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query

  // 授权失败或被拒绝
  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`)
  }

  // 校验 state
  const stateData = states.get(state)
  if (!stateData) {
    return res.redirect('/?auth_error=invalid_state')
  }
  states.delete(state)

  if (!code) {
    return res.redirect('/?auth_error=missing_code')
  }

  // 用授权码换取 access_token
  let accessToken
  try {
    const resp = await fetch(`${oauthConfig.providerUrl}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        redirect_uri: oauthConfig.redirectUri,
      }),
    })
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}))
      console.error('[北牖] 换取 token 失败:', resp.status, errBody)
      return res.redirect('/?auth_error=token_exchange_failed')
    }
    const tokenData = await resp.json()
    accessToken = tokenData.access_token
  } catch (err) {
    console.error('[北牖] 换取 token 异常:', err.message)
    return res.redirect('/?auth_error=server_error')
  }

  if (!accessToken) {
    return res.redirect('/?auth_error=no_token')
  }

  // 拉取一次用户信息，便于前端立即展示（可选）
  const xjUser = await verifyXuanjianToken(accessToken)

  // 通过 URL fragment 传递 token（# 后不会发到服务器日志）
  // 前端 /callback 页面解析 hash 后写入 localStorage
  const redirect = stateData.redirect || '/'
  const fragment = new URLSearchParams()
  fragment.set('access_token', accessToken)
  fragment.set('redirect', redirect)
  if (xjUser) {
    fragment.set('username', xjUser.username)
    fragment.set('level', String(xjUser.level || 0))
  }
  res.redirect(`/callback#${fragment.toString()}`)
})

/**
 * GET /api/auth/me
 * 返回当前登录用户（需 Bearer token）
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user })
})

/**
 * POST /api/auth/logout
 * 登出（清除后端 token 缓存；前端自行清除 localStorage）
 */
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  invalidateToken(token)
  res.json({ ok: true })
})

export default router
