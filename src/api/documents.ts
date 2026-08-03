import type { Document } from '@/types/document'
import { getFileType } from '@/utils/fileType'

// 模拟文档数据（批次4起替换为后端接口）
const MOCK_DOCS: Omit<Document, 'type'>[] = [
  {
    id: 'sample',
    title: '北牖使用说明',
    fileName: '北牖使用说明.md',
    uri: '/docs/sample.md',
    size: 1200,
    updatedAt: '2026-08-03T10:00:00Z',
  },
  {
    id: 'architecture',
    title: '系统架构说明',
    fileName: '架构说明.md',
    uri: '/docs/architecture.md',
    size: 980,
    updatedAt: '2026-08-02T15:30:00Z',
  },
  {
    id: 'guide',
    title: '使用指南',
    fileName: '使用指南.md',
    uri: '/docs/guide.md',
    size: 760,
    updatedAt: '2026-08-02T09:20:00Z',
  },
  {
    id: 'intro',
    title: '项目介绍',
    fileName: 'intro.txt',
    uri: '/docs/intro.txt',
    size: 540,
    updatedAt: '2026-08-01T16:00:00Z',
  },
  {
    id: 'about',
    title: '关于北域工作室',
    fileName: '关于北域.md',
    uri: '/docs/about.md',
    size: 620,
    updatedAt: '2026-07-30T11:10:00Z',
  },
  {
    id: 'icon',
    title: '应用图标',
    fileName: '应用图标.png',
    uri: '/icon.png',
    size: 607000,
    updatedAt: '2026-07-28T08:00:00Z',
  },
]

// 获取文档列表（模拟异步）
export async function fetchDocuments(): Promise<Document[]> {
  await new Promise((r) => setTimeout(r, 200))
  return MOCK_DOCS.map((d) => ({ ...d, type: getFileType(d.fileName) }))
}

// 按 id 获取单个文档
export async function fetchDocumentById(id: string): Promise<Document | null> {
  await new Promise((r) => setTimeout(r, 100))
  const found = MOCK_DOCS.find((d) => d.id === id)
  return found ? { ...found, type: getFileType(found.fileName) } : null
}
