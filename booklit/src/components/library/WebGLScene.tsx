import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { useApp } from '../../context/AppContext'
import { computeLayout } from './LayoutEngine'
import { createFramer, focusOnPoint, readAccentColor } from './frameCamera'
import { createTweens } from './tweens'
import type { Stoppable } from './tweens'
import { spineWidth } from '../../lib/bookMeta'
import {
  BOOK_W, BOOK_H, coverTexture, spineTexture, backTexture, pagesTexture,
} from './bookTextures'
import type { LocalBook } from '../../context/BookContext'

/**
 * Real WebGL view: every book is a solid box with a cover, a printed spine and
 * cut page edges, arranged by the same LayoutEngine the CSS3D view uses.
 *
 * The plan called for loading GLB models from the CSV's `3d_mesh` column, which
 * is empty for all 763 rows — real models do exist, in the sibling cards/
 * project, and ModelScene loads those. These meshes are generated, which is what
 * lets this view carry a whole page where that one carries forty. Depth comes
 * from the page count, so the shelf has real variation for Goodreads and local
 * books and sits at the default width for the curated ones, whose `pages` column
 * is also empty.
 */

/**
 * Every book is its own mesh with its own three canvas textures, so the whole
 * page of 300 would be ~900 textures and 300 draw calls. 160 keeps a mid-range
 * laptop above 50fps; the rest of the page is reachable by paging or filtering,
 * and the overflow is stated in the UI rather than silently dropped.
 */

/** Concurrent cover downloads. Enough to fill in fast, few enough not to stall
    the rest of the app's image loading. */
const COVER_CONCURRENCY = 6

interface Built {
  mesh: THREE.Mesh
  book: LocalBook
  materials: THREE.MeshLambertMaterial[]
  ownTextures: THREE.Texture[]
  cover: 'none' | 'pending' | 'done'
  /** The slot this book is flying to. Focusing aims here rather than at the
   *  mesh, so snapping to a book mid-rearrangement lands where it ends up. */
  target?: THREE.Vector3
}

