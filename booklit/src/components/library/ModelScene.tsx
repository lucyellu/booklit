import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { useApp } from '../../context/AppContext'
import { computeLayout } from './LayoutEngine'
import { createFramer, focusOnPoint, readAccentColor } from './frameCamera'
import { createTweens } from './tweens'
import type { Stoppable } from './tweens'
import { BOOK_W, BOOK_H } from './bookTextures'
import { hashStr } from '../../lib/bookMeta'
import { prepareModel, buildAtlas, cloneGltf, applyToMesh } from './modelSkin'
import type { ModelSkin } from './modelSkin'
import type { LocalBook } from '../../context/BookContext'
import { Loader2 } from 'lucide-react'

/**
 * The Models view: real hardcover GLB meshes, skinned per book.
 *
 * The models and the UV-island skinning come from `cards/library_001.html`.
 * They are streamed from that project through the backend's /models route
 * rather than copied into booklit/public — they are ~7 MB each and this repo is
 * public. If the folder isn't there, the view says so instead of hanging.
 *
 * This is the "4D" view. Sibling to WebGLScene ("3D"), which builds its own
 * boxes: that one renders a whole page cheaply, this one renders far fewer books
 * far better.
 */

/** Each book needs its own 1024² atlas — about 4 MB of GPU memory. */
const COVER_CONCURRENCY = 6

interface Built {
  group: THREE.Group
  book: LocalBook
  atlas: THREE.Texture
  skin: ModelSkin
  inner: THREE.Object3D
  cover: 'none' | 'pending' | 'done'
  /** The slot this book is flying to. Focusing aims here rather than at the
   *  group, so snapping to a book mid-rearrangement lands where it ends up. */
  target?: THREE.Vector3
}

