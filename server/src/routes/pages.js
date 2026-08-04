import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../database.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'
import bus from '../bus.js'

const router = Router()

function generateId() {
  return crypto.randomBytes(12).toString('base64url')
}

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

// 获取页面树（可选认证：公开页所有人可见；登录后可看自己的私有页）
router.get('/tree', optionalAuthMiddleware, (req, res) => {
  const myOnly = req.query.my === '1' && req.user

  let sql, rows
  if (myOnly) {
    // 只看我自己的文档（不论公开/私有）
    rows = db
      .prepare(
        `SELECT p.id, p.title, p.parent_id, p.sort_order, p.visibility,
                p.created_at, p.updated_at, p.author_id,
                u.username AS author_name, u.avatar AS author_avatar
         FROM pages p
         LEFT JOIN users u ON u.id = p.author_id
         WHERE p.author_id = ?
         ORDER BY p.sort_order ASC, p.updated_at DESC`,
      )
      .all(req.user.id)
  } else if (req.user) {
    // 已登录：看公开文档 + 自己的私有文档
    rows = db
      .prepare(
        `SELECT p.id, p.title, p.parent_id, p.sort_order, p.visibility,
                p.created_at, p.updated_at, p.author_id,
                u.username AS author_name, u.avatar AS author_avatar
         FROM pages p
         LEFT JOIN users u ON u.id = p.author_id
         WHERE p.visibility = 'public' OR p.author_id = ?
         ORDER BY p.sort_order ASC, p.updated_at DESC`,
      )
      .all(req.user.id)
  } else {
    // 未登录：只看公开文档
    rows = db
      .prepare(
        `SELECT p.id, p.title, p.parent_id, p.sort_order, p.visibility,
                p.created_at, p.updated_at, p.author_id,
                u.username AS author_name, u.avatar AS author_avatar
         FROM pages p
         LEFT JOIN users u ON u.id = p.author_id
         WHERE p.visibility = 'public'
         ORDER BY p.sort_order ASC, p.updated_at DESC`,
      )
      .all()
  }

  res.json(buildTree(rows))
})

// GET /api/pages/:id/versions — 获取版本列表
router.get('/:id/versions', (req, res) => {
  const page = db.prepare('SELECT id FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: 'Page not found' })

  const versions = db.prepare(
    'SELECT pv.*, u.username as author_name FROM page_versions pv LEFT JOIN users u ON pv.author_id = u.id WHERE pv.page_id = ? ORDER BY pv.created_at DESC'
  ).all(req.params.id)
  res.json(versions)
})

// POST /api/pages/:id/versions/:versionId/restore — 回滚到指定版本
router.post('/:id/versions/:versionId/restore', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: 'Page not found' })

  const version = db.prepare('SELECT * FROM page_versions WHERE id = ? AND page_id = ?').get(req.params.versionId, req.params.id)
  if (!version) return res.status(404).json({ error: 'Version not found' })

  // Save current state as a version (rollback snapshot)
  db.prepare('INSERT INTO page_versions (page_id, title, content, author_id, is_rollback) VALUES (?, ?, ?, ?, 1)')
    .run(req.params.id, page.title, page.content, req.user?.id)

  // Restore content
  db.prepare('UPDATE pages SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(version.title, version.content, req.params.id)

  res.json({ success: true })
})

// 获取单个页面（公开页所有人可看；私有页仅作者/管理员可看）
router.get('/:id', optionalAuthMiddleware, (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, u.username AS author_name, u.avatar AS author_avatar
       FROM pages p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.id = ?`,
    )
    .get(req.params.id)
  if (!row) return res.status(404).json({ error: '页面不存在' })

  // 私有页权限检查
  if (row.visibility !== 'public') {
    if (!req.user) return res.status(403).json({ error: '此文档为私有，请登录后查看' })
    if (row.author_id !== req.user.id && req.user.level < 1) {
      return res.status(403).json({ error: '无权查看此私有文档' })
    }
  }

  res.json(row)
})

// 创建页面（需登录）
router.post('/', authMiddleware, (req, res) => {
  const { title, parentId, content } = req.body
  const id = generateId()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO pages (id, title, content, parent_id, author_id, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'private', ?, ?)`,
  ).run(id, title || '无标题文档', content || '', parentId || null, req.user.id, now, now)
  res.status(201).json({ id })
})

// 更新页面（需登录，仅作者或管理员）
router.put('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: '页面不存在' })

  const canEdit = page.author_id === req.user.id || req.user.level >= 1
  if (!canEdit) return res.status(403).json({ error: '只能编辑自己的文档' })

  // Save version snapshot before update
  const current = db.prepare('SELECT title, content, author_id FROM pages WHERE id = ?').get(req.params.id)
  if (current) {
    db.prepare('INSERT INTO page_versions (page_id, title, content, author_id) VALUES (?, ?, ?, ?)')
      .run(req.params.id, current.title, current.content, current.author_id)
  }

  const { title, content, parentId, visibility } = req.body
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE pages SET title = COALESCE(?, title), content = COALESCE(?, content),
     parent_id = COALESCE(?, parent_id), visibility = COALESCE(?, visibility),
     updated_at = ?
     WHERE id = ?`,
  ).run(title ?? null, content ?? null, parentId ?? null, visibility ?? null, now, req.params.id)
  bus.emit('page:updated', { pageId: req.params.id })
  res.json({ success: true })
})

// 删除页面（需登录，仅作者或管理员）
router.delete('/:id', authMiddleware, (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json({ error: '页面不存在' })

  const canDelete = page.author_id === req.user.id || req.user.level >= 1
  if (!canDelete) return res.status(403).json({ error: '只能删除自己的文档' })

  db.prepare('UPDATE pages SET parent_id = NULL WHERE parent_id = ?').run(req.params.id)
  db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// 移动页面
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
