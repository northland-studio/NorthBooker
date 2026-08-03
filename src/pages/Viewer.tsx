import { useParams } from 'react-router-dom'
import { DocPreview } from '@doc-preview/react'
import { useThemeStore } from '@/store/theme'

// 示例文档映射（批次3起由后端接口提供）
const DEMO_DOCS: Record<string, { uri: string; fileName: string }> = {
  sample: { uri: '/docs/sample.md', fileName: '北牖使用说明.md' },
}

// 文档查看页
export default function Viewer() {
  const { id } = useParams<{ id: string }>()
  const theme = useThemeStore((s) => s.theme)
  const doc = DEMO_DOCS[id ?? 'sample'] ?? DEMO_DOCS.sample

  return (
    <div className="viewer-page">
      <DocPreview documents={[doc]} dark={theme === 'dark'} />
    </div>
  )
}
