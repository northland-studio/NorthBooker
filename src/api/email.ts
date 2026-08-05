import client from './client'

// 发送绑定邮箱验证邮件（2.6.1）
export function sendVerificationEmail(email: string) {
  return client.post('/api/email/send-verification', { email })
}
