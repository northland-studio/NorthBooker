// 邮件通知（2.6.0）：腾讯企业邮箱 SMTP，订阅更新提醒
import nodemailer from 'nodemailer'
import db from './database.js'
import logger from './logger.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST || 'smtp.exmail.qq.com'
  const port = Number(process.env.SMTP_PORT) || 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) {
    logger.warn('mail', '未配置 SMTP_USER / SMTP_PASS，邮件功能不可用')
    return null
  }
  transporter = nodemailer.createTransport({ host, port, secure: true, auth: { user, pass } })
  return transporter
}

// 北牖邮件 HTML 模板（table 布局，可引用图片资源）
export function buildMailHtml({ heading = '北牖 NorthBooker', bodyHtml = '', ctaText, ctaUrl, meta = '' }) {
  const logo = process.env.MAIL_LOGO_URL || 'https://northbooker.xuanjian.top/assets/icon-CkD-fn9T.png'
  const banner = process.env.MAIL_BANNER_URL || ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f4f8;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f8;padding:32px 12px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.06)">
      ${banner ? `<tr><td style="background:#004AAD;text-align:center"><img src="${banner}" width="560" style="max-width:560px;width:100%;display:block" alt="banner"></td></tr>` : ''}
      <tr>
        <td style="background:#004AAD;padding:24px 32px;text-align:center">
          <img src="${logo}" width="48" height="48" style="border-radius:10px;vertical-align:middle" alt="北牖">
          <span style="display:inline-block;vertical-align:middle;margin-left:12px;color:#fff;font-size:18px;font-weight:700">北牖 NorthBooker</span>
        </td>
      </tr>
      <tr><td style="padding:32px 32px 8px">
        <h2 style="margin:0 0 8px;font-size:18px;color:#1a1b1d">${heading}</h2>
        ${meta ? `<div style="margin:0 0 16px;font-size:12px;color:#9ca3af">${meta}</div>` : ''}
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;font-size:14px;line-height:1.8;color:#444">${bodyHtml}</div>
      </td></tr>
      ${ctaText && ctaUrl ? `
      <tr><td style="padding:24px 32px;text-align:center">
        <a href="${ctaUrl}" style="display:inline-block;padding:11px 32px;background:#004AAD;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">${ctaText}</a>
      </td></tr>` : ''}
      <tr><td style="padding:16px 32px 28px;font-size:12px;color:#999;text-align:center;border-top:1px solid #eee;margin-top:8px">
        北域工作室（Northland Studio）出品 · 本邮件由系统自动发送，请勿直接回复<br>
        <span style="color:#c3c8cf">北牖 NorthBooker · 云端文档管理平台</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

// 发送邮件
export async function sendMail({ to, subject, html }) {
  const t = getTransporter()
  if (!t) return { error: 'SMTP 未配置' }
  try {
    await t.sendMail({
      from: `"北牖 NorthBooker" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    return { ok: true }
  } catch (err) {
    logger.error('mail', '发送邮件失败', { to, error: err.message })
    return { error: err.message }
  }
}

// 在线文档更新时，通知所有订阅者（仅 target_type='page'）
export async function notifyPageUpdate(page, actorName, pageUrl) {
  try {
    const subs = db.prepare(
      `SELECT s.user_id, u.username, u.email FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.target_type = 'page' AND s.target_id = ?`,
    ).all(page.id)
    const targets = subs.filter((s) => s.email)
    if (!targets.length) return

    const time = new Date().toLocaleString('zh-CN', { hour12: false })
    const heading = `《${page.title}》已更新`
    const body = `<p>您订阅的在线文档 <strong style="color:#004AAD">《${page.title}》</strong> 刚刚被更新。</p>
                  <p style="margin-top:10px;color:#6b7280">更新人：<strong>${actorName || '某位用户'}</strong></p>
                  <p style="margin:4px 0 0;color:#6b7280">更新时间：<strong>${time}</strong></p>`
    const html = buildMailHtml({
      heading,
      bodyHtml: body,
      ctaText: '立即查看文档',
      ctaUrl: pageUrl || `https://northbooker.xuanjian.top/pages/${page.id}`,
      meta: `更新提醒 · ${time}`,
    })
    // 逐个发送（失败不影响其他收件人）
    for (const s of targets) {
      await sendMail({ to: s.email, subject: `[北牖] ${heading}`, html })
    }
    logger.info('mail', `已向 ${targets.length} 位订阅者发送更新通知`, { pageId: page.id })
  } catch (err) {
    logger.error('mail', '通知订阅者失败', { error: err.message })
  }
}
