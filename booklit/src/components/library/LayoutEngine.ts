import * as THREE from 'three'

export type LayoutType = 'grid' | 'shelf' | 'sphere' | 'helix'

export interface LayoutTarget {
  position: THREE.Vector3
  rotation: THREE.Euler
}

export function computeTargets(layout: LayoutType, count: number): LayoutTarget[] {
  switch (layout) {
    case 'grid': return computeGrid(count)
    case 'shelf': return computeShelf(count)
    case 'sphere': return computeSphere(count)
    case 'helix': return computeHelix(count)
  }
}

function computeGrid(n: number): LayoutTarget[] {
  const cols = Math.ceil(Math.sqrt(n * 1.5))
  const spaceX = 180
  const spaceY = 260
  const totalW = (cols - 1) * spaceX
  const totalH = (Math.ceil(n / cols) - 1) * spaceY

  return Array.from({ length: n }, (_, i) => ({
    position: new THREE.Vector3(
      (i % cols) * spaceX - totalW / 2,
      -Math.floor(i / cols) * spaceY + totalH / 2,
      0
    ),
    rotation: new THREE.Euler(0, 0, 0),
  }))
}

function computeShelf(n: number): LayoutTarget[] {
  const cols = Math.min(8, Math.ceil(Math.sqrt(n * 2)))
  const spacingX = 160
  const rowGap = 240
  const totalW = (cols - 1) * spacingX
  const rows = Math.ceil(n / cols)
  const totalH = (rows - 1) * rowGap

  return Array.from({ length: n }, (_, i) => ({
    position: new THREE.Vector3(
      (i % cols) * spacingX - totalW / 2,
      -Math.floor(i / cols) * rowGap + totalH / 2,
      0
    ),
    rotation: new THREE.Euler(0, 0, 0),
  }))
}

function computeSphere(n: number): LayoutTarget[] {
  const radius = 900
  const v = new THREE.Vector3()

  return Array.from({ length: n }, (_, i) => {
    const phi = Math.acos(-1 + (2 * i) / n)
    const theta = Math.sqrt(n * Math.PI) * phi
    const pos = new THREE.Vector3().setFromSphericalCoords(radius, phi, theta)

    const obj = new THREE.Object3D()
    obj.position.copy(pos)
    obj.lookAt(v.copy(pos).multiplyScalar(2))

    return {
      position: pos,
      rotation: obj.rotation.clone(),
    }
  })
}

function computeHelix(n: number): LayoutTarget[] {
  const radius = 600
  const tightness = 40

  return Array.from({ length: n }, (_, i) => {
    const theta = i * 0.175 + Math.PI
    const y = -(i * tightness) + (n * tightness / 2.5)
    const pos = new THREE.Vector3()
    pos.setFromCylindrical(new THREE.Cylindrical(radius, theta, y))

    const obj = new THREE.Object3D()
    obj.position.copy(pos)
    obj.lookAt(new THREE.Vector3(pos.x * 2, y, pos.z * 2))

    return {
      position: pos,
      rotation: obj.rotation.clone(),
    }
  })
}
