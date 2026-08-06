import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
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
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { fetchPage, updatePage, fetchPageVersions, restorePageVersion } from '@/api/pages'
import { fetchSubscriptions, subscribe, unsubscribe } from '@/api/subscriptions'
import { fetchAnnotations, addAnnotation, deleteAnnotation, type Annotation } from '@/api/annotations'
import { useAuthStore } from '@/store/auth'
import { isAdmin } from '@/types/user'
import { useT } from '@/i18n'
import { useThemeStore } from '@/store/theme'
import { formatDate } from '@/utils/fileType'
import { siteUrl } from '@/utils/site'
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

// ===== TTS 朗读高亮工具（与 electron/tts.js 切分规则保持一致） =====
// 按句号/逗号/分号/换行切分文本为段落（每段约 20~200 字），返回段落文本及在原文中的起始偏移
function splitTextSegments(text: string): { text: string; start: number }[] {
  const segments: { text: string; start: number }[] = []
  let cur = ''
  let curStart = 0
  let i = 0
  for (const ch of String(text || '')) {
    if (!cur) curStart = i
    cur += ch
    if (/[。！？；，、\n]/.test(ch) && cur.trim().length >= 20) {
      segments.push({ text: cur.trim(), start: curStart })
      cur = ''
    } else if (cur.trim().length >= 200) {
      segments.push({ text: cur.trim(), start: curStart })
      cur = ''
    }
    i++
  }
  if (cur.trim()) segments.push({ text: cur.trim(), start: curStart })
  return segments.filter((s) => s.text.length > 0)
}

// ===== 版本对比工具（HTML → 纯文本 → 行级 LCS diff + 字符级差异） =====
type DiffLineType = 'same' | 'add' | 'del' | 'mod'
interface DiffSegment { type: 'same' | 'add' | 'del'; text: string }
interface DiffLine { type: DiffLineType; text: string; segments?: DiffSegment[] }

// HTML 转纯文本（块级标签间插入换行，保证按段落分行，与文档块节点一一对应）
function htmlToText(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = (html || '').replace(/<\/(p|div|li|blockquote|h[1-6]|tr|pre)>/gi, '</$1>\n')
  return (tmp.textContent || '').replace(/\u00a0/g, ' ')
}

// 字符级 diff：公共前后缀 + 中间差异段（用于修改行精确统计与渲染）
function charDiffSegments(oldText: string, newText: string): DiffSegment[] {
  const a = oldText
  const b = newText
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++
  const segs: DiffSegment[] = []
  if (pre > 0) segs.push({ type: 'same', text: a.slice(0, pre) })
  const aMid = a.slice(pre, a.length - suf)
  const bMid = b.slice(pre, b.length - suf)
  if (aMid) segs.push({ type: 'del', text: aMid })
  if (bMid) segs.push({ type: 'add', text: bMid })
  if (suf > 0) segs.push({ type: 'same', text: a.slice(a.length - suf) })
  return segs
}

// 行级 LCS diff：相邻 del+add 块按 min 对数配对为 mod（修改），mod 行附字符级差异
function diffTextLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n').filter((l) => l.trim() !== '')
  const b = newText.split('\n').filter((l) => l.trim() !== '')
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] })
      i++
    } else {
      out.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) { out.push({ type: 'del', text: a[i] }); i++ }
  while (j < m) { out.push({ type: 'add', text: b[j] }); j++ }

  // 相邻 del+add 块配对为 mod（取 min 对数），mod 行计算字符级差异
  const merged: DiffLine[] = []
  for (let k = 0; k < out.length; k++) {
    const cur = out[k]
    if ((cur.type === 'del' || cur.type === 'add') && k + 1 < out.length) {
      const blockDel: string[] = []
      const blockAdd: string[] = []
      let t = k
      while (t < out.length && out[t].type === 'del') { blockDel.push(out[t].text); t++ }
      while (t < out.length && out[t].type === 'add') { blockAdd.push(out[t].text); t++ }
      const pairs = Math.min(blockDel.length, blockAdd.length)
      for (let x = 0; x < pairs; x++) {
        merged.push({
          type: 'mod',
          text: blockAdd[x],
          segments: charDiffSegments(blockDel[x], blockAdd[x]),
        })
      }
      for (let x = pairs; x < blockDel.length; x++) merged.push({ type: 'del', text: blockDel[x] })
      for (let x = pairs; x < blockAdd.length; x++) merged.push({ type: 'add', text: blockAdd[x] })
      k = t - 1
      continue
    }
    merged.push(cur)
  }
  return merged
}

// 判断文本是否含足够中文（与主进程 hasChinese 一致）
function hasChineseText(text: string): boolean {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return zh >= 10 || zh / Math.max(text.length, 1) >= 0.2
}

// 模拟 prosemirror textBetween(blockSeparator='\n') 遍历 doc，
// 返回拼接文本与每个字符的 { offset → pos } 映射（块分隔符映射到块起始 pos）
function buildTextMap(doc: any, from: number, to: number): { text: string; map: { off: number; pos: number }[] } {
  const map: { off: number; pos: number }[] = []
  let text = ''
  let separated = true
  const sep = '\n'
  doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.isText) {
      const t = node.text || ''
      for (let i = 0; i < t.length; i++) {
        map.push({ off: text.length, pos: pos + i })
        text += t[i]
      }
      separated = false
    } else if (node.isBlock && !separated) {
      map.push({ off: text.length, pos })
      text += sep
      separated = true
    }
    return true
  })
  return { text, map }
}

