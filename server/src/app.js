import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import documentsRouter from './routes/documents.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import uploadsRouter from './routes/uploads.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// 静态托管上传文件
app.use('/uploads', express.static(path.resolve(__dirname, '../data/uploads')))

// 路由
app.use('/api/documents', documentsRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/uploads', uploadsRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'northbooker' })
})

export default app
