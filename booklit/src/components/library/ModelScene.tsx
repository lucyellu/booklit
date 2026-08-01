import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import TWEEN from '@tweenjs/tween.js'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { computeTargets } from './LayoutEngine'
import { BOOK_H } from './bookTextures'
import { hashStr } from '../../lib/bookMeta'
import { analyzeIslands, buildAtlas, cloneGltf, applyToMesh, uprightMatrix } from './modelSkin'
import type { Islands } from './modelSkin'
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
 * Sibling to WebGLScene ("Books"), which builds its own boxes: that one renders
 * a whole page cheaply, this one renders far fewer books far better.
 */

/** Each book needs its own 1024² atlas — about 4 MB of GPU memory. */
const MAX_MODELS = 40
const COVER_CONCURRENCY = 6

interface Built {
  group: THREE.Group
  book: LocalBook
  atlas: THREE.Texture
  islands: Islands
  inner: THREE.Object3D
}

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export function ModelScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { layout, openReader, openDetail } = useApp()
  const { openBook } = useBook()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [hovered, setHovered] =
    useState<{ book: LocalBook; left: number; top: number } | null>(null)
  const layoutRef = useRef<((l: typeof layout) => void) | null>(null)

  const shown = books.slice(0, MAX_MODELS)
  const overflow = books.length - shown.length

  const handleOpen = useCallback((book: LocalBook) => {
    openBook(book).then(ok => { if (ok) openReader() })
  }, [openBook, openReader])

  const handlersRef = useRef({ open: handleOpen, detail: openDetail })
  useEffect(() => {
    handlersRef.current = { open: handleOpen, detail: openDetail }
  }, [handleOpen, openDetail])

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

    const built: Built[] = []
    let animId = 0

    const applyLayout = (which: typeof layout) => {
      const targets = computeTargets(which, built.length)
      const duration = 900
      built.forEach(({ group }, i) => {
        const t = targets[i]
        if (!t) return
        new TWEEN.Tween(group.position)
          .to({ x: t.position.x, y: t.position.y, z: t.position.z }, Math.random() * duration + duration)
          .easing(TWEEN.Easing.Exponential.InOut)
          .start()
        new TWEEN.Tween(group.rotation)
          .to({ x: t.rotation.x, y: t.rotation.y, z: t.rotation.z }, Math.random() * duration + duration)
          .easing(TWEEN.Easing.Exponential.InOut)
          .start()
      })
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
          .then(g => [n, g] as [string, GLTF])
          .catch(() => null)))
      if (disposed) return

      const templates = loaded.filter((x): x is [string, GLTF] => !!x)
      if (!templates.length) {
        setStatus({ kind: 'error', message: 'The book models failed to load.' })
        return
      }

      /* The island analysis walks every triangle, so it runs once per *model*
         and is shared by every book skinned with it. */
      const prepared = templates.map(([name, gltf]) => ({
        name, gltf, islands: analyzeIslands(gltf),
      })).filter(p => p.islands)

      if (!prepared.length) {
        setStatus({ kind: 'error', message: 'The models carry no UV data to place covers into.' })
        return
      }

      for (const book of shown) {
        // Stable per book, so a book keeps the same binding across reloads.
        const tpl = prepared[hashStr(book.id) % prepared.length]
        const inner = cloneGltf(tpl.gltf)
        inner.updateMatrixWorld(true)   // bbox below reads world matrices

        // Stand it up, then normalise the size — the source models differ in
        // both axis convention and scale, and the layout grid expects neither.
        inner.applyMatrix4(uprightMatrix(inner))
        inner.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(inner)
        const size = box.getSize(new THREE.Vector3())
        const scale = size.y > 0 ? BOOK_H / size.y : 1
        inner.scale.multiplyScalar(scale)
        inner.updateMatrixWorld(true)
        // Re-centre on the group origin whatever the model's own pivot was.
        const centred = new THREE.Box3().setFromObject(inner)
        inner.position.sub(centred.getCenter(new THREE.Vector3()))

        const atlas = buildAtlas(book, tpl.islands!, null)
        applyToMesh(inner, atlas)

        const group = new THREE.Group()
        group.add(inner)
        group.position.set(
          Math.random() * 3000 - 1500,
          Math.random() * 3000 - 1500,
          Math.random() * 3000 - 1500,
        )
        scene.add(group)
        built.push({ group, book, atlas, islands: tpl.islands!, inner })
      }

      if (disposed) return
      setStatus({ kind: 'ready' })
      applyLayout(layout)
      layoutRef.current = applyLayout

      // Repaint each atlas once its cover art is in, a few at a time.
      const queue = built.filter(b => !!b.book.coverUrl)
      let next = 0
      const pump = () => {
        if (disposed || next >= queue.length) return
        const item = queue[next++]
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (disposed) { pump(); return }
          const fresh = buildAtlas(item.book, item.islands, img)
          applyToMesh(item.inner, fresh)
          item.atlas.dispose()
          item.atlas = fresh
          pump()
        }
        img.onerror = () => pump()   // no cover: the typographic board stands
        img.src = item.book.coverUrl!
      }
      for (let i = 0; i < COVER_CONCURRENCY; i++) pump()
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

    const pick = (e: PointerEvent): Built | null => {
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
      if (!found) return
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

    const animate = () => {
      animId = requestAnimationFrame(animate)
      TWEEN.update()
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

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
      renderer.dispose()
      if (el.parentNode === container) container.removeChild(el)
      setHovered(null)
      setStatus({ kind: 'loading' })
    }
    // Layout is pushed in through layoutRef; rebuilding for it would re-download
    // nothing but would re-skin 40 atlases.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books])

  useEffect(() => { layoutRef.current?.(layout) }, [layout])

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
      {status.kind === 'ready' && (
        <p className="absolute bottom-2 left-2 z-10 text-[10.5px] text-text-muted pointer-events-none">
          Drag to orbit · scroll to zoom · click a book to read · shift-click for details
          {overflow > 0 && ` · showing the first ${MAX_MODELS} of ${books.length}`}
        </p>
      )}
    </div>
  )
}
