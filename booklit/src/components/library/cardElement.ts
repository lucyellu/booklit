import type { LocalBook } from '../../context/BookContext'
import type { CardMode } from '../../context/AppContext'
import { authorHue, hasDistinctSpineArt, spineWidth } from '../../lib/bookMeta'

/**
 * Builds one CSS3D card. Shared by both of CSS3DScene's build passes, which
 * previously carried near-identical copies of this — and both still painted the
 * pre-Forest `#111` gradient in Syne, a font the app no longer loads.
 *
 * Titles go in via textContent, never innerHTML: they come from user-supplied
 * CSV and EPUB metadata, so a title containing markup would otherwise be
 * injected straight into the page.
 */
export function buildCardElement(book: LocalBook, mode: CardMode): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'css3d-card'
  el.style.width = `${mode === 'spine' ? spineWidth(book.pages) : 140}px`
  el.style.height = '200px'
  el.style.borderRadius = '8px'
  el.style.overflow = 'hidden'
  el.style.cursor = 'pointer'
  el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)'
  el.style.fontFamily = 'Nunito, system-ui, sans-serif'

  const hue = authorHue(book.author, book.title)

  const placeholder = () => {
    const d = document.createElement('div')
    d.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
      `background:linear-gradient(145deg,hsl(${hue} 55% 26%),hsl(${hue} 58% 12%));`
    const s = document.createElement('span')
    s.style.cssText = 'font-size:32px;font-weight:800;color:rgba(255,255,255,0.35);'
    s.textContent = book.title.charAt(0)
    d.appendChild(s)
    return d
  }

  const coverImg = (src: string) => {
    const img = document.createElement('img')
    img.src = src
    img.alt = book.title
    img.loading = 'lazy'
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
    img.onerror = () => { img.replaceWith(placeholder()) }
    return img
  }

  if (mode === 'art') {
    const d = document.createElement('div')
    d.style.cssText =
      'width:100%;height:100%;padding:12px;display:flex;flex-direction:column;' +
      'justify-content:space-between;box-sizing:border-box;' +
      `background:linear-gradient(155deg,hsl(${hue} 62% 30%),hsl(${hue} 68% 14%));`
    const title = document.createElement('span')
    title.style.cssText = 'font-size:13px;font-weight:700;color:#fff;line-height:1.25;'
    title.textContent = book.title
    const author = document.createElement('span')
    author.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.7);'
    author.textContent = book.author || ''
    d.append(title, author)
    el.appendChild(d)
    return el
  }

  if (mode === 'book3d') {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'width:100%;height:100%;display:flex;'

    const spine = document.createElement('div')
    spine.style.cssText = 'width:18%;height:100%;flex-shrink:0;'
    if (hasDistinctSpineArt(book)) {
      spine.style.background = `url(${JSON.stringify(book.coverArtSpine)}) center/cover`
    } else {
      // The curated CSV's cover_art_spine is just the M-size of the same cover,
      // so a tinted slab reads as a spine far better than a squashed thumbnail.
      spine.style.background = `linear-gradient(90deg,hsl(${hue} 55% 16%),hsl(${hue} 58% 26%))`
    }

    const face = document.createElement('div')
    face.style.cssText = 'flex:1;height:100%;position:relative;overflow:hidden;'
    face.appendChild(book.coverUrl ? coverImg(book.coverUrl) : placeholder())
    const gutter = document.createElement('div')
    gutter.style.cssText =
      'position:absolute;inset:0 auto 0 0;width:12px;' +
      'background:linear-gradient(90deg,rgba(0,0,0,0.45),transparent);'
    face.appendChild(gutter)

    wrap.append(spine, face)
    el.appendChild(wrap)
    return el
  }

  // 'cover' and 'spine' both show the cover; spine just gets a narrower box.
  el.appendChild(book.coverUrl ? coverImg(book.coverUrl) : placeholder())
  return el
}
