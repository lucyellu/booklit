/**
 * Profiles — whose shelf you're looking at.
 *
 * This is the axis the library was missing. `BookSource` answers "how did this
 * book arrive" (Goodreads / local folder / upload); a profile answers "whose
 * library is this", and those are independent: your own profile contains books
 * from all four sources, and two different people's Goodreads imports must
 * never land in the same pile.
 */

/** One shelf-owner. Exactly one profile is the owner; the rest are guests. */
export interface Profile {
  id: string
  name: string
  kind: 'owner' | 'guest'
  /** Numeric Goodreads user id, if this profile is backed by a public shelf. */
  goodreadsUserId?: string
  /** Path to a bundled CSV under /data, for shelves that ship with the app. */
  bundledCsv?: string
  blurb?: string
  /** Avatar tint. Fixed per profile — it's how you tell libraries apart. */
  tint: string
  /** Epoch ms of the last successful sync. */
  lastSyncedAt?: number
}

/**
 * A local edit layered on top of an imported snapshot.
 *
 * Goodreads can't be written to, so this *is* the edit — Booklit keeps your
 * shelf changes and re-syncing a profile never clobbers them. Overrides belong
 * to you and apply to your own library only; guest shelves stay read-only,
 * because they're someone else's.
 */
export interface ShelfOverride {
  shelf?: string
  rating?: number
  notes?: string
  /** Soft-delete: hide a book from your library without touching the source. */
  removed?: boolean
  /**
   * Set when a book was pulled into your library from somewhere it isn't
   * already — a guest's shelf, mainly. Carries just enough to render a card.
   */
  saved?: {
    title: string
    author?: string
    coverUrl?: string
    isbn?: string
    /** Profile id it was saved from, for provenance in the detail panel. */
    from?: string
  }
  /** 0-100, derived from lastPosition. Drives the "Continue Reading" row. */
  progress?: number
  /** ISO timestamp of last reading activity (not when the book was added). */
  lastRead?: string
  /**
   * Where reading left off. `wordOffset` counts into the chapter's full
   * text rather than a page index — pages get re-cut whenever font size,
   * viewport, or column count changes, so a saved page number would drift.
   * A word offset survives repagination.
   */
  lastPosition?: { chapterIndex: number; wordOffset: number }
  /**
   * Manual choices for a title with multiple ingested records (e.g. a curated
   * CSV entry and a local-folder scan of the same book). Lets a duplicate that
   * `dedupeKey` merged into one card still show the cover/format the user
   * actually wants, instead of always the scoring-based default.
   */
  workPrefs?: {
    /** id of the edition whose cover should display for this title. */
    coverEditionId?: string
    /** id of the edition "Read" should open for this title. */
    readEditionId?: string
  }
  updatedAt: number
}

export const PROFILE_TINTS = [
  '#15803d', '#0f766e', '#cc583d', '#a16207',
  '#6d28d9', '#be185d', '#0369a1', '#4d7c0f',
]

export function tintFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PROFILE_TINTS[h % PROFILE_TINTS.length]
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Shelves that ship with the app. Patrick's is a real curated CSV that's been
 * in the repo since the start.
 *
 * Deliberately short: seeding more would mean hardcoding strangers' Goodreads
 * ids, and spot-checking candidate ids turned up private individuals rather
 * than public figures. Adding someone is one paste of a profile URL instead.
 */
export const SEED_GUESTS: Profile[] = [
  {
    id: 'guest-patrick-collison',
    name: 'Patrick Collison',
    kind: 'guest',
    bundledCsv: '/data/patrick_collison_bookshelf.csv',
    blurb: 'Stripe CEO · Eclectic reader',
    tint: '#15803d',
  },
]

/** Profiles offered in the "add someone" picker. Resolved live, nothing bundled. */
export const SUGGESTED_LOOKUPS = [
  { label: 'Paste a Goodreads profile URL', hint: 'goodreads.com/user/show/12345-name' },
]

export function makeOwnerProfile(name: string, goodreadsUserId?: string): Profile {
  return {
    id: 'owner',
    name: name.trim() || 'My Library',
    kind: 'owner',
    goodreadsUserId,
    blurb: 'Your shelves',
    tint: '#0f766e',
  }
}

export function guestProfileId(goodreadsUserId: string): string {
  return `guest-gr-${goodreadsUserId}`
}

/** Pull the numeric id out of a profile URL, or accept a bare id. */
export function parseGoodreadsId(input: string): string | null {
  const m = (input || '').match(/\d{1,12}/)
  return m ? m[0] : null
}

/**
 * Stable identity for a book across re-syncs. Goodreads import ids are
 * positional (`gr-<user>-<index>`) and shift whenever a shelf changes, so
 * overrides key off title+author instead.
 */
export function bookKey(title: string, author?: string): string {
  const t = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const a = (author || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return a ? `${t}|${a}` : t
}

/* ---- local persistence (used in local mode, and as the cloud cache) ---- */

const KEY = (uid: string, what: string) => `booklit:${uid}:${what}`

export function loadProfiles(uid: string): Profile[] | null {
  try {
    const raw = localStorage.getItem(KEY(uid, 'profiles'))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch { return null }
}

export function saveProfiles(uid: string, profiles: Profile[]) {
  try { localStorage.setItem(KEY(uid, 'profiles'), JSON.stringify(profiles)) } catch { /* quota */ }
}

export function loadOverrides(uid: string): Record<string, ShelfOverride> {
  try {
    const raw = localStorage.getItem(KEY(uid, 'overrides'))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}

export function saveOverrides(uid: string, overrides: Record<string, ShelfOverride>) {
  try { localStorage.setItem(KEY(uid, 'overrides'), JSON.stringify(overrides)) } catch { /* quota */ }
}

export function loadActiveProfileId(uid: string): string | null {
  try { return localStorage.getItem(KEY(uid, 'active')) } catch { return null }
}

export function saveActiveProfileId(uid: string, id: string) {
  try { localStorage.setItem(KEY(uid, 'active'), id) } catch { /* quota */ }
}
