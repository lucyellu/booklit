import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import TWEEN from '@tweenjs/tween.js'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { computeTargets } from './LayoutEngine'
import { spineWidth } from '../../lib/bookMeta'
import {
  BOOK_W, BOOK_H, coverTexture, spineTexture, backTexture, pagesTexture,
} from './bookTextures'
import type { LocalBook } from '../../context/BookContext'

/**
 * Real WebGL view: every book is a solid box with a cover, a printed spine and
 * cut page edges, arranged by the same LayoutEngine the CSS3D view uses.
 *
 * This replaces a placeholder that rendered the words "coming soon". The plan
 * called for loading GLB models from the CSV's `3d_mesh` column, but that column
 * is empty for all 763 rows and no .glb files exist anywhere in the project — so
 * the meshes are generated instead. Depth comes from the page count, which means
 * the shelf has real variation for Goodreads and local books and sits at the
 * default width for the curated ones, whose `pages` column is also empty.
 */

/**
 * Every book is its own mesh with its own three canvas textures, so the whole
 * page of 300 would be ~900 textures and 300 draw calls. 160 keeps a mid-range
 * laptop above 50fps; the rest of the page is reachable by paging or filtering,
 * and the overflow is stated in the UI rather than silently dropped.
 */
const MAX_MESHES = 160

/** Concurrent cover downloads. Enough to fill in fast, few enough not to stall
    the rest of the app's image loading. */
const COVER_CONCURRENCY = 6

interface Built {
  mesh: THREE.Mesh
  book: LocalBook
  materials: THREE.MeshLambertMaterial[]
  ownTextures: THREE.Texture[]
}

export function WebGLScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { layout, openReader, openDetail } = useApp()
  const { openBook } = useBook()
  /* Tooltip position is stored already clamped, because it's the pointer handler
     that has the container's width — reading it back out of a ref while
     rendering is exactly what React tells you not to do. */
  const [hovered, setHovered] =
    useState<{ book: LocalBook; left: number; top: number } | null>(null)
  /* Layout changes are pushed into the live scene through this ref rather than
     being an effect dependency — see the teardown note below. */
  const layoutRef = useRef<((l: typeof layout) => void) | null>(null)

  const shown = books.slice(0, MAX_MESHES)
  const overflow = books.length - shown.length

  const handleOpen = useCallback((book: LocalBook) => {
    openBook(book).then(ok => { if (ok) openReader() })
  }, [openBook, openReader])

  // Latest callbacks without re-mounting the scene.
  const handlersRef = useRef({ open: handleOpen, detail: openDetail })
  useEffect(() => {
    handlersRef.current = { open: handleOpen, detail: openDetail }
  }, [handleOpen, openDetail])

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

    const pages = pagesTexture()
    const built: Built[] = []

    for (const book of shown) {
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
      mesh.position.set(
        Math.random() * 4000 - 2000,
        Math.random() * 4000 - 2000,
        Math.random() * 4000 - 2000,
      )
      mesh.userData.bookId = book.id
      scene.add(mesh)
      built.push({ mesh, book, materials, ownTextures: [cover, spine, back] })
    }

    // Fly the boxes into the chosen layout.
    const applyLayout = (which: typeof layout) => {
      const targets = computeTargets(which, built.length)
      const duration = 900
      built.forEach(({ mesh }, i) => {
        const t = targets[i]
        if (!t) return
        new TWEEN.Tween(mesh.position)
          .to({ x: t.position.x, y: t.position.y, z: t.position.z }, Math.random() * duration + duration)
          .easing(TWEEN.Easing.Exponential.InOut)
          .start()
        new TWEEN.Tween(mesh.rotation)
          .to({ x: t.rotation.x, y: t.rotation.y, z: t.rotation.z }, Math.random() * duration + duration)
          .easing(TWEEN.Easing.Exponential.InOut)
          .start()
      })
    }
    applyLayout(layout)

    /* Swap in real cover art as it arrives. Throttled, and every load is
       recorded so the texture can be disposed on unmount even if it lands after
       the user has already left the view. */
    let disposed = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const queue = built.filter(b => !!b.book.coverUrl)
    let next = 0
    const pump = () => {
      if (disposed || next >= queue.length) return
      const item = queue[next++]
      loader.load(
        item.book.coverUrl!,
        tex => {
          if (disposed) { tex.dispose(); return }
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = 4
          const front = item.materials[4]
          front.map?.dispose()
          front.map = tex
          front.needsUpdate = true
          item.ownTextures.push(tex)
          pump()
        },
        undefined,
        // A cover that 404s or is blocked by CORS just keeps its painted board.
        () => pump(),
      )
    }
    for (let i = 0; i < COVER_CONCURRENCY; i++) pump()

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
      if (!found) return
      // Shift-click asks about a book instead of opening it — the 3D view has no
      // room for the grid's hover buttons.
      if (e.shiftKey) handlersRef.current.detail(found.book.id)
      else handlersRef.current.open(found.book)
    }
    const onLeave = () => setHovered(null)

    const el = renderer.domElement
    el.style.cursor = 'grab'
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    let animId = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      TWEEN.update()
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    layoutRef.current = applyLayout

    return () => {
      disposed = true
      layoutRef.current = null
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      controls.dispose()
      for (const b of built) {
        scene.remove(b.mesh)
        b.mesh.geometry.dispose()
        b.materials.forEach(m => m.dispose())
        // The shared pages texture is deliberately not disposed here.
        b.ownTextures.forEach(t => t.dispose())
      }
      renderer.dispose()
      if (el.parentNode === container) container.removeChild(el)
      setHovered(null)
    }
    // Rebuilt only when the book set changes. The layout is re-applied through
    // layoutRef instead, so switching Grid → Sphere animates rather than
    // dropping 160 meshes on the floor and making 480 new textures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books])

  useEffect(() => { layoutRef.current?.(layout) }, [layout])

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
        Drag to orbit · scroll to zoom · click a book to read · shift-click for details
        {overflow > 0 && ` · showing the first ${MAX_MESHES} of ${books.length}`}
      </p>
    </div>
  )
}
