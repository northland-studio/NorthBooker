import type { FileType } from '@/types/document'

// 文件类型图标（SVG），颜色随类型变化
const TYPE_COLOR: Record<FileType, string> = {
  pdf: '#e53935',
  docx: '#1976d2',
  xlsx: '#2e7d32',
  csv: '#2e7d32',
  pptx: '#e65100',
  image: '#7e57c2',
  text: '#546e7a',
  markdown: '#004aad',
  other: '#9e9e9e',
}

export default function FileTypeIcon({ type, size = 48 }: { type: FileType; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={TYPE_COLOR[type]}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
