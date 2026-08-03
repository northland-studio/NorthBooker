// 文档类型定义
export type FileType = 'pdf' | 'docx' | 'image' | 'text' | 'markdown' | 'csv' | 'xlsx' | 'pptx' | 'other'

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

export interface Comment {
  id: number
  documentId: string
  userId: number
  username: string
  avatar: string | null
  level: number
  content: string
  createdAt: string
}
