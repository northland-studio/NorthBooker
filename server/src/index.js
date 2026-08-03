import 'dotenv/config'
import app from './app.js'

// 北牖后端服务入口
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`[北牖] 后端服务已启动: http://localhost:${PORT}`)
})