// 将段落 [start, end)（textBetween 文本偏移）映射为文档 pos 范围
function segmentToPosRange(map: { off: number; pos: number }[], start: number, end: number): { from: number; to: number } | null {
  let from: number | null = null
  let to: number | null = null
  for (const item of map) {
    if (item.off >= start && from === null) from = item.pos
    if (item.off >= end && to === null) to = item.pos + 1
    if (from !== null && to !== null) break
  }
  if (from === null) from = map[0]?.pos ?? 0
  if (to === null) to = (map[map.length - 1]?.pos ?? from) + 1
  return { from, to }
}

// ===== TTS 朗读高亮 Decoration 插件（模块级状态，供所有编辑器实例共享） =====
// 高亮当前朗读段落：inline decoration 不能跨文本块，故按文本节点拆分为多个
let ttsHighlightRanges: { from: number; to: number }[] = []

const ttsHighlightPlugin = new Plugin({
  key: new PluginKey('ttsHighlight'),
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      if (tr.getMeta('ttsHighlight') !== undefined) {
        if (!ttsHighlightRanges.length) return DecorationSet.empty
        const decos: Decoration[] = []
        for (const r of ttsHighlightRanges) {
          tr.doc.nodesBetween(r.from, r.to, (node: any, pos: number) => {
            if (!node.isText) return true
            const nFrom = Math.max(r.from, pos)
            const nTo = Math.min(r.to, pos + node.nodeSize)
            if (nTo > nFrom) decos.push(Decoration.inline(nFrom, nTo, { class: 'tts-reading-highlight' }))
            return true
          })
        }
        return DecorationSet.create(tr.doc, decos)
      }
      return set.map(tr.mapping, tr.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
})

const ttsHighlightExtension = Extension.create({
  name: 'ttsHighlight',
  addProseMirrorPlugins() {
    return [ttsHighlightPlugin]
  },
})

// ===== 版本对比高亮 Decoration 插件（模块级状态，类 TTS 朗读高亮） =====
// 新增（绿）/ 修改（黄）用 inline decoration；被删去的内容以红色删除线 widget 加载进正文
// widget 分两类：inline（修改行内的被删片段，紧贴新内容前）与 block（整段被删的段落）
let diffHighlightData: {
  ranges: { from: number; to: number; type: 'add' | 'mod' }[]
  widgets: { pos: number; text: string; inline: boolean }[]
} = { ranges: [], widgets: [] }

const diffHighlightPlugin = new Plugin({
  key: new PluginKey('diffHighlight'),
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      if (tr.getMeta('diffHighlight') !== undefined) {
        if (!diffHighlightData.ranges.length && !diffHighlightData.widgets.length) return DecorationSet.empty
        const decos: Decoration[] = []
        for (const r of diffHighlightData.ranges) {
          tr.doc.nodesBetween(r.from, r.to, (node: any, pos: number) => {
            if (!node.isText) return true
            const nFrom = Math.max(r.from, pos)
            const nTo = Math.min(r.to, pos + node.nodeSize)
            if (nTo > nFrom) {
              decos.push(Decoration.inline(nFrom, nTo, { class: r.type === 'add' ? 'diff-read-add' : 'diff-read-mod' }))
            }
            return true
          })
        }
        for (const w of diffHighlightData.widgets) {
          decos.push(
            Decoration.widget(w.pos, () => {
              const el = document.createElement(w.inline ? 'span' : 'div')
              el.className = w.inline ? 'vdl-del-inline' : 'vdl-del-widget'
              el.textContent = w.text
              return el
            }, { side: -1 }),
          )
        }
        return DecorationSet.create(tr.doc, decos)
      }
      return set.map(tr.mapping, tr.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
})

const diffHighlightExtension = Extension.create({
  name: 'diffHighlight',
  addProseMirrorPlugins() {
    return [diffHighlightPlugin]
  },
})

// 将 diff 行映射到文档：
// - 新增行 → 整行绿色 inline 高亮
// - 修改行 → 黄色高亮新内容；行内被删去的片段以红色删除线 inline widget 加载到新内容前
// - 删除行 → 整段以红色删除线 block widget 加载到对应位置（非独立 diff 视图）
function mapDiffToDoc(doc: any, lines: DiffLine[]) {
  const ranges: { from: number; to: number; type: 'add' | 'mod' }[] = []
  const widgets: { pos: number; text: string; inline: boolean }[] = []
  let i = 0
  let pendingDels: string[] = []
  const flushDels = (pos: number) => {
    if (!pendingDels.length) return
    widgets.push({ pos, text: pendingDels.join('\n'), inline: false })
    pendingDels = []
  }
  doc.descendants((node: any, pos: number) => {
    if (node.isBlock && node.textContent) {
      const text = node.textContent.replace(/\u00a0/g, ' ')
      const line = lines[i]
      if (line && line.text.trim() === text.trim()) {
        if (line.type === 'del') {
          pendingDels.push(line.text)
        } else {
          flushDels(pos + 1)
          if (line.type === 'add' || line.type === 'mod') {
            const from = pos + 1
            const to = pos + node.nodeSize - 1
            if (to > from) {
              ranges.push({ from, to, type: line.type })
              // 修改行：把被删去的片段（红色删除线）加载到修改内容前
              if (line.type === 'mod' && line.segments) {
                const delText = line.segments.filter((s) => s.type === 'del').map((s) => s.text).join('')
                if (delText) widgets.push({ pos: from, text: delText, inline: true })
              }
            }
          }
        }
        i++
      }
    }
    return true
  })
  // 文档末尾仍残留的删除内容 → 追加到末尾
  if (pendingDels.length) {
    flushDels(doc.content.size)
  }
  return { ranges, widgets }
}

// ===== 片段批注高亮 Decoration 插件（仅在线文档） =====
// 有批注的文本片段以黄色波浪下划线标记；点击批注可跳转到对应位置
let annotationHighlightData: { from: number; to: number; id: number }[] = []

const annotationHighlightPlugin = new Plugin({
  key: new PluginKey('annotationHighlight'),
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      if (tr.getMeta('annotationHighlight') !== undefined) {
        if (!annotationHighlightData.length) return DecorationSet.empty
        const decos: Decoration[] = []
        for (const r of annotationHighlightData) {
          tr.doc.nodesBetween(r.from, r.to, (node: any, pos: number) => {
            if (!node.isText) return true
            const nFrom = Math.max(r.from, pos)
            const nTo = Math.min(r.to, pos + node.nodeSize)
            if (nTo > nFrom) {
              decos.push(Decoration.inline(nFrom, nTo, { class: 'ann-mark', 'data-ann-id': String(r.id) }))
            }
            return true
          })
        }
        return DecorationSet.create(tr.doc, decos)
      }
      return set.map(tr.mapping, tr.doc)
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)
    },
  },
})

