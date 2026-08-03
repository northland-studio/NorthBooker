import { Router } from 'express'
import db from '../database.js'

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

export default router
