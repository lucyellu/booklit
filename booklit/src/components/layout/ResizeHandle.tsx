import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface ResizeHandleProps {
  /** Horizontal pointer movement since the last event, in px. Sign is
      whatever the caller's drag direction means — grow-right vs grow-left —
      so the clamping and sign live with the panel, not here. */
  onResize: (delta: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  className?: string
}

/**
 * A draggable edge for resizing an adjacent panel. Purely behavioural — no
 * width, position or color opinions of its own, so callers place and size it
 * (a flex item between two panes, or an absolute overlay on a panel that's
 * already positioned) entirely through `className`.
 */
export function ResizeHandle({ onResize, onDragStart, onDragEnd, className = '' }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true
    lastX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
    onDragStart?.()
  }, [onDragStart])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const delta = e.clientX - lastX.current
    lastX.current = e.clientX
    if (delta !== 0) onResize(delta)
  }, [onResize])

  const stopDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    onDragEnd?.()
  }, [onDragEnd])

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      role="separator"
      aria-orientation="vertical"
      className={`group cursor-col-resize select-none touch-none ${className}`}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-accent group-hover:w-0.5 transition-colors" />
    </div>
  )
}
