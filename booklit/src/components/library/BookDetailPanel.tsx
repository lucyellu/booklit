import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { useTheme } from '../../context/ThemeContext'
import type { LocalBook } from '../../context/BookContext'
import {
  authorHue, metaRows, shelfDisplay, shelfEmoji,
} from '../../lib/bookMeta'
import {
  X, BookOpen, ShoppingCart, Landmark, ExternalLink, Loader2, Plus, Check,
  BookmarkPlus, Star,
} from 'lucide-react'
import { useProfiles } from '../../context/ProfileContext'

/**
 * The right-hand detail panel — what you get when you pick a book in any of the
 * four views. Ported from bookify's `openDetailPanel` (bibliophile.html:2535):
 * same content and same action set, and the blurred cover band and
 * author-tinted shelf badge are the two bits that carried the original's
 * character, so they're kept.
 *
 * It docks into the shell rather than floating over it behind a scrim, because
 * picking a *different* book is the most likely next thing you'll do and a
 * scrim would eat that click. The library keeps working with the panel open.
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

/** The three shelves a book can sit on, matching Goodreads' own exclusive set. */
const SHELF_CHOICES: { id: string; label: string }[] = [
  { id: 'currently-reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
  { id: 'to-read', label: 'Want to read' },
]

function ShelfControls({ book }: { book: LocalBook }) {
  const {
    canEdit, setBookShelf, setBookRating, saveToMyLibrary, removeFromMyLibrary,
  } = useBook()
  const { activeProfile } = useProfiles()
  const [justSaved, setJustSaved] = useState(false)

  // Someone else's shelf is a reference, not a workspace — the useful verb is
  // "put this on mine", not "change theirs".
  if (!canEdit) {
    return (
      <section className="mt-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-warm mb-2">
          {activeProfile?.name ?? 'This shelf'}
        </h3>
        <button
          onClick={() => { saveToMyLibrary(book); setJustSaved(true) }}
          disabled={justSaved}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            justSaved
              ? 'border-transparent bg-accent text-on-accent'
              : 'border-border-hover text-text-dim hover:border-accent hover:text-text'
          }`}
        >
          {justSaved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
          {justSaved ? 'Saved to your library' : 'Save to my library'}
        </button>
        <p className="text-[11px] text-text-muted mt-2 leading-snug">
          Read-only — this is {activeProfile?.name ?? 'someone else'}’s shelf.
        </p>
      </section>
    )
  }

  const current = SHELF_CHOICES.find(s => (book.shelf || '').includes(s.id))?.id
    ?? (book.shelf === 'local' ? undefined : 'read')

  return (
    <section className="mt-6">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-accent-warm mb-2">
        Shelf
      </h3>
      <div className="flex flex-wrap gap-2">
        {SHELF_CHOICES.map(s => (
          <button
            key={s.id}
            onClick={() => setBookShelf(book, s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              current === s.id
                ? 'bg-accent text-on-accent border-transparent'
                : 'border-border-hover text-text-dim hover:border-accent hover:text-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <span className="text-[11px] text-text-muted">Your rating</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setBookRating(book, book.rating === n ? 0 : n)}
              title={`${n} star${n > 1 ? 's' : ''}`}
              className="p-0.5 text-text-muted hover:text-accent-warm transition-colors"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  (book.rating ?? 0) >= n ? 'fill-accent-warm text-accent-warm' : ''
                }`}
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => removeFromMyLibrary(book)}
          className="ml-auto text-[11px] text-text-muted hover:text-accent-warm transition-colors"
          title="Hide this book from your library"
        >
          Remove
        </button>
      </div>

      <p className="text-[11px] text-text-muted mt-3 leading-snug">
        Saved in Booklit. Goodreads has no write API, so this doesn’t change your
        shelf there — export a CSV from Settings to push it back.
      </p>
    </section>
  )
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

  // The panel stays on the book after the reader opens, so closing the reader
  // puts you back where you were rather than on a blank sidebar.
  const handleRead = () => {
    openBook(book).then(ok => { if (ok) openReader() })
  }

  return (
      <aside
        aria-label={book.title}
        className="w-[360px] xl:w-[400px] flex-shrink-0 h-full overflow-y-auto bg-bg-surface border-l border-border"
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
            {/* Always here, so the panel answers "can I read this?" rather than
                leaving you to infer it from a missing button. */}
            <button
              onClick={handleRead}
              disabled={loading || !readable}
              title={readable
                ? 'Open in the reader (or double-click the book)'
                : 'No ebook file for this one yet'}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-on-accent text-sm font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:hover:brightness-100"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <BookOpen className="w-4 h-4" />}
              {readable ? 'Read free' : 'No ebook'}
            </button>
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

          {/* Shelf controls. On your own library these edit it; on someone
              else's the only sensible action is to take a copy. */}
          <ShelfControls book={book} />

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
