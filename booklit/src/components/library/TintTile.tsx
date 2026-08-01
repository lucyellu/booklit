/**
 * The Forest Day tile: a flat colour darkened toward the bottom right, with the
 * title set into the bottom-left corner.
 *
 * The mockup lays a photograph over the tint at `opacity-30 mix-blend-overlay`.
 * There are no images to point it at — every one in the mockup is a remote
 * Unsplash URL — so the tint carries the card on its own, which is also why the
 * gradient matters: white on `#3abcd4` flat is 2.1:1, and on the darkened corner
 * it clears AA.
 *
 * Shared by the playlist cards and the curated-list cards, which were drifting
 * apart: the playlists had inherited a tiled stripe-and-dot motif from
 * bibli_009 that belongs to a different design.
 *
 * Expects a `group` on an ancestor — the title lifts on hover of the whole card,
 * not of the tile alone.
 */
export function TintTile({ tint, title, blurb, meta, className = '', titleClass = 'text-2xl' }: {
  tint: string
  title: string
  blurb?: string
  meta?: string
  className?: string
  titleClass?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl shadow-sm transition-shadow group-hover:shadow-md ${className}`}
      style={{ background: tint }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/60 mix-blend-multiply" />
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <h3
          className={`text-white font-bold leading-tight origin-bottom-left transition-transform duration-300 group-hover:scale-105 ${titleClass}`}
        >
          {title}
        </h3>
        {blurb && (
          <p className="text-white/90 text-[12.5px] leading-snug mt-1 line-clamp-2">{blurb}</p>
        )}
        {/* /90 not the mockup's /80: on the cyan and gold tints /80 lands at
            4.2:1, just under AA for 14px text. */}
        {meta && <p className="text-white/90 text-sm font-medium mt-1">{meta}</p>}
      </div>
    </div>
  )
}
