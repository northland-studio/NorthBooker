import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function generateToken() {
  return crypto.randomBytes(16).toString('hex')
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'northbooker-salt').digest('hex')
}

// POST /api/share — 创建分享链接（需登录）
router.post('/', authMiddleware, (req, res) => {
  const { doc_id, password, expires_in_hours } = req.body
  if (!doc_id) return res.status(400).json({ error: '缺少 doc_id' })

  const token = generateToken()
  const password_hash = password ? hashPassword(password) : null
  const expires_at = expires_in_hours
    ? new Date(Date.now() + expires_in_hours * 3600000).toISOString()
    : null

  db.prepare(
    'INSERT INTO share_links (token, doc_id, password_hash, expires_at, created_by) VALUES (?,?,?,?,?)'
  ).run(token, doc_id, password_hash, expires_at, req.user?.id)

  res.json({ token, url: `/share/${token}` })
})

// 根据 doc_id 查找文档信息（不含内容）
function getDocInfo(docId) {
  // 先查 documents 表
  const doc = db.prepare('SELECT id, title, file_name, type AS file_type FROM documents WHERE id = ?').get(docId)
  if (doc) return doc
  // 再查 pages 表
  return db.prepare('SELECT id, title, NULL AS file_name, NULL AS file_type FROM pages WHERE id = ?').get(docId) || null
}

// 根据 doc_id 查找完整文档
function getFullDoc(docId) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId)
  if (doc) return doc
  return db.prepare('SELECT * FROM pages WHERE id = ?').get(docId) || null
}

// GET /api/share/:token — 验证 token，返回文档信息（公开）
router.get('/:token', (req, res) => {
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(req.params.token)
  if (!link) return res.status(404).json({ error: '链接不存在或已失效' })
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).json({ error: '链接已过期' })
  }

  const hasPassword = !!link.password_hash
  const doc = getDocInfo(link.doc_id)
  if (!doc) return res.status(404).json({ error: '文档不存在' })

  res.json({ hasPassword, doc })
})

// POST /api/share/:token/verify — 验证密码并返回文档完整内容（公开）
router.post('/:token/verify', (req, res) => {
  const { password } = req.body
  const link = db.prepare('SELECT * FROM share_links WHERE token = ?').get(req.params.token)
  if (!link) return res.status(404).json({ error: '链接不存在' })
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).json({ error: '链接已过期' })
  }

  if (link.password_hash) {
    if (!password) return res.status(403).json({ error: '需要密码' })
    if (link.password_hash !== hashPassword(password)) {
      return res.status(403).json({ error: '密码错误' })
    }
  }

  const doc = getFullDoc(link.doc_id)
  if (!doc) return res.status(404).json({ error: '文档不存在' })
  res.json({ doc })
})

export default router
