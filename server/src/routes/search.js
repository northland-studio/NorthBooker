import { Router } from 'express'
import db from '../database.js'
import { optionalAuthMiddleware } from '../middleware/auth.js'

const router = Router()

/**
 * 清理 FTS5 查询字符串，移除可能引发语法错误的特殊字符。
 * 保留：字母、数字、中文、日文假名、空格。
 */
function sanitizeFtsQuery(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/[^\w\s\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * GET /api/search?q=keyword
 * 全文搜索 pages（FTS5）和 documents（LIKE），按可见性过滤。
 */
router.get('/', optionalAuthMiddleware, (req, res) => {
  const rawQ = req.query.q || ''
  const sanitized = sanitizeFtsQuery(rawQ)
  const results = []

  // === FTS5 搜索 pages ===
  if (sanitized) {
    try {
      let pageSql, pageParams
      if (req.user) {
        // 已登录：匹配公开页 + 自己的私有页
        pageSql = `
          SELECT 'page' AS type, pages.id, pages.title,
                 snippet(page_fts, 1, '<mark>', '</mark>', '...', 32) AS snippet,
                 rank
          FROM page_fts
          JOIN pages ON page_fts.rowid = pages.rowid
          WHERE page_fts MATCH ?
            AND (pages.visibility = 'public' OR pages.author_id = ?)
          ORDER BY rank
          LIMIT 20
        `
        pageParams = [sanitized, req.user.id]
      } else {
        // 未登录：仅匹配公开页
        pageSql = `
          SELECT 'page' AS type, pages.id, pages.title,
                 snippet(page_fts, 1, '<mark>', '</mark>', '...', 32) AS snippet,
                 rank
          FROM page_fts
          JOIN pages ON page_fts.rowid = pages.rowid
          WHERE page_fts MATCH ?
            AND pages.visibility = 'public'
          ORDER BY rank
          LIMIT 20
        `
        pageParams = [sanitized]
      }
      const pageRows = db.prepare(pageSql).all(...pageParams)
      results.push(...pageRows)
    } catch (e) {
      // FTS5 MATCH 语法错误时静默降级，不中断整体搜索
      // 例如用户输入了纯标点符号等无法匹配的内容
    }
  }

  // === LIKE 搜索 documents（文件名 / 标题模糊匹配）===
  if (rawQ) {
    const likePattern = `%${rawQ}%`
    let docSql, docParams
    if (req.user) {
      docSql = `
        SELECT 'file' AS type, id, title, file_name AS snippet, updated_at AS score
        FROM documents
        WHERE (title LIKE ? OR file_name LIKE ?)
          AND (visibility = 'public' OR owner_id = ?)
        ORDER BY updated_at DESC
        LIMIT 10
      `
      docParams = [likePattern, likePattern, req.user.id]
    } else {
      docSql = `
        SELECT 'file' AS type, id, title, file_name AS snippet, updated_at AS score
        FROM documents
        WHERE (title LIKE ? OR file_name LIKE ?)
          AND visibility = 'public'
        ORDER BY updated_at DESC
        LIMIT 10
      `
      docParams = [likePattern, likePattern]
    }
    const docRows = db.prepare(docSql).all(...docParams)
    // 给文档结果附加一个较大的 rank 值（排在 FTS 结果之后），并将 snippet 包装为高亮
    const docResults = docRows.map((r) => ({
      type: r.type,
      id: r.id,
      title: r.title,
      snippet: highlightKeyword(r.snippet || '', rawQ),
      score: 999999, // 排在 FTS 精确结果之后
    }))
    results.push(...docResults)
  }

  res.json(results)
})

/**
 * 在文本中对关键词做简单高亮包装。
 */
function highlightKeyword(text, keyword) {
  if (!keyword || !text) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

export default router
