// 订阅管理（2.6.0：仅支持在线文档 pages）
import { Router } from 'express'
import db from '../database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取当前用户的订阅列表（含文档标题）
router.get('/', authMiddleware, (req, res) => {
  const subs = db.prepare(
    `SELECT s.id, s.target_type, s.target_id, s.created_at,
            p.title, p.updated_at
     FROM subscriptions s
     LEFT JOIN pages p ON p.id = s.target_id AND s.target_type = 'page'
     WHERE s.user_id = ? AND s.target_type = 'page'
     ORDER BY s.created_at DESC`,
  ).all(req.user.id)
  res.json(subs)
})

// 订阅在线文档
router.post('/', authMiddleware, (req, res) => {
  const { target_type, target_id } = req.body
  // 订阅功能仅限在线文档（pages）
  if (target_type !== 'page' || !target_id) {
    return res.status(400).json({ error: '订阅仅支持在线文档（target_type=page）' })
  }
  const page = db.prepare('SELECT id FROM pages WHERE id = ?').get(target_id)
  if (!page) return res.status(404).json({ error: '在线文档不存在' })
  db.prepare('INSERT OR IGNORE INTO subscriptions (user_id, target_type, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, 'page', target_id)
  res.json({ success: true })
})

// 取消订阅
router.delete('/:targetType/:targetId', authMiddleware, (req, res) => {
  if (req.params.targetType !== 'page') {
    return res.status(400).json({ error: '订阅仅支持在线文档（page）' })
  }
  db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND target_type = ? AND target_id = ?')
    .run(req.user.id, 'page', req.params.targetId)
  res.json({ success: true })
})

export default router
