import { useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseNode, Mark } from '@tiptap/pm/model'

interface DocSearchProps {
  editor: Editor | null
}

// 文档内搜索组件
export default function DocSearch({ editor }: DocSearchProps) {
  const [keyword, setKeyword] = useState('')
  const [index, setIndex] = useState(0)
  const [total, setTotal] = useState(0)
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([])

  const search = useCallback((kw: string) => {
    setKeyword(kw)
    if (!editor || !kw.trim()) {
      setMatches([])
      setIndex(0)
      setTotal(0)
      // 清除高亮
      if (editor) {
        const { state, view } = editor
        const { tr } = state
        state.doc.descendants((node: ProseNode, pos: number) => {
          if (node.marks) {
            node.marks.forEach((mark: Mark) => {
              if (mark.type.name === 'highlight') {
                tr.removeMark(pos, pos + node.nodeSize, mark.type)
              }
            })
          }
        })
        view.dispatch(tr)
      }
      return
    }

    const results: { from: number; to: number }[] = []
    const fullText = editor.state.doc.textContent
    const lower = fullText.toLowerCase()
    const searchWord = kw.toLowerCase()
    let startPos = 0

    while (startPos < lower.length) {
      const found = lower.indexOf(searchWord, startPos)
      if (found === -1) break
      results.push({ from: found, to: found + searchWord.length })
      startPos = found + 1
    }

    setMatches(results)
    setTotal(results.length)

    if (results.length > 0) {
      const newIndex = Math.min(index, results.length - 1)
      setIndex(newIndex)
      scrollToMatch(results[newIndex], editor)
    }
  }, [editor, index])

  const scrollToMatch = (match: { from: number; to: number }, ed: Editor) => {
    if (!ed) return
    // 在文档树中找到匹配位置的节点
    let offset = 0
    ed.state.doc.descendants((node: ProseNode, pos: number) => {
      if (node.isText) {
        const nodeStart = offset
        const nodeEnd = offset + (node.text?.length ?? 0)
        if (match.from >= nodeStart && match.from < nodeEnd) {
          // 清除旧高亮并添加新高亮
          const localFrom = pos + (match.from - nodeStart)
          const localTo = pos + (match.to - nodeStart)
          ed.commands.setTextSelection({ from: localFrom, to: localTo })
          return false
        }
        offset = nodeEnd
      }
    })
  }

  const goNext = () => {
    if (matches.length === 0) return
    const newIndex = (index + 1) % matches.length
    setIndex(newIndex)
    scrollToMatch(matches[newIndex], editor!)
  }

  const goPrev = () => {
    if (matches.length === 0) return
    const newIndex = (index - 1 + matches.length) % matches.length
    setIndex(newIndex)
    scrollToMatch(matches[newIndex], editor!)
  }

  const close = useCallback(() => {
    setKeyword('')
    setMatches([])
    setIndex(0)
    setTotal(0)
    if (editor) editor.commands.focus()
  }, [editor])

  return (
    <div className="doc-search">
      <input
        className="doc-search-input"
        type="text"
        placeholder="搜索文档内容..."
        value={keyword}
        onChange={(e) => search(e.target.value)}
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
      {total > 0 && (
        <span className="doc-search-count">{index + 1}/{total}</span>
      )}
      <button className="doc-search-btn" onClick={goPrev} disabled={total === 0} title="上一个">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button className="doc-search-btn" onClick={goNext} disabled={total === 0} title="下一个">
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