const annotationHighlightExtension = Extension.create({
  name: 'annotationHighlight',
  addProseMirrorPlugins() {
    return [annotationHighlightPlugin]
  },
})

// 在线文档编辑器
export default function PageEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const theme = useThemeStore((s) => s.theme)
  const [title, setTitle] = useState('')
  const [charCount, setCharCount] = useState(0)
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
  // 订阅（仅在线文档）+ 片段批注（2.6.0）
  const [subscribed, setSubscribed] = useState(false)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annInput, setAnnInput] = useState('')
  // 写作统计（2.6.0）：本次写作字数 / 今日写作字数 / 快捷键帮助
  const [writeStats, setWriteStats] = useState({ session: 0, today: 0 })
  const writeStatsRef = useRef({ session: 0, today: 0 })
  const lastCharRef = useRef(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const loadTodayStats = () => {
    try {
      const key = `northbooker-write-${new Date().toISOString().slice(0, 10)}`
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      writeStatsRef.current.today = saved?.count || 0
    } catch { writeStatsRef.current.today = 0 }
  }
  const saveTodayStats = () => {
    try {
      const key = `northbooker-write-${new Date().toISOString().slice(0, 10)}`
      localStorage.setItem(key, JSON.stringify({ count: writeStatsRef.current.today }))
    } catch { /* ignore */ }
  }
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoreConfirmId, setRestoreConfirmId] = useState<number | null>(null)
  // 版本对比（查看对比时直接在正文高亮 + 顶部信息条统计）
  const [comparingVersion, setComparingVersion] = useState<PageVersion | null>(null)
  const [diffStats, setDiffStats] = useState({ add: 0, del: 0 })
  // 对比模式：正文被临时替换为「版本内容 + 差异高亮」，退出时恢复原 HTML
  const diffBaseHtmlRef = useRef<string | null>(null)
  const comparingRef = useRef(false)
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'synthesizing' | 'playing'>('idle')
  const [ttsProgress, setTtsProgress] = useState(0)
  const [ttsTotal, setTtsTotal] = useState(0)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  // 合成池状态（A/B/C/D）与进度浮窗
  const [ttsPools, setTtsPools] = useState<{ id: number; name: string; total: number; done: number; current: number | null }[]>([])
  const [ttsPanelOpen, setTtsPanelOpen] = useState(true)
  // TTS 进度悬浮球：可拖动 + 点击展开/收起
  const [bubblePos, setBubblePos] = useState(() => ({ x: window.innerWidth - 96, y: window.innerHeight - 240 }))
  const bubbleDragRef = useRef<{ dx: number; dy: number; startX: number; startY: number } | null>(null)
  const bubbleMovedRef = useRef(false)
  const electronAPI = (window as any).electronAPI
  const isApp = !!electronAPI?.isElectron
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioQueueRef = useRef<{ wav: string; index: number }[]>([])
  const playingRef = useRef(false)
  const stopRef = useRef(false)
  const synthDoneRef = useRef(false)
  // TTS 朗读高亮：当前朗读段落（与主进程切分一致）+ 文档起始位置
  const ttsSegmentsRef = useRef<{ text: string; start: number }[]>([])
  const ttsStartPosRef = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  // 用 ref 解决 useCallback 闭包陷阱：scheduleSave（空依赖）调用的 doSave 需要最新的状态
  const titleRef = useRef(title)
  titleRef.current = title
  const doSaveRef = useRef<(() => Promise<void>) | null>(null)
  // 实时协作（Yjs CRDT，仅在线文档）：Y.Doc 始终创建（编辑器固定挂载 Collaboration 扩展），
  // 仅具备协作资格（登录且公开/作者）时创建 WebSocket provider 参与房间同步
  const ydocRef = useRef<Y.Doc | null>(null)
  if (!ydocRef.current) ydocRef.current = new Y.Doc()
  const providerRef = useRef<WebsocketProvider | null>(null)
  // 协作资格状态：init=判断中 / skipped=不启用协作 / ready=已创建 provider
  const [collabStatus, setCollabStatus] = useState<'init' | 'skipped' | 'ready'>('init')
  const pageContentRef = useRef('')
  // 初始内容同步标记：seedPending=sync 早于 fetch 完成，待 fetch 后补写；seedDone=初始内容已同步，之前禁止自动保存（防止空内容覆盖数据库）
  const seedPendingRef = useRef(false)
  const seedDoneRef = useRef(false)
  // 文档协作编辑权限（2.6.1）：open=任何登录用户可编辑 / author=仅作者可编辑
  const [coworkPolicy, setCoworkPolicy] = useState<'open' | 'author'>('open')

  // 更新目录（编辑时 + 加载内容后都要调用，只读文档也能用目录）
  const updateToc = (ed: any) => {
    const items: TocItem[] = []
    ed.state.doc.descendants((node: any) => {
      if (node.type.name === 'heading') {
        items.push({
          level: node.attrs.level,
          text: node.textContent,
          id: `toc-h-${items.length}`,
        })
      }
    })
    setToc(items)
  }

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
      ttsHighlightExtension,
      diffHighlightExtension,
      annotationHighlightExtension,
      Collaboration.configure({ document: ydocRef.current }),
    ],
    onUpdate: ({ editor: ed }) => {
      scheduleSave()
      // 统计字数（去空白字符）+ 写作统计
      const newCount = ed.state.doc.textContent.replace(/\s/g, '').length
      setCharCount(newCount)
      const delta = newCount - lastCharRef.current
      lastCharRef.current = newCount
      if (delta > 0) {
        writeStatsRef.current.session += delta
        writeStatsRef.current.today += delta
        saveTodayStats()
        setWriteStats({ ...writeStatsRef.current })
      }
      // 更新目录
      updateToc(ed)
    },
    editorProps: {
      attributes: {
        class: 'page-editor-content prose',
      },
    },
  })

  // 判断是否有编辑权限（实时协作：公开文档按协作策略，author 策略或私有仅作者本人；管理员也不能修改用户私有文档）
  const canEdit = useMemo(() => {
    if (!user) return false
    if (authorId > 0 && user.id === authorId) return true
    if (visibility !== 'public') return false
    return coworkPolicy !== 'author'
  }, [user, authorId, visibility, coworkPolicy])

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
    if (comparingRef.current) return // 对比模式不保存
    if (!seedDoneRef.current) return // 初始内容同步完成前不保存，避免空内容覆盖数据库
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

  // Ctrl+S 手动保存 + Ctrl+/ 快捷键帮助
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (id && canEdit && editor && seedDoneRef.current) {
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

  // 加载页面（协作模式下内容由 Yjs 同步，初始 HTML 暂存到 ref 供首次填充）
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
        pageContentRef.current = page.content || ''
        // 协作编辑权限（2.6.1）：仅具备编辑权限的用户才连接协作房间，只读用户直接用内容快照
        const pagePolicy: 'open' | 'author' = page.cowork_policy === 'author' ? 'author' : 'open'
        setCoworkPolicy(pagePolicy)
        const pageAuthorId = page.authorId ?? page.author_id
        const canEditThis = !!user && (pageAuthorId === user.id || (page.visibility === 'public' && pagePolicy !== 'author'))
        // 若 sync 事件早于 fetch 完成触发（当时 ref 为空），在此补写初始内容
        if (seedPendingRef.current) {
          seedPendingRef.current = false
          trySeedContent()
        }
        // 启用实时协作：具备编辑权限的登录用户连接房间；Y.Doc 始终存在，仅连接房间
        const canCollab = canEditThis
        let willCollab = false
        if (canCollab && !providerRef.current) {
          try {
            const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/collab/`
            const provider = new WebsocketProvider(wsUrl, id, ydocRef.current!, {
              params: { token: localStorage.getItem('nb_token') || '' },
            })
            providerRef.current = provider
            // 房间内容同步完成后，若 Yjs 文档为空才写入初始 HTML（避免覆盖他人实时内容）
            provider.on('sync', (synced: boolean) => {
              if (!synced) return
              if (!pageContentRef.current) {
                // fetch 尚未完成：标记待补写，fetch 完成后重新尝试
                seedPendingRef.current = true
                return
              }
              trySeedContent()
            })
            setCollabStatus('ready')
            willCollab = true
          } catch {
            // 协作连接失败不阻断正常编辑
            setCollabStatus('skipped')
          }
        } else {
          setCollabStatus('skipped')
        }
        loadTodayStats()
        setWriteStats({ ...writeStatsRef.current })
        if (!willCollab) {
          // 非协作：初始内容由 effect 直接写入，可立即结束加载态
          setLoading(false)
        } else {
          // 协作：内容在 sync 完成后由 trySeedContent 填充并结束加载态；
          // 兜底超时，避免 WebSocket 异常导致永久停留在加载中
          setTimeout(() => setLoading(false), 12000)
        }
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [id, user])

  // 初始内容同步：仅当 Yjs 文档"无实质内容"（空文档或仅空段落）时写入初始 HTML；
  // 协作模式（ready）等 provider sync 后再判断，非协作（skipped）直接写入
  const trySeedContent = useCallback(() => {
    if (!editor) return
    // 房间有协作者实质内容时保留房间内容，否则用数据库内容填充（防止空段落被当作有效内容）
    const hasText = editor.state.doc.textContent.replace(/\s/g, '').length > 0
    if (!hasText && pageContentRef.current) {
      editor.commands.setContent(pageContentRef.current)
      pageContentRef.current = ''
    }
    // 无论是否写入（Yjs 房间已有内容视为已同步），标记完成，解锁自动保存并结束加载态
    seedDoneRef.current = true
    setLoading(false)
  }, [editor])

  useEffect(() => {
    if (!editor || !pageContentRef.current) return
    if (collabStatus === 'skipped') {
      trySeedContent()
    }
    // collabStatus === 'ready'：由 provider sync 回调触发 trySeedContent
  }, [editor, collabStatus, trySeedContent])

  // 编辑器就绪后统计字数与目录
  useEffect(() => {
    if (!editor) return
    const count = editor.state.doc.textContent.replace(/\s/g, '').length
    setCharCount(count)
    lastCharRef.current = count
    updateToc(editor)
  }, [editor])

  // 卸载时销毁协作连接与 Y.Doc
  useEffect(() => {
    return () => {
      if (providerRef.current) {
        try { providerRef.current.destroy() } catch { /* ignore */ }
        providerRef.current = null
      }
      if (ydocRef.current) {
        try { ydocRef.current.destroy() } catch { /* ignore */ }
        ydocRef.current = null
      }
    }
  }, [id])

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

  // 订阅（仅在线文档）：加载订阅状态
  useEffect(() => {
    if (!id || !user) return
    fetchSubscriptions()
      .then((list) => {
        const hit = (list || []).find((s: any) => s.target_type === 'page' && s.target_id === id)
        setSubscribed(!!hit)
      })
      .catch(() => setSubscribed(false))
  }, [id, user])

  const toggleSubscribe = async () => {
    if (!id || !user) return
    try {
      if (subscribed) {
        await unsubscribe('page', id)
        setSubscribed(false)
      } else {
        await subscribe('page', id)
        setSubscribed(true)
      }
    } catch {
      alert('订阅操作失败')
    }
  }

  // 片段批注：加载 + 刷新正文高亮
  const applyAnnotationMarks = useCallback(() => {
    if (!editor) return
    annotationHighlightData = annotations.map((a) => ({ from: a.start_pos, to: a.end_pos, id: a.id }))
    editor.view.dispatch(editor.state.tr.setMeta('annotationHighlight', true))
  }, [editor, annotations])

  useEffect(() => { applyAnnotationMarks() }, [applyAnnotationMarks])

  const loadAnnotations = useCallback(async () => {
    if (!id) return
    try {
      const list = await fetchAnnotations(id)
      setAnnotations(list || [])
    } catch { setAnnotations([]) }
  }, [id])

  useEffect(() => { loadAnnotations() }, [loadAnnotations])

  // 从当前选区创建批注
  const handleAddAnnotation = async () => {
    if (!editor || !id || !user) return
    const { from, to } = editor.state.selection
    if (to <= from) {
      alert('请先选中要批注的文本片段')
      return
    }
    const text = editor.state.doc.textBetween(from, to, ' ').trim()
    if (!text) { alert('选中的片段没有文字'); return }
    const content = annInput.trim()
    if (!content) { alert('请输入批注内容'); return }
    try {
      await addAnnotation(id, { start_pos: from, end_pos: to, text: text.slice(0, 500), content: content.slice(0, 2000) })
      setAnnInput('')
      await loadAnnotations()
    } catch {
      alert('添加批注失败')
    }
  }

  const handleDeleteAnnotation = async (ann: Annotation) => {
    if (!confirm('删除这条批注？')) return
    try {
      await deleteAnnotation(ann.id)
      await loadAnnotations()
    } catch {
      alert('删除批注失败')
    }
  }

  // 点击批注跳转到正文对应位置
  const scrollToAnnotation = (ann: Annotation) => {
    if (!editor) return
    const { view } = editor
    const coords = view.coordsAtPos(ann.start_pos)
    const container = view.dom.parentElement
    if (container) {
      const rect = container.getBoundingClientRect()
      container.scrollTop += coords.top - rect.top - 100
    }
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(ann.start_pos))))
    view.focus()
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

  // 版本对比：该版本相对「上一版本」的修改（列表最后一项为最旧版本，无上一版则对比当前文档）
  // 对比结果直接在编辑器正文中高亮（新增绿 / 删除红 / 修改黄），退出时恢复原文
  const handleCompare = (v: PageVersion) => {
    if (!editor) return
    const idx = versions.findIndex((x) => x.id === v.id)
    const prev = idx >= 0 && idx < versions.length - 1 ? versions[idx + 1] : null
    const prevText = htmlToText(prev?.content || '')
    const curText = htmlToText(v.content || '')
    const lines = diffTextLines(prevText, curText)
    let add = 0
    let del = 0
    for (const l of lines) {
      if (l.type === 'add') add += l.text.length
      else if (l.type === 'del') del += l.text.length
      else if (l.type === 'mod' && l.segments) {
        for (const s of l.segments) {
          if (s.type === 'add') add += s.text.length
          else if (s.type === 'del') del += s.text.length
        }
      }
    }
    setDiffStats({ add, del })
    // 临时替换正文为该版本内容，正文内高亮差异：新增绿 / 修改黄；
    // 被删去的内容以红色删除线 widget 插入到对应位置（非独立 diff 视图）
    if (diffBaseHtmlRef.current === null) diffBaseHtmlRef.current = editor.getHTML()
    comparingRef.current = true
    editor.commands.setContent(v.content || '')
    diffHighlightData = mapDiffToDoc(editor.state.doc, lines)
    editor.view.dispatch(editor.state.tr.setMeta('diffHighlight', true))
    editor.setEditable(false)
    setComparingVersion(v)
    setShowVersions(false)
  }

  // 退出对比：清除高亮并恢复原正文与编辑状态
  const exitCompare = () => {
    if (!editor) return
    comparingRef.current = false
    diffHighlightData = { ranges: [], widgets: [] }
    editor.view.dispatch(editor.state.tr.setMeta('diffHighlight', true))
    if (diffBaseHtmlRef.current !== null) {
      editor.commands.setContent(diffBaseHtmlRef.current)
      diffBaseHtmlRef.current = null
    }
    editor.setEditable(canEdit)
    setComparingVersion(null)
  }

  // TTS 进度悬浮球拖动 + 点击展开/收起
  const onBubblePointerDown = (e: React.PointerEvent) => {
    bubbleMovedRef.current = false
    bubbleDragRef.current = { dx: e.clientX - bubblePos.x, dy: e.clientY - bubblePos.y, startX: e.clientX, startY: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onBubblePointerMove = (e: React.PointerEvent) => {
    const drag = bubbleDragRef.current
    if (!drag) return
    if (Math.abs(e.clientX - drag.startX) > 4 || Math.abs(e.clientY - drag.startY) > 4) bubbleMovedRef.current = true
    const x = Math.max(8, Math.min(window.innerWidth - 76, e.clientX - drag.dx))
    const y = Math.max(8, Math.min(window.innerHeight - 260, e.clientY - drag.dy))
    setBubblePos({ x, y })
  }
  const onBubblePointerUp = () => { bubbleDragRef.current = null }
  const onBubbleClick = () => {
    if (bubbleMovedRef.current) { bubbleMovedRef.current = false; return }
    setTtsPanelOpen(!ttsPanelOpen)
  }

  const handleShare = () => {
    const url = siteUrl(`/pages/${id ?? ''}`)
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
      audioQueueRef.current.push({ wav: chunk.wav, index: chunk.index })
      if (!playingRef.current) playNextRef.current()
    })
    // 合成状态
    electronAPI.onTtsState?.((s: { type: string; done?: number; total?: number; pools?: any[] }) => {
      if (s.type === 'start') {
        setTtsStatus('synthesizing')
        setTtsProgress(0)
        setTtsTotal(s.total || 0)
        setTtsPools(s.pools || [])
        setTtsPanelOpen(true)
      } else if (s.type === 'progress') {
        setTtsProgress(s.done || 0)
        if (s.pools) setTtsPools(s.pools)
      } else if (s.type === 'done') {
        synthDoneRef.current = true
        setTtsPools((prev) => prev.map((p) => ({ ...p, current: null, done: p.total })))
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

  // 高亮当前朗读段落并滚动到可视区
  const highlightSegment = useCallback((index: number) => {
    if (!editor) return
    const seg = ttsSegmentsRef.current[index]
    if (!seg) return
    const doc = editor.state.doc
    const startPos = ttsStartPosRef.current
    const { text, map } = buildTextMap(doc, startPos, doc.content.size)
    if (!text) return
    const segStart = seg.start
    const segEnd = segStart + seg.text.length
    const range = segmentToPosRange(map, segStart, segEnd)
    if (!range) return
    ttsHighlightRanges = [{ from: range.from, to: range.to }]
    editor.view.dispatch(editor.state.tr.setMeta('ttsHighlight', true))
    // 滚动到当前段落
    try {
      const dom = editor.view.domAtPos(range.from)
      const el = dom.node.nodeType === 3 ? dom.node.parentElement : (dom.node as HTMLElement)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      // ignore
    }
  }, [editor])

  // 清除朗读高亮
  const clearHighlight = useCallback(() => {
    ttsHighlightRanges = []
    if (editor) editor.view.dispatch(editor.state.tr.setMeta('ttsHighlight', true))
  }, [editor])

  // 逐段播放队列
  const playNext = useCallback(async () => {
    if (stopRef.current) return
    const item = audioQueueRef.current.shift()
    if (!item) {
      playingRef.current = false
      if (synthDoneRef.current) { setTtsStatus('idle'); setTtsProgress(0); clearHighlight() }
      return
    }
    playingRef.current = true
    setTtsStatus('playing')
    highlightSegment(item.index)
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      await ctx.resume()
      const buf = await ctx.decodeAudioData(base64ToArrayBuffer(item.wav))
      const source = ctx.createBufferSource()
      source.buffer = buf
      source.connect(ctx.destination)
      ttsSourceRef.current = source
      source.onended = () => { playNext() }
      source.start()
    } catch {
      playNext()
    }
  }, [highlightSegment, clearHighlight])

  // TTS 停止朗读
  const stopTTS = useCallback(() => {
    stopRef.current = true
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    try { ttsSourceRef.current?.stop() } catch {}
    ttsSourceRef.current = null
    audioQueueRef.current = []
    playingRef.current = false
    synthDoneRef.current = false
    ttsSegmentsRef.current = []
    clearHighlight()
    electronAPI?.ttsStop?.()
    setTtsStatus('idle')
    setTtsProgress(0)
    setTtsPools([])
  }, [clearHighlight])

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
    let ttsCfg = { enabled: true, speed: 0.9, model: 'edge', sid: 0 }
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
      // 记录朗读起始位置与切分段落（与主进程规则一致，用于高亮+滚动；Melo 双语不过滤）
      ttsStartPosRef.current = from
      const rawSegs = splitTextSegments(text)
      ttsSegmentsRef.current =
        ttsCfg.model === 'melo-zh-en' ? rawSegs : rawSegs.filter((s) => hasChineseText(s.text))
      clearHighlight()
      setTtsStatus('synthesizing')
      setTtsProgress(0)
      const res = await electronAPI.ttsStart({
        text,
        model: ttsCfg.model,
        speed: Number(ttsCfg.speed) || 1.0,
        sid: Number(ttsCfg.sid) || 0,
      })
      // 内容不含中文（中文模型无法朗读英文）时提示切换模型
      if (res?.error) {
        setTtsStatus('idle')
        setTtsProgress(0)
        ttsSegmentsRef.current = []
        clearHighlight()
        alert(res.error)
      }
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
          {authorName && (
            <button
              className="page-editor-author user-link"
              title={authorName}
              onClick={() => {
                if (authorId > 0) navigate(`/profile/${authorId}`)
              }}
            >
              {authorAvatar && <img className="page-editor-avatar" src={authorAvatar} alt={authorName} />}
              {authorName}
            </button>
          )}
          {createdAt && (
            <span className="page-editor-time">创建于 {formatDate(createdAt)}</span>
          )}
          <span className="page-editor-time">更新于 {formatDate(updatedAt)}</span>
          <span className="page-editor-time" title="文档字数">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <path d="M18 5c0-1.1-.9-2-2-2h-4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z" />
            </svg>
            {charCount} 字
          </span>
          {saving && <span className="page-editor-saving">保存中...</span>}
        </div>
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
            readOnly={!canEdit || !!comparingVersion}
          />
          <div className={`page-editor-wrapper ${!canEdit || comparingVersion ? 'page-editor-wrapper--readonly' : ''}`}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* 评论面板（按钮在底部栏右下角） */}
      {id && (
        <CommentPanel
          docId={id}
          open={showComments}
          onClose={() => setShowComments(false)}
        />
      )}

      {/* 片段批注面板（仅在线文档） */}
      {id && (
        <div className={`comment-panel annotation-panel ${showAnnotations ? 'comment-panel--open' : ''}`}>
          <div className="comment-panel-header">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5" /><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
                <path d="M3 21l6-6" /><path d="M21 3l-8 8" />
              </svg>
              {t('editor.annotations')}
            </h3>
            <button className="comment-panel-close" onClick={() => setShowAnnotations(false)} aria-label="关闭">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="comment-panel-body">
            {user && (
              <div className="ann-compose">
                <textarea
                  className="ann-input"
                  placeholder="先在正文中选中一段文字，再输入批注内容…"
                  value={annInput}
                  onChange={(e) => setAnnInput(e.target.value)}
                  rows={3}
                />
                <button className="ann-submit" onClick={handleAddAnnotation}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  添加批注（选中片段）
                </button>
              </div>
            )}
            <div className="ann-list">
              {annotations.length === 0 ? (
                <div className="comment-empty">暂无批注</div>
              ) : (
                annotations.map((a) => (
                  <div key={a.id} className="ann-item">
                    <div className="ann-item-text" onClick={() => scrollToAnnotation(a)} title="点击跳转到原文">
                      「{a.text}」
                    </div>
                    <div className="ann-item-content">{a.content}</div>
                    <div className="ann-item-meta">
                      <span>{a.username || '未知用户'}</span>
                      <span>{formatDate(a.created_at)}</span>
                      {user && (a.user_id === user.id || isAdmin(user)) && (
                        <button className="link-btn danger" onClick={() => handleDeleteAnnotation(a)}>删除</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 版本历史面板 */}
      {showVersions && <div className="comment-overlay" onClick={() => { setShowVersions(false); setRestoreConfirmId(null); setComparingVersion(null) }} />}
      <div className={`comment-panel version-panel ${showVersions ? 'comment-panel--open' : ''}`}>
        <div className="comment-panel-header">
          <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {t('editor.versions')}
            </h3>
          <button className="comment-panel-close" onClick={() => { setShowVersions(false); setRestoreConfirmId(null); setComparingVersion(null) }} aria-label="关闭">
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
                        <span className="version-number">版本 {versions.length - versions.findIndex((x) => x.id === v.id)}</span>
                        {v.isRollback && <span className="version-rollback-badge">已恢复</span>}
                      </div>
                      <div className="version-meta">
                        <span className="version-author">{v.authorName || '未知用户'}</span>
                        <span className="comment-time">{formatDate(v.createdAt)}</span>
                      </div>
                    </div>
                    <div className="version-actions">
                      <button className="version-compare-btn" onClick={() => handleCompare(v)}>
                        查看对比
                      </button>
                      {canEdit && (
                        restoreConfirmId === v.id ? (
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
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>
      </div>

      {showShare && id && <ShareDialog docId={id} onClose={() => setShowShare(false)} />}

      {/* 快捷键帮助 */}
      {showShortcuts && (
        <div className="dialog-mask" onClick={() => setShowShortcuts(false)}>
          <div className="dialog-card shortcuts-card" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>{t('editor.shortcuts')}</h3>
              <button className="dialog-close" onClick={() => setShowShortcuts(false)} aria-label="关闭">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="shortcuts-grid">
              {[
                ['Ctrl / ⌘ + S', '手动保存'],
                ['Ctrl / ⌘ + B', '加粗'],
                ['Ctrl / ⌘ + I', '斜体'],
                ['Ctrl / ⌘ + U', '下划线'],
                ['Ctrl / ⌘ + K', '插入链接'],
                ['Ctrl / ⌘ + Z', '撤销'],
                ['Ctrl / ⌘ + Shift + Z', '重做'],
                ['Ctrl / ⌘ + Alt + 1/2/3', '标题 1/2/3'],
                ['Ctrl / ⌘ + Shift + 7', '无序列表'],
                ['Ctrl / ⌘ + Shift + 8', '有序列表'],
                ['Ctrl / ⌘ + /', '快捷键帮助'],
                ['Ctrl / ⌘ + Enter', '发表评论'],
              ].map(([key, desc]) => (
                <div key={key} className="shortcuts-item">
                  <kbd className="shortcuts-key">{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TTS 合成进度悬浮球（仅桌面应用版）：可拖动 + 点击展开/收起 */}
      {isApp && ttsPools.length > 0 && (
        <div
          className={`tts-pool-bubble ${ttsPanelOpen ? 'tts-pool-bubble--open' : ''}`}
          style={{ left: bubblePos.x, top: bubblePos.y }}
          onPointerDown={onBubblePointerDown}
          onPointerMove={onBubblePointerMove}
          onPointerUp={onBubblePointerUp}
          onClick={onBubbleClick}
          title={ttsPanelOpen ? '' : '点击展开 TTS 合成进度'}
        >
          {ttsPanelOpen ? (
            <>
              <div className="tts-pool-panel-header">
                <div className="tts-pool-panel-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5 6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  <span>TTS 合成进度</span>
                  <span className="tts-pool-panel-total">{ttsProgress}/{ttsTotal}</span>
                </div>
                <button
                  className="tts-pool-panel-toggle"
                  onClick={(e) => { e.stopPropagation(); setTtsPanelOpen(false) }}
                  aria-label="收起"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
              </div>
              <div className="tts-pool-panel-overall">
                <div className="tts-pool-overall-bar">
                  <div
                    className="tts-pool-overall-fill"
                    style={{ width: ttsTotal ? `${Math.round((ttsProgress / ttsTotal) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="tts-pool-overall-pct">
                  {ttsTotal ? `${Math.round((ttsProgress / ttsTotal) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="tts-pool-panel-body">
                {ttsPools.map((p) => (
                  <div key={p.id} className="tts-pool-row">
                    <span className="tts-pool-name">{p.name}池</span>
                    <div className="tts-pool-bar-wrap">
                      <div
                        className="tts-pool-bar"
                        style={{ width: p.total ? `${Math.round((p.done / p.total) * 100)}%` : '0%' }}
                      />
                    </div>
                    <span className="tts-pool-state">
                      {p.current != null
                        ? `第 ${p.current} 段`
                        : p.done >= p.total && p.total > 0
                          ? '已完成'
                          : '等待中'}
                    </span>
                    <span className="tts-pool-count">{p.done}/{p.total}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="tts-pool-bubble-core">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <span className="tts-pool-bubble-count">{ttsProgress}/{ttsTotal}</span>
            </div>
          )}
        </div>
      )}

      {/* 底部栏：非富文本按钮 + 版本对比统计 */}
      <div className="page-editor-bottom-bar">
        <div className="pe-bottom-group pe-bottom-left">
          <button
            className={`pe-btn ${showVersions ? 'pe-btn--active' : ''}`}
            onClick={() => {
              if (!showVersions) loadVersions()
              setShowVersions(!showVersions)
            }}
            title={t('editor.versions')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
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
          <span className="pe-sep" />
          <button className={`pe-share-btn ${copied ? 'pe-share-btn--copied' : ''}`} onClick={handleShare} title={t('editor.copyLink')}>
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
            title={t('editor.share')}
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
            title={t('editor.search')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          {isAuthor && (
            <button className={`pe-vis-toggle ${visibility === 'public' ? 'pe-vis-public' : ''}`} onClick={toggleVisibility} title={t('editor.toggleVisibility')}>
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
              {visibility === 'public' ? t('editor.public') : t('editor.private')}
            </button>
          )}
          {/* 协作控制面板入口（2.6.2）：作者管理权限，访客只读查看 */}
          {user && visibility === 'public' && (
            <button
              className={`pe-vis-toggle ${coworkPolicy === 'open' ? 'pe-vis-public' : ''}`}
              onClick={() => navigate(`/pages/${id}/cowork_set`)}
              title={t('editor.coworkPanel')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {coworkPolicy === 'open' ? (
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
              {coworkPolicy === 'open' ? t('editor.coworkOpen') : t('editor.coworkAuthor')}
            </button>
          )}
        </div>
        <div className="pe-bottom-group pe-bottom-center">
          {!comparingVersion && (
            <span className="pe-write-stats" title="本次写作字数 / 今日写作字数">
              <span className="pe-write-stat pe-write-stat--session">本次 +{writeStats.session} 字</span>
              <span className="pe-write-stat">今日 {writeStats.today} 字</span>
              <span className="pe-write-stat pe-write-stat--total">全文 {charCount} 字</span>
            </span>
          )}
          {comparingVersion && (
            <span className="pe-bottom-diff-info">
              <strong>版本 {versions.length - versions.findIndex((x) => x.id === comparingVersion.id)}</strong>
              <span className="diff-stat diff-stat--add">+{diffStats.add} 字</span>
              <span className="diff-stat diff-stat--del">-{diffStats.del} 字</span>
              <span className="pe-bottom-diff-time">{formatDate(comparingVersion.createdAt)}</span>
              <button className="version-info-bar-exit" onClick={exitCompare}>{t('editor.exitCompare')}</button>
            </span>
          )}
        </div>
        <div className="pe-bottom-group pe-bottom-right">
          {user && (
            <button
              className={`pe-share-btn ${subscribed ? 'pe-btn--active pe-sub-active' : ''}`}
              onClick={toggleSubscribe}
              title={subscribed ? t('editor.unsubscribe') : t('editor.subscribe')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          )}
          <button
            className={`pe-share-btn ${showAnnotations ? 'pe-btn--active' : ''}`}
            onClick={() => setShowAnnotations(!showAnnotations)}
            title={t('editor.annotations')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="12" y1="10" x2="12" y2="16" />
            </svg>
          </button>
          {id && (
            <button
              className={`pe-share-btn ${showComments ? 'pe-btn--active' : ''}`}
              onClick={() => setShowComments(!showComments)}
              title={t('editor.comments')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}
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
