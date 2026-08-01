import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { computeLayout } from './LayoutEngine'
import { createFramer } from './frameCamera'
import { createTweens } from './tweens'
import type { Stoppable } from './tweens'
import { buildCardElement, CARD_W, CARD_H } from './cardElement'
import type { LocalBook } from '../../context/BookContext'

interface Built {
  object: CSS3DObject
  book: LocalBook
}

export function CSS3DScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { layout, gridCols, gridRows, openReader, openDetail, cardMode } = useApp()
  const { openBook } = useBook()

  /* Built once; the book list, the layout and the card mode are pushed into the
     live scene through these. Re-sorting therefore moves each card from where it
     was to where it now belongs — the transform the three.js periodic table does
     between arrangements — instead of rebuilding the deck from scratch. */
  const syncRef = useRef<((b: LocalBook[]) => void) | null>(null)
  const layoutRef = useRef<((l: typeof layout) => void) | null>(null)
  const rebuildRef = useRef<(() => void) | null>(null)
  const booksRef = useRef(books)
  // The card mode changes what each element *is*, not where it sits, so it is
  // the one change that has to rebuild rather than retarget.
  const cardModeRef = useRef(cardMode)
  const gridRef = useRef({ cols: gridCols, rows: gridRows })

  // One click picks the book and fills the detail panel; two open it. Same in
  // all four views.
  const handleOpen = useCallback((book: LocalBook) => {
    openBook(book).then(ok => { if (ok) openReader() })
  }, [openBook, openReader])

  const handlersRef = useRef({ select: openDetail, open: handleOpen })
  useEffect(() => {
    handlersRef.current = { select: openDetail, open: handleOpen }
  }, [openDetail, handleOpen])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 10000)
    camera.position.z = 2000

    const renderer = new CSS3DRenderer()
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const render = () => renderer.render(scene, camera)

    const controls = new TrackballControls(camera, renderer.domElement)
    controls.minDistance = 500
    controls.maxDistance = 6000
    controls.addEventListener('change', render)

    const tweens = createTweens()
    const framer = createFramer(camera, controls, tweens)
    const built: Built[] = []
    let current = layout
    let spawn = 2000
    /* CSS3DRenderer draws on demand, so something has to pump frames for as
       long as a transition runs. Cheaper and more robust than a dummy tween:
       render until the last one is due to have finished. */
    let renderUntil = 0

    const make = (book: LocalBook): Built => {
      const el = buildCardElement(book, cardModeRef.current)
      const entry: Built = { object: new CSS3DObject(el), book }
      // Both read the record rather than closing over `book`, so a card that
      // survives a re-sort still points at the right thing.
      el.addEventListener('click', () => handlersRef.current.select(entry.book.id))
      el.addEventListener('dblclick', () => handlersRef.current.open(entry.book))
      // Cards fly in from somewhere off the arrangement, as in the original.
      entry.object.position.set(
        (Math.random() - 0.5) * 2 * spawn,
        (Math.random() - 0.5) * 2 * spawn,
        (Math.random() - 0.5) * 2 * spawn,
      )
      scene.add(entry.object)
      return entry
    }

    // CSS3DObject removes its own element from the DOM on 'removed'.
    const destroy = (b: Built) => scene.remove(b.object)

    let running: Stoppable[] = []
    const applyLayout = (which: typeof layout) => {
      current = which
      running.forEach(t => t.stop())
      running = []
      // Nothing to frame yet; the first sync will call straight back.
      if (!built.length) return

      const aspect = container.clientWidth / Math.max(1, container.clientHeight)
      const { targets, extent } = computeLayout(which, built.length, {
        cellW: CARD_W, cellH: CARD_H, aspect, ...gridRef.current,
      })
      spawn = Math.max(extent.x, extent.y, extent.z) * 1.4

      const duration = 1000
      built.forEach(({ object }, i) => {
        const target = targets[i]
        if (!target) return
        // Staggered, as in the original — one shared duration reads as a rigid
        // block sliding across rather than a deck rearranging itself.
        const ms = Math.random() * duration + duration
        running.push(
          tweens.move(object.position, {
            x: target.position.x, y: target.position.y, z: target.position.z,
          }, ms),
          tweens.move(object.rotation, {
            x: target.rotation.x, y: target.rotation.y, z: target.rotation.z,
          }, ms),
        )
      })
      running.push(...framer(extent, duration * 1.4))
      renderUntil = performance.now() + duration * 2 + 150
    }

    /** Reconcile the scene against a new book list, keeping what survives. */
    const sync = (next: LocalBook[]) => {
      const byId = new Map(built.map(b => [b.book.id, b]))
      const kept = next.map(book => {
        const existing = byId.get(book.id)
        if (!existing) return make(book)
        byId.delete(book.id)
        existing.book = book
        return existing
      })
      running.forEach(t => t.stop())
      running = []
      byId.forEach(destroy)
      built.length = 0
      built.push(...kept)
      applyLayout(current)
    }

    const rebuild = () => {
      running.forEach(t => t.stop())
      running = []
      built.forEach(destroy)
      built.length = 0
      sync(booksRef.current)
    }

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      // The block is shaped from the window, so a resize re-lays it out.
      applyLayout(current)
      render()
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    let animId = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      tweens.update()
      controls.update()
      if (performance.now() < renderUntil) render()
    }
    animate()

    layoutRef.current = applyLayout
    syncRef.current = sync
    rebuildRef.current = rebuild
    sync(booksRef.current)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      layoutRef.current = null
      syncRef.current = null
      rebuildRef.current = null
      tweens.stopAll()
      built.forEach(destroy)
      controls.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
    // Mount once. Everything else arrives through the refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    booksRef.current = books
    syncRef.current?.(books)
  }, [books])

  useEffect(() => {
    gridRef.current = { cols: gridCols, rows: gridRows }
    layoutRef.current?.(layout)
  }, [layout, gridCols, gridRows])

  useEffect(() => {
    // Skip the mount pass — the scene was just built in this mode.
    if (cardModeRef.current === cardMode) return
    cardModeRef.current = cardMode
    rebuildRef.current?.()
  }, [cardMode])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
