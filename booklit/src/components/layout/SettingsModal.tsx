import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import type { Theme } from '../../context/ThemeContext'
import { X, Sun, Moon } from 'lucide-react'

const THEMES: { id: Theme; label: string; hint: string; icon: typeof Sun; swatch: string[] }[] = [
  {
    id: 'day',
    label: 'Forest Day',
    hint: 'Sage paper, deep-green chrome',
    icon: Sun,
    swatch: ['#e8ede4', '#f0ebe0', '#1a3a0a', '#a0522d'],
  },
  {
    id: 'evening',
    label: 'Forest Evening',
    hint: 'Same hues, ground flipped',
    icon: Moon,
    swatch: ['#14260d', '#1e3614', '#0a1606', '#d08a50'],
  },
]

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useApp()
  const { theme, setTheme } = useTheme()

  if (!settingsOpen) return null

  return (
    <div
      className="scrim fixed inset-0 z-[80] flex items-center justify-center"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="surface rounded-3xl w-[420px] max-w-[92vw] p-7 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-text">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-bg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-accent-warm mb-3">
          Appearance
        </div>
        <div className="flex flex-col gap-2.5">
          {THEMES.map(({ id, label, hint, icon: Icon, swatch }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all border-l-4 ${
                theme === id
                  ? 'border-accent bg-bg'
                  : 'border-transparent hover:bg-bg hover:border-border-hover'
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  theme === id ? 'text-accent' : 'text-text-muted'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-text">{label}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{hint}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {swatch.map(c => (
                  <span
                    key={c}
                    className="w-3.5 h-3.5 rounded-[3px] border border-border"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