export function WebGLScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    layout, gridCols, gridRows, openDetail, closeDetail, detailBookId,
    registerFocusHandler, registerResetHandler,
  } = useApp()
  /* Tooltip position is stored already clamped, because it's the pointer handler
     that has the container's width — reading it back out of a ref while
     rendering is exactly what React tells you not to do. */
  const [hovered, setHovered] =
    useState<{ book: LocalBook; left: number; top: number } | null>(null)
  /* The scene is built once. A new book list — from sorting, filtering or
     paging — is pushed in through syncRef and reconciled against what is
     already there, and the layout through layoutRef. See the note on sync. */
  const syncRef = useRef<((b: LocalBook[]) => void) | null>(null)
  const layoutRef = useRef<((l: typeof layout) => void) | null>(null)
  const selectionRef = useRef<((id: string | null) => void) | null>(null)
  const focusRef = useRef<((id: string | null) => boolean) | null>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const booksRef = useRef(books)
  const gridRef = useRef({ cols: gridCols, rows: gridRows })
  const selectedIdRef = useRef(detailBookId)

  // Latest callbacks without re-mounting the scene. One click picks the book
  // and fills the detail panel, a click on empty space clears it; double-click
  // focuses the camera on it instead of opening the reader — reading now lives
  // only on the detail panel's button.
  const handlersRef = useRef({ select: openDetail, deselect: closeDetail })
  useEffect(() => {
    handlersRef.current = { select: openDetail, deselect: closeDetail }
  }, [openDetail, closeDetail])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const width = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 20000)
    camera.position.set(0, 0, 1800)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return   // no WebGL context available; the fallback message stays up
    }
    // Cap at 2 — a 3× retina buffer for a full-window canvas costs more than it
    // shows on boxes this size.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearAlpha(0)
    container.appendChild(renderer.domElement)

    const controls = new TrackballControls(camera, renderer.domElement)
    controls.minDistance = 300
    controls.maxDistance = 9000
    controls.rotateSpeed = 2.2
    controls.panSpeed = 0.6

    // Warm key light plus a cool fill, so the spines stay legible when a book
    // turns away from the camera.
    scene.add(new THREE.HemisphereLight(0xfdf6e3, 0x2a3a18, 1.35))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(600, 900, 1400)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xbcd9a0, 0.45)
    fill.position.set(-800, -300, -900)
    scene.add(fill)

    const tweens = createTweens()
    const framer = createFramer(camera, controls, tweens)
    const pages = pagesTexture()
    const built: Built[] = []
    let disposed = false
    let current = layout
    let spawn = 2000

    const make = (book: LocalBook): Built => {
      const depth = spineWidth(book.pages)
      const geo = new THREE.BoxGeometry(BOOK_W, BOOK_H, depth)

      const cover = coverTexture(book)
      const spine = spineTexture(book)
      const back = backTexture(book)

      // BoxGeometry face order is +X, −X, +Y, −Y, +Z, −Z. The book faces the
      // camera, so the cover is +Z and the spine is −X; the other three are cut
      // paper and share one texture.
      const edge = () => new THREE.MeshLambertMaterial({ map: pages })
      const materials = [
        edge(),
        new THREE.MeshLambertMaterial({ map: spine }),
        edge(),
        edge(),
        new THREE.MeshLambertMaterial({ map: cover }),
        new THREE.MeshLambertMaterial({ map: back }),
      ]

      const mesh = new THREE.Mesh(geo, materials)
      // Books fly in from somewhere off the arrangement, as in the original.
      mesh.position.set(
        (Math.random() - 0.5) * 2 * spawn,
        (Math.random() - 0.5) * 2 * spawn,
        (Math.random() - 0.5) * 2 * spawn,
      )
      mesh.userData.bookId = book.id
      scene.add(mesh)
      return { mesh, book, materials, ownTextures: [cover, spine, back], cover: 'none' }
    }

    const destroy = (b: Built) => {
      scene.remove(b.mesh)
      b.mesh.geometry.dispose()
      b.materials.forEach(m => m.dispose())
      // The shared pages texture is deliberately not disposed here.
      b.ownTextures.forEach(t => t.dispose())
    }

    /* Fly the boxes to their slots. Positions are indexed, so this is also what
       makes a re-sort read as a sort: each book travels from where it was to
       where it now belongs, the way the three.js periodic table moves between
       arrangements, rather than the shelf blinking into a new order. */
    let running: Stoppable[] = []
    // The extent of the arrangement as it currently stands, so the camera can be
    // re-fitted to it without recomputing — and therefore without disturbing —
    // where the books are.
    let extentNow: THREE.Vector3 | null = null
    const applyLayout = (which: typeof layout, force = false) => {
      current = which
      running.forEach(t => t.stop())
      running = []
      // Nothing to frame yet; the first sync will call straight back.
      if (!built.length) return

      const aspect = container.clientWidth / Math.max(1, container.clientHeight)
      const { targets, extent } = computeLayout(which, built.length, {
        cellW: BOOK_W, cellH: BOOK_H, aspect, ...gridRef.current,
      })
      spawn = Math.max(extent.x, extent.y, extent.z) * 1.4

      const duration = 900
      built.forEach((entry, i) => {
        const { mesh } = entry
        const t = targets[i]
        if (!t) return
        entry.target = new THREE.Vector3(t.position.x, t.position.y, t.position.z)
        // Staggered, as in the original — one shared duration reads as a rigid
        // block sliding across rather than a shelf rearranging itself.
        const ms = Math.random() * duration + duration
        running.push(
          tweens.move(mesh.position, { x: t.position.x, y: t.position.y, z: t.position.z }, ms),
          tweens.move(mesh.rotation, { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z }, ms),
        )
      })
      extentNow = extent
      running.push(...framer(extent, duration * 1.4, force))
    }

    /** Pull the camera back to hold the whole arrangement. Camera only — the
        books stay exactly where they are. */
    const frameAll = (ms = 700) => {
      if (!extentNow) return
      running.push(...framer(extentNow, ms, true))
    }

    // Selected book gets a wireframe outline, parented to its mesh so it rides
    // along for free through every tween — no per-frame bookkeeping needed.
    const accentColor = readAccentColor()
    let selectionHelper: THREE.LineSegments | null = null
    const applySelection = (id: string | null) => {
      if (selectionHelper) {
        selectionHelper.parent?.remove(selectionHelper)
        selectionHelper.geometry.dispose()
        ;(selectionHelper.material as THREE.LineBasicMaterial).dispose()
        selectionHelper = null
      }
      const entry = id ? built.find(b => b.book.id === id) : undefined
      if (!entry) return
      const depth = spineWidth(entry.book.pages)
      const geo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(BOOK_W * 1.08, BOOK_H * 1.08, depth + 10),
      )
      selectionHelper = new THREE.LineSegments(
        geo, new THREE.LineBasicMaterial({ color: accentColor }),
      )
      entry.mesh.add(selectionHelper)
    }

    /** Snap the camera onto one book, or back out to the whole arrangement if
        nothing is selected. */
    const focusOn = (id: string | null): boolean => {
      if (!built.length) return false
      // Forced, because backing out is a deliberate move: the arrangement is the
      // same size it was, so the framer would otherwise call the camera "close
      // enough" and leave it sitting on the book.
      if (!id) { frameAll(); return true }
      const entry = built.find(b => b.book.id === id)
      if (!entry) return false
      running.push(...focusOnPoint(
        framer, entry.target ?? entry.mesh.position, BOOK_W, BOOK_H,
      ))
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

    /* Swap in real cover art as it arrives. Throttled, and every load is
       recorded so the texture can be disposed on unmount even if it lands after
       the user has already left the view. */
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    let loading = 0
    const pumpCovers = () => {
      while (!disposed && loading < COVER_CONCURRENCY) {
        const item = built.find(b => b.cover === 'none' && b.book.coverUrl)
        if (!item) return
        item.cover = 'pending'
        loading++
        loader.load(
          item.book.coverUrl!,
          tex => {
            loading--
            item.cover = 'done'
            // The book may have been filtered out while its cover was in flight.
            if (disposed || !built.includes(item)) { tex.dispose(); pumpCovers(); return }
            tex.colorSpace = THREE.SRGBColorSpace
            tex.anisotropy = 4
            const front = item.materials[4]
            front.map?.dispose()
            front.map = tex
            front.needsUpdate = true
            item.ownTextures.push(tex)
            pumpCovers()
          },
          undefined,
          // A cover that 404s or is blocked by CORS just keeps its painted board.
          () => { loading--; item.cover = 'done'; pumpCovers() },
        )
      }
    }

    /** Reconcile the scene against a new book list, keeping what survives. */
    const sync = (next: LocalBook[]) => {
      if (disposed) return
      const wanted = next
      const byId = new Map(built.map(b => [b.book.id, b]))
      const kept = wanted.map(book => {
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
      pumpCovers()
    }

    // Pointer: raycast for hover and click, with drag suppressed so orbiting
    // the scene doesn't open whatever happened to be under the cursor.
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downAt: { x: number; y: number } | null = null

    const pick = (e: PointerEvent | MouseEvent): Built | null => {
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(built.map(b => b.mesh), false)[0]
      if (!hit) return null
      return built.find(b => b.mesh === hit.object) ?? null
    }

    const TOOLTIP_W = 268
    const onMove = (e: PointerEvent) => {
      const found = pick(e)
      renderer.domElement.style.cursor = found ? 'pointer' : 'grab'
      if (!found) { setHovered(null); return }
      const rect = container.getBoundingClientRect()
      setHovered({
        book: found.book,
        left: Math.max(0, Math.min(
          e.clientX - rect.left + 14, container.clientWidth - TOOLTIP_W,
        )),
        top: e.clientY - rect.top + 14,
      })
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
    const onLeave = () => setHovered(null)

    const el = renderer.domElement
    el.style.cursor = 'grab'
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('dblclick', onDouble)
    el.addEventListener('pointerleave', onLeave)

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      // Only the camera adapts. The block is shaped from the window, so
      // re-laying it out here meant every book flew to a new slot the moment the
      // detail panel slid in beside the canvas — selecting a book is supposed to
      // be a camera move, not a rearrangement. 'R' re-shapes the block for the
      // window you have now, when that's actually what you want.
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    let animId = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      tweens.update()
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    layoutRef.current = applyLayout
    syncRef.current = sync
    selectionRef.current = applySelection
    focusRef.current = focusOn
    resetRef.current = resetView
    sync(booksRef.current)

    return () => {
      disposed = true
      layoutRef.current = null
      syncRef.current = null
      selectionRef.current = null
      focusRef.current = null
      resetRef.current = null
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('dblclick', onDouble)
      el.removeEventListener('pointerleave', onLeave)
      controls.dispose()
      tweens.stopAll()
      built.forEach(destroy)
      renderer.dispose()
      if (el.parentNode === container) container.removeChild(el)
      setHovered(null)
    }
    // Mount once. The book list and the layout are pushed in through refs, so
    // switching Grid → Sphere, or re-sorting, animates rather than dropping 160
    // meshes on the floor and making 480 new textures.
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

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {hovered && (
        <div
          className="surface pointer-events-none absolute z-20 max-w-64 rounded-xl px-3 py-2 shadow-lg"
          style={{ left: hovered.left, top: hovered.top }}
        >
          <p className="text-[12px] font-bold text-text leading-tight">{hovered.book.title}</p>
          {hovered.book.author && (
            <p className="text-[11px] text-text-muted mt-0.5">{hovered.book.author}</p>
          )}
        </div>
      )}
      <p className="absolute bottom-2 left-2 z-10 text-[10.5px] text-text-muted pointer-events-none">
        Drag to orbit · scroll to zoom · click a book for details · double-click or press F to focus · press R to reset
      </p>
    </div>
  )
}
