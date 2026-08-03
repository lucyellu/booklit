import { useMemo, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { findList } from '../../lib/curatedLists'
import {
  dedupe, applyFilters, sortBooks, SORT_LABELS, SORT_DIR_LABELS,
} from '../../lib/filterBooks'
import type { SortKey } from '../../lib/filterBooks'
import { Search, ArrowUpNarrowWide, ArrowDownWideNarrow, X } from 'lucide-react'

/**
 * The outliner: every book the current shelf holds, as a plain list, with its
 * own search and its own sort.
 *
 * Its whole reason for existing is to reach a book the stage can't currently
 * show you — one on another page, or buried in the middle of three hundred
 * spines. So its search and sort are deliberately *not* the library's: typing
 * here narrows the list without re-shuffling the arrangement behind it, and you
 * can keep the shelf in its own order while hunting alphabetically.
 *
 * The shelf, collection, source and availability facets *are* shared, because
 * those choose which books exist at all — a list of books that aren't on the
 * stage would have nothing to snap to.
 */

/** Rendered at once. Past this, refine the search — a thousand rows of DOM is
 *  slower than typing three letters, and nobody reads row 900. */
const MAX_ROWS = 400

export function OutlinePanel() {
  const {
    shelfFilter, readableOnly, availability, librarySource, collectionId,
    collections, listId, detailBookId, openDetail,
    outlineQuery, setOutlineQuery, outlineSortKey, outlineSortDir,
    setOutlineSortKey, toggleOutlineSortDir, requestReveal,
  } = useApp()
  const { localBooks, isReadable } = useBook()

  const activeList = useMemo(() => findList(listId, isReadable), [listId, isReadable])
  const deduped = useMemo(() => dedupe(localBooks, isReadable), [localBooks, isReadable])

  const books = useMemo(
    () => sortBooks(
      applyFilters(
        deduped,
        {
          shelfFilter,
          // The outliner's own box, not the library's.
          searchQuery: outlineQuery,
          readableOnly,
          availability,
          librarySource,
          collectionId,
          collections,
          listMatch: activeList?.match ?? null,
        },
        isReadable,
      ),
      outlineSortKey,
      outlineSortDir,
    ),
    [deduped, shelfFilter, outlineQuery, readableOnly, availability, librarySource,
      collectionId, collections, activeList, isReadable, outlineSortKey, outlineSortDir],
  )

  const shown = books.slice(0, MAX_ROWS)

  // Follow the stage: selecting a book out there scrolls its row into view here,
  // so the list is always showing you where you are.
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [detailBookId])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 rounded-full bg-bg px-3 py-1.5 focus-within:ring-1 focus-within:ring-accent transition-shadow">
          <Search className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <input
            type="text"
            value={outlineQuery}
            onChange={e => setOutlineQuery(e.target.value)}
            placeholder="Find in this shelf…"
            className="bg-transparent outline-none text-[13px] text-text placeholder:text-text-muted w-full"
          />
          {outlineQuery && (
            <button
              onClick={() => setOutlineQuery('')}
              className="text-text-muted hover:text-text transition-colors"
              aria-label="Clear outline search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2.5">
          <select
            value={outlineSortKey}
            onChange={e => setOutlineSortKey(e.target.value as SortKey)}
            aria-label="Sort the outline"
            className="flex-1 min-w-0 rounded-lg bg-bg border border-border px-2 py-1 text-[11.5px] text-text-dim outline-none focus:ring-1 focus:ring-accent"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          <button
            onClick={toggleOutlineSortDir}
            title={`Reverse order — currently ${SORT_DIR_LABELS[outlineSortKey][outlineSortDir]}`}
            aria-label={`Reverse order, currently ${SORT_DIR_LABELS[outlineSortKey][outlineSortDir]}`}
            className="p-1 rounded-lg border border-border text-text-dim hover:text-text hover:border-border-hover transition-colors flex-shrink-0"
          >
            {outlineSortDir === 'asc'
              ? <ArrowUpNarrowWide className="w-3.5 h-3.5" />
              : <ArrowDownWideNarrow className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className="mt-2 text-[10.5px] text-text-muted">
          {books.length} {books.length === 1 ? 'book' : 'books'}
          {books.length > MAX_ROWS && ` — showing the first ${MAX_ROWS}`}
          <span className="block mt-0.5">Click to select · double-click to snap the camera</span>
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {shown.map((b, i) => {
          const selected = b.id === detailBookId
          return (
            <button
              key={b.id}
              ref={selected ? selectedRef : undefined}
              onClick={() => openDetail(b.id)}
              onDoubleClick={() => requestReveal(b.id)}
              title={`${b.title}${b.author ? ` — ${b.author}` : ''}`}
              className={`w-full text-left px-4 py-1.5 flex items-baseline gap-2 transition-colors ${
                selected ? 'bg-accent/15 text-text' : 'text-text-dim hover:bg-bg'
              }`}
            >
              <span className="w-7 flex-shrink-0 text-[10px] font-mono text-text-muted tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] leading-tight ${
                  selected ? 'font-semibold' : ''
                }`}>
                  {b.title}
                </span>
                {b.author && (
                  <span className="block truncate text-[11px] text-text-muted leading-tight">
                    {b.author}
                  </span>
                )}
              </span>
            </button>
          )
        })}

        {books.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-text-muted text-center">
            {outlineQuery
              ? `Nothing here matches “${outlineQuery}”.`
              : 'This shelf is empty.'}
          </p>
        )}
      </div>
    </div>
  )
}
