// 将 TTS 模型上传到七牛 CDN（供桌面端快速下载）
// 用法: node upload-tts-models.js <本地tar.bz2路径> [CDN key]
// 环境变量: QINIU_ACCESS_KEY / QINIU_SECRET_KEY（或读取 ../server/.env）
const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  try {
    const content = fs.readFileSync(file, 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/)
      if (m) process.env[m[1]] = m[2].trim()
    }
  } catch {}
}

// 从 server/.env 读取七牛密钥（本地开发环境）
loadEnv(path.join(__dirname, '..', 'server', '.env'))

const ACCESS_KEY = process.env.QINIU_ACCESS_KEY
const SECRET_KEY = process.env.QINIU_SECRET_KEY
const BUCKET = process.env.QINIU_BUCKET || 'northbooker'

const localPath = process.argv[2]
const key = process.argv[3] || path.basename(localPath)

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('缺少七牛密钥，请检查 server/.env')
  process.exit(1)
}
if (!fs.existsSync(localPath)) {
  console.error('本地文件不存在:', localPath)
  process.exit(1)
}

const qiniu = require('qiniu')
const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY)
const config = new qiniu.conf.Config()
config.zone = qiniu.zone.Zone_as0 // 东南亚
config.useHttpsDomain = true
const formUploader = new qiniu.form_up.FormUploader(config)

const token = new qiniu.rs.PutPolicy({ scope: BUCKET + ':' + key }).uploadToken(mac)
const putExtra = new qiniu.form_up.PutExtra()

console.log('上传:', key, '(', fs.statSync(localPath).size, 'bytes )')
formUploader.putFile(token, key, localPath, putExtra, (err, ret, info) => {
  if (err) { console.error('上传失败:', err); process.exit(1) }
  if (info.statusCode === 200) {
    console.log('上传成功:', 'https://cdn.northbooker.xuanjian.top/' + key)
  } else {
    console.error('上传失败:', info.statusCode, JSON.stringify(ret))
    process.exit(1)
  }
})
