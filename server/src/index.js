import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 显式加载 server/.env，不依赖进程 cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// 北牖后端服务入口
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`[北牖] 后端服务已启动: http://localhost:${PORT}`)
})
