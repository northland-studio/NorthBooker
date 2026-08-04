import { Router } from 'express'
import { getPrivateDownloadUrl } from '../qiniu.js'

const router = Router()

// GET /api/download/releases/:filename
// 为私有七牛 CDN 上的发行文件生成时效性签名下载 URL（1 小时有效）
router.get('/releases/:filename', (req, res) => {
  const { filename } = req.params
  const key = `releases/${filename}`

  try {
    const signedUrl = getPrivateDownloadUrl(key, 3600)
    res.redirect(302, signedUrl)
  } catch (e) {
    console.error('[下载] 签名生成失败:', e.message)
    res.status(500).json({ error: '下载链接生成失败' })
  }
})

export default router
