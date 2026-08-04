import { Router } from 'express'
import db from '../database.js'
import authMiddleware from '../middleware/auth.js'

const router = Router()

// 获取当前用户的订阅列表
router.get('/', authMiddleware, (req, res) => {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(req.user.id)
  res.json(subs)
})

// 订阅
router.post('/', authMiddleware, (req, res) => {
  const { target_type, target_id } = req.body
  if (!target_type || !target_id) {
    return res.status(400).json({ error: 'target_type 和 target_id 为必填项' })
  }
  db.prepare('INSERT OR IGNORE INTO subscriptions (user_id, target_type, target_id) VALUES (?, ?, ?)')
    .run(req.user.id, target_type, target_id)
  res.json({ success: true })
})

// 取消订阅
router.delete('/:targetType/:targetId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND target_type = ? AND target_id = ?')
    .run(req.user.id, req.params.targetType, req.params.targetId)
  res.json({ success: true })
})

export default router
