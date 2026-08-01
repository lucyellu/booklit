import type { CSSProperties } from 'react'

/**
 * Clip playlists, ported verbatim from `cards/bibli_009.html` (the "Bibliophile
 * 3D Shelf" app) — the CLIPS and PLAYLISTS arrays and the 130-wpm duration
 * model, unchanged.
 *
 * These are the real thing: hand-authored excerpts from named books, grouped
 * into six playlists. Unlike the curated lists in `curatedLists.ts`, which
 * filter the books you own, a playlist plays *text* — the excerpt is read aloud
 * through the same speech synthesis the reader uses. That is why they are
 * measured in clips and minutes rather than in books.
 *
 * Durations are computed from the word count, not stored, so editing a clip's
 * text keeps its listed length honest.
 */

/** Words per minute used to turn clip text into a running time. */
const CLIP_WPM = 130

export interface Clip {
  id: string
  book: string
  author: string
  year: number
  playlists: string[]
  themes: string[]
  text: string
}

export type ClipPattern = 'lines-v' | 'lines-h' | 'dots' | 'grid' | 'diagonal' | 'cross'

export interface Playlist {
  id: string
  title: string
  description: string
  color: string
  lightColor: string
  pattern: ClipPattern
  clipIds: string[]
}

export const CLIPS: Clip[] = [
  {
    id: 'smith-butcher',
    book: 'The Wealth of Nations', author: 'Adam Smith', year: 1776,
    playlists: ['capitalism-communism', 'ideas-3min'],
    themes: ['economics', 'capitalism', 'self-interest'],
    text: `It is not from the benevolence of the butcher, the brewer, or the baker that we expect our dinner, but from their regard to their own interest. We address ourselves, not to their humanity, but to their self-love, and never talk to them of our own necessities, but of their advantages.\n\nEvery individual necessarily labours to render the annual revenue of the society as great as he can. He generally, indeed, neither intends to promote the public interest, nor knows how much he is promoting it... he intends only his own gain, and he is in this, as in many other cases, led by an invisible hand to promote an end which was no part of his intention.`
  },
  {
    id: 'marx-opening',
    book: 'The Communist Manifesto', author: 'Karl Marx', year: 1848,
    playlists: ['capitalism-communism', 'ideas-3min'],
    themes: ['economics', 'communism', 'history', 'class'],
    text: `A spectre is haunting Europe — the spectre of communism. All the powers of old Europe have entered into a holy alliance to exorcise this spectre: Pope and Tsar, Metternich and Guizot, French Radicals and German police-spies.\n\nThe history of all hitherto existing society is the history of class struggles. Freeman and slave, patrician and plebeian, lord and serf, guild-master and journeyman, in a word, oppressor and oppressed, stood in constant opposition to one another, carried on an uninterrupted, now hidden, now open fight, a fight that each time ended, either in a revolutionary reconstitution of society at large, or in the common ruin of the contending classes.`
  },
  {
    id: 'hayek-knowledge',
    book: 'The Use of Knowledge in Society', author: 'F.A. Hayek', year: 1945,
    playlists: ['capitalism-communism'],
    themes: ['economics', 'capitalism', 'knowledge', 'markets'],
    text: `The curious task of economics is to demonstrate to men how little they really know about what they imagine they can design.\n\nThe peculiar character of the problem of a rational economic order is determined precisely by the fact that the knowledge of the circumstances of which we must make use never exists in concentrated or integrated form but solely as the dispersed bits of incomplete and frequently contradictory knowledge which all the separate individuals possess. The economic problem of society is thus not merely a problem of how to allocate "given" resources—if "given" is taken to mean given to a single mind which deliberately solves the problem set by these "data."`
  },
  {
    id: 'keynes-long-run',
    book: 'A Tract on Monetary Reform', author: 'John Maynard Keynes', year: 1923,
    playlists: ['capitalism-communism', 'first-lines'],
    themes: ['economics', 'policy', 'time'],
    text: `The long run is a misleading guide to current affairs. In the long run we are all dead. Economists set themselves too easy, too useless a task if in tempestuous seasons they can only tell us that when the storm is long past the ocean is flat again.\n\nBut this long run is a misleading guide to current affairs. In the long run we are all dead. Economists set themselves too easy, too useless a task if in tempestuous seasons they can only tell us that when the storm is long past the ocean is flat again.`
  },
  {
    id: 'gatsby-opening',
    book: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925,
    playlists: ['first-lines', 'must-read-40'],
    themes: ['fiction', 'american-dream', 'wealth'],
    text: `In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.\n\n"Whenever you feel like criticizing anyone," he told me, "just remember that all the people in this world haven't had the advantages that you've had."\n\nHe didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgements, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.`
  },
  {
    id: 'pride-prejudice-opening',
    book: 'Pride and Prejudice', author: 'Jane Austen', year: 1813,
    playlists: ['first-lines', 'must-read-40'],
    themes: ['fiction', 'marriage', 'society'],
    text: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.\n\n"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"\n\nMr. Bennet replied that he had not.`
  },
  {
    id: 'moby-dick-opening',
    book: 'Moby Dick', author: 'Herman Melville', year: 1851,
    playlists: ['first-lines', 'must-read-40'],
    themes: ['fiction', 'adventure', 'obsession'],
    text: `Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can.`
  },
  {
    id: 'anna-karenina-opening',
    book: 'Anna Karenina', author: 'Leo Tolstoy', year: 1878,
    playlists: ['first-lines', 'must-read-40'],
    themes: ['fiction', 'family', 'society', 'happiness'],
    text: `All happy families are alike; each unhappy family is unhappy in its own way.\n\nEverything was in confusion in the Oblonskys' house. The wife had discovered that the husband was carrying on an intrigue with a French girl, who had been a governess in their family, and she had announced to her husband that she could not go on living in the same house with him. This position of affairs had now lasted three days, and not only the husband and wife themselves, but all the members of their family and household, were painfully conscious of it.`
  },
  {
    id: '1984-opening',
    book: '1984', author: 'George Orwell', year: 1949,
    playlists: ['first-lines', 'must-read-40', 'tech-canon'],
    themes: ['dystopia', 'surveillance', 'totalitarianism'],
    text: `It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.\n\nThe hallway smelt of boiled cabbage and old rag mats. At one end of it a coloured poster, too large for the hallway, had been tacked to the wall. It depicted simply an enormous face, more than a metre wide: the face of a man of about forty-five, with a heavy black moustache and ruggedly handsome features.`
  },
  {
    id: 'zero-to-one-opening',
    book: 'Zero to One', author: 'Peter Thiel', year: 2014,
    playlists: ['tech-canon', 'ideas-3min'],
    themes: ['startups', 'technology', 'monopoly', 'innovation'],
    text: `Every moment in business happens only once. The next Bill Gates will not build an operating system. The next Larry Page or Sergey Brin won't make a search engine. And the next Mark Zuckerberg won't create a social network. If you are copying these guys, you aren't learning from them.\n\nOf course, it's easier to copy a model than to make something new. Doing what we already know how to do takes the world from 1 to n, adding more of something familiar. But every time we create something new, we go from 0 to 1. The act of creation is singular, as is the moment of creation, and the result is something fresh and strange.`
  },
  {
    id: 'innovators-ada',
    book: 'The Innovators', author: 'Walter Isaacson', year: 2014,
    playlists: ['tech-canon'],
    themes: ['technology', 'history', 'computing', 'ada-lovelace'],
    text: `Ada Lovelace was born in 1815, the only child of the poet Lord Byron and his wife Anne Isabelle Milbanke, who separated a month after her birth. Lady Byron, fearful that Ada might inherit her father's dangerous poetic temperament, raised her on a strict regimen of science and mathematics.\n\nAda met Charles Babbage in 1833, at a dinner party. Babbage showed her a small model of his Difference Engine, and Ada immediately grasped its potential. "Her eyes brightened, her colour rose," reported another guest. Here, at last, was something worthy of her imagination. She saw in his machine not just a calculator but a general-purpose computer — a mind of metal.`
  },
  {
    id: 'sicp-opening',
    book: 'Structure and Interpretation of Computer Programs', author: 'Harold Abelson & Gerald Jay Sussman', year: 1984,
    playlists: ['tech-canon'],
    themes: ['programming', 'computer-science', 'abstraction'],
    text: `A computational process is indeed much like a sorcerer's idea of a spirit. It cannot be seen or touched. It is not composed of matter at all. However, it is very real. It can perform intellectual work. It can answer questions. It can affect the world by disbursing money at a bank or by controlling a robot arm in a factory. The programs we use to conjure processes are like a sorcerer's spells. They are carefully composed from symbolic expressions in arcane and esoteric programming languages that prescribe the tasks we want our processes to perform.`
  },
  {
    id: 'innovators-internet',
    book: 'The Innovators', author: 'Walter Isaacson', year: 2014,
    playlists: ['tech-canon', 'ideas-3min'],
    themes: ['technology', 'internet', 'collaboration'],
    text: `The Internet was born from a desire to share, not to own. Unlike almost every other significant technology developed in the twentieth century, the Internet was not the result of a single inventor's eureka moment. Instead, it emerged from the collective creativity and collaborative spirit of thousands of engineers, visionaries, and rebels.\n\nWhat was most fascinating about the Internet's development was how it reflected a fundamental tension in human nature: the desire for individual expression versus the desire for collaborative community. The protocols that made the Internet work — TCP/IP, HTTP, HTML — were all created as open standards, freely shared, because their inventors understood that the network's value would grow exponentially with each new participant.`
  },
  {
    id: 'feynman-pleasure',
    book: 'The Pleasure of Finding Things Out', author: 'Richard Feynman', year: 1999,
    playlists: ['must-read-40', 'ideas-3min'],
    themes: ['science', 'curiosity', 'wonder', 'physics'],
    text: `I have a friend who's an artist and he's sometimes taken a view which I don't agree with very well. He'll hold up a flower and say, "Look how beautiful it is," and I'll agree. But then he'll say, "I, as an artist, can see how beautiful a flower is. But you, as a scientist, take it all apart and it becomes dull." I think he's wrong. I think the beauty that he sees is available to other people too—and to me, too, I believe.\n\nI can appreciate the beauty of a flower. At the same time, I see much more about the flower than he sees. I can imagine the cells inside, the complicated actions inside which also have a beauty. I mean it's not just beauty at this dimension, at one centimeter; there's also beauty at smaller dimensions, the inner structure, also the processes.`
  },
  {
    id: 'founders-quote',
    book: 'Founders at Work', author: 'Jessica Livingston', year: 2007,
    playlists: ['must-read-40', 'tech-canon'],
    themes: ['startups', 'founders', 'failure', 'persistence'],
    text: `One of the most striking things about successful founders is how often they succeeded by persisting through failure after failure. Apple almost died several times before it became the company we know. Google's early approach to advertising was rejected by the established players. Amazon lost money for years.\n\nWhat separated these companies wasn't avoiding failure — it was refusing to be defined by it. The founders who built lasting companies were the ones who could look at a door slamming in their face and immediately start looking for a window. Not from naivety, but from a bone-deep conviction that they were working on something that mattered.`
  },
  {
    id: 'sapiens-revolution',
    book: 'Sapiens', author: 'Yuval Noah Harari', year: 2011,
    playlists: ['must-read-40', 'ideas-3min'],
    themes: ['history', 'humans', 'cooperation', 'evolution'],
    text: `The Cognitive Revolution kick-started history about 70,000 years ago. What caused it? We're not sure. The most commonly believed theory argues that accidental genetic mutations changed the inner wiring of the brains of Sapiens, enabling them to think in unprecedented ways and to communicate using an altogether new type of language.\n\nWhat was so special about the new Sapiens language? The most common answer is that our language is amazingly supple. We can connect a limited number of sounds and signs to produce an infinite number of sentences, each with a distinct meaning. We can thereby ingest, store and communicate a prodigious amount of information about the surrounding world.\n\nBut the truly unique feature of our language is not its ability to transmit information about men and lions. Rather, it's the ability to transmit information about things that do not exist at all. As far as we know, only Sapiens can talk about entire kinds of entities that they have never seen, touched or smelled.`
  },
  {
    id: 'poor-charlies-mental',
    book: "Poor Charlie's Almanack", author: 'Charles T. Munger', year: 2005,
    playlists: ['must-read-40', 'ideas-3min'],
    themes: ['investing', 'thinking', 'mental-models', 'wisdom'],
    text: `I have what I call an iron prescription that helps me keep sane when I drift toward preferring one intense view over another on a complex topic. I put the thought in my mind: "What would change this view?" And if I can't easily answer that question, then I may be too committed. I can't be highly confident I'm right about complex issues if I can't easily explain what would make me reconsider.\n\nYou must know the big ideas in the big disciplines and use them routinely—all of them, not just a few. Most people are trained in one model—economics, for instance—and try to solve all problems in one way. You know the old saying: to the man with only a hammer, every problem looks like a nail. This is a dumb way of handling problems.`
  },
];

