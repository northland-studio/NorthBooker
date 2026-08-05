// 发布 Android APK 到七牛 CDN（仅 CDN 分发，不使用 GitHub Releases）
// 用法: node publish-to-cdn.js --apk <apk路径> [--versionName x.y.z] [--versionCode N] [--notes "a|b|c"]
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

loadEnv(path.join(__dirname, '..', '..', 'server', '.env'))

const ACCESS_KEY = process.env.QINIU_ACCESS_KEY
const SECRET_KEY = process.env.QINIU_SECRET_KEY
const BUCKET = process.env.QINIU_BUCKET || 'northbooker'

const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const apkPath = arg('--apk')
let versionName = arg('--versionName')
let versionCode = parseInt(arg('--versionCode') || '0', 10)
let notes = (arg('--notes') || '').split('|').filter(Boolean)

// 从 android/app/build.gradle 解析版本（未通过参数提供时）
if (!versionName || !versionCode) {
  const gradleFile = path.join(__dirname, '..', 'android', 'app', 'build.gradle')
  try {
    const content = fs.readFileSync(gradleFile, 'utf-8')
    if (!versionName) {
      const m = content.match(/versionName\s+"([^"]+)"/)
      if (m) versionName = m[1]
    }
    if (!versionCode) {
      const m = content.match(/versionCode\s+(\d+)/)
      if (m) versionCode = parseInt(m[1], 10)
    }
  } catch (e) {
    console.error('无法解析 build.gradle:', e.message)
  }
}

// 未提供 notes 时，从仓库 CHANGELOG.md 顶部匹配版本段落的条目
if (!notes.length && versionName) {
  const changelog = path.join(__dirname, '..', '..', 'CHANGELOG.md')
  try {
    const lines = fs.readFileSync(changelog, 'utf-8').split('\n')
    let inSection = false
    for (const line of lines) {
      if (/^##\s/.test(line)) {
        if (inSection) break
        if (line.includes(versionName) || line.includes(`v${versionName}`)) inSection = true
        continue
      }
      if (inSection && /^\s*[-*]\s+/.test(line)) {
        notes.push(line.replace(/^\s*[-*]\s+/, '').trim())
      }
    }
  } catch {}
}

if (!apkPath || !fs.existsSync(apkPath)) {
  console.error('缺少 APK 文件:', apkPath)
  process.exit(1)
}
if (!versionName || !versionCode) {
  console.error('无法确定版本号（--versionName/--versionCode）')
  process.exit(1)
}
if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('缺少七牛密钥，请检查 server/.env 或 CI secrets')
  process.exit(1)
}

const qiniu = require('qiniu')
const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY)
const config = new qiniu.conf.Config()
config.zone = qiniu.zone.Zone_as0 // 东南亚
config.useHttpsDomain = true
const formUploader = new qiniu.form_up.FormUploader(config)

function upload(localPath, key) {
  return new Promise((resolve, reject) => {
    const token = new qiniu.rs.PutPolicy({ scope: BUCKET + ':' + key }).uploadToken(mac)
    formUploader.putFile(token, key, localPath, null, (err, ret, info) => {
      if (err) return reject(err)
      if (info.statusCode === 200) {
        console.log('上传成功:', key)
        resolve(ret)
      } else {
        reject(new Error(info.statusCode + ' ' + JSON.stringify(ret)))
      }
    })
  })
}

const apkFile = `northbooker-${versionName}.apk`
const apkKey = `releases/android/${apkFile}`

;(async () => {
  console.log('发布版本:', versionName, '(versionCode', versionCode + ')')
  console.log('更新说明:', notes.length ? notes.join(' | ') : '（无）')

  await upload(apkPath, apkKey)

  const meta = {
    versionName,
    versionCode,
    apkFile,
    notes,
    publishAt: new Date().toISOString(),
  }
  const tmp = path.join(__dirname, 'latest.tmp.json')
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2))
  try {
    await upload(tmp, 'releases/android/latest.json')
  } finally {
    fs.unlinkSync(tmp)
  }

  console.log('Android CDN 更新源部署完成')
  console.log('下载地址: https://cdn.northbooker.xuanjian.top/' + apkKey)
})().catch((e) => {
  console.error('发布失败:', e.message)
  process.exit(1)
})
