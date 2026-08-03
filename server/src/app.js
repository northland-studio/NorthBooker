import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import documentsRouter from './routes/documents.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import uploadsRouter from './routes/uploads.js'

const app = express()

// 信任反向代理（cloudflare/nginx），以便正确识别 HTTPS 与客户端 IP
app.set('trust proxy', 1)

// 中间件
app.use(cors())
app.use(express.json())
app.use(cookieParser(process.env.JWT_SECRET || 'change_me'))

// 路由（文件存储使用七牛对象存储，不再本地静态托管）
app.use('/api/documents', documentsRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/uploads', uploadsRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'northbooker' })
})

export default app