export const PLAYLISTS: Playlist[] = [
  {
    id: 'must-read-40',
    title: '40 Books Before You Die',
    description: 'The essential reading list. Compressed to their finest moments.',
    color: '#1D57F6', lightColor: '#7BAAFF', pattern: 'lines-v',
    clipIds: ['gatsby-opening','pride-prejudice-opening','moby-dick-opening','anna-karenina-opening','1984-opening','feynman-pleasure','founders-quote','sapiens-revolution','poor-charlies-mental'],
  },
  {
    id: 'capitalism-communism',
    title: 'Capitalism vs Communism',
    description: 'The greatest thinkers on how economies should be organized.',
    color: '#E54F10', lightColor: '#FF9B6B', pattern: 'lines-h',
    clipIds: ['smith-butcher','marx-opening','hayek-knowledge','keynes-long-run'],
  },
  {
    id: 'first-lines',
    title: 'Perfect First Lines',
    description: 'Opening sentences that changed everything.',
    color: '#E8225C', lightColor: '#FF85AA', pattern: 'dots',
    clipIds: ['gatsby-opening','pride-prejudice-opening','moby-dick-opening','anna-karenina-opening','1984-opening'],
  },
  {
    id: 'tech-canon',
    title: 'Tech Canon',
    description: 'Essential reading for builders and founders.',
    color: '#0099D6', lightColor: '#6BD4FF', pattern: 'grid',
    clipIds: ['zero-to-one-opening','innovators-ada','sicp-opening','innovators-internet','founders-quote','1984-opening'],
  },
  {
    id: 'ideas-3min',
    title: '3-Minute Ideas',
    description: 'Big ideas compressed to their sharpest form.',
    color: '#18A651', lightColor: '#6FFFA8', pattern: 'diagonal',
    clipIds: ['smith-butcher','marx-opening','hayek-knowledge','zero-to-one-opening','feynman-pleasure','sapiens-revolution','poor-charlies-mental','innovators-internet'],
  },
  {
    id: 'patricks-picks',
    title: "Patrick's Picks",
    description: 'The books that shaped how Stripe\'s founder thinks.',
    color: '#D4A017', lightColor: '#FFE07A', pattern: 'cross',
    clipIds: ['feynman-pleasure','poor-charlies-mental','sapiens-revolution','hayek-knowledge','zero-to-one-opening','founders-quote'],
  },
];

