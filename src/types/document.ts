// 文档类型定义
export type FileType = 'pdf' | 'docx' | 'image' | 'text' | 'markdown' | 'other'

export interface Document {
  id: string
  title: string
  fileName: string
  uri: string
  type: FileType
  size: number // 字节数
  updatedAt: string // ISO 时间字符串
  thumbnail?: string
}
