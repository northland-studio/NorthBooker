import { useRef, useState } from 'react'
import { uploadDocument } from '@/api/uploads'
import type { Document } from '@/types/document'
import { getFileTypeLabel, formatSize } from '@/utils/fileType'

// 上传对话框（2.6.5 支持多文件）：拖拽 / 选择多个文件，逐个上传显示总进度
export default function UploadDialog({
  onClose,
  onUploaded,
  folderId,
}: {
  onClose: () => void
  onUploaded: (docs: Document[]) => void
  folderId?: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'recording'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (list: FileList | File[] | null | undefined) => {
    if (!list || list.length === 0) return
    const picked = Array.from(list)
    setFiles((prev) => [...prev, ...picked])
    if (picked.length === 1 && !title) setTitle(picked[0].name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files)
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('请先选择文件')
      return
    }
    setUploading(true)
    setError(null)
    setProgress(0)
    setStage('uploading')
    const uploaded: Document[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        // 仅单文件时允许自定义标题，多文件使用各自文件名
        const doc = await uploadDocument(f, files.length === 1 ? title : undefined, (p) => {
          setProgress(Math.round(((i + p / 100) / files.length) * 100))
          if (p >= 100 && i === files.length - 1) setStage('recording')
        }, folderId)
        uploaded.push(doc)
      }
      onUploaded(uploaded)
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

        {/* 拖拽区（支持多文件） */}
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${files.length > 0 ? 'has-file' : ''}`}
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
            multiple
            hidden
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ''
            }}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp,.svg,.json,.xml"
          />
          {files.length > 0 ? (
            <div className="dropzone-file">
              {files.slice(0, 5).map((f, i) => (
                <div key={`${f.name}-${i}`} className="dropzone-file-row">
                  <span className="dropzone-file-name">
                    {getFileTypeLabel(getExtType(f.name))} · {formatSize(f.size)}
                  </span>
                  <span className="dropzone-file-title">{f.name}</span>
                  {!uploading && (
                    <button
                      className="dropzone-file-remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(i)
                      }}
                      aria-label="移除"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {files.length > 5 && (
                <div className="dropzone-file-meta">等共 {files.length} 个文件</div>
              )}
              <div className="dropzone-file-meta">点击可继续添加文件</div>
            </div>
          ) : (
            <div className="dropzone-hint">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>点击或拖拽文件到此处上传（可多选）</p>
              <span>支持 PDF / Word / 图片 / 文本 / Markdown，最大 100MB</span>
            </div>
          )}
        </div>

        {/* 标题（仅单文件时可用） */}
        {files.length === 1 && (
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
        )}

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
          <button className="btn-primary" onClick={handleSubmit} disabled={uploading || files.length === 0}>
            {uploading ? '上传中...' : `上传${files.length > 1 ? ` ${files.length} 个文件` : ''}`}
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
