import React, { useEffect, useRef, useState } from 'react';
import { ReadWordStyle } from '../context/BookContext';

interface KaraokeHighlighterProps {
  text: string;
  isPlaying: boolean;
  highlightedWordIndex: number;
  readWordIndices: number[];
  readWordStyle: ReadWordStyle;
  highlightColor: string;
  fontSize: number;
  sentenceSpacing: number;
  wordSpacing: number;
  fontFamily: string;
  isDarkMode: boolean;
  onWordBoundary?: (wordIndex: number) => void;
  onWordClick?: (wordIndex: number) => void;
  pageHighlights?: Array<{ startWordIndex: number; wordCount: number; color: string }>;
}

const KaraokeHighlighter: React.FC<KaraokeHighlighterProps> = ({
  text,
  isPlaying,
  highlightedWordIndex,
  readWordIndices,
  readWordStyle,
  highlightColor,
  fontSize,
  sentenceSpacing,
  wordSpacing,
  fontFamily,
  isDarkMode,
  onWordBoundary,
  onWordClick,
  pageHighlights
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState<string[]>([]);
  const [segments, setSegments] = useState<Array<{ text: string; isWord: boolean; wordIndex?: number }>>([]);

  useEffect(() => {
    // Extract words and create segments
    const extractedWords = text.match(/\S+/g) || [];
    const textSegments = text.split(/(\S+)/);
    
    let wordIndex = 0;
    const processedSegments = textSegments.map(segment => {
      if (segment.trim() && extractedWords.includes(segment)) {
        const result = { text: segment, isWord: true, wordIndex };
        wordIndex++;
        return result;
      } else {
        return { text: segment, isWord: false };
      }
    });

    setWords(extractedWords);
    setSegments(processedSegments);
  }, [text]);

  // Scroll highlighted word into view
  useEffect(() => {
    if (highlightedWordIndex !== -1 && containerRef.current) {
      const highlightedElement = containerRef.current.querySelector(`[data-word-index="${highlightedWordIndex}"]`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [highlightedWordIndex]);

  // Build a set of word indices that fall within highlighted ranges. Each
  // highlight already knows its own start/length in word units (captured at
  // selection time), so this only marks that one occurrence — not every
  // place the same word or phrase happens to appear on the page.
  const highlightedWords = new Map<number, string>(); // wordIndex -> color
  if (pageHighlights && pageHighlights.length > 0) {
    pageHighlights.forEach(h => {
      for (let i = h.startWordIndex; i < h.startWordIndex + h.wordCount; i++) {
        highlightedWords.set(i, h.color);
      }
    });
  }

  const getWordStyle = (wordIndex: number) => {
    const userHighlightColor = highlightedWords.get(wordIndex);
    if (userHighlightColor) {
      return {
        backgroundColor: userHighlightColor + '60',
        borderRadius: '3px',
        padding: '1px 2px',
        marginRight: wordSpacing > 0 ? `${wordSpacing}em` : undefined,
        transition: 'all 0.3s ease',
        fontWeight: 'normal' as const,
        opacity: 1,
        transform: 'scale(1)',
        boxShadow: 'none',
      };
    }

    const isHighlighted = wordIndex === highlightedWordIndex;
    const isRead = readWordIndices.includes(wordIndex);

    const base = {
      marginRight: wordSpacing > 0 ? `${wordSpacing}em` : undefined,
      transition: 'all 0.3s ease',
    };

    if (readWordStyle === 'off' || (!isHighlighted && !isRead)) {
      return base;
    }

    // Read-but-not-current words get a faint dim regardless of style, so
    // there's still a sense of progress once the highlight moves on.
    const opacity = isRead && !isHighlighted ? 0.7 : 1;

    switch (readWordStyle) {
      case 'bold':
        return { ...base, opacity, fontWeight: isHighlighted ? 700 : 'normal' };
      case 'underline':
        return {
          ...base,
          opacity,
          textDecoration: isHighlighted ? 'underline' : 'none',
          textDecorationColor: highlightColor,
          textDecorationThickness: isHighlighted ? '2px' : undefined,
          textUnderlineOffset: isHighlighted ? '3px' : undefined,
        };
      case 'italic':
        return { ...base, opacity, fontStyle: isHighlighted ? 'italic' : 'normal' };
      case 'highlight':
      default: {
        let backgroundColor = 'transparent';
        let fontWeight = 'normal';

        if (isHighlighted) {
          backgroundColor = `${highlightColor}80`; // 50% opacity
          fontWeight = '500';
        } else if (isRead) {
          backgroundColor = `${highlightColor}20`; // 12.5% opacity
        }

        return {
          ...base,
          backgroundColor,
          opacity,
          fontWeight,
          padding: isHighlighted ? '2px 4px' : '0',
          borderRadius: isHighlighted ? '4px' : '0',
          transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isHighlighted ? `0 2px 8px ${highlightColor}40` : 'none'
        };
      }
    }
  };

  // Group segments into paragraphs at blank-line breaks (source articles use
  // "\n\n" between paragraphs) without touching word indices — TTS and
  // highlighting still walk one flat word sequence per page regardless of
  // how the markup is grouped for display.
  const paragraphs: Array<typeof segments> = [[]];
  segments.forEach(segment => {
    if (!segment.isWord && /\n\s*\n/.test(segment.text)) {
      paragraphs.push([]);
    } else {
      paragraphs[paragraphs.length - 1].push(segment);
    }
  });

  const renderSegment = (segment: (typeof segments)[number], key: string) => {
    if (segment.isWord && segment.wordIndex !== undefined) {
      const wordIndex = segment.wordIndex;
      return (
        <span
          key={key}
          data-word-index={wordIndex}
          className={`word inline-block ${onWordClick ? 'cursor-pointer' : ''}`}
          style={getWordStyle(wordIndex)}
          title={onWordClick ? 'Double-click to start reading from here' : undefined}
          onDoubleClick={onWordClick ? () => {
            // A drag that produced a selection is handled by the
            // container's mouseup (highlight popup) instead.
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim()) return;
            onWordClick(wordIndex);
          } : undefined}
        >
          {segment.text}
        </span>
      );
    }
    return <span key={key}>{segment.text}</span>;
  };

  return (
    <div
      ref={containerRef}
      className={`leading-relaxed text-justify transition-all duration-300 ${
        isDarkMode ? 'text-white/95' : 'text-gray-900'
      }`}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: sentenceSpacing,
        fontFamily: fontFamily,
        wordBreak: 'break-word',
        hyphens: 'auto',
        userSelect: 'text',
        WebkitUserSelect: 'text'
      }}
    >
      {paragraphs.map((paragraph, pi) => (
        <p key={pi} className={pi < paragraphs.length - 1 ? 'mb-4' : ''}>
          {paragraph.map((segment, si) => renderSegment(segment, `${pi}-${si}`))}
        </p>
      ))}
    </div>
  );
};

export default KaraokeHighlighter;