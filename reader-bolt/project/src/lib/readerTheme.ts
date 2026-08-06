/*
 * Hue-rotates the reader's hand-tuned Forest palette to match a custom accent
 * colour chosen in the host (Booklit's Settings > Custom Theme Color). Every
 * --rd-* token keeps its original lightness and saturation — only the hue
 * moves, by the same offset for every token, so the ramp's contrast and
 * relative vividness survive the rotation intact. No custom colour is a
 * no-op (delta 0): callers should clear any override and let the Forest
 * defaults in index.css stand, rather than calling this at all.
 */

function hexToHsl(hex: string): [number, number, number] {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const hslToHex = (h: number, s: number, l: number) =>
  `#${hslToRgb(h, s, l).map(v => v.toString(16).padStart(2, '0')).join('')}`;

const hslToTriplet = (h: number, s: number, l: number) => hslToRgb(h, s, l).join(' ');

function rotate(hex: string, deltaHue: number): [number, number, number] {
  const [h, s, l] = hexToHsl(hex);
  return [(h + deltaHue + 360) % 360, s, l];
}

// The reader's own default accent hue — Booklit Forest Day's --color-accent
// (#41761f) — the zero point every rotation is measured from.
const FOREST_HUE = hexToHsl('#41761f')[0];

const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Exact values from index.css — kept here only as rotation input.
const FOREST_DAY = {
  white: 'f0ebe0', black: '1a2e0a', bg: 'e8ede4', title: 'a0522d',
  gray: ['f7f6f0', 'e8ede4', 'd5ddcc', 'b8c5ac', '94a888', '748a67', '55694a', '415236', '2f3d27', '1e2a19', '121b0e'],
  accent: ['eef6e8', 'd9ecc9', 'b8dc9e', '93c96f', '7ab84a', '3d6e1c', '345e19', '2a4d14', '234011', '1c330e', '14260d'],
};

const FOREST_EVENING = {
  white: 'd8e8c8', black: '0a1606', bg: '14260d', title: 'd08a50',
  gray: FOREST_DAY.gray,
  accent: FOREST_DAY.accent,
};

/** Every CSS custom property this module ever sets — used to clear overrides cleanly. */
export const READER_THEME_KEYS = [
  '--rd-white', '--rd-black', '--rd-bg', '--rd-title',
  ...RAMP_STOPS.flatMap(s => [`--rd-gray-${s}`, `--rd-accent-${s}`]),
];

/** Returns {} (a no-op) when accentColorHex is null or matches the Forest hue. */
export function readerThemeVars(accentColorHex: string | null, isDark: boolean): Record<string, string> {
  const deltaHue = accentColorHex ? hexToHsl(accentColorHex)[0] - FOREST_HUE : 0;
  if (!deltaHue) return {};

  const base = isDark ? FOREST_EVENING : FOREST_DAY;
  const vars: Record<string, string> = {};

  const [wh, ws, wl] = rotate(base.white, deltaHue);
  vars['--rd-white'] = hslToTriplet(wh, ws, wl);
  const [bh, bs, bl] = rotate(base.black, deltaHue);
  vars['--rd-black'] = hslToTriplet(bh, bs, bl);
  const [gh, gs, gl] = rotate(base.bg, deltaHue);
  vars['--rd-bg'] = hslToHex(gh, gs, gl);
  const [th, ts, tl] = rotate(base.title, deltaHue);
  vars['--rd-title'] = hslToHex(th, ts, tl);

  RAMP_STOPS.forEach((stop, i) => {
    const [grh, grs, grl] = rotate(base.gray[i], deltaHue);
    vars[`--rd-gray-${stop}`] = hslToTriplet(grh, grs, grl);
    const [ach, acs, acl] = rotate(base.accent[i], deltaHue);
    vars[`--rd-accent-${stop}`] = hslToTriplet(ach, acs, acl);
  });

  return vars;
}
