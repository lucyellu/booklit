# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript compile + Vite production build
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

## Architecture

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Firebase

**State management:** All reading state lives in a single React Context (`src/context/BookContext.tsx`). The `BookProvider` wraps the entire app and the `useBook()` hook is used everywhere to access state. This context is large — it manages book content, pagination, audio playback, highlights, bookmarks, themes, and settings.

**Component structure:** `src/App.tsx` renders either `LibraryView` or the reader (with `BookReader` + `SwipeablePageReader` + `KaraokeHighlighter`). A `ControlPanel` at the bottom contains tabbed sub-components for audio, settings, design, translation, bookmarks, and export.

**Pagination:** Dynamic and sentence-based. When font size, spacing, page dimensions, or column count change, pages are recomputed by splitting content into sentences and filling pages until they overflow. The algorithm lives in `BookContext`.

**EPUB support:** Files are parsed with JSZip. The parser extracts `content.opf` for metadata and spine order, then reads individual HTML chapter files in order. The `@google-cloud/translate` package is in dependencies but the app actually uses the free MyMemory HTTP API for translation at runtime.

**Text-to-speech:** Uses the browser's Web Speech API (`SpeechSynthesisUtterance`). Word boundaries are tracked via `utterance.onboundary` to drive the `KaraokeHighlighter` component. Voice language is mapped to speech synthesis voices.

**Themes:** 5 named themes (midnight, ocean-breeze, forest-dawn, warm-sunset, lavender-mist) defined via CSS custom properties, toggled by adding a class to `document.documentElement`. Dark mode is separate and layered on top.

**Firebase:** Auth (email/password + Google OAuth) and Firestore are configured in `src/lib/firebase.ts` with hardcoded demo credentials. Firestore is initialized but not actively used in app logic yet.

**File loading:** Uses the FileSystem Access API (`showDirectoryPicker`, `showOpenFilePicker`) to open local EPUB/TXT/MD files without upload. Book file handles are stored in state for re-access.
