import { glowPaletteFromTint } from '../../lib/glowPalette'

/**
 * The glow tile: a dark ground with three softly blurred, slowly drifting
 * colour blobs derived from a single tint hex, with the title set into the
 * bottom-left corner. Replaces the old flat-tint-plus-diagonal-shade look —
 * see lib/glowPalette.ts for how the blob colours are chosen (analogous
 * hues, not a flat tint, so there's depth even from one input colour).
 *
 * Shared by the playlist cards and the curated-list cards, which were drifting
 * apart: the playlists had inherited a tiled stripe-and-dot motif from
 * bibli_009 that belongs to a different design.
 *
 * Expects a `group` on an ancestor — the title lifts, and the tile itself
 * lifts (via .glow-tile's `.group:hover` rule in index.css), on hover of the
 * whole card, not of the tile alone.
 */
export function TintTile({ tint, title, blurb, meta, className = '', titleClass = 'text-2xl' }: {
  tint: string
  title: string
  blurb?: string
  meta?: string
  className?: string
  titleClass?: string
}) {
  const { ground, hero, deep, bloom } = glowPaletteFromTint(tint)

  return (
    <div
      className={`glow-tile relative overflow-hidden rounded-xl isolate ${className}`}
      style={{ background: ground }}
    >
      <div
        className="glow-tile-blob glow-tile-blob-a"
        style={{ background: hero, width: '75%', height: '75%', top: '-15%', left: '-10%' }}
      />
      <div
        className="glow-tile-blob glow-tile-blob-b"
        style={{ background: deep, width: '65%', height: '65%', bottom: '-20%', right: '-10%' }}
      />
      <div
        className="glow-tile-blob glow-tile-blob-c"
        style={{ background: bloom, width: '55%', height: '55%', bottom: '-15%', left: '10%' }}
      />
      <div className="glow-tile-grain" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/15 to-black/65 mix-blend-multiply" />
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
