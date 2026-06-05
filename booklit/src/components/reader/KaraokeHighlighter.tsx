import { useEffect, useRef, useState } from 'react'

interface KaraokeHighlighterProps {
  text: string
  highlightedWordIndex: number
  readWordIndices: number[]
  highlightColor: string
  fontSize: number
  sentenceSpacing: number
  wordSpacing: number
  fontFamily: string
  pageHighlights?: Array<{ selectedText: string; color: string }>
}

interface Segment {
  text: string
  isWord: boolean
  wordIndex?: number
}

export function KaraokeHighlighter({
  text,
  highlightedWordIndex,
  readWordIndices,
  highlightColor,
  fontSize,
  sentenceSpacing,
  wordSpacing,
  fontFamily,
  pageHighlights,
}: KaraokeHighlighterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [segments, setSegments] = useState<Segment[]>([])

  useEffect(() => {
    const words = text.match(/\S+/g) || []
    const parts = text.split(/(\S+)/)
    let wi = 0
    const segs = parts.map(part => {
      if (part.trim() && words.includes(part)) {
        return { text: part, isWord: true, wordIndex: wi++ } as Segment
      }
      return { text: part, isWord: false } as Segment
    })
    setSegments(segs)
  }, [text])

  useEffect(() => {
    if (highlightedWordIndex !== -1 && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-word-index="${highlightedWordIndex}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }
  }, [highlightedWordIndex])

  const userHighlights = new Map<number, string>()
  if (pageHighlights?.length) {
    for (const h of pageHighlights) {
      let idx = text.indexOf(h.selectedText)
      while (idx !== -1) {
        const before = text.slice(0, idx)
        const startWord = (before.match(/\S+/g) || []).length
        const count = (h.selectedText.match(/\S+/g) || []).length
        for (let i = startWord; i < startWord + count; i++) userHighlights.set(i, h.color)
        idx = text.indexOf(h.selectedText, idx + 1)
      }
    }
  }

  const getStyle = (wi: number): React.CSSProperties => {
    const userColor = userHighlights.get(wi)
    if (userColor) {
      return {
        backgroundColor: userColor + '60',
        borderRadius: '3px',
        padding: '1px 2px',
        marginRight: wordSpacing > 0 ? `${wordSpacing}em` : undefined,
        transition: 'all 0.3s ease',
      }
    }
    const isHighlighted = wi === highlightedWordIndex
    const isRead = readWordIndices.includes(wi)
    return {
      backgroundColor: isHighlighted ? `${highlightColor}80` : isRead ? `${highlightColor}20` : 'transparent',
      opacity: isRead && !isHighlighted ? 0.7 : 1,
      fontWeight: isHighlighted ? 500 : undefined,
      marginRight: wordSpacing > 0 ? `${wordSpacing}em` : undefined,
      padding: isHighlighted ? '2px 4px' : '0',
      borderRadius: isHighlighted ? '4px' : '0',
      transition: 'all 0.3s ease',
      transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
      boxShadow: isHighlighted ? `0 2px 8px ${highlightColor}40` : 'none',
    }
  }

  return (
    <div
      ref={containerRef}
      className="leading-relaxed text-justify text-text/95"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: sentenceSpacing,
        fontFamily,
        wordBreak: 'break-word',
        hyphens: 'auto',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
    >
      {segments.map((seg, i) =>
        seg.isWord && seg.wordIndex !== undefined ? (
          <span key={i} data-word-index={seg.wordIndex} className="inline-block" style={getStyle(seg.wordIndex)}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  )
}
