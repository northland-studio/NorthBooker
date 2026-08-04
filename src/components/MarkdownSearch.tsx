import { useState, useCallback, useRef } from 'react'

interface MarkdownSearchProps {
  content: string
  textareaId: string
}

// Markdown 编辑器内搜索组件
export default function MarkdownSearch({ content, textareaId }: MarkdownSearchProps) {
  const [keyword, setKeyword] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const [matchPositions, setMatchPositions] = useState<number[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // 搜索全部匹配位置
  const findAll = useCallback((kw: string) => {
    if (!kw.trim()) return []
    const results: number[] = []
    const lower = kw.toLowerCase()
    const text = content.toLowerCase()
    let from = 0
    while (from < text.length) {
      const found = text.indexOf(lower, from)
      if (found === -1) break
      results.push(found)
      from = found + 1
    }
    return results
  }, [content])

  const search = useCallback((value: string) => {
    setKeyword(value)
    if (!value.trim()) {
      setMatchPositions([])
      setTotalMatches(0)
      setMatchIndex(0)
      return
    }
    const results = findAll(value)
    setMatchPositions(results)
    setTotalMatches(results.length)
    if (results.length > 0) {
      setMatchIndex(0)
      selectMatch(results[0], value.length)
    } else {
      setMatchIndex(0)
    }
  }, [findAll])

  // 选中 textarea 中指定位置的匹配文本
  const selectMatch = (pos: number, len: number) => {
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(pos, pos + len)
    // 滚动到可见位置
    const lineHeight = 20
    const linesBefore = content.substring(0, pos).split('\n').length - 1
    ta.scrollTop = Math.max(0, linesBefore * lineHeight - 60)
  }

  const goNext = () => {
    if (matchPositions.length === 0) return
    const next = (matchIndex + 1) % matchPositions.length
    setMatchIndex(next)
    selectMatch(matchPositions[next], keyword.length)
  }

  const goPrev = () => {
    if (matchPositions.length === 0) return
    const prev = (matchIndex - 1 + matchPositions.length) % matchPositions.length
    setMatchIndex(prev)
    selectMatch(matchPositions[prev], keyword.length)
  }

  const close = () => {
    setKeyword('')
    setMatchPositions([])
    setTotalMatches(0)
    setMatchIndex(0)
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null
    ta?.focus()
  }

  return (
    <div className="doc-search">
      <input
        ref={inputRef}
        className="doc-search-input"
        type="text"
        placeholder="搜索 Markdown 内容..."
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
