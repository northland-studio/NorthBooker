import { useEffect, useMemo, useState } from 'react'
import { fetchDocuments } from '@/api/documents'
import type { Document, FileType } from '@/types/document'
import DocumentCard from '@/components/DocumentCard'

type FilterType = FileType | 'all'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'image', label: '图片' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: '文本' },
]

// 文档列表页
export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')

  useEffect(() => {
    fetchDocuments().then((d) => {
      setDocs(d)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let list = docs
    if (filter !== 'all') list = list.filter((d) => d.type === filter)
    const kw = keyword.trim()
    if (kw) list = list.filter((d) => d.title.includes(kw))
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh')
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [docs, filter, keyword, sort])

  return (
    <div className="documents-page">
      <div className="documents-toolbar">
        <input
          className="search-input"
          placeholder="搜索文档..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`filter-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'updated' | 'title')}
        >
          <option value="updated">最近更新</option>
          <option value="title">标题排序</option>
        </select>
      </div>

      {loading ? (
        <div className="documents-status">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="documents-status">未找到匹配的文档</div>
      ) : (
        <div className="doc-grid">
          {filtered.map((d) => (
            <DocumentCard key={d.id} doc={d} />
          ))}
        </div>
      )}
    </div>
  )
}
