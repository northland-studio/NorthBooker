// 个人主页数据（2.6.3）：/api/profile/:userId
// 展示贡献总字数、上传文件数、邮箱绑定、订阅情况等
import { Router } from 'express'
import db from '../database.js'
import { optionalAuthMiddleware } from '../middleware/auth.js'

const router = Router()

// HTML 转纯文本（与前端统计一致）
function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}

// GET /api/profile/:userId
router.get('/:userId', optionalAuthMiddleware, (req, res) => {
  const id = Number(req.params.userId)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的用户ID' })
  const user = db.prepare('SELECT id, username, avatar, level, contribution, email, created_at FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: '用户不存在' })

  // 贡献总字数 = 该用户创作的所有在线文档（pages）纯文本字数合计
  const pages = db.prepare('SELECT content FROM pages WHERE author_id = ?').all(id)
  const totalChars = pages.reduce((sum, p) => sum + stripHtml(p.content).length, 0)

  const docCount = pages.length
  const uploadCount = db.prepare('SELECT COUNT(*) AS c FROM documents WHERE owner_id = ?').get(id).c
  const subCount = db.prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE user_id = ? AND target_type = 'page'").get(id).c

  // 邮箱与订阅详情仅本人或管理员可见（他人只能看到是否已绑定）
  const privileged = req.user && (req.user.id === id || req.user.level >= 1)
  let subscriptions = []
  if (privileged) {
    subscriptions = db
      .prepare(
        `SELECT s.target_id AS page_id, p.title, p.updated_at
         FROM subscriptions s
         LEFT JOIN pages p ON p.id = s.target_id
         WHERE s.user_id = ? AND s.target_type = 'page'
         ORDER BY s.created_at DESC`,
      )
      .all(id)
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      level: user.level,
      title: null,
      contribution: user.contribution,
      createdAt: user.created_at,
      emailBound: !!user.email,
      email: privileged ? user.email : null,
    },
    stats: { totalChars, docCount, uploadCount, subCount },
    subscriptions,
  })
})

export default router
