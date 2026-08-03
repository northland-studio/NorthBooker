import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function generateId() {
  return crypto.randomBytes(12).toString('base64url')
}

// 获取页面树（公开，用于浏览）
router.get('/tree', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.parent_id, p.sort_order, p.updated_at, p.author_id,
              u.username AS author_name, u.avatar AS author_avatar
       FROM pages p
       LEFT JOIN users u ON u.id = p.author_id
       ORDER BY p.sort_order ASC, p.updated_at DESC`,
    )
    .all()
  res.json(buildTree(rows))
})

function buildTree(rows) {
  const map = new Map()
  const roots = []
  for (const r of rows) {
    map.set(r.id, { ...r, children: [] })
  }
  for (const r of rows) {
    const node = map.get(r.id)
    if (r.parent_id && map.has(r.parent_id)) {
      map.get(r.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// 获取单个页面（公开，用于阅读）
router.get('/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, u.username AS author_name, u.avatar AS author_avatar
       FROM pages p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.id = ?`,
    )
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '页面不存在' })
  res.json(row)
})

// 创建页面（需登录）
router.post('/', authMiddleware, (req, res) => {
  const { title, parentId, content } = req.body
  const id = generateId()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO pages (id, title, content, parent_id, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, title || '无标题文档', content || '', parentId || null, req.user.id, now, now)
  res.status(201).json({ id })
})

// 更新页面（需登录，仅作者或管理员）
router.put('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: '页面不存在' })

  const canEdit = page.author_id === req.user.id || req.user.level >= 1
  if (!canEdit) return res.status(403).json({ error: '只能编辑自己的文档' })

  const { title, content, parentId } = req.body
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE pages SET title = COALESCE(?, title), content = COALESCE(?, content),
     parent_id = COALESCE(?, parent_id), updated_at = ?
     WHERE id = ?`,
  ).run(title ?? null, content ?? null, parentId ?? null, now, req.params.id)
  res.json({ success: true })
})

// 删除页面（需登录，仅作者或管理员）
router.delete('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: '页面不存在' })

  const canDelete = page.author_id === req.user.id || req.user.level >= 1
  if (!canDelete) return res.status(403).json({ error: '只能删除自己的文档' })

  // 子页面移到根级
  db.prepare('UPDATE pages SET parent_id = NULL WHERE parent_id = ?').run(req.params.id)
  db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// 移动页面（拖拽排序用）
router.patch('/:id/move', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: '页面不存在' })

  const { parentId, sortOrder } = req.body
  db.prepare(
    `UPDATE pages SET parent_id = COALESCE(?, parent_id), sort_order = COALESCE(?, sort_order)
     WHERE id = ?`,
  ).run(parentId ?? null, sortOrder ?? null, req.params.id)
  res.json({ success: true })
})

export default router
