import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 必须先加载 .env，再 import app.js
// 原因：ESM 中静态 import 会先于本模块顶层代码执行，
// qiniu.js 等依赖在模块加载时读取 process.env，若 dotenv 尚未执行则密钥为空
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// 动态 import 确保 .env 已加载后再加载 app 及其依赖（qiniu.js 等）
const { default: app } = await import('./app.js')
const { default: logger } = await import('./logger.js')

// 北牖后端服务入口
const PORT = process.env.PORT || 3090

app.listen(PORT, () => {
  logger.info('server', `后端服务已启动: http://localhost:${PORT}`, {
    qiniu: process.env.QINIU_ACCESS_KEY ? `已加载(${process.env.QINIU_ACCESS_KEY.slice(0, 6)}...)` : '未加载',
    oauth: process.env.OAUTH_CLIENT_ID ? '已配置' : '未配置',
  })
})
