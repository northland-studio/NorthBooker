import db from '../database.js'
import { uploadBuffer, getCdnUrl } from './qiniu.js'
import logger from './logger.js'

// 各文件类型对应颜色
const COLORS = {
  pdf: '#e74c3c',
  docx: '#2980b9',
  xlsx: '#27ae60',
  pptx: '#e67e22',
  csv: '#1abc9c',
  image: '#9b59b6',
  text: '#34495e',
  markdown: '#2c3e50',
  other: '#95a5a6',
}

/**
 * 根据文件类型生成 SVG 缩略图
 * @param {string} fileType - 文档类型（pdf / docx / xlsx / pptx / csv / image / text / markdown / other）
 * @returns {Buffer}
 */
export function generateSvgThumbnail(fileType) {
  const color = COLORS[fileType] || COLORS.other
  const label = fileType.toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
  <rect width="300" height="400" fill="#f5f5f5" rx="8"/>
  <rect x="30" y="80" width="240" height="160" fill="${color}" rx="4" opacity="0.15"/>
  <text x="150" y="170" text-anchor="middle" font-family="system-ui,sans-serif" font-size="48" font-weight="bold" fill="${color}">${label}</text>
  <rect x="30" y="280" width="240" height="4" fill="${color}" rx="2" opacity="0.3"/>
  <rect x="30" y="300" width="160" height="4" fill="${color}" rx="2" opacity="0.2"/>
  <rect x="30" y="316" width="200" height="4" fill="${color}" rx="2" opacity="0.2"/>
</svg>`
  return Buffer.from(svg)
}

/**
 * 为指定文档生成并上传缩略图（fire-and-forget）
 * @param {string} docId - 文档 ID
 */
export async function generateAndUploadThumbnail(docId) {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId)
    if (!doc) {
      logger.warn('thumbnail', `文档不存在: ${docId}`)
      return
    }
    // 已有缩略图则跳过
    if (doc.thumbnail) {
      logger.info('thumbnail', `已有缩略图，跳过: ${docId}`)
      return
    }

    const fileType = doc.type || 'other'
    const svg = generateSvgThumbnail(fileType)
    const key = `thumbnails/${docId}.svg`
    await uploadBuffer(key, svg, 'image/svg+xml')
    const cdnUrl = getCdnUrl(key)

    db.prepare('UPDATE documents SET thumbnail = ? WHERE id = ?').run(cdnUrl, docId)
    logger.info('thumbnail', `缩略图已生成: ${docId} (${fileType})`)
  } catch (err) {
    logger.error('thumbnail', `缩略图生成失败: ${docId}`, { error: err.message })
  }
}
