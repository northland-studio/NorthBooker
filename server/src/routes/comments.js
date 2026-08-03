import { Router } from 'express'
import db from '../database.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取某文档的评论列表（可选认证，用于区分当前用户）
router.get('/:docId', optionalAuthMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.document_id, c.content, c.created_at,
              u.id AS user_id, u.username, u.avatar, u.level
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.document_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(req.params.docId)
  res.json(rows)
})

// 发表评论（需登录）
router.post('/:docId', authMiddleware, (req, res) => {
  const { content } = req.body
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '评论内容不能为空' })
  }
  if (content.trim().length > 2000) {
    return res.status(400).json({ error: '评论内容不能超过2000字' })
  }

  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.docId)
  if (!doc) return res.status(404).json({ error: '文档不存在' })

  const result = db
    .prepare('INSERT INTO comments (document_id, user_id, content, created_at) VALUES (?, ?, ?, ?)')
    .run(req.params.docId, req.user.id, content.trim(), new Date().toISOString())

  const row = db
    .prepare(
      `SELECT c.id, c.document_id, c.content, c.created_at,
              u.id AS user_id, u.username, u.avatar, u.level
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
    )
    .get(result.lastInsertRowid)

  res.status(201).json(row)
})

// 删除评论（本人或管理员）
router.delete('/:id', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id)
  if (!comment) return res.status(404).json({ error: '评论不存在' })

  if (comment.user_id !== req.user.id && req.user.level < 1) {
    return res.status(403).json({ error: '只能删除自己的评论' })
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
