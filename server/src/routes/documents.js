import { Router } from 'express'
import db from '../database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 数据库行转换为接口文档对象
function toDoc(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    uri: row.uri,
    type: row.type,
    size: row.size,
    updatedAt: row.updated_at,
    thumbnail: row.thumbnail,
  }
}

// 获取文档列表
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all()
  res.json(rows.map(toDoc))
})

// 获取单个文档
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })
  res.json(toDoc(row))
})

// 更新文档标题（需管理员权限）
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { title } = req.body
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '标题不能为空' })
  }
  const updatedAt = new Date().toISOString()
  const result = db
    .prepare('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?')
    .run(title.trim(), updatedAt, req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: '文档不存在' })
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  res.json(toDoc(row))
})

export default router
