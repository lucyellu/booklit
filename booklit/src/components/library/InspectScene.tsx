import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { createBookRig, updateLeafFlex, LEAVES } from './bookRig'
import type { BookRig } from './bookRig'
import type { LocalBook } from '../../context/BookContext'
import {
  X, BookOpen, BookMarked, ChevronLeft, ChevronRight, RotateCcw, ImageOff,
} from 'lucide-react'

/**
 * One book, close up: orbit the binding, open the boards, and drag the pages
 * over with the pointer.
 *
 * This is the view the library never had. `CSS3DScene` and `WebGLScene` carry a
 * whole page of books and `ModelScene` carries forty, so all three are built
 * around cost per book — a shut object you look at. Here there is exactly one,
 * which buys physical materials, self-shadowing, and a page that bends while
 * you hold it.
 *
 * It orbits rather than trackballs, unlike its three siblings. Trackball is the
 * right control for a grid you fly around; for a single object it lets the
 * horizon roll over and you end up inspecting a book that is slowly going
 * upside down. Orbit pins the up vector.
 */

/** Degrees a board swings when the book opens. A shade under flat, because a
 *  hardcover pressed to 180 looks broken-spined. */
const OPEN_ANGLE = Math.PI * 0.94

/** Opening seat: three-quarters on, from slightly above. Square-on hides the
 *  thickness, which is the one thing a photograph of a book can't show and this
 *  can. */
const HOME = new THREE.Vector3(185, 165, 420)

/**
 * The studio.
 *
 * These are the *themed* values, not the ones the reference passes to its
 * constructors — it builds the room in warm paper tones and then immediately
 * re-tints every material and light from the selected book's palette, before
 * the first frame. Porting the constructor arguments and missing that pass is
 * how this ended up as a near-white room bouncing five softboxes into a blown
 * out book. The room a reader actually sees is nearly black.
 */
const STUDIO = {
  floor: 0x10131b,
  wall: 0x171a24,
  /** Warm sky over a dark ground bounce. */
  hemiSky: 0xf1eadf,
  hemiGround: 0x3a2118,
  key: 0xf4d7b9,
  fill: 0x9fb3c9,
} as const

/**
 * Scale between the reference's world and ours, and the point conversion that
 * goes with it. Its book is roughly 1.02 x 1.58 x 0.26 units sitting on a shelf
 * with its centre near y = 1.5; ours is 140 x 200 centred on the origin.
 *
 * Light *intensities* deliberately do not get scaled by this. A directional
 * light's irradiance is distance-invariant, and a rect light's depends on the
 * solid angle it subtends — so scaling a softbox's position and its width and
 * height together leaves its contribution unchanged. Fog density is the
 * exception, being per world unit; see its use below.
 */
const S = 130
const at = (x: number, y: number, z: number) =>
  new THREE.Vector3(x * S, (y - 1.5) * S, z * S)

