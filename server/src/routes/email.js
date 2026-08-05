// 邮箱绑定（2.6.1）：发送验证邮件，链接一键验证
// - POST /api/email/send-verification  发送验证邮件（需登录）
// - GET  /api/email/verify?token=xxx   邮件链接回调，验证并绑定邮箱
import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../database.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendMail, buildMailHtml } from '../mail.js'
import logger from '../logger.js'

const router = Router()

const TOKEN_TTL = 60 * 60 * 1000 // 验证链接 1 小时有效
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 发送验证邮件
router.post('/send-verification', authMiddleware, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' })
  }
  // 已绑定同邮箱则无需再发
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id)
  if (user?.email === email) {
    return res.json({ success: true, already: true })
  }
  // 删除该用户旧的待验证 token（避免重复邮件）
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(req.user.id)

  const token = crypto.randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL).toISOString()
  db.prepare('INSERT INTO email_verifications (token, user_id, email, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, req.user.id, email, expiresAt)

  // 验证链接基于当前请求 host（生产为 northbooker.xuanjian.top，走 HTTPS）
  const base = `${req.protocol}://${req.get('host')}`
  const verifyUrl = `${base}/api/email/verify?token=${token}`
  const html = buildMailHtml({
    heading: '绑定邮箱验证',
    bodyHtml: `<p>您正在为北牖 NorthBooker 账号绑定邮箱 <strong style="color:#004AAD">${email}</strong>。</p>
               <p>请点击下方按钮完成验证，链接 ${TOKEN_TTL / 60000} 分钟内有效：</p>`,
    ctaText: '完成绑定',
    ctaUrl: verifyUrl,
    meta: `绑定邮箱 · ${email}`,
  })
  const r = await sendMail({ to: email, subject: '[北牖] 绑定邮箱验证', html })
  if (r.error) {
    logger.error('mail', '绑定验证邮件发送失败', { email, error: r.error })
    return res.status(500).json({ error: '邮件发送失败，请检查邮箱是否正确' })
  }
  res.json({ success: true })
})

// 邮件链接回调：验证并绑定邮箱
router.get('/verify', async (req, res) => {
  const { token } = req.query
  const page = (title, html) => {
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
      <body style="margin:0;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#f2f4f8">
        <div style="max-width:440px;margin:80px auto;background:#fff;border-radius:12px;padding:40px 32px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.06)">
          ${html}
        </div>
      </body></html>`)
  }
  if (!token || typeof token !== 'string') return page('验证失败', '<h3 style="color:#d33">缺少验证参数</h3>')
  const row = db.prepare('SELECT * FROM email_verifications WHERE token = ?').get(token)
  if (!row || row.used) return page('验证失败', '<h3 style="color:#d33">验证链接无效或已被使用</h3>')
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM email_verifications WHERE token = ?').run(token)
    return page('验证失败', '<h3 style="color:#d33">验证链接已过期，请重新发送</h3>')
  }
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(row.email, row.user_id)
  db.prepare('UPDATE email_verifications SET used = 1 WHERE token = ?').run(token)
  logger.info('mail', '邮箱绑定成功', { userId: row.user_id, email: row.email })
  page('绑定成功', `<h2 style="color:#004AAD;margin:0 0 12px">邮箱绑定成功</h2>
    <p style="color:#666;line-height:1.8;margin:0 0 20px">已为你的账号绑定<br><strong style="color:#1a1b1d">${row.email}</strong><br><span style="font-size:12px;color:#9ca3af">现在可以返回北牖继续使用</span></p>
    <a href="/" style="display:inline-block;padding:11px 32px;background:#004AAD;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">返回北牖</a>`)
})

export default router
