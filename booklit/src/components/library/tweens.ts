import TWEEN from '@tweenjs/tween.js'

/** Anything a scene can stop when it starts a new transition. */
export interface Stoppable { stop: () => void }

/**
 * A scene's own tween group — and the reason none of the 3D views ever animated.
 *
 * tween.js v25 dropped the auto-registration that `new Tween(obj)` used to get.
 * Unless a tween is handed a group, `TWEEN.update()` never advances it: it
 * starts, and then sits still for the rest of its life. Every scene here built
 * its tweens the old way, so nothing they were told to move ever moved. The
 * books stayed at the random points they are spawned at, which is the "cloud";
 * a re-sort looked like a teleport because the only books that changed were the
 * ones destroyed and remade at fresh random points, not moved; and the camera
 * never travelled to the distance the framer picked.
 *
 * Owning the group per scene also means unmounting one view can't leave tweens
 * belonging to another running.
 */
export function createTweens() {
  const group = new TWEEN.Group()

  return {
    /** Ease the numeric fields of `target` towards `props` over `ms`. */
    move(target: object, props: Record<string, number>, ms: number): Stoppable {
      return new TWEEN.Tween(target, group)
        .to(props, ms)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start()
    },
    /** Advance everything in flight. Call once a frame. */
    update() { group.update() },
    /** Drop everything in flight, leaving objects where they got to. */
    stopAll() { group.removeAll() },
  }
}

export type Tweens = ReturnType<typeof createTweens>
