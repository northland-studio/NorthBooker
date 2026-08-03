import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DocPreview } from '@doc-preview/react'
import { useThemeStore } from '@/store/theme'
import { fetchDocumentById } from '@/api/documents'
import type { Document } from '@/types/document'

// 文档查看页
export default function Viewer() {
  const { id } = useParams<{ id: string }>()
  const theme = useThemeStore((s) => s.theme)
  const [doc, setDoc] = useState<Document | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setDoc(null)
    setError(false)
    fetchDocumentById(id ?? '').then((d) => {
      if (d) setDoc(d)
      else setError(true)
    })
  }, [id])

  if (error) return <div className="viewer-status">文档不存在</div>
  if (!doc) return <div className="viewer-status">加载中...</div>

  return (
    <div className="viewer-page">
      <DocPreview documents={[{ uri: doc.uri, fileName: doc.fileName }]} dark={theme === 'dark'} />
    </div>
  )
}
