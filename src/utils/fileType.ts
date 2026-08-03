import type { FileType } from '@/types/document'

// 根据文件名推断文档类型
export function getFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['docx', 'doc', 'docm', 'dotx'].includes(ext)) return 'docx'
  if (['xlsx', 'xls', 'xlsm', 'xltx', 'csv'].includes(ext)) return 'xlsx'
  if (['pptx', 'ppt', 'pptm', 'ppsx'].includes(ext)) return 'pptx'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff'].includes(ext)) return 'image'
  if (['txt', 'log', 'tsv', 'json', 'xml'].includes(ext)) return 'text'
  if (['md', 'markdown'].includes(ext)) return 'markdown'
  return 'other'
}

// 类型显示名
export function getFileTypeLabel(type: FileType): string {
  const map: Record<FileType, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    csv: 'CSV',
    pptx: 'PPT',
    image: '图片',
    text: '文本',
    markdown: 'Markdown',
    other: '其他',
  }
  return map[type]
}

// 格式化文件大小
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 格式化日期（含时分秒）
export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
