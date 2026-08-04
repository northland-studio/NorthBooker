/**
 * 双源更新 - CDN 代理路由
 *
 * 七牛私有空间无法直接被 electron-updater (NsisUpdater generic provider) 访问，
 * 因此通过后端代理 latest.yml 和安装包文件，后端用 SDK 生成临时签名 URL。
 *
 * GET /api/updates/latest.yml  — 返回改写后的 latest.yml（文件 URL 指向本代理）
 * GET /api/updates/files/:key  — 302 重定向到七牛签名下载 URL
 */

import { Router } from 'express'
import https from 'node:https'
import qiniu from 'qiniu'
import logger from '../logger.js'

const router = Router()

const accessKey = process.env.QINIU_ACCESS_KEY || ''
const secretKey = process.env.QINIU_SECRET_KEY || ''
const cdnDomain = (process.env.QINIU_CDN_DOMAIN || 'https://cdn.northbooker.xuanjian.top').replace(/\/$/, '')

const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
const config = new qiniu.conf.Config()
config.zone = qiniu.zone.Zone_as0
config.useHttpsDomain = true
const bucketManager = new qiniu.rs.BucketManager(mac, config)

// 生成私有下载签名 URL
function signUrl(key, ttlSeconds = 300) {
  const deadline = Math.floor(Date.now() / 1000) + ttlSeconds
  return bucketManager.privateDownloadUrl(cdnDomain, key, deadline)
}

// HTTPS 获取远程文件内容
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') })
      })
    }).on('error', reject)
  })
}

/**
 * GET /api/updates/latest.yml
 * 从七牛读取 releases/latest.yml，将文件 URL 改写为本代理地址后返回
 */
router.get('/latest.yml', async (_req, res) => {
  try {
    const signedUrl = signUrl('releases/latest.yml', 60)
    // 追加时间戳绕过 CDN 缓存（token 之后额外参数不影响签名校验）
    const { status, body } = await httpGet(signedUrl + '&_t=' + Date.now())

    if (status !== 200) {
      logger.error('updates', 'latest.yml 读取失败', { status })
      return res.status(502).send('latest.yml not available')
    }

    // 改写 YAML 中的文件 URL
    // electron-builder 生成的格式: - url: 北牖 NorthBooker Setup 2.1.2.exe
    const rewritten = body.replace(
      /^(\s*- url:\s*)(.+)$/gm,
      (_match, prefix, fileName) => {
        const encoded = encodeURIComponent(fileName.trim())
        return `${prefix}/api/updates/files/${encoded}`
      },
    )

    res.set('Content-Type', 'text/yaml; charset=utf-8')
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.send(rewritten)
  } catch (err) {
    logger.error('updates', 'latest.yml 代理异常', { error: err.message })
    res.status(502).send('update source unavailable')
  }
})

/**
 * GET /api/updates/files/:key
 * 302 重定向到七牛签名下载 URL
 */
router.get('/files/:key', (req, res) => {
  try {
    const key = `releases/${decodeURIComponent(req.params.key)}`
    const signedUrl = signUrl(key, 3600)
    res.redirect(302, signedUrl)
  } catch (err) {
    logger.error('updates', '文件签名失败', { error: err.message })
    res.status(500).send('sign error')
  }
})

/**
 * GET /api/updates/release-notes.json
 * 返回最新版本的更新公告
 */
router.get('/release-notes.json', (_req, res) => {
  try {
    const signedUrl = signUrl('releases/release-notes.json', 60)
    https.get(signedUrl, { headers: { 'Cache-Control': 'no-cache' } }, (qiniuRes) => {
      const chunks = []
      qiniuRes.on('data', (c) => chunks.push(c))
      qiniuRes.on('end', () => {
        if (qiniuRes.statusCode === 200) {
          res.set('Content-Type', 'application/json; charset=utf-8')
          res.set('Cache-Control', 'no-cache')
          res.send(Buffer.concat(chunks))
        } else {
          res.status(404).json({ error: 'release notes not found' })
        }
      })
    }).on('error', () => res.status(502).json({ error: 'unavailable' }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
