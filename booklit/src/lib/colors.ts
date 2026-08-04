export function hexToHsl(hex: string): [number, number, number] {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('')
  
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }

  return [h * 360, s * 100, l * 100]
}

export function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = s * Math.min(l, 1 - l) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function generateThemeFromColor(baseHex: string, isDark: boolean): Record<string, string> {
  const [h, s] = hexToHsl(baseHex)
  
  if (isDark) {
    return {
      '--color-bg': hslToHex(h, s * 0.3, 6),
      '--color-bg-elevated': hslToHex(h, s * 0.3, 10),
      '--color-bg-surface': hslToHex(h, s * 0.3, 13),
      '--color-bg-sunken': hslToHex(h, s * 0.3, 4),
      
      '--color-chrome': hslToHex(h, s * 0.4, 3),
      '--color-chrome-elevated': hslToHex(h, s * 0.4, 8),
      '--color-chrome-active': `hsla(${h}, ${s}%, 50%, 0.22)`,
      '--color-on-chrome-active': hslToHex(h, Math.min(s * 1.2, 100), 85),
      
      '--color-text': hslToHex(h, s * 0.1, 98),
      '--color-text-dim': hslToHex(h, s * 0.2, 85),
      '--color-text-muted': hslToHex(h, s * 0.3, 70),
      
      '--color-on-chrome': hslToHex(h, s * 0.1, 95),
      '--color-on-chrome-dim': `hsla(${h}, ${s}%, 95%, 0.7)`,
      '--color-on-chrome-muted': `hsla(${h}, ${s}%, 95%, 0.5)`,
      
      '--color-accent': hslToHex(h, s, 45),
      '--color-accent-vivid': hslToHex(h, Math.min(s * 1.2, 100), 55),
      '--color-accent-warm': hslToHex((h + 30) % 360, s, 50),
      '--color-on-accent': hslToHex(h, s, 2),
      
      '--color-border': `hsla(${h}, ${s}%, 80%, 0.15)`,
      '--color-border-hover': `hsla(${h}, ${s}%, 80%, 0.3)`,
      
      '--color-scrim': 'rgba(0, 0, 0, 0.7)',
    }
  } else {
    return {
      '--color-bg': hslToHex(h, s * 0.2, 98),
      '--color-bg-elevated': hslToHex(h, s * 0.2, 95),
      '--color-bg-surface': hslToHex(h, s * 0.2, 100),
      '--color-bg-sunken': hslToHex(h, s * 0.2, 92),
      
      '--color-chrome': hslToHex(h, s * 0.5, 12),
      '--color-chrome-elevated': hslToHex(h, s * 0.5, 18),
      '--color-chrome-active': `hsla(${h}, ${s}%, 40%, 0.25)`,
      '--color-on-chrome-active': hslToHex(h, Math.min(s * 1.2, 100), 75),
      
      '--color-text': hslToHex(h, s * 0.2, 8),
      '--color-text-dim': hslToHex(h, s * 0.3, 20),
      '--color-text-muted': hslToHex(h, s * 0.4, 35),
      
      '--color-on-chrome': hslToHex(h, s * 0.1, 98),
      '--color-on-chrome-dim': `hsla(${h}, ${s}%, 98%, 0.7)`,
      '--color-on-chrome-muted': `hsla(${h}, ${s}%, 98%, 0.5)`,
      
      '--color-accent': hslToHex(h, s, 35),
      '--color-accent-vivid': hslToHex(h, Math.min(s * 1.2, 100), 45),
      '--color-accent-warm': hslToHex((h - 30 + 360) % 360, s, 40),
      '--color-on-accent': '#ffffff',
      
      '--color-border': `hsla(${h}, ${s}%, 10%, 0.15)`,
      '--color-border-hover': `hsla(${h}, ${s}%, 10%, 0.3)`,
      
      '--color-scrim': `hsla(${h}, ${s}%, 5%, 0.65)`,
    }
  }
}
