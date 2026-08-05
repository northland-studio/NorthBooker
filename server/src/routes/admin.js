import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import db from '../database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { deleteFile, parseKeyFromUrl, signPrivateUri } from '../qiniu.js'
import logger from '../logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const router = Router()

// 所有管理接口均需登录且 level >= 1
router.use(authMiddleware, adminMiddleware)

// 统计信息
router.get('/stats', (req, res) => {
  const docCount = db.prepare('SELECT COUNT(*) AS c FROM documents').get().c
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  const totalSize = db.prepare('SELECT COALESCE(SUM(size),0) AS s FROM documents').get().s
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM users WHERE level >= 1').get().c
  res.json({
    documents: docCount,
    users: userCount,
    admins: adminCount,
    totalSize,
  })
})

// 用户列表（含权限等级）
router.get('/users', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, xuanjian_id, username, avatar, level, contribution, created_at
       FROM users ORDER BY level DESC, id ASC`,
    )
    .all()
  res.json(
    rows.map((r) => ({
      id: r.id,
      xuanjianId: r.xuanjian_id,
      username: r.username,
      avatar: r.avatar,
      level: r.level,
      contribution: r.contribution,
      createdAt: r.created_at,
    })),
  )
})

// 文档管理列表（含 visibility、owner_id 等管理字段）
router.get('/documents', (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.id, d.title, d.file_name, d.uri, d.type, d.size, d.updated_at,
              d.thumbnail, d.visibility, d.owner_id, u.username AS owner_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.owner_id
       ORDER BY d.updated_at DESC`,
    )
    .all()
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      fileName: r.file_name,
      uri: signPrivateUri(r.uri),
      type: r.type,
      size: r.size,
      updatedAt: r.updated_at,
      thumbnail: signPrivateUri(r.thumbnail),
      visibility: r.visibility,
      ownerId: r.owner_id,
      ownerName: r.owner_name,
    })),
  )
})

// 更新文档可见性
router.put('/documents/:id/visibility', (req, res) => {
  const { visibility } = req.body
  if (!['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: 'visibility 取值非法' })
  }
  const result = db.prepare('UPDATE documents SET visibility = ? WHERE id = ?').run(visibility, req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: '文档不存在' })
  res.json({ ok: true })
})

// 删除文档（同步删除七牛对象存储中的文件）
router.delete('/documents/:id', async (req, res) => {
  const row = db.prepare('SELECT uri FROM documents WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '文档不存在' })

  // 删除七牛文件（失败不阻断数据库删除，仅记日志）
  const key = parseKeyFromUrl(row.uri)
  if (key) {
    try {
      await deleteFile(key)
    } catch (err) {
      logger.error('admin', '删除七牛文件失败', { error: err.message, key })
    }
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// 审计日志（分页）
router.get('/audit-logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const rows = db.prepare(
    'SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
  ).all(limit, offset)
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c
  res.json({ rows, total })
})

// 登录日志（分页）
router.get('/login-logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const rows = db.prepare(
    'SELECT * FROM login_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
  ).all(limit, offset)
  const total = db.prepare('SELECT COUNT(*) AS c FROM login_logs').get().c
  res.json({ rows, total })
})

// 数据备份：VACUUM INTO 生成 SQLite 快照下载
router.get('/backup', (req, res) => {
  const tmpFile = path.join(os.tmpdir(), `northbooker-backup-${Date.now()}.sqlite`)
  try {
    db.prepare(`VACUUM INTO '${tmpFile.replace(/'/g, "''")}'`).run()
    const name = `northbooker-backup-${new Date().toISOString().slice(0, 10)}.sqlite`
    res.download(tmpFile, name, () => {
      fs.unlink(tmpFile, () => {})
    })
    logger.info('admin', '已生成数据库备份', { user: req.user?.username })
  } catch (err) {
    logger.error('admin', '备份失败', { error: err.message })
    res.status(500).json({ error: '备份失败' })
  }
})

// 数据迁移：导出全部文档与在线文档（JSON）
router.get('/export-all', (req, res) => {
  try {
    const documents = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all()
    const users = db.prepare('SELECT id, xuanjian_id, username, avatar, level, contribution, email, created_at FROM users').all()
    const pages = db.prepare(
      `SELECT p.id, p.title, p.content, p.parent_id, p.sort_order, p.author_id, p.visibility, p.tags, p.created_at, p.updated_at,
              u.username AS author_name
       FROM pages p LEFT JOIN users u ON u.id = p.author_id
       ORDER BY p.updated_at DESC`,
    ).all()
    const folders = db.prepare('SELECT * FROM folders').all()
    const payload = {
      app: 'northbooker',
      version: '2.6.0',
      exported_at: new Date().toISOString(),
      users,
      folders,
      documents,
      pages,
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="northbooker-export-${new Date().toISOString().slice(0, 10)}.json"`)
    res.send(JSON.stringify(payload, null, 2))
    logger.info('admin', '已导出全部数据', { user: req.user?.username })
  } catch (err) {
    logger.error('admin', '导出失败', { error: err.message })
    res.status(500).json({ error: '导出失败' })
  }
})

export default router
