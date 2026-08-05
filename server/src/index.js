import dotenv from 'dotenv'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 必须先加载 .env，再 import app.js
// 原因：ESM 中静态 import 会先于本模块顶层代码执行，
// qiniu.js 等依赖在模块加载时读取 process.env，若 dotenv 尚未执行则密钥为空
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// 动态 import 确保 .env 已加载后再加载 app 及其依赖（qiniu.js 等）
const { default: app } = await import('./app.js')
const { default: logger } = await import('./logger.js')
const { default: db } = await import('./database.js')
const { default: bus } = await import('./bus.js')
const { WebSocketServer } = await import('ws')
// Yjs 实时协作（仅在线文档，2.6.0）：y-websocket 协议
const { setupWSConnection } = await import('y-websocket/bin/utils')

// 北牖后端服务入口
const PORT = process.env.PORT || 3090

const httpServer = http.createServer(app)

// 普通 WebSocket（订阅广播）：noServer 模式，由 upgrade 分发
const wss = new WebSocketServer({ noServer: true })
wss.on('connection', (ws) => {
  logger.info('ws', '客户端已连接')
  ws.on('close', () => logger.info('ws', '客户端已断开'))
})

// Yjs 协作 WebSocket：/api/collab/:room 交给 y-websocket 协议处理
const collabWss = new WebSocketServer({ noServer: true })
collabWss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

// upgrade 分发：/api/collab/* → Yjs 协作；其余 → 订阅广播
httpServer.on('upgrade', (req, socket, head) => {
  let pathname = ''
  try {
    pathname = new URL(req.url, 'http://localhost').pathname
  } catch {
    socket.destroy()
    return
  }
  if (pathname.startsWith('/api/collab/')) {
    collabWss.handleUpgrade(req, socket, head, (ws) => collabWss.emit('connection', ws, req))
  } else {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
  }
})

// 监听页面更新事件，向订阅者广播通知
bus.on('page:updated', (data) => {
  try {
    const subs = db.prepare('SELECT user_id FROM subscriptions WHERE target_type = ? AND target_id = ?')
      .all('page', data.pageId)
    const page = db.prepare('SELECT title, updated_at FROM pages WHERE id = ?').get(data.pageId)
    const message = JSON.stringify({
      type: 'update',
      target_type: 'page',
      target_id: data.pageId,
      title: page?.title,
      updated_at: page?.updated_at,
    })
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(message)
    })
  } catch (e) {
    logger.warn('ws', `广播失败: ${e.message}`)
  }
})

// 监听文档更新事件，向订阅者广播通知
bus.on('document:updated', (data) => {
  try {
    const subs = db.prepare('SELECT user_id FROM subscriptions WHERE target_type = ? AND target_id = ?')
      .all('document', data.documentId)
    const doc = db.prepare('SELECT title, updated_at FROM documents WHERE id = ?').get(data.documentId)
    const message = JSON.stringify({
      type: 'update',
      target_type: 'document',
      target_id: data.documentId,
      title: doc?.title,
      updated_at: doc?.updated_at,
    })
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(message)
    })
  } catch (e) {
    logger.warn('ws', `广播失败: ${e.message}`)
  }
})

httpServer.listen(PORT, () => {
  logger.info('server', `后端服务已启动: http://localhost:${PORT}`, {
    ws: true,
    qiniu: process.env.QINIU_ACCESS_KEY ? `已加载(${process.env.QINIU_ACCESS_KEY.slice(0, 6)}...)` : '未加载',
    oauth: process.env.OAUTH_CLIENT_ID ? '已配置' : '未配置',
  })
})
