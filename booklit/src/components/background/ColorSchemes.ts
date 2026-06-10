export interface ColorScheme {
  name: string
  preview: [string, string]
  /** 6 RGB triplets for uColor1–uColor6 */
  colors: [number, number, number][]
  /** uDarkNavy base color RGB */
  darkNavy: [number, number, number]
  /** Per-scheme uniform overrides */
  gradientSize: number
  gradientCount: number
  speed: number
  color1Weight: number
  color2Weight: number
}

// Exact values from the original interactive-liquid-gradient template
export const COLOR_SCHEMES: ColorScheme[] = [
  {
    // Scheme 1: Orange + Navy Blue (default)
    name: 'Ember',
    preview: ['#F15A22', '#0a0e27'],
    colors: [
      [0.945, 0.353, 0.133], // F15A22 - Orange
      [0.039, 0.055, 0.153], // 0a0e27 - Navy Blue
      [0.945, 0.353, 0.133], // Orange
      [0.039, 0.055, 0.153], // Navy Blue
      [0.945, 0.353, 0.133], // Orange
      [0.039, 0.055, 0.153], // Navy Blue
    ],
    darkNavy: [0.039, 0.055, 0.153],
    gradientSize: 0.45,
    gradientCount: 12.0,
    speed: 1.5,
    color1Weight: 0.5,
    color2Weight: 1.8,
  },
  {
    // Scheme 2: Coral Red-Orange + Turquoise
    name: 'Coral',
    preview: ['#FF6C50', '#40E0D0'],
    colors: [
      [1.0, 0.424, 0.314],   // FF6C50 - Coral Red-Orange
      [0.251, 0.878, 0.816], // 40E0D0 - Turquoise
      [1.0, 0.424, 0.314],   // Coral
      [0.251, 0.878, 0.816], // Turquoise
      [1.0, 0.424, 0.314],   // Coral
      [0.251, 0.878, 0.816], // Turquoise
    ],
    darkNavy: [0.039, 0.055, 0.153],
    gradientSize: 1.0,
    gradientCount: 6.0,
    speed: 1.2,
    color1Weight: 1.0,
    color2Weight: 1.0,
  },
  {
    // Scheme 3: Orange + Navy + Turquoise (three-color)
    name: 'Tropic',
    preview: ['#F15A22', '#40E0D0'],
    colors: [
      [0.945, 0.353, 0.133], // F15A22 - Orange
      [0.039, 0.055, 0.153], // 0a0e27 - Navy Blue
      [0.251, 0.878, 0.816], // 40E0D0 - Turquoise
      [0.945, 0.353, 0.133], // Orange
      [0.039, 0.055, 0.153], // Navy Blue
      [0.251, 0.878, 0.816], // Turquoise
    ],
    darkNavy: [0.039, 0.055, 0.153],
    gradientSize: 0.45,
    gradientCount: 12.0,
    speed: 1.5,
    color1Weight: 0.5,
    color2Weight: 1.8,
  },
  {
    // Scheme 4: Orange/Coral + Teal/Blue-Green + Beige/Peach
    name: 'Desert',
    preview: ['#F26633', '#D1AF9C'],
    colors: [
      [0.949, 0.4, 0.2],     // F26633 - Orange/Coral
      [0.176, 0.42, 0.427],  // 2D6B6D - Teal/Blue-Green
      [0.82, 0.686, 0.612],  // D1AF9C - Beige/Peach
      [0.949, 0.4, 0.2],     // Orange/Coral
      [0.176, 0.42, 0.427],  // Teal/Blue-Green
      [0.82, 0.686, 0.612],  // Beige/Peach
    ],
    darkNavy: [0, 0, 0],
    gradientSize: 0.45,
    gradientCount: 12.0,
    speed: 1.5,
    color1Weight: 0.5,
    color2Weight: 1.8,
  },
  {
    // Scheme 5: Orange + Dark Teal + Black
    name: 'Abyss',
    preview: ['#F15A22', '#004238'],
    colors: [
      [0.945, 0.353, 0.133], // F15A22 - Orange
      [0.0, 0.259, 0.22],    // 004238 - Dark Teal
      [0.945, 0.353, 0.133], // Orange
      [0.0, 0.0, 0.0],       // 000000 - Black
      [0.945, 0.353, 0.133], // Orange
      [0.0, 0.0, 0.0],       // 000000 - Black
    ],
    darkNavy: [0.039, 0.055, 0.153],
    gradientSize: 0.45,
    gradientCount: 12.0,
    speed: 1.5,
    color1Weight: 0.5,
    color2Weight: 1.8,
  },
]
