import { verifyXuanjianToken, invalidateToken } from '../oauth.js'
import db from '../database.js'

// 校验玄剑 access_token，注入 req.user = { id, username, avatar, level, ... }
// 同时把用户同步到本地 users 表（以 xuanjian_id 关联）
export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' })
  }

  const xjUser = await verifyXuanjianToken(token)
  if (!xjUser) {
    return res.status(401).json({ error: '认证令牌无效或已过期' })
  }

  // 同步到本地 users 表（首次登录则创建）
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO users (xuanjian_id, username, avatar, level, contribution, email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(xuanjian_id) DO UPDATE SET
       username = excluded.username,
       avatar = excluded.avatar,
       level = excluded.level,
       contribution = excluded.contribution,
       email = COALESCE(excluded.email, users.email)`,
  ).run(xjUser.id, xjUser.username, xjUser.avatar || null, xjUser.level || 0, xjUser.contribution || 0, xjUser.email || null, now)

  // 查出本地 id（用于 owner_id 关联）
  const local = db.prepare('SELECT id FROM users WHERE xuanjian_id = ?').get(xjUser.id)

  req.user = {
    id: local.id,
    xuanjianId: xjUser.id,
    username: xjUser.username,
    avatar: xjUser.avatar,
    level: xjUser.level || 0,
    contribution: xjUser.contribution || 0,
    title: xjUser.title || null,
  }
  req.token = token
  next()
}

// 要求 level >= 1（管理员）
export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.level < 1) {
    return res.status(403).json({ error: '权限不足，需要管理员权限' })
  }
  next()
}

// 要求 level >= 2（超级管理员）
export function superAdminMiddleware(req, res, next) {
  if (!req.user || req.user.level < 2) {
    return res.status(403).json({ error: '权限不足，需要超级管理员权限' })
  }
  next()
}

// 仅做可选认证：有 token 且有效则注入 req.user，无 token 或无效则放行（用于公开接口）
export async function optionalAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return next()
  const xjUser = await verifyXuanjianToken(token)
  if (!xjUser) return next()

  const local = db.prepare('SELECT id FROM users WHERE xuanjian_id = ?').get(xjUser.id)
  req.user = {
    id: local?.id,
    xuanjianId: xjUser.id,
    username: xjUser.username,
    avatar: xjUser.avatar,
    level: xjUser.level || 0,
    contribution: xjUser.contribution || 0,
    title: xjUser.title || null,
  }
  req.token = token
  next()
}

export { invalidateToken }
