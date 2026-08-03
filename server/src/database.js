import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../data/northbooker.sqlite')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`)

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
  console.log('[北牖] 已初始化示例文档数据')
}

export default db
