import { useApp } from '../../context/AppContext'
import { X } from 'lucide-react'

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen, gradientSpeed, setGradientSpeed } = useApp()

  if (!settingsOpen) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="glass-panel rounded-2xl w-[420px] max-w-[92vw] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold tracking-tight">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-md text-text-dim hover:text-text hover:bg-bg-glass-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Background animation speed */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12.5px] text-text">Background animation speed</label>
            <span className="text-[11px] text-text-muted font-mono">
              {Math.round(gradientSpeed * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gradientSpeed}
            onChange={e => setGradientSpeed(parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>Still</span>
            <span>Full</span>
          </div>
          <p className="text-[11px] text-text-dim mt-3">
            Lower values calm the liquid gradient and reduce GPU load. Set to 0% to freeze it.
          </p>
        </div>
      </div>
    </div>
  )
}
