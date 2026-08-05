// 审计日志 / 登录日志工具（2.6.0）
import db from './database.js'

// 写入管理员审计日志（失败不影响主流程）
export function logAudit(user, action, target, detail) {
  try {
    db.prepare(
      'INSERT INTO audit_logs (user_id, username, action, target, detail) VALUES (?, ?, ?, ?, ?)',
    ).run(user?.id || null, user?.username || null, action || '', target || null, detail || null)
  } catch {
    // ignore
  }
}

// 写入登录日志
export function logLogin(user, ip, ua, success = true) {
  try {
    db.prepare(
      'INSERT INTO login_logs (user_id, username, ip, ua, success) VALUES (?, ?, ?, ?, ?)',
    ).run(user?.id || null, user?.username || null, ip || null, ua || null, success ? 1 : 0)
  } catch {
    // ignore
  }
}
