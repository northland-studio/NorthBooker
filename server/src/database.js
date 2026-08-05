import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../data/northbooker.sqlite')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = OFF')

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uri TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    thumbnail TEXT,
    owner_id INTEGER,
    visibility TEXT DEFAULT 'public'
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xuanjian_id INTEGER UNIQUE,
    username TEXT NOT NULL,
    avatar TEXT,
    level INTEGER DEFAULT 0,
    contribution INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    UNIQUE(user_id, document_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '无标题文档',
    content TEXT NOT NULL DEFAULT '',
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    author_id INTEGER NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS page_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    author_id INTEGER,
    is_rollback INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    owner_id INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
  );

  -- FTS5 全文搜索（外部内容表，使用 pages 的隐式 rowid 关联）
  CREATE VIRTUAL TABLE IF NOT EXISTS page_fts USING fts5(
    content, title,
    content=pages,
    content_rowid=rowid
  );

  -- 触发器：pages 插入时同步 FTS 索引
  CREATE TRIGGER IF NOT EXISTS page_fts_ai AFTER INSERT ON pages BEGIN
    INSERT INTO page_fts(rowid, content, title) VALUES (new.rowid, new.content, new.title);
  END;

  -- 触发器：pages 删除时同步 FTS 索引
  CREATE TRIGGER IF NOT EXISTS page_fts_ad AFTER DELETE ON pages BEGIN
    INSERT INTO page_fts(page_fts, rowid, content, title) VALUES ('delete', old.rowid, old.content, old.title);
  END;

  -- 触发器：pages 更新时重建 FTS 索引
  CREATE TRIGGER IF NOT EXISTS page_fts_au AFTER UPDATE ON pages BEGIN
    INSERT INTO page_fts(page_fts, rowid, content, title) VALUES ('delete', old.rowid, old.content, old.title);
    INSERT INTO page_fts(rowid, content, title) VALUES (new.rowid, new.content, new.title);
  END;

  CREATE TABLE IF NOT EXISTS share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    doc_id TEXT NOT NULL,
    password_hash TEXT DEFAULT NULL,
    expires_at DATETIME DEFAULT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'document',
    target_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
  );

  -- 在线文档片段批注（仅在线文档 pages）
  CREATE TABLE IF NOT EXISTS page_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    start_pos INTEGER NOT NULL,
    end_pos INTEGER NOT NULL,
    text TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- 管理员审计日志
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

  -- 登录日志
  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    ip TEXT,
    ua TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at);
`)

// 迁移：为已有的 page_fts 重新索引全部 pages（仅当 FTS 表为空时）
try {
  const ftsCount = db.prepare('SELECT COUNT(*) AS c FROM page_fts').get()
  if (ftsCount.c === 0) {
    const allPages = db.prepare('SELECT rowid, title, content FROM pages').all()
    if (allPages.length > 0) {
      const insertFts = db.prepare('INSERT INTO page_fts(rowid, title, content) VALUES (?, ?, ?)')
      const tx = db.transaction((rows) => rows.forEach((r) => insertFts.run(r.rowid, r.title, r.content)))
      tx(allPages)
      logger.info('db', `已为 ${allPages.length} 个页面建立全文索引`)
    }
  }
} catch (e) {
  logger.warn('db', `FTS 索引迁移失败: ${e.message}`)
}

// 迁移：为已有的 pages 表补充 visibility 列（v0.2.0+）
try {
  db.exec('ALTER TABLE pages ADD COLUMN visibility TEXT NOT NULL DEFAULT \'private\'')
  logger.info('db', '已迁移 pages.visibility 列')
} catch {
  // 列已存在则跳过
}

// 迁移：为已有的 documents 表添加 folder_id 列（v0.3.0+）
try {
  db.exec('ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders(id)')
  logger.info('db', '已迁移 documents.folder_id 列')
} catch {
  // 列已存在则跳过
}

// 迁移：documents.tags（标签，逗号分隔）+ deleted_at（软删除，2.6.0+）
try {
  db.exec("ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
  logger.info('db', '已迁移 documents.tags 列')
} catch {
  // 列已存在则跳过
}
try {
  db.exec('ALTER TABLE documents ADD COLUMN deleted_at TEXT')
  logger.info('db', '已迁移 documents.deleted_at 列')
} catch {
  // 列已存在则跳过
}
// 迁移：pages.tags（标签，2.6.0+）
try {
  db.exec("ALTER TABLE pages ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
  logger.info('db', '已迁移 pages.tags 列')
} catch {
  // 列已存在则跳过
}
// 迁移：users.email（订阅邮件通知，2.6.0+）
try {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT')
  logger.info('db', '已迁移 users.email 列')
} catch {
  // 列已存在则跳过
}

// 初始化示例文档（仅当文档表为空时执行）
const count = db.prepare('SELECT COUNT(*) AS c FROM documents').get()
if (count.c === 0) {
  const insert = db.prepare(
    `INSERT INTO documents (id, title, file_name, uri, type, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const seed = [
    ['sample', '北牖使用说明', '北牖使用说明.md', '/docs/sample.md', 'markdown', 1200, '2026-08-03T10:00:00Z'],
    ['architecture', '系统架构说明', '架构说明.md', '/docs/architecture.md', 'markdown', 980, '2026-08-02T15:30:00Z'],
    ['guide', '使用指南', '使用指南.md', '/docs/guide.md', 'markdown', 760, '2026-08-02T09:20:00Z'],
    ['intro', '项目介绍', 'intro.txt', '/docs/intro.txt', 'text', 540, '2026-08-01T16:00:00Z'],
    ['about', '关于北域工作室', '关于北域.md', '/docs/about.md', 'markdown', 620, '2026-07-30T11:10:00Z'],
    ['icon', '应用图标', '应用图标.png', '/icon.png', 'image', 607000, '2026-07-28T08:00:00Z'],
  ]
  const tx = db.transaction((rows) => rows.forEach((r) => insert.run(...r)))
  tx(seed)
  logger.info('db', '已初始化示例文档数据')
}

export default db
