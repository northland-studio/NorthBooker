// 七牛对象存储配置与工具
// bucket: northbooker / 区域: 东南亚(as0) / CDN: cdn.northbooker.xuanjian.top
import qiniu from 'qiniu'

const accessKey = process.env.QINIU_ACCESS_KEY || ''
const secretKey = process.env.QINIU_SECRET_KEY || ''
const bucket = process.env.QINIU_BUCKET || 'northbooker'
const cdnDomain = (process.env.QINIU_CDN_DOMAIN || 'https://cdn.northbooker.xuanjian.top').replace(/\/$/, '')

const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)

const config = new qiniu.conf.Config()
// 东南亚（新加坡）区域
config.zone = qiniu.zone.Zone_as0
config.useHttpsDomain = true

const formUploader = new qiniu.form_up.FormUploader(config)
const bucketManager = new qiniu.rs.BucketManager(mac, config)

export const qiniuConfig = { bucket, cdnDomain }

// 东南亚(as0)区域上传地址（前端直传用）
export const QINIU_UPLOAD_URL = 'https://up-as0.qiniup.com'

// 生成上传凭证（指定 key 则覆盖同名文件）
export function getUploadToken(key) {
  const scope = key ? `${bucket}:${key}` : bucket
  const putPolicy = new qiniu.rs.PutPolicy({ scope })
  putPolicy.expires = 3600
  // 上传成功后七牛返回的字段（前端可解析 key/hash/fsize）
  putPolicy.returnBody = '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)"}'
  return putPolicy.uploadToken(mac)
}

/**
 * 上传 Buffer 到七牛
 * @param {string} key 存储路径，如 docs/2026-08/xxx.pdf
 * @param {Buffer} body 文件内容
 * @param {string} [mimeType] MIME 类型
 * @returns {Promise<{key: string, hash: string}>}
 */
export function uploadBuffer(key, body, mimeType) {
  return new Promise((resolve, reject) => {
    const putExtra = new qiniu.form_up.PutExtra()
    if (mimeType) putExtra.mimeType = mimeType
    putExtra.fname = key.split('/').pop() || 'file'
    formUploader.put(getUploadToken(key), key, body, putExtra, (err, respBody, respInfo) => {
      if (err) return reject(err)
      if (respInfo.statusCode === 200) {
        resolve({ key: respBody.key, hash: respBody.hash })
      } else {
        reject(new Error(`七牛上传失败: ${respInfo.statusCode} ${JSON.stringify(respBody)}`))
      }
    })
  })
}

// 拼接 CDN 访问 URL（公开空间用）
export function getCdnUrl(key) {
  return `${cdnDomain}/${key}`
}

/**
 * 生成私有空间时效性下载 URL（带 ?e=&token= 签名）
 * @param {string} key 存储路径
 * @param {number} [ttlSeconds=3600] 有效期（秒），默认 1 小时
 * @returns {string} 私有签名下载 URL
 */
export function getPrivateDownloadUrl(key, ttlSeconds = 3600) {
  const deadline = Math.floor(Date.now() / 1000) + ttlSeconds
  return bucketManager.privateDownloadUrl(cdnDomain, key, deadline)
}

/**
 * 对外暴露的文档 uri 进行私有签名
 * - 七牛 CDN URL：解析 key 后生成时效性签名 URL
 * - 非七牛 URL（如本地示例文档 /docs/sample.md）：原样返回
 * @param {string} uri 原始 uri
 * @param {number} [ttlSeconds] 有效期
 */
export function signPrivateUri(uri, ttlSeconds) {
  if (typeof uri !== 'string' || !uri) return uri
  const key = parseKeyFromUrl(uri)
  if (!key) return uri
  return getPrivateDownloadUrl(key, ttlSeconds)
}

// 从完整 URL 中解析出 key（用于删除）
export function parseKeyFromUrl(url) {
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.replace(/^\//, ''))
  } catch {
    return null
  }
}

/**
 * 删除七牛上的文件
 * @param {string} key 存储路径
 * @returns {Promise<void>}
 */
export function deleteFile(key) {
  return new Promise((resolve, reject) => {
    bucketManager.delete(bucket, key, (err, respBody, respInfo) => {
      if (err) return reject(err)
      // 612 = 文件不存在（视为删除成功）
      if (respInfo.statusCode === 200 || respInfo.statusCode === 612) resolve()
      else reject(new Error(`七牛删除失败: ${respInfo.statusCode}`))
    })
  })
}