const CLIP_BY_ID = new Map(CLIPS.map(c => [c.id, c]))

/** Seconds of speech for one clip, at CLIP_WPM. */
export function clipDuration(clip: Clip): number {
  return Math.round((clip.text.trim().split(/\s+/).length / CLIP_WPM) * 60)
}

/** "45s" under a minute, "3:20" above it — bibli_009's own formatting. */
export function formatDuration(sec: number): string {
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** A playlist's clips, in order, skipping ids with no clip behind them. */
export function clipsFor(pl: Playlist): Clip[] {
  return pl.clipIds.map(id => CLIP_BY_ID.get(id)).filter((c): c is Clip => !!c)
}

export function playlistDuration(pl: Playlist): number {
  return clipsFor(pl).reduce((sum, c) => sum + clipDuration(c), 0)
}

export function findPlaylist(id: string | null): Playlist | null {
  return id ? PLAYLISTS.find(p => p.id === id) ?? null : null
}

/**
 * The card background: the playlist's flat colour plus a tiled line/dot motif.
 * bibli_009 built an <svg> string and injected it as innerHTML; here it's a
 * background-image so nothing untrusted goes near the DOM parser, and because a
 * CSS gradient tiles without needing an element of its own.
 */
export function patternStyle(pl: Playlist): CSSProperties {
  const c = pl.lightColor
  const line = (angle: string, size: string) => ({
    backgroundImage: `repeating-linear-gradient(${angle}, ${c} 0 1.2px, transparent 1.2px ${size})`,
  })
  const base: CSSProperties = { background: pl.color }
  const motif: CSSProperties =
    pl.pattern === 'lines-v' ? line('90deg', '6px')
    : pl.pattern === 'lines-h' ? line('0deg', '5px')
    : pl.pattern === 'diagonal' ? line('45deg', '8px')
    : pl.pattern === 'grid' ? {
        backgroundImage:
          `repeating-linear-gradient(90deg, ${c} 0 1px, transparent 1px 16px),` +
          `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 16px)`,
      }
    : pl.pattern === 'cross' ? {
        backgroundImage:
          `repeating-linear-gradient(90deg, ${c} 0 1px, transparent 1px 10px),` +
          `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 10px)`,
      }
    : { backgroundImage: `radial-gradient(${c} 1.2px, transparent 1.3px)`, backgroundSize: '8px 8px' }
  return { ...base, ...motif }
}
