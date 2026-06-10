import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useApp } from '../../context/AppContext'
import { useBook } from '../../context/BookContext'
import { COLOR_SCHEMES } from './ColorSchemes'
import { TouchTexture } from './TouchTexture'
import { vertexShader, fragmentShader } from './LiquidGradientShader'

export function LiquidGradient() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.OrthographicCamera
    uniforms: Record<string, THREE.IUniform>
    touchTexture: TouchTexture
    animId: number
  } | null>(null)
  const { colorScheme, gradientSpeed } = useApp()
  const { isPlaying } = useBook()
  const speedRef = useRef(gradientSpeed)
  speedRef.current = gradientSpeed
  // While audio plays, the gradient acts as a visualizer — push it faster.
  const playingRef = useRef(isPlaying)
  playingRef.current = isPlaying

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const touchTexture = new TouchTexture()
    const scheme = COLOR_SCHEMES[0]

    const uniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uColor1: { value: new THREE.Vector3(...scheme.colors[0]) },
      uColor2: { value: new THREE.Vector3(...scheme.colors[1]) },
      uColor3: { value: new THREE.Vector3(...scheme.colors[2]) },
      uColor4: { value: new THREE.Vector3(...scheme.colors[3]) },
      uColor5: { value: new THREE.Vector3(...scheme.colors[4]) },
      uColor6: { value: new THREE.Vector3(...scheme.colors[5]) },
      uSpeed: { value: scheme.speed },
      uIntensity: { value: 1.8 },
      uTouchTexture: { value: touchTexture.texture },
      uGrainIntensity: { value: 0.06 },
      uDarkNavy: { value: new THREE.Vector3(...scheme.darkNavy) },
      uGradientSize: { value: scheme.gradientSize },
      uGradientCount: { value: scheme.gradientCount },
      uColor1Weight: { value: scheme.color1Weight },
      uColor2Weight: { value: scheme.color2Weight },
    }

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    scene.add(new THREE.Mesh(geometry, material))

    const onMouseMove = (e: MouseEvent) => {
      touchTexture.addTouch({
        x: e.clientX / window.innerWidth,
        y: 1 - e.clientY / window.innerHeight,
      })
    }

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('resize', onResize)

    // Accumulate *scaled* time so the speed slider changes motion smoothly
    // without resetting the animation phase.
    let simTime = 0
    let lastFrame = performance.now()
    const animate = () => {
      stateRef.current!.animId = requestAnimationFrame(animate)
      const now = performance.now()
      const boost = playingRef.current ? 4 : 1
      simTime += ((now - lastFrame) / 1000) * speedRef.current * boost
      lastFrame = now
      uniforms.uTime.value = simTime
      touchTexture.update()
      renderer.render(scene, camera)
    }

    stateRef.current = { renderer, scene, camera, uniforms, touchTexture, animId: 0 }
    animate()

    return () => {
      cancelAnimationFrame(stateRef.current!.animId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      container.removeChild(renderer.domElement)
      stateRef.current = null
    }
  }, [])

  // Update colors when scheme changes
  useEffect(() => {
    const state = stateRef.current
    if (!state) return

    const scheme = COLOR_SCHEMES[colorScheme] ?? COLOR_SCHEMES[0]
    const u = state.uniforms

    const lerp = (from: THREE.Vector3, to: number[], t: number) => {
      from.x += (to[0] - from.x) * t
      from.y += (to[1] - from.y) * t
      from.z += (to[2] - from.z) * t
    }
    const lerpVal = (from: number, to: number, t: number) => from + (to - from) * t

    let frame: number
    let progress = 0
    const startSpeed = u.uSpeed.value as number
    const startGradientSize = u.uGradientSize.value as number
    const startGradientCount = u.uGradientCount.value as number
    const startC1Weight = u.uColor1Weight.value as number
    const startC2Weight = u.uColor2Weight.value as number

    const transition = () => {
      progress = Math.min(progress + 0.02, 1)
      const t = progress
      lerp(u.uColor1.value, scheme.colors[0], t)
      lerp(u.uColor2.value, scheme.colors[1], t)
      lerp(u.uColor3.value, scheme.colors[2], t)
      lerp(u.uColor4.value, scheme.colors[3], t)
      lerp(u.uColor5.value, scheme.colors[4], t)
      lerp(u.uColor6.value, scheme.colors[5], t)
      lerp(u.uDarkNavy.value, scheme.darkNavy, t)
      u.uSpeed.value = lerpVal(startSpeed, scheme.speed, t)
      u.uGradientSize.value = lerpVal(startGradientSize, scheme.gradientSize, t)
      u.uGradientCount.value = lerpVal(startGradientCount, scheme.gradientCount, t)
      u.uColor1Weight.value = lerpVal(startC1Weight, scheme.color1Weight, t)
      u.uColor2Weight.value = lerpVal(startC2Weight, scheme.color2Weight, t)
      if (progress < 1) frame = requestAnimationFrame(transition)
    }
    transition()
    return () => cancelAnimationFrame(frame)
  }, [colorScheme])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0"
      style={{ pointerEvents: 'none' }}
    />
  )
}
