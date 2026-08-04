import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { generateThemeFromColor } from '../lib/colors'

/** Forest Day (light) and Forest Evening (dark) — see src/index.css. */
export type Theme = 'day' | 'evening'

const STORAGE_KEY = 'booklit-theme'
const CUSTOM_COLOR_KEY = 'booklit-custom-color'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  customColor: string | null
  setCustomColor: (hex: string) => void
  resetCustomColor: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Read the stored choice, falling back to the OS preference on first run.
function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'day' || stored === 'evening') return stored
  } catch { /* private mode / storage disabled */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'evening' : 'day'
}

function initialCustomColor(): string | null {
  try {
    return localStorage.getItem(CUSTOM_COLOR_KEY)
  } catch { /* ignore */ }
  return null
}

const TOKENS = [
  '--color-bg', '--color-bg-elevated', '--color-bg-surface', '--color-bg-sunken',
  '--color-chrome', '--color-chrome-elevated', '--color-chrome-active', '--color-on-chrome-active',
  '--color-text', '--color-text-dim', '--color-text-muted',
  '--color-on-chrome', '--color-on-chrome-dim', '--color-on-chrome-muted',
  '--color-accent', '--color-accent-vivid', '--color-accent-warm', '--color-on-accent',
  '--color-border', '--color-border-hover', '--color-scrim'
]

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [customColor, setCustomColorState] = useState<string | null>(initialCustomColor)

  useEffect(() => {
    const root = document.documentElement
    if (customColor) {
      const generated = generateThemeFromColor(customColor, theme === 'evening')
      Object.entries(generated).forEach(([token, val]) => {
        root.style.setProperty(token, val)
      })
    } else {
      TOKENS.forEach(token => root.style.removeProperty(token))
    }
    
    try {
      if (customColor) localStorage.setItem(CUSTOM_COLOR_KEY, customColor)
      else localStorage.removeItem(CUSTOM_COLOR_KEY)
    } catch { /* ignore */ }
  }, [customColor, theme])

  // The whole token set hangs off this attribute.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch { /* ignore */ }
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = useCallback(
    () => setThemeState(t => (t === 'day' ? 'evening' : 'day')),
    [],
  )

  const setCustomColor = useCallback((hex: string) => {
    setCustomColorState(hex)
  }, [])
  const resetCustomColor = useCallback(() => setCustomColorState(null), [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, customColor, setCustomColor, resetCustomColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
