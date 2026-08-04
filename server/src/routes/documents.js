import { Router } from 'express'
import db from '../database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { signPrivateUri } from '../qiniu.js'

const router = Router()

// 数据库行转换为接口文档对象（uri/thumbnail 转为私有空间时效性签名 URL）
function toDoc(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    uri: signPrivateUri(row.uri),
    type: row.type,
    size: row.size,
    updatedAt: row.updated_at,
    thumbnail: signPrivateUri(row.thumbnail),
    folder_id: row.folder_id ?? null,
  }
}

// 获取文档列表（支持 folder_id 过滤）
router.get('/', (req, res) => {
  const folderId = req.query.folder_id !== undefined ? (req.query.folder_id || null) : undefined
  let rows
  if (folderId !== undefined) {
    if (folderId) {
      rows = db.prepare('SELECT * FROM documents WHERE folder_id = ? ORDER BY updated_at DESC').all(folderId)
    } else {
      rows = db.prepare('SELECT * FROM documents WHERE folder_id IS NULL ORDER BY updated_at DESC').all()
    }
  } else {
    rows = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all()
  }
  res.json(rows.map(toDoc))
})

// 获取单个文档
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })
  res.json(toDoc(row))
})

// 更新文档（标题、所属文件夹等）
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { title, folder_id, visibility } = req.body
  const updatedAt = new Date().toISOString()

  // 如果传入 title，则更新 title
  if (typeof title === 'string' && title.trim()) {
    db.prepare('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?')
      .run(title.trim(), updatedAt, req.params.id)
  }

  // 如果传入 folder_id（含 null），则移动文档
  if (folder_id !== undefined || 'folder_id' in req.body) {
    db.prepare('UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?')
      .run(folder_id || null, updatedAt, req.params.id)
  }

  // 如果传入 visibility，则更新可见性
  if (visibility === 'public' || visibility === 'private') {
    db.prepare('UPDATE documents SET visibility = ?, updated_at = ? WHERE id = ?')
      .run(visibility, updatedAt, req.params.id)
  }

  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })
  res.json(toDoc(row))
})

export default router
