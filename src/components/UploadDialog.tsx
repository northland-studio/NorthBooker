import { useRef, useState } from 'react'
import { uploadDocument } from '@/api/uploads'
import type { Document } from '@/types/document'
import { getFileTypeLabel, formatSize } from '@/utils/fileType'

// 上传对话框：拖拽 / 选择文件，显示进度
export default function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void
  onUploaded: (doc: Document) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'recording'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (f: File | null | undefined) => {
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0])
  }

  const handleSubmit = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }
    setUploading(true)
    setError(null)
    setProgress(0)
    setStage('uploading')
    try {
      const doc = await uploadDocument(file, title, (p) => {
        setProgress(p)
        if (p >= 100) setStage('recording')
      })
      onUploaded(doc)
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || '上传失败')
    } finally {
      setUploading(false)
      setStage('idle')
    }
  }

  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>上传文档</h3>
          <button className="dialog-close" onClick={onClose} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 拖拽区 */}
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
            accept=".pdf,.docx,.doc,.txt,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp,.svg,.csv,.json,.xml"
          />
          {file ? (
            <div className="dropzone-file">
              <div className="dropzone-file-name">{file.name}</div>
              <div className="dropzone-file-meta">
                {getFileTypeLabel(getExtType(file.name))} · {formatSize(file.size)}
              </div>
            </div>
          ) : (
            <div className="dropzone-hint">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>点击或拖拽文件到此处上传</p>
              <span>支持 PDF / Word / 图片 / 文本 / Markdown，最大 100MB</span>
            </div>
          )}
        </div>

        {/* 标题 */}
        <label className="form-label">
          标题
          <input
            className="form-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="留空则使用文件名"
          />
        </label>

        {/* 进度 */}
        {uploading && (
          <div className="upload-progress">
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            <span className="upload-progress-text">
              {stage === 'recording' ? '记录中...' : `${progress}%`}
            </span>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose} disabled={uploading}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={uploading || !file}>
            {uploading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getExtType(fileName: string): import('@/types/document').FileType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['docx', 'doc', 'docm', 'dotx'].includes(ext)) return 'docx'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff'].includes(ext)) return 'image'
  if (['txt', 'log', 'csv', 'tsv', 'json', 'xml'].includes(ext)) return 'text'
  if (['md', 'markdown'].includes(ext)) return 'markdown'
  return 'other'
}
