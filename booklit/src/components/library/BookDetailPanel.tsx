import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { useTheme } from '../../context/ThemeContext'
import type { LocalBook } from '../../context/BookContext'
import {
  authorHue, metaRows, shelfDisplay, shelfEmoji,
} from '../../lib/bookMeta'
import {
  X, BookOpen, ShoppingCart, Landmark, ExternalLink, Loader2, Plus, Check,
} from 'lucide-react'

/**
 * Slide-in book detail, ported from bookify's `openDetailPanel`
 * (bibliophile.html:2535). Same content and same action set; the blurred cover
 * band and the author-tinted shelf badge are the two bits that carried the
 * original's character, so they're kept.
 */
export function BookDetailPanel() {
  const { detailBookId, closeDetail } = useApp()
  const { localBooks } = useBook()

  useEffect(() => {
    if (!detailBookId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetail() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailBookId, closeDetail])

  const book = detailBookId
    ? localBooks.find(b => b.id === detailBookId) ?? null
    : null
  if (!book) return null

  // Keyed on the book so per-book UI state (the broken-cover fallback) resets
  // when you switch books, instead of leaking from the previous one.
  return <DetailBody key={book.id} book={book} />
}

function DetailBody({ book }: { book: LocalBook }) {
  const { closeDetail, openReader, collections, toggleBookInCollection } = useApp()
  const { openBook, isReadable, bookLoadingId } = useBook()
  const { theme } = useTheme()
  const [coverFailed, setCoverFailed] = useState(false)

  const hue = authorHue(book.author, book.title)
  const cover = coverFailed ? undefined : book.coverUrl
  const readable = isReadable(book)
  const loading = bookLoadingId === book.id

  const handleRead = () => {
    openBook(book).then(ok => { if (ok) { closeDetail(); openReader() } })
  }

  return createPortal(
    <>
      <div
        className="scrim fixed inset-0 z-[80]"
        onClick={closeDetail}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={book.title}
        className="fixed right-0 top-0 bottom-0 z-[81] w-full max-w-md bg-bg-surface shadow-2xl flex flex-col overflow-y-auto"
      >
        {/* Blurred cover band */}
        <div className="relative h-52 flex-shrink-0 overflow-hidden">
          <div
            className="absolute inset-0 scale-125 blur-2xl opacity-60"
            style={cover
              ? { backgroundImage: `url(${JSON.stringify(cover)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `hsl(${hue} 60% 22%)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-surface via-bg-surface/40 to-transparent" />

          <button
            onClick={closeDetail}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-chrome text-on-chrome hover:bg-chrome-elevated transition-colors shadow-md"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute left-6 bottom-0 translate-y-8 w-28 aspect-[2/3] rounded-lg overflow-hidden shadow-lg bg-bg-sunken">
            {cover ? (
              <img
                src={cover}
                alt={book.title}
                className="w-full h-full object-cover"
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-3xl"
                style={{ background: `linear-gradient(145deg, hsl(${hue} 60% 28%), hsl(${hue} 60% 12%))` }}
              >
                📚
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pt-12 pb-8">
          {/* The badge is tinted with the book's own hue, so its lightness has
              to flip with the theme — a 32%-light green is invisible on the
              Evening card and a 70%-light one is invisible on the Day card. */}
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-3"
            style={{
              background: `hsl(${hue} 72% 58% / 0.18)`,
              color: `hsl(${hue} ${theme === 'day' ? '72% 28%' : '65% 72%'})`,
              borderColor: `hsl(${hue} 72% 58% / 0.4)`,
            }}
          >
            {shelfEmoji(book.shelf)} {shelfDisplay(book.shelf)}
          </span>

          <h2 className="font-display text-2xl font-bold text-text leading-tight">{book.title}</h2>
          {book.subtitle && (
            <p className="text-text-dim text-sm mt-1 leading-snug">{book.subtitle}</p>
          )}
          {book.author && (
            <p className="text-text-muted text-sm mt-2">by {book.author}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-5">
            {readable && (
              <button
                onClick={handleRead}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-on-accent text-sm font-semibold hover:brightness-110 transition disabled:opacity-60"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <BookOpen className="w-4 h-4" />}
                Read free
              </button>
            )}
            {book.buyLink && (
              <ActionLink href={book.buyLink} icon={ShoppingCart} label="Buy" />
            )}
            {book.notesSearchUrl && (
              <ActionLink href={book.notesSearchUrl} icon={ExternalLink} label="Author's notes" />
            )}
            {book.isbn && (
              <ActionLink
                href={`https://www.worldcat.org/isbn/${book.isbn}`}
                icon={Landmark}
                label="Find in a library"
              />
            )}
            {book.goodreadsUrl && (
              <ActionLink href={book.goodreadsUrl} icon={ExternalLink} label="Goodreads" />
            )}
          </div>

          {/* Meta grid */}
          <MetaGrid book={book} />

          {book.notes && (
            <section className="mt-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-warm mb-2">
                Notes
              </h3>
              <p className="text-[13px] text-text-dim leading-relaxed whitespace-pre-line">
                {book.notes}
              </p>
            </section>
          )}

          {collections.length > 0 && (
            <section className="mt-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-warm mb-2">
                Collections
              </h3>
              <div className="flex flex-wrap gap-2">
                {collections.map(c => {
                  const inIt = c.bookIds.includes(book.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleBookInCollection(c.id, book.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        inIt
                          ? 'bg-accent text-on-accent border-transparent'
                          : 'border-border-hover text-text-dim hover:border-accent hover:text-text'
                      }`}
                    >
                      {inIt ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>,
    document.body,
  )
}

function ActionLink({ href, icon: Icon, label }: {
  href: string
  icon: typeof BookOpen
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-hover text-text-dim text-sm font-semibold hover:border-accent hover:text-text transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  )
}

function MetaGrid({ book }: { book: LocalBook }) {
  const rows = metaRows(book)
  if (rows.length === 0) return null
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-6 pt-6 border-t border-border">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {label}
          </dt>
          <dd className="text-[13px] text-text font-semibold mt-0.5">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