interface Prepared { gltf: GLTF; skin: ModelSkin }

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export function ModelScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    layout, gridCols, gridRows, openDetail, closeDetail, detailBookId,
    registerFocusHandler, registerResetHandler,
  } = useApp()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [hovered, setHovered] =
    useState<{ book: LocalBook; left: number; top: number } | null>(null)

  /* The scene is built once and then kept: sorting and filtering push a new book
     list in through syncRef, and the layout through layoutRef. Rebuilding for
     either would re-download the models and re-skin every atlas — and, worse,
     would drop the books on the floor and fly them back in from nowhere instead
     of moving them from where they were to where they now belong. */
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
    if (!width || !height) return

    let disposed = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 20000)
    camera.position.set(0, 0, 1600)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      // Deferred: setting state synchronously inside an effect body cascades
      // a second render before this one has committed.
      queueMicrotask(() => setStatus({ kind: 'error', message: 'This browser has no WebGL context.' }))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearAlpha(0)
    // The GLBs are authored as PBR, so they look flat and grey without one.
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)

    const controls = new TrackballControls(camera, renderer.domElement)
    controls.minDistance = 200
    controls.maxDistance = 9000
    controls.rotateSpeed = 2.2
    controls.panSpeed = 0.6

    scene.add(new THREE.AmbientLight(0xfff0d0, 0.9))
    const key = new THREE.DirectionalLight(0xfff5e0, 1.5)
    key.position.set(500, 900, 800)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffd0a0, 0.45)
    fill.position.set(-800, 300, 500)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffe8c0, 0.3)
    rim.position.set(0, -500, -800)
    scene.add(rim)

    const tweens = createTweens()
    const framer = createFramer(camera, controls, tweens)
    const built: Built[] = []
    let prepared: Prepared[] = []
    let animId = 0
    let current = layout
    let spawn = 1600

    /* Fly every book to its slot. Positions are indexed, so this is what makes a
       sort read as a sort: the books that moved take the scenic route to where
       they now are, exactly as the three.js periodic table does when it goes
       from table to sphere. */
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
        const { group } = entry
        const t = targets[i]
        if (!t) return
        entry.target = new THREE.Vector3(t.position.x, t.position.y, t.position.z)
        // Staggered, as in the original — a single shared duration reads as one
        // rigid block sliding across rather than a shelf rearranging itself.
        const ms = Math.random() * duration + duration
        running.push(
          tweens.move(group.position, { x: t.position.x, y: t.position.y, z: t.position.z }, ms),
          tweens.move(group.rotation, { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z }, ms),
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

    // Selected book gets a wireframe outline, parented to its group so it rides
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
      const geo = new THREE.EdgesGeometry(
        new THREE.BoxGeometry(BOOK_W * 1.15, BOOK_H * 1.1, BOOK_W * 0.6),
      )
      selectionHelper = new THREE.LineSegments(
        geo, new THREE.LineBasicMaterial({ color: accentColor }),
      )
      entry.group.add(selectionHelper)
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
        framer, entry.target ?? entry.group.position, BOOK_W, BOOK_H,
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

    const make = (book: LocalBook): Built => {
      // Stable per book, so a book keeps the same binding across reloads.
      const tpl = prepared[hashStr(book.id) % prepared.length]
      const inner = cloneGltf(tpl.gltf)
      inner.updateMatrixWorld(true)

      // Stand it up, then normalise the size — the source models differ in
      // both axis convention and scale, and the layout grid expects neither.
      inner.applyMatrix4(tpl.skin.upright)
      inner.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(inner)
      const size = box.getSize(new THREE.Vector3())
      const scale = size.y > 0 ? BOOK_H / size.y : 1
      inner.scale.multiplyScalar(scale)
      inner.updateMatrixWorld(true)
      // Re-centre on the group origin whatever the model's own pivot was.
      const centred = new THREE.Box3().setFromObject(inner)
      inner.position.sub(centred.getCenter(new THREE.Vector3()))

      const atlas = buildAtlas(book, tpl.skin, null)
      applyToMesh(inner, atlas)

      const group = new THREE.Group()
      group.add(inner)
      // Books fly in from somewhere off the arrangement, as in the original.
      group.position.set(
        (Math.random() - 0.5) * 2 * spawn,
        (Math.random() - 0.5) * 2 * spawn,
        (Math.random() - 0.5) * 2 * spawn,
      )
      scene.add(group)
      return { group, book, atlas, skin: tpl.skin, inner, cover: 'none' }
    }

    const destroy = (b: Built) => {
      scene.remove(b.group)
      b.atlas.dispose()
      b.group.traverse(n => {
        const mesh = n as THREE.Mesh
        if (!mesh.isMesh) return
        // Geometry is shared with the loader's template — only the cloned
        // materials belong to this instance.
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach(m => m.dispose())
      })
    }

    let loading = 0
    const pumpCovers = () => {
      while (!disposed && loading < COVER_CONCURRENCY) {
        const item = built.find(b => b.cover === 'none' && b.book.coverUrl)
        if (!item) return
        item.cover = 'pending'
        loading++
        const img = new Image()
        img.crossOrigin = 'anonymous'
        const settle = (paint: boolean) => {
          loading--
          item.cover = 'done'
          // The book may have been filtered out while its cover was in flight.
          if (paint && !disposed && built.includes(item)) {
            const fresh = buildAtlas(item.book, item.skin, img)
            applyToMesh(item.inner, fresh)
            item.atlas.dispose()
            item.atlas = fresh
          }
          pumpCovers()
        }
        img.onload = () => settle(true)
        // No cover, or it 404s: the typographic board stands.
        img.onerror = () => settle(false)
        img.src = item.book.coverUrl!
      }
    }

    /** Reconcile the scene against a new book list, keeping what survives. */
    const sync = (next: LocalBook[]) => {
      if (disposed || !prepared.length) return
      const wanted = next
      const byId = new Map(built.map(b => [b.book.id, b]))
      const kept = wanted.map(book => {
        const existing = byId.get(book.id)
        if (!existing) return make(book)
        byId.delete(book.id)
        // Same book, possibly a fresher record — keep the mesh and the atlas.
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

    const build = async () => {
      let names: string[]
      try {
        const resp = await fetch('/api/models')
        const json = await resp.json()
        // Hardcovers only — softcover_01 is 18 MB and unwraps differently, so
        // its cover would land in the wrong place.
        names = (json.models ?? []).filter((n: string) => /^hardcover_\d+\.glb$/i.test(n))
      } catch {
        names = []
      }
      if (disposed) return
      if (!names.length) {
        setStatus({
          kind: 'error',
          message: 'No book models found. They live in cards/assets/models — set MODELS_DIR if that folder has moved.',
        })
        return
      }

      const loader = new GLTFLoader()
      const loaded = await Promise.all(names.map(n =>
        loader.loadAsync(`/models/${n}`)
          .then(g => g)
          .catch(() => null)))
      if (disposed) return

      const templates = loaded.filter((x): x is GLTF => !!x)
      if (!templates.length) {
        setStatus({ kind: 'error', message: 'The book models failed to load.' })
        return
      }

      /* The island analysis walks every triangle, so it runs once per *model*
         and is shared by every book skinned with it. */
      prepared = templates
        .map(gltf => ({ gltf, skin: prepareModel(gltf) }))
        .filter((p): p is Prepared => !!p.skin)

      if (!prepared.length) {
        setStatus({ kind: 'error', message: 'The models carry no UV data to place covers into.' })
        return
      }

      setStatus({ kind: 'ready' })
      syncRef.current = sync
      sync(booksRef.current)
    }

    build().catch(e => {
      if (!disposed) setStatus({ kind: 'error', message: (e as Error).message })
    })

    // Pointer: raycast for hover and click, drag suppressed so orbiting the
    // scene doesn't open whatever was under the cursor.
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let downAt: { x: number; y: number } | null = null
    const TOOLTIP_W = 268

    const pick = (e: PointerEvent | MouseEvent): Built | null => {
      if (!built.length) return null
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObjects(built.map(b => b.group), true)[0]
      if (!hit) return null
      // The hit is a mesh deep inside the clone; walk up to its book group.
      let node: THREE.Object3D | null = hit.object
      while (node) {
        const found = built.find(b => b.group === node)
        if (found) return found
        node = node.parent
      }
      return null
    }

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

    const animate = () => {
      animId = requestAnimationFrame(animate)
      tweens.update()
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    layoutRef.current = applyLayout
    selectionRef.current = applySelection
    focusRef.current = focusOn
    resetRef.current = resetView

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
      setStatus({ kind: 'loading' })
    }
    // Mount once. The book list and the layout are pushed in through refs.
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
      {status.kind === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="surface rounded-2xl px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span className="text-[12.5px] text-text-dim">Loading book models…</span>
          </div>
        </div>
      )}
      {status.kind === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <p className="text-text-muted text-[13px] text-center max-w-sm">{status.message}</p>
        </div>
      )}
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
      {status.kind === 'ready' && books.length > 0 && (
        <p className="absolute bottom-2 left-2 z-10 text-[10.5px] text-text-muted pointer-events-none">
          Drag to orbit · scroll to zoom · click a book for details · double-click or press F to focus · press R to reset
        </p>
      )}
    </div>
  )
}
