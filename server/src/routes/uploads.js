import { Router } from 'express'
import crypto from 'node:crypto'
import path from 'node:path'
import db from '../database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { getFileType } from '../utils/fileType.js'
import {
  getUploadToken,
  getCdnUrl,
  getPrivateDownloadUrl,
  deleteFile,
  parseKeyFromUrl,
  QINIU_UPLOAD_URL,
  qiniuConfig,
} from '../qiniu.js'
import logger from '../logger.js'

const router = Router()

// 所有上传接口需登录且 level >= 1
router.use(authMiddleware, adminMiddleware)

// 根据文件名生成七牛存储 key：docs/2026-08/<原名>-<随机>.<ext>
function buildKey(fileName) {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  const rand = crypto.randomBytes(4).toString('hex')
  return `docs/${month}/${base}-${rand}${ext}`
}

/**
 * GET /api/uploads/token?fileName=xxx
 * 返回七牛上传凭证与存储 key，供前端直传七牛（带真实进度）
 */
router.get('/token', (req, res) => {
  const fileName = typeof req.query.fileName === 'string' ? req.query.fileName : ''
  if (!fileName) {
    return res.status(400).json({ error: '缺少 fileName' })
  }
  const key = buildKey(fileName)
  const uploadToken = getUploadToken(key)
  logger.info('upload', '颁发上传凭证', {
    userId: req.user?.id,
    fileName,
    key,
    uploadUrl: QINIU_UPLOAD_URL,
    tokenLen: uploadToken.length,
  })
  res.json({
    uploadToken,
    key,
    uploadUrl: QINIU_UPLOAD_URL,
    cdnDomain: qiniuConfig.cdnDomain,
  })
})

/**
 * POST /api/uploads/callback
 * 前端直传七牛成功后调用，记录文档到数据库
 * body: { key, fileName, title?, size, hash }
 */
router.post('/callback', (req, res) => {
  const { key, fileName, title, size, hash, folder_id } = req.body
  if (typeof key !== 'string' || !key) {
    return res.status(400).json({ error: '缺少 key' })
  }
  if (typeof fileName !== 'string' || !fileName) {
    return res.status(400).json({ error: '缺少 fileName' })
  }

  const docTitle = (typeof title === 'string' && title.trim()) || fileName
  const type = getFileType(fileName)
  const docSize = typeof size === 'number' ? size : Number(size) || 0
  const updatedAt = new Date().toISOString()
  const id = crypto.randomBytes(8).toString('hex')
  // 数据库存原始公开 URL（便于删除时解析 key），返回前端用私有签名 URL
  const uri = getCdnUrl(key)
  const signedUri = getPrivateDownloadUrl(key)

  db.prepare(
    `INSERT INTO documents (id, title, file_name, uri, type, size, updated_at, owner_id, folder_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')`,
  ).run(id, docTitle, fileName, uri, type, docSize, updatedAt, req.user.id, folder_id || null)

  res.json({
    id,
    title: docTitle,
    fileName,
    uri: signedUri,
    type,
    size: docSize,
    updatedAt,
    thumbnail: null,
    hash: hash || null,
  })
})

/**
 * DELETE /api/uploads
 * 按 uri 删除七牛文件（供管理后台删除文档时调用）
 * body: { uri }
 */
router.delete('/', async (req, res) => {
  const { uri } = req.body
  if (typeof uri !== 'string' || !uri) {
    return res.status(400).json({ error: '缺少 uri' })
  }
  const key = parseKeyFromUrl(uri)
  if (!key) return res.status(400).json({ error: 'uri 解析失败' })
  try {
    await deleteFile(key)
    res.json({ ok: true })
  } catch (err) {
    logger.error('upload', '七牛删除失败', { error: err.message, key })
    res.status(500).json({ error: '对象存储删除失败' })
  }
})

export default router