export function InspectScene({ book, coverUrl, onClose }: {
  book: LocalBook
  /**
   * The cover the panel is actually showing. Passed in rather than read off
   * `book.coverUrl`, because those are frequently not the same URL: a card is
   * one *work*, and the record that won dedupe may be a curated row with no art
   * while a merged sibling edition has it — plus the user can pick a different
   * edition's cover, and a broken image falls back. Reading the raw field meant
   * every deduped book got the painted board instead of its own cover.
   */
  coverUrl?: string
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [spread, setSpread] = useState(0)
  /* Whether the real cover art made it onto the board. Reported rather than
     swallowed: a silent failure here is indistinguishable from "this book has
     no cover", and the painted fallback is convincing enough that it reads as
     a deliberate design rather than a broken image.

     The outcome is stored against the URL it belongs to, so a result for a
     cover the user has already switched away from is ignored rather than
     mislabelling the new one — and so the status needs no resetting when the
     book changes, which would mean setting state from the effect body. */
  const [outcome, setOutcome] = useState<{ url: string; status: 'ok' | 'failed' } | null>(null)
  const cover: 'none' | 'loading' | 'ok' | 'failed' = !coverUrl
    ? 'none'
    : outcome?.url === coverUrl ? outcome.status : 'loading'

  /* The scene reads intent through refs rather than being rebuilt: React owns
     the buttons, the render loop owns the book, and a state change must not
     tear down a WebGL context. */
  const openRef = useRef(false)
  const turnedRef = useRef(0)
  const commandRef = useRef<{ reset?: () => void }>({})

  const turn = useCallback((direction: 1 | -1) => {
    const next = Math.min(LEAVES, Math.max(0, turnedRef.current + direction))
    if (next === turnedRef.current) return
    turnedRef.current = next
    setSpread(next)
    // Turning a page on a shut book opens it first — otherwise the control does
    // nothing visible and reads as broken.
    if (!openRef.current) { openRef.current = true; setOpen(true) }
  }, [])

  const toggleOpen = useCallback(() => {
    openRef.current = !openRef.current
    setOpen(openRef.current)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /* ---- renderer, camera, controls ---- */

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      // No WebGL. The panel's own fallback copy covers this case.
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    /* Back to ACES at 0.9, which is what the reference uses and what the
       side-by-side settled. I had switched this to Neutral on the theory that
       ACES was desaturating the covers — but the same covers went through ACES
       in the reference and looked fine, so the curve was never the problem.
       Washed out was the lighting: hard lamps over a black room. ACES only
       looks flat when there's nothing in the shadows for it to roll off. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    /* Exponential fog in the wall colour. This is what turns a lit floor and a
       lit backdrop into a single seamless dark field instead of two visibly
       different planes meeting at a horizon — the room stops being a room and
       becomes a background.

       Density is per world unit, so unlike the light intensities it does *not*
       survive the change of scale: the reference's 0.027 is against a book one
       unit tall, and at 130x that would fog the book itself into nothing. */
    scene.fog = new THREE.FogExp2(STUDIO.wall, 0.027 / S)

    const camera = new THREE.PerspectiveCamera(
      35, container.clientWidth / container.clientHeight, 1, 4000,
    )
    camera.position.copy(HOME)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 150
    controls.maxDistance = 1400
    // Stop short of the poles: past them the book is edge-on and the controls
    // gimbal-flip as they cross.
    controls.minPolarAngle = 0.12
    controls.maxPolarAngle = Math.PI * 0.86
    controls.target.set(0, 0, 0)

    /* ---- light ----

       A studio, not a stage. The version before this was three directional
       lights over a near-black ground with the environment probe held down to
       0.35 — all of it hard, punchy and directional, which is what put a
       travelling highlight on the cover and left everything else flat. Broad
       soft sources over a bright warm room is the opposite approach and the
       one that actually suits a book: almost all of the light arrives as
       ambient bounce, and the single hard lamp is there to cast a shadow
       rather than to do the lighting.

       Positions are converted from the reference rig. Its book is about
       1.02 x 1.58 x 0.26 units with its centre near y = 1.5; ours is 140 x 200
       centred on the origin, so a point of theirs maps to (x, y - 1.5, z) * S.

       Intensities carry over unconverted, which is not a fudge: a
       DirectionalLight's irradiance is distance-invariant, and a
       RectAreaLight's depends on the solid angle it subtends — so scaling a
       rect light's position *and* its width and height by the same factor
       leaves its contribution identical. */
    // Required before any RectAreaLight renders — it uploads the BRDF lookup
    // tables the area-light shader samples. Without it they light nothing.
    RectAreaLightUniformsLib.init()

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envTarget.texture
    scene.environmentIntensity = 0.72

    // Warm sky over a warm bounce floor. This carries the scene; everything
    // below is modelling on top of it.
    scene.add(new THREE.HemisphereLight(STUDIO.hemiSky, STUDIO.hemiGround, 0.56))

    // The only hard lamp, and the only one that casts.
    const key = new THREE.DirectionalLight(STUDIO.key, 1.42)
    key.position.copy(at(-4.6, 7.4, 5.8))
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -6 * S
    key.shadow.camera.right = 6 * S
    key.shadow.camera.top = 6 * S
    key.shadow.camera.bottom = -3 * S
    key.shadow.camera.near = 1 * S
    key.shadow.camera.far = 18 * S
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.018 * S
    key.shadow.radius = 3.5
    scene.add(key)

    const fill = new THREE.DirectionalLight(STUDIO.fill, 0.3)
    fill.position.copy(at(5.5, 3.6, 4.2))
    scene.add(fill)

    /* The softboxes. Each is metres across at this scale — the cloth softbox is
       more than four times the book's own width — and that size is the point: a
       big source wraps light round an edge instead of drawing a line on it. */
    const softboxes = [
      // Main softbox, front left.
      { color: 0xffe8c2, power: 5.4, w: 4.8, h: 5.6, at: [-3.2, 5.5, 4.6], aim: [0, 1.45, 0] },
      // Warm rake from behind right — catches the fore edge and the boards.
      { color: 0xd5a45e, power: 3.45, w: 1.6, h: 4.8, at: [3.8, 3.6, -2.1], aim: [-0.2, 1.5, 0] },
      // Cool fill behind, so the back board never goes to black.
      { color: 0xd8e3e7, power: 2.7, w: 3.8, h: 4.8, at: [-1.8, 2.9, -4.5], aim: [-0.1, 1.45, 0] },
      // Grazes the spine.
      { color: 0xffe8c2, power: 1.9, w: 0.9, h: 4.6, at: [-4.6, 3.2, 1.1], aim: [-0.55, 1.5, 0] },
      // Grazes the page edges, which is what separates them into sheets.
      { color: 0xfff7e7, power: 2.15, w: 1.15, h: 3.8, at: [4.2, 4.8, 3.1], aim: [0.65, 1.55, 0] },
    ]
    for (const box of softboxes) {
      const light = new THREE.RectAreaLight(box.color, box.power, box.w * S, box.h * S)
      // `.position.copy`, never `Object.assign({ position })`: Object3D defines
      // position as a getter-only accessor, so assigning to it throws.
      light.position.copy(at(box.at[0], box.at[1], box.at[2]))
      scene.add(light)
      // After add(), so lookAt resolves against world space.
      const aim = at(box.aim[0], box.aim[1], box.aim[2])
      light.lookAt(aim.x, aim.y, aim.z)
    }

    /* ---- the book ---- */

    const rig: BookRig = createBookRig(book)
    scene.add(rig.root)

    /* ---- the room ----

       A warm paper floor the book stands on and a warm backdrop behind it.
       This replaced a single near-black plane, and the swap matters more than
       it looks: a dark room returns no bounce, so every surface facing away
       from a lamp went dead and the only thing modelling the cover was direct
       light. Light ground is most of why the reference's covers sit in their
       scene instead of on top of it.

       Both are `MeshStandardMaterial` because `RectAreaLight` only lights
       standard and physical materials — on a basic or lambert material the
       softboxes above would silently contribute nothing. */
    const roomGeo = new THREE.PlaneGeometry(1, 1)
    const floorMat = new THREE.MeshStandardMaterial({ color: STUDIO.floor, roughness: 0.92 })
    const wallMat = new THREE.MeshStandardMaterial({ color: STUDIO.wall, roughness: 1 })

    const floor = new THREE.Mesh(roomGeo, floorMat)
    floor.scale.set(30 * S, 20 * S, 1)
    floor.rotation.x = -Math.PI / 2
    // Just under the book, so it stands on the floor rather than hovering over
    // it — the contact shadow is what gives the case its weight.
    floor.position.y = -rig.height / 2 - 0.5
    floor.receiveShadow = true
    scene.add(floor)

    const backdrop = new THREE.Mesh(roomGeo, wallMat)
    backdrop.scale.set(28 * S, 14 * S, 1)
    backdrop.position.copy(at(0, 5.5, -3.3))
    backdrop.receiveShadow = true
    scene.add(backdrop)

    /* Real cover art if there is any, over the painted board underneath.
       Anonymous CORS, which the cover hosts in use (Goodreads, OpenLibrary)
       all allow — and it has to be anonymous, because WebGL refuses to upload
       a cross-origin image that wasn't fetched with it. */
    let coverTex: THREE.Texture | null = null
    if (coverUrl) {
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')

      const onLoaded = (tex: THREE.Texture) => {
        // May land after the user has already closed the panel.
        if (disposed) { tex.dispose(); return }
        tex.colorSpace = THREE.SRGBColorSpace
        // One book fills the frame, so the cover is magnified far past what the
        // grid ever asks of it — worth the driver's best filtering.
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
        // The painted case underneath isn't disposed here — the rig owns it and
        // drops it on teardown, and disposing it twice is just noise.
        rig.applyCover(tex)
        coverTex = tex
        setOutcome({ url: coverUrl, status: 'ok' })
      }

      /* Every other view shows covers through a plain <img> with no
         `crossorigin`, so the browser caches the response without CORS headers.
         A texture load needs CORS — WebGL refuses to upload a cross-origin
         image fetched without it — and the browser can answer that request from
         the non-CORS cache entry, which then fails the check even though the
         host allows it. Goodreads and OpenLibrary both send
         `Access-Control-Allow-Origin: *`, so a host that genuinely forbids it
         is the rarer case.

         Hence one retry against a URL the cache has never seen. It costs a
         second request only for books that failed, and it distinguishes the two
         causes: if the retry works it was the cache, and if it doesn't the host
         really is refusing or the URL is dead. */
      const retry = () => {
        if (disposed) return
        const bust = `${coverUrl}${coverUrl.includes('?') ? '&' : '?'}booklit-cors=1`
        loader.load(bust, onLoaded, undefined, () => {
          if (disposed) return
          setOutcome({ url: coverUrl, status: 'failed' })
          console.warn('[inspect] cover would not load as a texture:', coverUrl)
        })
      }

      loader.load(coverUrl, onLoaded, undefined, retry)
    }

    /* ---- page dragging ----
       A drag that starts on a page turns it; a drag that starts anywhere else
       orbits. Deciding by raycast rather than by screen region means the grab
       still works once the book has been rotated to an angle. */

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    interface Drag {
      /** Leaf being carried, and which way it's going. */
      index: number
      direction: 1 | -1
      startX: number
      progress: number
      /** Screen-space speed at release, for the follow-through. */
      velocity: number
      lastX: number
      lastT: number
    }
    let drag: Drag | null = null

    const setPointer = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !openRef.current) return
      setPointer(e)
      raycaster.setFromCamera(pointer, camera)
      if (!raycaster.intersectObjects(rig.pageTargets, false).length) return

      // Forward unless there is nothing left to turn, in which case a grab can
      // only mean coming back. The real direction is settled on first movement.
      const forward = turnedRef.current < LEAVES
      drag = {
        index: forward ? turnedRef.current : turnedRef.current - 1,
        direction: forward ? 1 : -1,
        startX: e.clientX,
        progress: 0,
        velocity: 0,
        lastX: e.clientX,
        lastT: performance.now(),
      }
      controls.enabled = false
      renderer.domElement.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return
      const dx = e.clientX - drag.startX

      // First real movement picks the direction: left turns forward, right
      // comes back. Either is only possible if there's a page that way.
      if (drag.progress === 0 && Math.abs(dx) > 3) {
        const wantForward = dx < 0
        if (wantForward && turnedRef.current < LEAVES) {
          drag.direction = 1
          drag.index = turnedRef.current
        } else if (!wantForward && turnedRef.current > 0) {
          drag.direction = -1
          drag.index = turnedRef.current - 1
        } else {
          return
        }
      }

      const travel = rig.width * 0.8
      drag.progress = THREE.MathUtils.clamp(
        (drag.direction === 1 ? -dx : dx) / travel, 0, 1,
      )

      const now = performance.now()
      const dt = Math.max(1, now - drag.lastT)
      drag.velocity = (e.clientX - drag.lastX) / dt
      drag.lastX = e.clientX
      drag.lastT = now
    }

    const endDrag = (e: PointerEvent) => {
      if (!drag) return
      // Past halfway, or thrown hard enough that stopping it would feel sticky.
      const thrown = drag.direction === 1 ? drag.velocity < -0.55 : drag.velocity > 0.55
      const commit = drag.progress > 0.5 || (thrown && drag.progress > 0.12)
      if (commit) {
        turnedRef.current = THREE.MathUtils.clamp(
          turnedRef.current + drag.direction, 0, LEAVES,
        )
        setSpread(turnedRef.current)
      }
      // Hand the throw to the spring so the page arrives with a wobble rather
      // than snapping flat.
      const leaf = rig.leaves[drag.index]
      if (leaf) leaf.flex.curveVelocity += (commit ? 1 : -1) * Math.min(1.2, Math.abs(drag.velocity) * 1.6)
      drag = null
      controls.enabled = true
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId)
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', endDrag)
    renderer.domElement.addEventListener('pointercancel', endDrag)

    /* ---- loop ---- */

    const clock = new THREE.Clock()
    let openAmount = 0
    let frame = 0

    const tick = () => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min(clock.getDelta(), 0.05)

      const openTarget = openRef.current ? 1 : 0
      openAmount = reducedMotion
        ? openTarget
        : THREE.MathUtils.damp(openAmount, openTarget, 7, delta)

      // Only the board swings. The block is the right-hand page and stays put.
      rig.frontPivot.rotation.y = -OPEN_ANGLE * openAmount

      for (let i = 0; i < rig.leaves.length; i++) {
        const leaf = rig.leaves[i]
        const held = drag?.index === i ? drag : null

        // Where this leaf wants to be, 0 unturned .. 1 fully over. A held leaf
        // follows the pointer; everything else follows the page count.
        let progress = i < turnedRef.current ? 1 : 0
        if (held) {
          progress = held.direction === 1 ? held.progress : 1 - held.progress
        }

        const angle = -OPEN_ANGLE * progress * openAmount
        const z = THREE.MathUtils.lerp(leaf.restZ, leaf.turnedZ, progress * openAmount)
        if (reducedMotion || held) {
          leaf.pivot.rotation.y = angle
          leaf.pivot.position.z = z
        } else {
          leaf.pivot.rotation.y = THREE.MathUtils.damp(leaf.pivot.rotation.y, angle, 9, delta)
          leaf.pivot.position.z = THREE.MathUtils.damp(leaf.pivot.position.z, z, 9, delta)
        }

        // Paper is only arched while it's actually mid-turn — flat at both
        // ends, most curved as it passes over the gutter.
        const midTurn = Math.sin(Math.PI * THREE.MathUtils.clamp(progress, 0, 1))
        updateLeafFlex(
          leaf,
          midTurn * 0.19 * openAmount,
          held ? midTurn * 0.075 : midTurn * 0.02,
          delta,
          reducedMotion,
        )
      }

      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    commandRef.current.reset = () => {
      camera.position.copy(HOME)
      controls.target.set(0, 0, 0)
      controls.update()
    }

    /* ---- resize ---- */

    const resize = () => {
      if (disposed || !container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', endDrag)
      renderer.domElement.removeEventListener('pointercancel', endDrag)
      controls.dispose()
      rig.dispose()
      coverTex?.dispose()
      roomGeo.dispose()
      floorMat.dispose()
      wallMat.dispose()
      envTarget.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
    /* Rebuilt only when the book or its chosen cover changes — page and camera
       state live in refs precisely so that opening a board, turning a sheet or
       orbiting doesn't drop the WebGL context. Picking a different edition's
       cover does rebuild, which is heavy, but it's a deliberate and rare act. */
  }, [book, coverUrl])

  // Escape closes the inspector, and the arrows are the keyboard equivalent of
  // dragging a page across.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); turn(1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1) }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOpen() }
    }
    // Capture, so the library's own arrow-key navigation doesn't also fire.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, turn, toggleOpen])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-sunken/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text truncate">{book.title}</p>
          {book.author && (
            <p className="text-[11px] text-text-muted truncate">{book.author}</p>
          )}
        </div>
        {cover === 'failed' && (
          <span
            title={`The cover couldn't be loaded as a texture — see the console. Showing a painted board instead.\n${coverUrl ?? ''}`}
            className="flex items-center gap-1.5 text-[11px] text-text-muted flex-shrink-0"
          >
            <ImageOff className="w-3.5 h-3.5" />
            Painted board — cover art wouldn&apos;t load
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto p-2 rounded-full bg-chrome text-on-chrome hover:bg-chrome-elevated transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 cursor-grab active:cursor-grabbing" />

      <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border flex-shrink-0">
        <ControlButton
          icon={open ? BookMarked : BookOpen}
          label={open ? 'Close the book' : 'Open the book'}
          onClick={toggleOpen}
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ControlButton
          icon={ChevronLeft}
          label="Previous page"
          onClick={() => turn(-1)}
          disabled={spread === 0}
        />
        <span className="text-[11px] tabular-nums text-text-muted w-24 text-center">
          {open ? `Leaf ${spread} / ${LEAVES}` : 'Shut'}
        </span>
        <ControlButton
          icon={ChevronRight}
          label="Next page"
          onClick={() => turn(1)}
          disabled={spread === LEAVES}
        />
        <div className="w-px h-6 bg-border mx-1" />
        <ControlButton icon={RotateCcw} label="Reset the view" onClick={() => commandRef.current.reset?.()} />
      </div>

      <p className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[11px] text-text-muted pointer-events-none">
        Drag the page to turn it · drag anywhere else to orbit
      </p>
    </div>
  )
}

function ControlButton({ icon: Icon, label, onClick, disabled }: {
  icon: typeof BookOpen
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="p-2 rounded-lg border border-border text-text-dim transition-colors
                 hover:border-accent hover:text-text disabled:opacity-35 disabled:cursor-default
                 disabled:hover:border-border disabled:hover:text-text-dim"
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
