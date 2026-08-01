import type { LocalBook } from '../context/BookContext'
import { matchesShelf } from './filterBooks'

/**
 * Browsable curated lists — the Spotify-style "playlists" the Forest Day mockup
 * shows as big tinted cards.
 *
 * The mockup's own titles ("40 Books Before You Die", "Tech Canon", …) are
 * placeholder copy: they are hardcoded <h3> strings with invented durations, and
 * nothing in bookify or the CSV backs them. There is no genre, subject or topic
 * column anywhere in the data — the curated CSV's only real grouping is `shelf`,
 * which has exactly three values.
 *
 * So these lists are *derived*, not hand-authored, and every one of them is
 * either a shelf/availability fact or a keyword match over the text the books
 * actually carry (title + subtitle + author). That keeps them honest: a list can
 * never promise a book it doesn't contain, and the counts in the sidebar are the
 * real thing rather than the mockup's "40 items · 18:45:00".
 *
 * A book may appear in several lists, and most books appear in none. That's the
 * point — these are a discovery surface, not a partition of the library.
 */

export interface CuratedList {
  id: string
  title: string
  blurb: string
  /** Card colour. Fixed per list, not by position — a list keeps its colour
      even when the ones before it are hidden for being empty. */
  tint: string
  match: (b: LocalBook) => boolean
}

/**
 * Forest Day's featured cards are deliberately *not* green: colour is how you
 * tell one card from another at a glance, and a wall of greens on a green ground
 * reads as one block. These are the mockup's own six.
 */
export const CARD_TINTS = [
  '#4a7fd4', '#e07b39', '#d44a7a', '#3abcd4', '#3aad5a', '#d4a83a',
] as const

const hay = (b: LocalBook) =>
  `${b.title} ${b.subtitle ?? ''} ${b.author ?? ''}`.toLowerCase()

/** A topic list is a single anchored-word regex over that haystack. */
const topic = (
  id: string, title: string, blurb: string, tint: string, re: RegExp,
): CuratedList => ({ id, title, blurb, tint, match: b => re.test(hay(b)) })

export const CURATED_LISTS: CuratedList[] = [
  {
    id: 'favorites-pick',
    title: "Patrick's Favorites",
    blurb: 'The twenty he starred out of seven hundred.',
    tint: CARD_TINTS[0],
    match: b => matchesShelf(b, 'favorites'),
  },
  topic(
    'tech', 'The Tech Canon',
    'Computing, silicon, and the people who built it.',
    CARD_TINTS[1],
    /\b(comput\w*|software|programm\w*|algorithm\w*|internet|silicon valley|semiconductor|microchip|transistor|artificial intelligence|machine learning|cybernetic\w*|hacker\w*|startup\w*|engineer\w*|technolog\w*|robot\w*|digital|the web|open source|unix|linux)\b/,
  ),
  topic(
    'money', 'Money & Markets',
    'Capitalism, growth, and how economies actually work.',
    CARD_TINTS[2],
    /\b(econom\w*|capitalis\w*|socialis\w*|communis\w*|market\w*|financ\w*|money|wealth|povert\w*|inflation|trade|banking|debt|investing|investor|entrepreneur\w*|monopol\w*|corporation|industr\w*|growth)\b/,
  ),
  topic(
    'physics', 'Physics & the Cosmos',
    'From quantum fields to the shape of the universe.',
    CARD_TINTS[3],
    /\b(physic\w*|quantum|relativit\w*|cosmolog\w*|cosmos|universe|astronom\w*|astrophysic\w*|galax\w*|black hole\w*|particle\w*|thermodynamic\w*|electromagnet\w*|spacetime|feynman|einstein)\b/,
  ),
  topic(
    'life', 'Life Sciences',
    'Evolution, genes, brains, and the things that kill us.',
    CARD_TINTS[4],
    /\b(biolog\w*|evolution\w*|genetic\w*|genome|dna|darwin|specie\w*|neurosci\w*|neurolog\w*|the brain|medicin\w*|epidemi\w*|virus|viral|bacteri\w*|microb\w*|immun\w*|cancer|vaccin\w*|plague|ecolog\w*)\b/,
  ),
  topic(
    'empires', 'Empires & Wars',
    'How power was won, held, and lost.',
    CARD_TINTS[5],
    /\b(empire\w*|imperial|war|wars|warfare|battle\w*|revolution\w*|dynast\w*|conquest|siege|army|armies|napoleon|roman|rome|byzant\w*|ottoman|crusad\w*|colonial\w*|cold war)\b/,
  ),
  topic(
    'lives', 'Lives',
    'Biography, memoir, letters and diaries.',
    CARD_TINTS[1],
    /\b(a life|his life|her life|the life of|biograph\w*|autobiograph\w*|memoir\w*|letters of|diaries|journals of|the man who|the woman who|portrait of)\b/,
  ),
  topic(
    'numbers', 'Numbers & Logic',
    'Mathematics, proof, and reasoning under uncertainty.',
    CARD_TINTS[3],
    /\b(mathematic\w*|geometr\w*|algebra|calculus|topolog\w*|probabilit\w*|statistic\w*|number theory|g[oö]del|logic|proofs?|theorem\w*)\b/,
  ),
  topic(
    'minds', 'Minds & Meaning',
    'Philosophy, ethics, consciousness and belief.',
    CARD_TINTS[2],
    /\b(philosoph\w*|ethic\w*|moral\w*|consciousness|the mind|metaphysic\w*|epistemolog\w*|stoic\w*|nietzsche|plato|aristotle|wittgenstein|meaning of life|religio\w*|theolog\w*)\b/,
  ),
  topic(
    'otherworlds', 'Other Worlds',
    'Science fiction and fantasy.',
    CARD_TINTS[5],
    // Deliberately narrow. Loose words like "magic" and "foundation" pulled in
    // "The Life-Changing Magic of Tidying Up" and "Things Hidden Since the
    // Foundation of the World", so they're out — a short honest list beats a
    // long wrong one.
    /\b(sci-?fi|science fiction|fantasy|space opera|cyberpunk|starship|dystopia\w*|asimov|le guin|tolkien|terry pratchett|neal stephenson|dark forest|three[- ]body)\b/,
  ),
]

/** Lists whose contents can only be known once a book is checked for readability. */
export function readyToRead(isReadable: (b: LocalBook) => boolean): CuratedList {
  return {
    id: 'ready',
    title: 'Ready to Open',
    blurb: 'Everything you can start reading right now.',
    tint: CARD_TINTS[4],
    match: b => isReadable(b) && b.progress === 0,
  }
}

export function allLists(isReadable: (b: LocalBook) => boolean): CuratedList[] {
  return [...CURATED_LISTS, readyToRead(isReadable)]
}

export function findList(
  id: string | null,
  isReadable: (b: LocalBook) => boolean,
): CuratedList | null {
  if (!id) return null
  return allLists(isReadable).find(l => l.id === id) ?? null
}
