import * as THREE from 'three'

/**
 * Where each book sits in the 3D views, after the three.js periodic-table
 * example's `targets`.
 *
 * Two things matter for reading a sorted library, and the first version had
 * neither. Order has to run the way you read — left to right, top to bottom,
 * front to back — so that "sorted by title" is something you can see rather
 * than take on trust. And the arrangement has to *fit*: laying 300 books out on
 * fixed 180-unit centres builds a block far wider and taller than the frame, so
 * you see a wall of covers running off every edge, which is not a grid so much
 * as a crowd. Every layout is therefore sized from the number of books and the
 * shape of the window, and reports the extent it ended up with so the camera
 * can be pulled back far enough to show the whole thing.
 */

export type LayoutType = 'grid' | 'shelf' | 'cube' | 'sphere' | 'helix'

export interface LayoutTarget {
  position: THREE.Vector3
  rotation: THREE.Euler
}

export interface LayoutOptions {
  /** One book's own width and height, in scene units. */
  cellW: number
  cellH: number
  /** Viewport aspect, so a block comes out roughly the shape of the window. */
  aspect: number
}

export interface Layout {
  targets: LayoutTarget[]
  /** Half-extents of the whole arrangement, one book's own size included. */
  extent: THREE.Vector3
}

const flat = (position: THREE.Vector3): LayoutTarget =>
  ({ position, rotation: new THREE.Euler(0, 0, 0) })

const EMPTY: Layout = { targets: [], extent: new THREE.Vector3(1, 1, 1) }

export function computeLayout(kind: LayoutType, count: number, opts: LayoutOptions): Layout {
  if (count <= 0) return EMPTY
  switch (kind) {
    case 'grid': return rows(count, opts, 1)
    case 'shelf': return rows(count, opts, 2)
    case 'cube': return cube(count, opts)
    case 'sphere': return sphere(count, opts)
    case 'helix': return helix(count, opts)
  }
}

/**
 * A block of rows read left to right, top to bottom.
 *
 * `stretch` widens the rows past the window's own shape: at 1 the block matches
 * the viewport, which packs the most books into the frame; higher makes long
 * shelves with fewer, longer rows.
 */
function rows(n: number, { cellW, cellH, aspect }: LayoutOptions, stretch: number): Layout {
  const gapX = cellW * 1.3
  const gapY = cellH * 1.3

  // cols/rows should come out as the window's aspect, in units of one cell:
  // cols·gapX / (rows·gapY) = aspect, with cols·rows = n.
  const wanted = Math.sqrt((n * aspect * stretch * gapY) / gapX)
  const cols = Math.min(n, Math.max(1, Math.round(wanted)))
  const rowCount = Math.ceil(n / cols)

  const totalW = (cols - 1) * gapX
  const totalH = (rowCount - 1) * gapY

  const targets = Array.from({ length: n }, (_, i) => flat(new THREE.Vector3(
    (i % cols) * gapX - totalW / 2,
    -Math.floor(i / cols) * gapY + totalH / 2,
    0,
  )))

  return {
    targets,
    extent: new THREE.Vector3((totalW + cellW) / 2, (totalH + cellH) / 2, cellW / 2),
  }
}

/**
 * The periodic table's own "grid": slabs stacked away from the camera, so the
 * first books are the ones nearest you and the order runs across, down, then
 * back.
 *
 * The cube is as deep as the cube root suggests, but each slab is shaped by the
 * window rather than square — a square slab in a wide window leaves most of the
 * frame empty and shrinks every book for nothing.
 */
function cube(n: number, { cellW, cellH, aspect }: LayoutOptions): Layout {
  const gapX = cellW * 1.35
  const gapY = cellH * 1.3
  // Slabs need real air between them or the front one just hides the rest.
  const gapZ = Math.max(cellW, cellH) * 1.7

  const slabs = Math.max(1, Math.round(Math.cbrt(n)))
  const perSlab = Math.ceil(n / slabs)
  const wanted = Math.sqrt((perSlab * aspect * gapY) / gapX)
  const cols = Math.min(perSlab, Math.max(1, Math.round(wanted)))
  const rowCount = Math.ceil(perSlab / cols)
  const face = cols * rowCount
  const depth = Math.ceil(n / face)

  const totalW = (cols - 1) * gapX
  const totalH = (rowCount - 1) * gapY
  const totalD = (depth - 1) * gapZ

  const targets = Array.from({ length: n }, (_, i) => flat(new THREE.Vector3(
    (i % cols) * gapX - totalW / 2,
    -(Math.floor(i / cols) % rowCount) * gapY + totalH / 2,
    -Math.floor(i / face) * gapZ + totalD / 2,
  )))

  return {
    targets,
    extent: new THREE.Vector3((totalW + cellW) / 2, (totalH + cellH) / 2, (totalD + cellW) / 2),
  }
}

function sphere(n: number, { cellW, cellH }: LayoutOptions): Layout {
  // Big enough that n books of this size cover the surface without piling up.
  const radius = Math.max(cellH, Math.sqrt((n * cellW * cellH) / (4 * Math.PI)) * 1.3)
  const outward = new THREE.Vector3()

  const targets = Array.from({ length: n }, (_, i) => {
    const phi = Math.acos(-1 + (2 * i) / n)
    const theta = Math.sqrt(n * Math.PI) * phi
    const position = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta)

    const obj = new THREE.Object3D()
    obj.position.copy(position)
    obj.lookAt(outward.copy(position).multiplyScalar(2))

    return { position, rotation: obj.rotation.clone() }
  })

  const r = radius + Math.max(cellW, cellH) / 2
  return { targets, extent: new THREE.Vector3(r, r, r) }
}

function helix(n: number, { cellW, cellH }: LayoutOptions): Layout {
  const turn = 0.175                          // radians per book
  const perTurn = (2 * Math.PI) / turn        // ≈ 36 books to a turn
  const radius = (perTurn * cellW * 0.82) / (2 * Math.PI)
  // A whole turn should climb about one and a half books, as in the original —
  // pitch it per book instead and a long library becomes a mile of rope.
  const step = (cellH * 1.5) / perTurn
  const totalH = (n - 1) * step

  const targets = Array.from({ length: n }, (_, i) => {
    const theta = i * turn + Math.PI
    const y = -i * step + totalH / 2
    const position = new THREE.Vector3().setFromCylindricalCoords(radius, theta, y)

    const obj = new THREE.Object3D()
    obj.position.copy(position)
    obj.lookAt(new THREE.Vector3(position.x * 2, y, position.z * 2))

    return { position, rotation: obj.rotation.clone() }
  })

  const r = radius + cellW / 2
  return { targets, extent: new THREE.Vector3(r, (totalH + cellH) / 2, r) }
}

/**
 * How far back the camera has to sit for an arrangement of these half-extents to
 * fall inside the frame.
 */
export function fitDistance(extent: THREE.Vector3, fovDeg: number, aspect: number): number {
  const half = Math.tan((fovDeg * Math.PI) / 180 / 2)
  const forHeight = extent.y / half
  const forWidth = extent.x / (half * Math.max(0.2, aspect))
  // Plus the depth, so the nearest slab of a cube isn't already past the lens.
  return Math.max(forHeight, forWidth) * 1.08 + extent.z
}
