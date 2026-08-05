import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import logger from './logger.js'
import documentsRouter from './routes/documents.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'
import uploadsRouter from './routes/uploads.js'
import bookmarksRouter from './routes/bookmarks.js'
import commentsRouter from './routes/comments.js'
import pagesRouter from './routes/pages.js'
import foldersRouter from './routes/folders.js'
import logRouter from './routes/log.js'
import updatesRouter from './routes/updates.js'
import downloadRouter from './routes/download.js'
import searchRouter from './routes/search.js'
import shareRouter from './routes/share.js'
import subscriptionsRouter from './routes/subscriptions.js'
import annotationsRouter from './routes/annotations.js'

const app = express()

// 信任反向代理（cloudflare/nginx），以便正确识别 HTTPS 与客户端 IP
app.set('trust proxy', 1)

// === 请求日志中间件 ===
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[level]('http', `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, {
      ip: req.ip,
      ua: req.get('user-agent')?.slice(0, 100) || '',
    })
  })
  next()
})

// 中间件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser(process.env.JWT_SECRET || 'change_me'))

// 路由（文件存储使用七牛对象存储，不再本地静态托管）
app.use('/api/documents', documentsRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/bookmarks', bookmarksRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/pages', pagesRouter)
app.use('/api/folders', foldersRouter)
app.use('/api/log', logRouter)
app.use('/api/updates', updatesRouter)
app.use('/api/download', downloadRouter)
app.use('/api/search', searchRouter)
app.use('/api/share', shareRouter)
app.use('/api/subscriptions', subscriptionsRouter)
app.use('/api/annotations', annotationsRouter)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'northbooker',
    qiniu: process.env.QINIU_ACCESS_KEY ? 'loaded' : 'missing',
    bucket: process.env.QINIU_BUCKET || 'missing',
    oauth: process.env.OAUTH_CLIENT_ID || 'missing',
  })
})

export default app
