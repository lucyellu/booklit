# Reader App - Work State

## Current Session Goals
1. Library persistence across sessions (localStorage)
2. iBooks/Calibre-style clean layout (remove confusing size controls)
3. Remove horizontal scroll mode entirely
4. Page-flip OR continuous vertical scroll only
5. Simplified settings: font, font size, voice, speed only
6. Remove swipe-to-turn-page drag gesture (breaks text selection)
7. Navigation: click buttons, arrow keys, tap only

## Architecture
- React + TypeScript + Vite
- State: `src/context/BookContext.tsx` (single large context)
- Main reader: `src/components/BookReader.tsx`
- Page renderer: `src/components/SwipeablePageReader.tsx`
- Settings: `src/components/ReadingSettings.tsx`
- Control bar: `src/components/ControlPanel.tsx`
- App entry: `src/App.tsx`

## Changes Made This Session
- BookContext: TextHighlight interface, continuousScroll state, localStorage persistence (TODO)
- BookReader: arrow keys, page-flip fill container, scroll modes fixed, isPlaying added
- SwipeablePageReader: touch-only drag (pointer: { touch: true }), selection popup
- ReadingSettings: continuous scroll toggle, Scroll icon
- ControlPanel: 800ms delay before hiding

## TODO (next steps if context runs out)
1. BookContext.tsx: Add localStorage load/save for localBooks (books without handles)
2. BookReader.tsx: Replace outer glass container with clean iBooks layout (max-w-3xl centered)
3. SwipeablePageReader.tsx: Remove useDrag entirely — use buttons/arrows only
4. App.tsx: Remove 'horizontal-scroll' from ReadingMode type
5. ControlPanel.tsx: Remove horizontal scroll button
6. ReadingSettings.tsx: Remove container/page/padding/margin/column/wordspacing controls; keep font, fontSize, lineHeight, voice, speed

## Key Files
- src/context/BookContext.tsx
- src/components/BookReader.tsx
- src/components/SwipeablePageReader.tsx
- src/components/ReadingSettings.tsx
- src/components/ControlPanel.tsx
- src/App.tsx
- src/data/sampleBook.ts
- .env (Firebase config - gitignored)
