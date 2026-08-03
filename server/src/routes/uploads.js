import { Router } from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db from '../database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { getFileType } from '../utils/fileType.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.resolve(__dirname, '../data/uploads')

// multer 存储配置：按日期分目录，文件名加随机后缀避免冲突
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date()
    const monthDir = path.join(
      UPLOAD_DIR,
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    )
    fs.mkdirSync(monthDir, { recursive: true })
    cb(null, monthDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext)
    const rand = crypto.randomBytes(4).toString('hex')
    cb(null, `${base}-${rand}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
})

const router = Router()

// 所有上传接口需登录且 level >= 1
router.use(authMiddleware, adminMiddleware)

/**
 * POST /api/uploads
 * 单文件上传，创建文档记录
 * 字段：file（文件）、title（可选，默认用文件名）
 */
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' })
  }

  const title = (typeof req.body.title === 'string' && req.body.title.trim()) || req.file.originalname
  const fileName = req.file.originalname
  // 相对 URL：/uploads/2026-08/xxx.pdf（由 app.js 静态托管 /uploads -> data/uploads）
  const rel = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/')
  const uri = `/uploads/${rel}`
  const type = getFileType(fileName)
  const size = req.file.size
  const updatedAt = new Date().toISOString()
  const id = crypto.randomBytes(8).toString('hex')

  db.prepare(
    `INSERT INTO documents (id, title, file_name, uri, type, size, updated_at, owner_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public')`,
  ).run(id, title, fileName, uri, type, size, updatedAt, req.user.id)

  res.json({
    id,
    title,
    fileName,
    uri,
    type,
    size,
    updatedAt,
    thumbnail: null,
  })
})

export default router
