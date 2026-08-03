import { useState, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

interface DocSearchProps {
  editor: Editor | null
}

// 文档内搜索组件
export default function DocSearch({ editor }: DocSearchProps) {
  const [keyword, setKeyword] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [matchPositions, setMatchPositions] = useState<Array<{ from: number; to: number }>>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef(editor)
  editorRef.current = editor

  // 在文档树中遍历文本节点搜索
  const findInDoc = useCallback((kw: string) => {
    const ed = editorRef.current
    if (!ed || !kw.trim()) return []

    const results: Array<{ from: number; to: number }> = []
    const lower = kw.toLowerCase()

    ed.state.doc.descendants((node: ProseNode, pos: number) => {
      if (node.isText && node.text) {
        const text = node.text.toLowerCase()
        let from = 0
        while (from < text.length) {
          const found = text.indexOf(lower, from)
          if (found === -1) break
          results.push({ from: pos + found, to: pos + found + kw.length })
          from = found + 1
        }
      }
      return true
    })

    return results
  }, [])

  // 跳转到指定匹配
  const jumpTo = useCallback((pos: { from: number; to: number }) => {
    const ed = editorRef.current
    if (!ed) return

    const { view } = ed
    const { state, dispatch } = view

    // 设置文本选区
    const tr = state.tr.setSelection(
      TextSelection.create(state.doc, pos.from, pos.to)
    )
    dispatch(tr)

    // 滚动到可视区域
    requestAnimationFrame(() => {
      try {
        const start = view.coordsAtPos(pos.from)
        if (start) {
          const editorDom = view.dom.closest('.page-editor-body') as HTMLElement
          if (editorDom) {
            const scrollTarget = start.top - editorDom.getBoundingClientRect().top + editorDom.scrollTop - 120
            editorDom.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
          } else {
            window.scrollTo({ top: window.scrollY + start.top - 120, behavior: 'smooth' })
          }
        }
      } catch {
        // ignore scroll errors
      }
    })
  }, [])

  // 当 keyword 变化时执行搜索
  const handleInput = useCallback((value: string) => {
    setKeyword(value)
    if (!value.trim()) {
      setMatchPositions([])
      setTotalMatches(0)
      setMatchIndex(0)
      return
    }
    const results = findInDoc(value)
    setMatchPositions(results)
    setTotalMatches(results.length)
    if (results.length > 0) {
      setMatchIndex(0)
      jumpTo(results[0])
    } else {
      setMatchIndex(0)
    }
  }, [findInDoc, jumpTo])

  const goNext = () => {
    if (matchPositions.length === 0) return
    const next = (matchIndex + 1) % matchPositions.length
    setMatchIndex(next)
    jumpTo(matchPositions[next])
  }

  const goPrev = () => {
    if (matchPositions.length === 0) return
    const prev = (matchIndex - 1 + matchPositions.length) % matchPositions.length
    setMatchIndex(prev)
    jumpTo(matchPositions[prev])
  }

  const close = useCallback(() => {
    setKeyword('')
    setMatchPositions([])
    setTotalMatches(0)
    setMatchIndex(0)
    const ed = editorRef.current
    if (ed) ed.commands.focus()
  }, [])

  return (
    <div className="doc-search">
      <input
        ref={inputRef}
        className="doc-search-input"
        type="text"
        placeholder="搜索文档内容..."
        value={keyword}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) goPrev()
            else goNext()
          }
          if (e.key === 'Escape') close()
        }}
        autoFocus
      />
      {totalMatches > 0 && (
        <span className="doc-search-count">{matchIndex + 1}/{totalMatches}</span>
      )}
      <button className="doc-search-btn" onClick={goPrev} disabled={totalMatches === 0} title="上一个">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button className="doc-search-btn" onClick={goNext} disabled={totalMatches === 0} title="下一个">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button className="doc-search-btn" onClick={close} title="关闭搜索">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
