import { Router } from 'express'
import db from '../database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取当前用户的所有书签（包含文档信息）
router.get('/', authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.*, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN documents d ON d.id = b.document_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
    )
    .all(req.user.id)
  res.json(rows)
})

// 检查某文档是否已被当前用户收藏
router.get('/check/:docId', authMiddleware, (req, res) => {
  const row = db
    .prepare('SELECT 1 AS bookmarked FROM bookmarks WHERE user_id = ? AND document_id = ?')
    .get(req.user.id, req.params.docId)
  res.json({ bookmarked: !!row })
})

// 添加书签
router.post('/:docId', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.docId)
  if (!doc) return res.status(404).json({ error: '文档不存在' })

  try {
    db.prepare('INSERT INTO bookmarks (user_id, document_id, created_at) VALUES (?, ?, ?)').run(
      req.user.id,
      req.params.docId,
      new Date().toISOString(),
    )
    res.json({ bookmarked: true })
  } catch {
    // 已存在则忽略
    res.json({ bookmarked: true })
  }
})

// 移除书签
router.delete('/:docId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND document_id = ?').run(
    req.user.id,
    req.params.docId,
  )
  res.json({ bookmarked: false })
})

export default router
