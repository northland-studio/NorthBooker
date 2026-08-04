import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import LinkExtension from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import ImageExt from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { fetchPage, updatePage, fetchPageVersions, restorePageVersion } from '@/api/pages'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { formatDate } from '@/utils/fileType'
import DocSearch from '@/components/DocSearch'
import ShareDialog from '@/components/ShareDialog'
import CommentPanel from '@/components/CommentPanel'

interface TocItem {
  level: number
  text: string
  id: string
}

interface PageVersion {
  id: number
  version: number
  content: string
  createdAt: string
  authorName: string
  authorAvatar?: string | null
  isRollback?: boolean
}

// 在线文档编辑器
export default function PageEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const theme = useThemeStore((s) => s.theme)
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorId, setAuthorId] = useState<number>(0)
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null)
  const [visibility, setVisibility] = useState('private')
  const [createdAt, setCreatedAt] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoreConfirmId, setRestoreConfirmId] = useState<number | null>(null)
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'synthesizing' | 'playing'>('idle')
  const [ttsProgress, setTtsProgress] = useState(0)
  const [ttsTotal, setTtsTotal] = useState(0)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const electronAPI = (window as any).electronAPI
  const isApp = !!electronAPI?.isElectron
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioQueueRef = useRef<string[]>([])
  const playingRef = useRef(false)
  const stopRef = useRef(false)
  const synthDoneRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  // 用 ref 解决 useCallback 闭包陷阱：scheduleSave（空依赖）调用的 doSave 需要最新的状态
  const titleRef = useRef(title)
  titleRef.current = title
  const doSaveRef = useRef<(() => Promise<void>) | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: '输入内容...' }),
      Underline,
      LinkExtension.configure({ openOnClick: false }),
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ImageExt.configure({ inline: true, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    onUpdate: ({ editor: ed }) => {
      scheduleSave()
      // 更新目录
      const items: TocItem[] = []
      ed.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          items.push({
            level: node.attrs.level,
            text: node.textContent,
            id: `toc-h-${items.length}`,
          })
        }
      })
      setToc(items)
    },
    editorProps: {
      attributes: {
        class: 'page-editor-content prose',
      },
    },
  })

  // 判断是否有编辑权限
  const canEdit = useMemo(() => {
    if (!user) return false
    if ((user.level ?? 0) >= 1) return true
    if (authorId > 0 && user.id === authorId) return true
    return false
  }, [user, authorId])

  // 非编辑者禁止编辑 ProseMirror
  useEffect(() => {
    if (editor) {
      editor.setEditable(canEdit)
    }
  }, [editor, canEdit])

  // 判断是否为作者（用于显示可见性开关）
  const isAuthor = useMemo(() => {
    if (!user) return false
    return authorId > 0 && user.id === authorId
  }, [user, authorId])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSaveRef.current?.(), 1500)
  }, [])

  const doSave = useCallback(async () => {
    if (!id || !canEdit || !editor) return
    setSaving(true)
    try {
      await updatePage(id, {
        title: titleRef.current || '无标题文档',
        content: editor.getHTML(),
      })
      setUpdatedAt(new Date().toISOString())
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }, [id, editor, canEdit])
  doSaveRef.current = doSave

  // Ctrl+S 手动保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (id && canEdit && editor) {
          clearTimeout(saveTimer.current)
          setSaving(true)
          updatePage(id, {
            title: titleRef.current || '无标题文档',
            content: editor.getHTML(),
          })
            .then(() => { setSaving(false); setUpdatedAt(new Date().toISOString()) })
            .catch(() => setSaving(false))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [id, editor, canEdit])

  // 加载页面
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    fetchPage(id)
      .then((page) => {
        setTitle(page.title)
        setAuthorName(page.authorName || page.author_name)
        setAuthorId(page.authorId ?? page.author_id)
        setAuthorAvatar(page.authorAvatar || page.author_avatar)
        setVisibility(page.visibility ?? 'private')
        setCreatedAt(page.createdAt ?? page.created_at)
        setUpdatedAt(page.updatedAt ?? page.updated_at)
        if (editor) {
          editor.commands.setContent(page.content || '')
        }
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [id, editor])

  const handleTitleChange = (val: string) => {
    setTitle(val)
    scheduleSave()
  }

  const toggleVisibility = async () => {
    const newVis = visibility === 'public' ? 'private' : 'public'
    setVisibility(newVis)
    try {
      await updatePage(id!, { visibility: newVis })
    } catch {
      setVisibility(visibility)
    }
  }

  const loadVersions = async () => {
    if (!id) return
    setVersionsLoading(true)
    try {
      const data = await fetchPageVersions(id)
      const list = data.versions || data || []
      // 映射后端蛇形命名到前端驼峰命名
      setVersions(list.map((v: any) => ({
        ...v,
        authorName: v.authorName || v.author_name || '未知用户',
        createdAt: v.createdAt || v.created_at || '',
      })))
    } catch {
      setVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleRestore = async (versionId: number) => {
    if (!id) return
    setRestoreConfirmId(null)
    setSaving(true)
    try {
      await restorePageVersion(id, versionId)
      const page = await fetchPage(id)
      setTitle(page.title)
      setUpdatedAt(page.updatedAt ?? page.updated_at)
      if (editor) {
        editor.commands.setContent(page.content || '')
      }
      setShowVersions(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // 加载 TTS 配置（仅应用版）
  useEffect(() => {
    if (!isApp || !electronAPI) return
    electronAPI.getSettings().then((s: any) => {
      if (s?.tts) setTtsEnabled(s.tts.enabled !== false)
    })
    // 流式分段：收到合成段落即入队播放
    electronAPI.onTtsChunk?.((chunk: { index: number; wav?: string; error?: string }) => {
      if (stopRef.current || !chunk.wav) return
      audioQueueRef.current.push(chunk.wav)
      if (!playingRef.current) playNextRef.current()
    })
    // 合成状态
    electronAPI.onTtsState?.((s: { type: string; done?: number; total?: number }) => {
      if (s.type === 'start') {
        setTtsStatus('synthesizing')
        setTtsProgress(0)
        setTtsTotal(s.total || 0)
      } else if (s.type === 'progress') {
        setTtsProgress(s.done || 0)
      } else if (s.type === 'done') {
        synthDoneRef.current = true
        if (!playingRef.current) { setTtsStatus('idle'); setTtsProgress(0) }
      } else if (s.type === 'stopped') {
        setTtsStatus('idle')
        setTtsProgress(0)
      }
    })
    electronAPI.onTtsError?.((e: { error: string }) => {
      console.error('TTS 错误:', e.error)
      stopTTSRef.current()
    })
  }, [isApp])

  // 逐段播放队列
  const playNext = useCallback(async () => {
    if (stopRef.current) return
    const wav = audioQueueRef.current.shift()
    if (!wav) {
      playingRef.current = false
      if (synthDoneRef.current) { setTtsStatus('idle'); setTtsProgress(0) }
      return
    }
    playingRef.current = true
    setTtsStatus('playing')
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      await ctx.resume()
      const buf = await ctx.decodeAudioData(base64ToArrayBuffer(wav))
      const source = ctx.createBufferSource()
      source.buffer = buf
      source.connect(ctx.destination)
      ttsSourceRef.current = source
      source.onended = () => { playNext() }
      source.start()
    } catch {
      playNext()
    }
  }, [])

  // TTS 停止朗读
  const stopTTS = useCallback(() => {
    stopRef.current = true
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    try { ttsSourceRef.current?.stop() } catch {}
    ttsSourceRef.current = null
    audioQueueRef.current = []
    playingRef.current = false
    synthDoneRef.current = false
    electronAPI?.ttsStop?.()
    setTtsStatus('idle')
    setTtsProgress(0)
  }, [])

  const playNextRef = useRef(playNext)
  playNextRef.current = playNext
  const stopTTSRef = useRef(stopTTS)
  stopTTSRef.current = stopTTS

  // 组件卸载时停止朗读
  useEffect(() => () => stopTTS(), [stopTTS])

  const base64ToArrayBuffer = (b64: string) => {
    const bin = atob(b64)
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    return buf.buffer
  }

  // TTS 朗读文档（从光标位置开始读，流式分段合成）
  const handleTTS = async () => {
    if (ttsStatus !== 'idle') { stopTTS(); return }
    if (!editor) return
    const from = editor.state.selection.from
    const text = editor.state.doc.textBetween(from, editor.state.doc.content.size, '\n')
    if (!text.trim()) return
    let ttsCfg = { enabled: true, speed: 0.9, model: 'edge' }
    if (isApp && electronAPI) {
      const s = await electronAPI.getSettings()
      ttsCfg = { ...ttsCfg, ...(s?.tts || {}) }
    }
    // sherpa-onnx 流式分段合成（worker 线程池预合成）
    if (isApp && ttsCfg.model !== 'edge') {
      stopRef.current = false
      audioQueueRef.current = []
      playingRef.current = false
      synthDoneRef.current = false
      setTtsStatus('synthesizing')
      setTtsProgress(0)
      await electronAPI.ttsStart({
        text,
        model: ttsCfg.model,
        speed: Number(ttsCfg.speed) || 1.0,
      })
      return
    }
    // Web Speech API（Edge 内置）
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = Number(ttsCfg.speed) || 0.9
    utterance.onend = () => setTtsStatus('idle')
    utterance.onerror = () => setTtsStatus('idle')
    setTtsStatus('playing')
    window.speechSynthesis.speak(utterance)
  }

  if (error) {
    return (
      <div className="viewer-status-wrap">
        <div className="viewer-status-card">
          <h2>文档不存在</h2>
          <p>该文档可能已被删除或无权查看</p>
          <button className="btn-primary" onClick={() => navigate('/pages')}>
            返回列表
          </button>
        </div>
      </div>
    )
  }

  if (loading || !editor) {
    return <div className="viewer-status">加载中...</div>
  }

  return (
    <div className="page-editor-page">
      <div className="page-editor-toolbar">
        <button className="viewer-back" onClick={() => navigate('/pages')} aria-label="返回">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回
        </button>
        <div className="page-editor-info">
          {authorAvatar && (
            <img className="page-editor-avatar" src={authorAvatar} alt={authorName} />
          )}
          <span className="page-editor-author">{authorName}</span>
          {createdAt && (
            <span className="page-editor-time">创建于 {formatDate(createdAt)}</span>
          )}
          <span className="page-editor-time">更新于 {formatDate(updatedAt)}</span>
          <button className={`pe-share-btn ${copied ? 'pe-share-btn--copied' : ''}`} onClick={handleShare} title="复制链接">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {copied ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </>
              )}
            </svg>
          </button>
          <button
            className="pe-share-btn"
            onClick={() => setShowShare(true)}
            title="生成分享链接"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            className={`pe-share-btn ${showSearch ? 'pe-btn--active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
            title="搜索"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          {saving && <span className="page-editor-saving">保存中...</span>}
        </div>

        {/* TTS 朗读按钮（仅应用版可见） */}
        {isApp && ttsEnabled && (
          <button
            className={`pe-btn ${ttsStatus !== 'idle' ? 'pe-btn--active' : ''}`}
            onClick={handleTTS}
            title={ttsStatus === 'synthesizing' ? `合成中 ${ttsProgress}/${ttsTotal}` : ttsStatus === 'playing' ? '停止朗读' : '朗读文档'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {ttsStatus !== 'idle' ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </>
              )}
            </svg>
          </button>
        )}

        {/* 版本历史按钮 */}
        <button
          className={`pe-btn ${showVersions ? 'pe-btn--active' : ''}`}
          onClick={() => {
            if (!showVersions) loadVersions()
            setShowVersions(!showVersions)
          }}
          title="版本历史"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>

        {/* 可见性切换（仅作者可见） */}
        {isAuthor && (
          <button className={`pe-vis-toggle ${visibility === 'public' ? 'pe-vis-public' : ''}`} onClick={toggleVisibility} title="切换可见性">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {visibility === 'public' ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
            {visibility === 'public' ? '公开' : '私有'}
          </button>
        )}

        {/* 目录按钮 */}
        <button
          className={`pe-btn pe-toc-btn ${showToc ? 'pe-btn--active' : ''}`}
          onClick={() => setShowToc(!showToc)}
          title="目录"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>

        {canEdit && (
          <PageEditorMenu editor={editor} />
        )}
      </div>

      {showSearch && <DocSearch editor={editor} />}

      <div className={`page-editor-body ${theme === 'dark' ? 'page-editor-body--dark' : ''}`}>
        {showToc && toc.length > 0 && (
          <aside className="page-editor-toc">
            <div className="toc-title">目录</div>
            {toc.map((item, i) => (
              <a
                key={i}
                className={`toc-item toc-item--h${item.level}`}
                onClick={() => {
                  const el = document.querySelector(
                    `.page-editor-main h${item.level}:nth-of-type(${toc.slice(0, i + 1).filter((t) => t.level === item.level).length})`,
                  )
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {item.text}
              </a>
            ))}
          </aside>
        )}
        <div className="page-editor-main">
          <input
            className="page-editor-title-input"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="无标题文档"
            readOnly={!canEdit}
          />
          <div className={`page-editor-wrapper ${!canEdit ? 'page-editor-wrapper--readonly' : ''}`}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* 评论悬浮按钮 */}
      {id && (
        <>
          <button
            className={`comment-fab ${showComments ? 'comment-fab--active' : ''}`}
            onClick={() => setShowComments(!showComments)}
            title="评论"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <CommentPanel
            docId={id}
            open={showComments}
            onClose={() => setShowComments(false)}
          />
        </>
      )}

      {/* 版本历史面板 */}
      {showVersions && <div className="comment-overlay" onClick={() => { setShowVersions(false); setRestoreConfirmId(null) }} />}
      <div className={`comment-panel version-panel ${showVersions ? 'comment-panel--open' : ''}`}>
        <div className="comment-panel-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            版本历史
          </h3>
          <button className="comment-panel-close" onClick={() => { setShowVersions(false); setRestoreConfirmId(null) }} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="comment-panel-body">
          <div className="comment-list">
            {versionsLoading ? (
              <div className="comment-empty">加载中...</div>
            ) : versions.length === 0 ? (
              <div className="comment-empty">暂无版本历史</div>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="version-item">
                  <div className="version-info">
                    <div className="version-header">
                      <span className="version-number">版本 {v.version}</span>
                      {v.isRollback && <span className="version-rollback-badge">已恢复</span>}
                    </div>
                    <div className="version-meta">
                      <span className="version-author">{v.authorName || '未知用户'}</span>
                      <span className="comment-time">{formatDate(v.createdAt)}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="version-actions">
                      {restoreConfirmId === v.id ? (
                        <div className="version-confirm">
                          <span className="version-confirm-text">确认恢复到此版本？</span>
                          <button
                            className="version-confirm-btn version-confirm-btn--yes"
                            onClick={() => handleRestore(v.id)}
                          >
                            确认
                          </button>
                          <button
                            className="version-confirm-btn"
                            onClick={() => setRestoreConfirmId(null)}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          className="version-restore-btn"
                          onClick={() => setRestoreConfirmId(v.id)}
                        >
                          恢复到此版本
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showShare && id && <ShareDialog docId={id} onClose={() => setShowShare(false)} />}
    </div>
  )
}

// 编辑器工具栏
function PageEditorMenu({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const btn = (action: () => void, active: boolean, title: string, children: React.ReactNode) => (
    <button
      type="button"
      className={`pe-btn ${active ? 'pe-btn--active' : ''}`}
      onClick={action}
      title={title}
    >
      {children}
    </button>
  )

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const deleteTable = () => {
    editor.chain().focus().deleteTable().run()
  }

  const addLink = () => {
    const url = prompt('输入链接地址：')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <div className="pe-toolbar">
      {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), '加粗',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), '斜体',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), '下划线',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), '删除线',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><path d="M12 10V8a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2"/><path d="M12 14v2a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-2"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleHighlight().run(), editor.isActive('highlight'), '高亮',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4 4 1.42-1.4a3.5 3.5 0 0 0 0-5 3.5 3.5 0 0 0-5 0L13 11"/></svg>
      )}
      <span className="pe-sep" />
      {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), '标题1',
        <span style={{ fontWeight: 700, fontSize: 14 }}>H1</span>
      )}
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), '标题2',
        <span style={{ fontWeight: 700, fontSize: 13 }}>H2</span>
      )}
      {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), '标题3',
        <span style={{ fontWeight: 700, fontSize: 12 }}>H3</span>
      )}
      <span className="pe-sep" />
      {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), '无序列表',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), '有序列表',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4l2-3"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'), '任务列表',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      )}
      <span className="pe-sep" />
      {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), '引用',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
      )}
      {btn(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'), '代码块',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      )}
      {btn(addTable, editor.isActive('table'), '插入表格',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      )}
      {editor.isActive('table') && btn(deleteTable, false, '删除表格',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      )}
      {btn(addLink, editor.isActive('link'), '链接',
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      )}
    </div>
  )
}
