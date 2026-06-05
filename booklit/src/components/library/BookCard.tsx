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
      <div className="w-full h-full rounded-lg overflow-hidden glass relative group">
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
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-surface to-bg-elevated">
            <span className="font-display text-3xl text-text-muted">{book.title.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
          <p className="text-[10px] font-medium text-white truncate leading-tight">{book.title}</p>
          <p className="text-[9px] text-white/60 truncate">{book.author}</p>
        </div>
      </div>
    </div>
  )
}
