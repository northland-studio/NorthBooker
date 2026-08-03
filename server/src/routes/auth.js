import { Router } from 'express'

const router = Router()

// 认证路由（批次5实现 OAuth 对接玄剑官网）
// - GET  /api/auth/login        跳转玄剑授权
// - GET  /api/auth/callback     授权码回调
// - GET  /api/auth/me           获取当前用户
// - POST /api/auth/logout       登出

router.get('/me', (req, res) => {
  // TODO: 批次5实现，从 JWT 读取当前用户
  res.json({ user: null })
})

export default router
