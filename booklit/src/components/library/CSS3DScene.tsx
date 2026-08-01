import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import TWEEN from '@tweenjs/tween.js'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { computeTargets } from './LayoutEngine'
import { buildCardElement } from './cardElement'
import type { LocalBook } from '../../context/BookContext'

export function CSS3DScene({ books }: { books: LocalBook[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: CSS3DRenderer
    controls: TrackballControls
    objects: CSS3DObject[]
    animId: number
  } | null>(null)

  const { layout, openReader, cardMode } = useApp()
  const { openBook } = useBook()
  const localBooks = books
  const booksRef = useRef(localBooks)
  booksRef.current = localBooks
  // The mount effect runs once, so it reads the mode through a ref rather than
  // taking it as a dependency and tearing down the whole scene on every switch.
  const cardModeRef = useRef(cardMode)
  cardModeRef.current = cardMode

  const handleBookClick = useCallback((book: LocalBook) => {
    openBook(book).then(ok => { if (ok) openReader() })
  }, [openBook, openReader])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 10000)
    camera.position.z = 2000

    const renderer = new CSS3DRenderer()
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const controls = new TrackballControls(camera, renderer.domElement)
    controls.minDistance = 500
    controls.maxDistance = 6000
    controls.addEventListener('change', () => renderer.render(scene, camera))

    const objects: CSS3DObject[] = []

    const buildCards = () => {
      objects.forEach(o => scene.remove(o))
      objects.length = 0

      booksRef.current.forEach((book) => {
        const el = buildCardElement(book, cardModeRef.current)
        el.addEventListener('click', () => handleBookClick(book))

        const obj = new CSS3DObject(el)
        obj.position.set(
          Math.random() * 4000 - 2000,
          Math.random() * 4000 - 2000,
          Math.random() * 4000 - 2000
        )
        scene.add(obj)
        objects.push(obj)
      })
    }

    buildCards()

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.render(scene, camera)
    }
    window.addEventListener('resize', onResize)

    const animate = () => {
      stateRef.current!.animId = requestAnimationFrame(animate)
      TWEEN.update()
      controls.update()
    }

    stateRef.current = { scene, camera, renderer, controls, objects, animId: 0 }
    animate()

    return () => {
      cancelAnimationFrame(stateRef.current!.animId)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      container.removeChild(renderer.domElement)
      stateRef.current = null
    }
  }, [handleBookClick])

  useEffect(() => {
    const state = stateRef.current
    if (!state || state.objects.length === 0) return

    const targets = computeTargets(layout, state.objects.length)
    const duration = 1000

    state.objects.forEach((obj, i) => {
      const target = targets[i]
      if (!target) return

      new TWEEN.Tween(obj.position)
        .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start()

      new TWEEN.Tween(obj.rotation)
        .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start()
    })

    new TWEEN.Tween({})
      .to({}, duration * 2)
      .onUpdate(() => state.renderer.render(state.scene, state.camera))
      .start()
  }, [layout, localBooks.length])

  useEffect(() => {
    const state = stateRef.current
    if (!state) return

    state.objects.forEach(o => state.scene.remove(o))
    state.objects.length = 0

    booksRef.current.forEach((book) => {
      const el = buildCardElement(book, cardMode)
      el.addEventListener('click', () => handleBookClick(book))

      const obj = new CSS3DObject(el)
      obj.position.set(Math.random() * 4000 - 2000, Math.random() * 4000 - 2000, Math.random() * 4000 - 2000)
      state.scene.add(obj)
      state.objects.push(obj)
    })

    const targets = computeTargets(layout, state.objects.length)
    const duration = 1000
    state.objects.forEach((obj, i) => {
      const target = targets[i]
      if (!target) return
      new TWEEN.Tween(obj.position)
        .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start()
      new TWEEN.Tween(obj.rotation)
        .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start()
    })

    new TWEEN.Tween({})
      .to({}, duration * 2)
      .onUpdate(() => state.renderer.render(state.scene, state.camera))
      .start()
  }, [localBooks, layout, cardMode, handleBookClick])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
