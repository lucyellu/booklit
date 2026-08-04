import { hexToHsl, hslToHex } from './colors'

/**
 * Derives the ground + three blob colours a glow tile paints from a single
 * tint hex. Analogous hues (±20°) rather than a complementary jump, so the
 * blobs read as one lush gradient instead of two colours fighting each other
 * — the same complaint that drove the accent-warm fix in colors.ts.
 */
export interface GlowPalette {
  ground: string
  hero: string
  deep: string
  bloom: string
}

export function glowPaletteFromTint(tint: string): GlowPalette {
  const [h, s, l] = hexToHsl(tint)
  return {
    ground: hslToHex(h, Math.min(s * 0.55, 55), 8),
    hero: hslToHex(h, Math.min(s + 8, 100), Math.max(l, 54)),
    deep: hslToHex((h - 20 + 360) % 360, Math.min(s, 90), 30),
    bloom: hslToHex((h + 20) % 360, Math.min(s, 85), 68),
  }
}
