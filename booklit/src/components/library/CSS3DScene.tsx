import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { useApp } from '../../context/AppContext'
import { computeLayout } from './LayoutEngine'
import { createFramer, focusOnPoint } from './frameCamera'
import { createTweens } from './tweens'
import type { Stoppable } from './tweens'
import {
  buildCardElement, CARD_W, CARD_H, CARD_SHADOW, CARD_SHADOW_SELECTED,
} from './cardElement'
import type { LocalBook } from '../../context/BookContext'

interface Built {
  object: CSS3DObject
  book: LocalBook
  /** The slot this card is flying to. Focusing aims here rather than at the
   *  object, so snapping to a card mid-rearrangement lands where it ends up. */
  target?: THREE.Vector3
}

export function CSS3DScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    layout, gridCols, gridRows, openDetail, closeDetail, cardMode, detailBookId,
    registerFocusHandler, registerResetHandler,
  } = useApp()

  /* Built once; the book list, the layout and the card mode are pushed into the
     live scene through these. Re-sorting therefore moves each card from where it
     was to where it now belongs — the transform the three.js periodic table does
     between arrangements — instead of rebuilding the deck from scratch. */
  const syncRef = useRef<((b: LocalBook[]) => void) | null>(null)
  const layoutRef = useRef<((l: typeof layout) => void) | null>(null)
  const rebuildRef = useRef<(() => void) | null>(null)
  const selectionRef = useRef<((id: string | null) => void) | null>(null)
  const focusRef = useRef<((id: string | null) => boolean) | null>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const booksRef = useRef(books)
  // The card mode changes what each element *is*, not where it sits, so it is
  // the one change that has to rebuild rather than retarget.
  const cardModeRef = useRef(cardMode)
  const gridRef = useRef({ cols: gridCols, rows: gridRows })
  const selectedIdRef = useRef(detailBookId)

  // One click picks the book and fills the detail panel; a click on empty
  // space clears it. (Opening the reader now lives only on the "Read free"
  // button — double-click focuses the camera instead, see focusOn below.)
  const handlersRef = useRef({ select: openDetail, deselect: closeDetail })
  useEffect(() => {
    handlersRef.current = { select: openDetail, deselect: closeDetail }
  }, [openDetail, closeDetail])

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
    // The extent of the arrangement as it currently stands, so the camera can be
    // re-fitted to it without recomputing — and therefore without disturbing —
    // where the cards are.
    let extentNow: THREE.Vector3 | null = null
    const applyLayout = (which: typeof layout, force = false) => {
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
      built.forEach((entry, i) => {
        const { object } = entry
        const target = targets[i]
        if (!target) return
        entry.target = new THREE.Vector3(
          target.position.x, target.position.y, target.position.z,
        )
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
      extentNow = extent
      running.push(...framer(extent, duration * 1.4, force))
      renderUntil = performance.now() + duration * 2 + 150
    }

    /** Pull the camera back to hold the whole arrangement. Camera only — the
        cards stay exactly where they are. */
    const frameAll = (ms = 700) => {
      if (!extentNow) return
      running.push(...framer(extentNow, ms, true))
      renderUntil = performance.now() + ms + 150
    }

    /** Outline the selected card; everyone else gets the plain shadow back. */
    const applySelection = (id: string | null) => {
      built.forEach(b => {
        b.object.element.style.boxShadow = b.book.id === id ? CARD_SHADOW_SELECTED : CARD_SHADOW
      })
    }

    /** Snap the camera onto one book, or back out to the whole arrangement if
        nothing is selected. */
    const focusOn = (id: string | null): boolean => {
      if (!built.length) return false
      // Forced, because backing out is a deliberate move: the arrangement is the
      // same size it was, so the framer would otherwise call the camera "close
      // enough" and leave it sitting on the card.
      if (!id) { frameAll(); return true }
      const entry = built.find(b => b.book.id === id)
      if (!entry) return false
      running.push(...focusOnPoint(
        framer, entry.target ?? entry.object.position, CARD_W, CARD_H,
      ))
      renderUntil = performance.now() + 850
      return true
    }

    /** Clears the selection and forces the camera back to frame the whole
        arrangement — unlike backing out via focusOn(null), this always moves
        even if the arrangement's own extent hasn't changed, so it also
        recovers from a pan or zoom drifting away from it. */
    const resetView = () => {
      handlersRef.current.deselect()
      applyLayout(current, true)
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
      applySelection(selectedIdRef.current)
    }

    const rebuild = () => {
      running.forEach(t => t.stop())
      running = []
      built.forEach(destroy)
      built.length = 0
      sync(booksRef.current)
    }

    // Pointer: the CSS3DObject elements are real, clickable DOM nodes — but
    // TrackballControls captures the pointer on renderer.domElement on every
    // pointerdown, and per the Pointer Events spec that also retargets the
    // compatibility mouse events (click, dblclick) to the capture target. A
    // listener sitting on the card itself never sees them. So, like the WebGL
    // and Models views, this listens on the same captured element and hit-tests
    // by hand — via elementFromPoint here, since there's no raycaster for DOM.
    let downAt: { x: number; y: number } | null = null
    const pick = (e: PointerEvent | MouseEvent): Built | null => {
      const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const cardEl = hit?.closest<HTMLElement>('.css3d-card')
      if (!cardEl) return null
      return built.find(b => b.book.id === cardEl.dataset.bookId) ?? null
    }
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (!downAt) return
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
      downAt = null
      if (moved > 5) return
      const found = pick(e)
      if (found) handlersRef.current.select(found.book.id)
      else handlersRef.current.deselect()
    }
    // A drag that ends where it began still counts as a click, so the double
    // click is picked up here rather than by counting clicks in onUp.
    const onDouble = (e: MouseEvent) => {
      const found = pick(e)
      if (found) focusOn(found.book.id)
    }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('dblclick', onDouble)

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      // Only the camera adapts. The block is shaped from the window, so
      // re-laying it out here meant every card flew to a new slot the moment the
      // detail panel slid in beside the canvas — selecting a book is supposed to
      // be a camera move, not a rearrangement. 'R' re-shapes the block for the
      // window you have now, when that's actually what you want.
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
    selectionRef.current = applySelection
    focusRef.current = focusOn
    resetRef.current = resetView
    sync(booksRef.current)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('dblclick', onDouble)
      layoutRef.current = null
      syncRef.current = null
      rebuildRef.current = null
      selectionRef.current = null
      focusRef.current = null
      resetRef.current = null
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

  // The active scene wires its own focusOn into context so the 'F' key
  // (LibraryView) and the detail panel's Focus button — both outside this
  // component — can reach it.
  useEffect(() => {
    registerFocusHandler(id =>
      focusRef.current?.(id === undefined ? selectedIdRef.current : id) ?? false)
    return () => registerFocusHandler(null)
  }, [registerFocusHandler])

  useEffect(() => {
    registerResetHandler(() => resetRef.current?.())
    return () => registerResetHandler(null)
  }, [registerResetHandler])

  useEffect(() => {
    selectedIdRef.current = detailBookId
    selectionRef.current?.(detailBookId)
  }, [detailBookId])

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
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {books.length > 0 && (
        <p className="absolute bottom-2 left-2 z-10 text-[10.5px] text-text-muted pointer-events-none">
          Drag to orbit · scroll to zoom · click a book for details · double-click or press F to focus · press R to reset
        </p>
      )}
    </div>
  )
}
