import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

function generateId() {
  return crypto.randomBytes(12).toString('base64url')
}

// 获取文件夹列表（按 parent_id 过滤，null=根目录）
router.get('/', (req, res) => {
  const parentId = req.query.parent_id || null
  let rows
  if (parentId) {
    rows = db.prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name ASC').all(parentId)
  } else {
    rows = db.prepare('SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC').all()
  }
  res.json(rows)
})

// 创建文件夹（需管理员权限）
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { name, parent_id } = req.body
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '文件夹名称不能为空' })
  }
  const id = generateId()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO folders (id, name, parent_id, owner_id, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name.trim(), parent_id || null, req.user.id, now)
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id)
  res.status(201).json(row)
})

// 删除文件夹（需管理员权限，级联删除子内容）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id)
  if (!folder) return res.status(404).json({ error: '文件夹不存在' })
  // 将子文档移回根目录
  db.prepare('UPDATE documents SET folder_id = NULL WHERE folder_id = ?').run(req.params.id)
  // 递归删除子文件夹
  function deleteChildren(parentId) {
    const children = db.prepare('SELECT id FROM folders WHERE parent_id = ?').all(parentId)
    for (const child of children) {
      deleteChildren(child.id)
      db.prepare('UPDATE documents SET folder_id = NULL WHERE folder_id = ?').run(child.id)
    }
    db.prepare('DELETE FROM folders WHERE parent_id = ?').run(parentId)
  }
  deleteChildren(req.params.id)
  db.prepare('DELETE FROM folders WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
