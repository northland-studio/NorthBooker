import { Router } from 'express'
import db from '../database.js'
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from '../middleware/auth.js'
import { signPrivateUri, deleteFile, parseKeyFromUrl } from '../qiniu.js'
import { logAudit } from '../audit.js'
import bus from '../bus.js'
import logger from '../logger.js'

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
    visibility: row.visibility || 'public',
    owner_id: row.owner_id,
    tags: row.tags ? String(row.tags).split(',').filter(Boolean) : [],
    deletedAt: row.deleted_at || null,
  }
}

// 判断是否有管理权（管理员或文档所有者）
function canManage(req, row) {
  if (!req.user) return false
  if (req.user.level >= 1) return true
  return row.owner_id === req.user.id
}

// 获取文档列表（支持 folder_id / tags 过滤，过滤私有文档与回收站）
router.get('/', optionalAuthMiddleware, (req, res) => {
  const folderId = req.query.folder_id !== undefined ? (req.query.folder_id || null) : undefined
  const isOwner = req.user ? `OR d.owner_id = ${req.user.id}` : ''
  let rows
  if (folderId !== undefined) {
    if (folderId) {
      rows = db.prepare(`SELECT d.* FROM documents d WHERE d.deleted_at IS NULL AND d.folder_id = ? AND (d.visibility != 'private' ${isOwner}) ORDER BY d.updated_at DESC`).all(folderId)
    } else {
      rows = db.prepare(`SELECT d.* FROM documents d WHERE d.deleted_at IS NULL AND d.folder_id IS NULL AND (d.visibility != 'private' ${isOwner}) ORDER BY d.updated_at DESC`).all()
    }
  } else {
    rows = db.prepare(`SELECT d.* FROM documents d WHERE d.deleted_at IS NULL AND (d.visibility != 'private' ${isOwner}) ORDER BY d.updated_at DESC`).all()
  }
  res.json(rows.map(toDoc))
})

// 回收站列表（需登录，管理员可见全部，普通用户仅自己删除的）
router.get('/trash', authMiddleware, (req, res) => {
  const rows = req.user.level >= 1
    ? db.prepare('SELECT * FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()
    : db.prepare('SELECT * FROM documents WHERE deleted_at IS NOT NULL AND owner_id = ? ORDER BY deleted_at DESC').all(req.user.id)
  res.json(rows.map(toDoc))
})

// 获取单个文档（回收站内文档不可见）
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })
  res.json(toDoc(row))
})

// 更新文档（标题、所属文件夹、可见性、标签）
router.put('/:id', authMiddleware, (req, res) => {
  const { title, folder_id, visibility, tags } = req.body
  const updatedAt = new Date().toISOString()
  const row0 = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!row0) return res.status(404).json({ error: '文档不存在' })
  if (!canManage(req, row0)) return res.status(403).json({ error: '无权限操作该文档' })

  if (typeof title === 'string' && title.trim()) {
    db.prepare('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?')
      .run(title.trim(), updatedAt, req.params.id)
  }

  if (folder_id !== undefined || 'folder_id' in req.body) {
    db.prepare('UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?')
      .run(folder_id || null, updatedAt, req.params.id)
  }

  if (visibility === 'public' || visibility === 'private') {
    db.prepare('UPDATE documents SET visibility = ?, updated_at = ? WHERE id = ?')
      .run(visibility, updatedAt, req.params.id)
  }

  if (Array.isArray(tags)) {
    const tagStr = tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10).join(',')
    db.prepare('UPDATE documents SET tags = ?, updated_at = ? WHERE id = ?')
      .run(tagStr, updatedAt, req.params.id)
  }

  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  bus.emit('document:updated', { documentId: req.params.id })
  res.json(toDoc(row))
})

// 软删除：移入回收站（需登录，管理员或所有者）
router.delete('/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })
  if (!canManage(req, row)) return res.status(403).json({ error: '无权限删除该文档' })
  db.prepare('UPDATE documents SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id)
  logAudit(req.user, 'trash_document', row.title, `移入回收站: ${row.id}`)
  res.json({ ok: true })
})

// 从回收站恢复
router.post('/:id/restore', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在或不在回收站' })
  if (!canManage(req, row)) return res.status(403).json({ error: '无权限恢复该文档' })
  db.prepare('UPDATE documents SET deleted_at = NULL WHERE id = ?').run(req.params.id)
  logAudit(req.user, 'restore_document', row.title, `从回收站恢复: ${row.id}`)
  res.json({ ok: true })
})

// 永久删除（同步清理七牛对象存储，仅管理员）
router.delete('/:id/permanent', authMiddleware, adminMiddleware, async (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })

  const key = parseKeyFromUrl(row.uri)
  if (key) {
    try {
      await deleteFile(key)
    } catch (err) {
      logger.error('documents', '删除七牛文件失败', { error: err.message, key })
    }
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
  db.prepare('DELETE FROM bookmarks WHERE document_id = ?').run(req.params.id)
  logAudit(req.user, 'permanent_delete', row.title, `永久删除: ${row.id}`)
  res.json({ ok: true })
})

export default router
