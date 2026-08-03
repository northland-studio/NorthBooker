import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env') })

const { getUploadToken, QINIU_UPLOAD_URL, qiniuConfig } = await import('./src/qiniu.js')

console.log('=== 七牛配置 ===')
console.log('accessKey:', qiniuConfig.accessKey ? qiniuConfig.accessKey.slice(0, 8) + '...' : '(空)')
console.log('secretKey:', qiniuConfig.secretKey ? '已设置(' + qiniuConfig.secretKey.length + '字符)' : '(空)')
console.log('bucket:', qiniuConfig.bucket)
console.log('uploadUrl:', QINIU_UPLOAD_URL)

const token = getUploadToken('test-prod.txt')
console.log('\n=== 生成的 token ===')
console.log('token 长度:', token ? token.length : 0)
console.log('token 预览:', token ? token.slice(0, 30) + '...' : '(空)')

// 测试上传
const form = new FormData()
form.append('token', token)
form.append('key', 'test-prod.txt')
form.append('file', new Blob(['prod test']), 'test-prod.txt')
const resp = await fetch(QINIU_UPLOAD_URL, { method: 'POST', body: form })
console.log('\n=== 上传测试 ===')
console.log('状态码:', resp.status)
const text = await resp.text()
console.log('响应:', text.slice(0, 300))
