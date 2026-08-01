import type { LocalBook } from '../../context/BookContext'

interface BookCardProps {
  book: LocalBook
  onClick: () => void
}

export function BookCard({ book, onClick }: BookCardProps) {
  return (
    <div
      className="book-card"
      onClick={onClick}
      style={{ width: 140, height: 200, cursor: 'pointer' }}
    >
      <div className="w-full h-full rounded-xl overflow-hidden bg-bg-sunken shadow-sm relative group">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-bg-sunken">
            <span className="font-display text-3xl font-extrabold text-text/30">
              {book.title.charAt(0)}
            </span>
          </div>
        )}
        {/* Title band on hover. Tinted with the chrome green rather than black
            so it reads as part of the forest palette over any cover. */}
        <div className="absolute inset-0 bg-gradient-to-t from-chrome via-chrome/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
          <p className="text-[10px] font-bold text-on-chrome truncate leading-tight">{book.title}</p>
          <p className="text-[9px] text-on-chrome-dim truncate mt-0.5">{book.author}</p>
        </div>
      </div>
    </div>
  )
}
