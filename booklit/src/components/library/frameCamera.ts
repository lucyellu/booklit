import * as THREE from 'three'
import type { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import TWEEN from '@tweenjs/tween.js'
import { fitDistance } from './LayoutEngine'

/** Anything the scenes can stop when they start a new transition. */
export interface Stoppable { stop: () => void }

/**
 * Keeps the whole arrangement inside the frame.
 *
 * A layout is sized from how many books are in it, so the camera can't sit at a
 * fixed distance: 40 models want a much closer seat than 300 cards, and at the
 * wrong one you see a slab of covers running off every edge instead of a grid
 * you can read.
 *
 * Re-sorting is deliberately *not* a reason to move — the arrangement is the
 * same size, only its contents have swapped places, and yanking the camera
 * every time someone changes the sort key would undo their own zoom for no
 * reason. Only a different layout, or a different number of books, refits.
 */
export function createFramer(camera: THREE.PerspectiveCamera, controls: TrackballControls) {
  let last: THREE.Vector3 | null = null

  return (extent: THREE.Vector3, ms: number, force = false): Stoppable[] => {
    if (!force && last && last.distanceTo(extent) < Math.max(1, last.length() * 0.02)) {
      return []
    }
    const first = !last
    last = extent.clone()

    const dist = Math.max(camera.near * 4, fitDistance(extent, camera.fov, camera.aspect))
    // Let people pull back past the fit, and don't let the clamp fight a small
    // arrangement that wants the camera closer than the scene's own minimum.
    controls.maxDistance = Math.max(controls.maxDistance, dist * 2.4)
    controls.minDistance = Math.min(controls.minDistance, dist * 0.5)
    if (camera.far < dist * 3) {
      camera.far = dist * 3
      camera.updateProjectionMatrix()
    }

    // Keep whichever way they were looking; only the distance is ours to set.
    const eye = camera.position.clone().sub(controls.target)
    if (eye.lengthSq() < 1e-6) eye.set(0, 0, 1)
    eye.normalize().multiplyScalar(dist)

    if (first || ms <= 0) {
      camera.position.copy(eye)
      controls.target.set(0, 0, 0)
      return []
    }
    return [
      new TWEEN.Tween(camera.position)
        .to({ x: eye.x, y: eye.y, z: eye.z }, ms)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start(),
      new TWEEN.Tween(controls.target)
        .to({ x: 0, y: 0, z: 0 }, ms)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start(),
    ]
  }
}
