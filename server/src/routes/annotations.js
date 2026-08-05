// 在线文档片段批注（2.6.0，仅在线文档 pages）
import { Router } from 'express'
import db from '../database.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取某在线文档的批注列表
router.get('/:pageId', optionalAuthMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT a.*, u.username, u.avatar
     FROM page_annotations a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.page_id = ?
     ORDER BY a.start_pos ASC, a.id ASC`,
  ).all(req.params.pageId)
  res.json(rows)
})

// 添加批注（选中文本的起止 pos + 原文 + 批注内容）
router.post('/:pageId', authMiddleware, (req, res) => {
  const { start_pos, end_pos, text, content } = req.body
  const page = db.prepare('SELECT id FROM pages WHERE id = ?').get(req.params.pageId)
  if (!page) return res.status(404).json({ error: '在线文档不存在' })
  if (typeof start_pos !== 'number' || typeof end_pos !== 'number' || end_pos <= start_pos) {
    return res.status(400).json({ error: '非法的批注范围' })
  }
  const info = db.prepare(
    'INSERT INTO page_annotations (page_id, user_id, start_pos, end_pos, text, content) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(req.params.pageId, req.user.id, start_pos, end_pos, String(text || '').slice(0, 500), String(content || '').slice(0, 2000))
  const row = db.prepare('SELECT * FROM page_annotations WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json({ ...row, username: req.user.username, avatar: req.user.avatar })
})

// 删除批注（作者或管理员）
router.delete('/:id', authMiddleware, (req, res) => {
  const ann = db.prepare('SELECT * FROM page_annotations WHERE id = ?').get(req.params.id)
  if (!ann) return res.status(404).json({ error: '批注不存在' })
  if (ann.user_id !== req.user.id && req.user.level < 1) {
    return res.status(403).json({ error: '无权删除该批注' })
  }
  db.prepare('DELETE FROM page_annotations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
