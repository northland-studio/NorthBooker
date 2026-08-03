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
import { fetchPage, updatePage } from '@/api/pages'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { formatDate } from '@/utils/fileType'

interface TocItem {
  level: number
  text: string
  id: string
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
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  // 用 ref 解决 useCallback 闭包陷阱：scheduleSave（空依赖）调用的 doSave 需要最新的 title
  const titleRef = useRef(title)
  titleRef.current = title

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
    saveTimer.current = setTimeout(() => doSave(), 1500)
  }, [])

  const doSave = useCallback(async () => {
    if (!id || !editor || !canEdit) return
    setSaving(true)
    try {
      await updatePage(id, {
        title: titleRef.current || '无标题文档',
        content: editor.getHTML(),
      })
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }, [id, editor, canEdit])

  // Ctrl+S 手动保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (id && editor && canEdit) {
          clearTimeout(saveTimer.current)
          setSaving(true)
          updatePage(id, {
            title: titleRef.current || '无标题文档',
            content: editor.getHTML(),
          })
            .then(() => setSaving(false))
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
          {saving && <span className="page-editor-saving">保存中...</span>}
        </div>

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
