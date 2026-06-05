import React, { useEffect, useRef, useState } from 'react';

interface KaraokeHighlighterProps {
  text: string;
  isPlaying: boolean;
  highlightedWordIndex: number;
  readWordIndices: number[];
  highlightColor: string;
  fontSize: number;
  sentenceSpacing: number;
  wordSpacing: number;
  fontFamily: string;
  isDarkMode: boolean;
  onWordBoundary?: (wordIndex: number) => void;
  pageHighlights?: Array<{ selectedText: string; color: string }>;
}

const KaraokeHighlighter: React.FC<KaraokeHighlighterProps> = ({
  text,
  isPlaying,
  highlightedWordIndex,
  readWordIndices,
  highlightColor,
  fontSize,
  sentenceSpacing,
  wordSpacing,
  fontFamily,
  isDarkMode,
  onWordBoundary,
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

  // Build a set of word indices that fall within highlighted text ranges
  const highlightedWords = new Map<number, string>(); // wordIndex -> color
  if (pageHighlights && pageHighlights.length > 0) {
    pageHighlights.forEach(h => {
      // Find where this text appears in the full text
      let searchIdx = text.indexOf(h.selectedText);
      while (searchIdx !== -1) {
        // Count words up to searchIdx to find start word index
        const before = text.slice(0, searchIdx);
        const inHighlight = h.selectedText;
        const startWordIdx = (before.match(/\S+/g) || []).length;
        const highlightWordCount = (inHighlight.match(/\S+/g) || []).length;
        for (let i = startWordIdx; i < startWordIdx + highlightWordCount; i++) {
          highlightedWords.set(i, h.color);
        }
        searchIdx = text.indexOf(h.selectedText, searchIdx + 1);
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
    
    let backgroundColor = 'transparent';
    let opacity = 1;
    let fontWeight = 'normal';
    
    if (isHighlighted) {
      backgroundColor = `${highlightColor}80`; // 50% opacity
      fontWeight = '500';
    } else if (isRead) {
      backgroundColor = `${highlightColor}20`; // 12.5% opacity
      opacity = 0.7;
    }
    
    return {
      backgroundColor,
      opacity,
      fontWeight,
      marginRight: wordSpacing > 0 ? `${wordSpacing}em` : undefined,
      padding: isHighlighted ? '2px 4px' : '0',
      borderRadius: isHighlighted ? '4px' : '0',
      transition: 'all 0.3s ease',
      transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
      boxShadow: isHighlighted ? `0 2px 8px ${highlightColor}40` : 'none'
    };
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
      {segments.map((segment, index) => {
        if (segment.isWord && segment.wordIndex !== undefined) {
          return (
            <span
              key={index}
              data-word-index={segment.wordIndex}
              className="word inline-block"
              style={getWordStyle(segment.wordIndex)}
            >
              {segment.text}
            </span>
          );
        } else {
          return <span key={index}>{segment.text}</span>;
        }
      })}
    </div>
  );
};

export default KaraokeHighlighter;