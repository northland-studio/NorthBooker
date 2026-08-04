import { Router } from 'express'
import logger from '../logger.js'

const router = Router()

// POST /api/log — 接收前端错误日志上报
router.post('/', (req, res) => {
  const { level, module, message, data, ua, url, timestamp } = req.body
  if (level && module && message) {
    logger[level]?.('client' + (module ? ':' + module : ''), message, {
      data,
      ua,
      url,
      clientTime: timestamp,
    })
  }
  res.json({ ok: true })
})

export default router
