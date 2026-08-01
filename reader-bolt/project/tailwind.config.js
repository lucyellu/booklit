/** @type {import('tailwindcss').Config} */

/*
 * Forest palette remap.
 *
 * This reader threads an `isDarkMode` boolean through ~16 components as roughly
 * 700 hardcoded colour utilities (`text-white`, `bg-black/40`, `text-gray-900`,
 * `bg-blue-500`…). Rewriting those by hand would be a huge, error-prone diff, so
 * instead the *palette itself* is redefined here in terms of CSS variables:
 * every existing class keeps working and retints from one place. The ramps live
 * in src/index.css and flip on [data-theme].
 *
 * The `rgb(var(--x) / <alpha-value>)` form is what keeps slash-opacity classes
 * like `bg-white/10` and `border-white/20` working — Tailwind substitutes the
 * alpha into that placeholder, which it cannot do with a plain hex or with a var
 * holding a complete colour.
 *
 * `white` and `black` here mean "the light end" and "the dark end" of the forest
 * ramp rather than literal white and black, which is how the reader already uses
 * them: white for text in dark mode and for panels in light mode.
 */

const v = (name) => `rgb(var(--rd-${name}) / <alpha-value>)`;

const ramp = (prefix) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
      step,
      v(`${prefix}-${step}`),
    ])
  );

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // App font is driven by the --app-font CSS var (set in index.html).
        // Change it in ONE place: the --app-font line in index.html.
        sans: ['var(--app-font)', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['var(--app-font)', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        white: v('white'),
        black: v('black'),
        // The reader splits its neutrals across gray/slate with no real
        // distinction, so they all point at one ramp.
        gray: ramp('gray'),
        slate: ramp('gray'),
        zinc: ramp('gray'),
        neutral: ramp('gray'),
        stone: ramp('gray'),
        // Every interactive accent in the reader is blue; the neighbours below
        // only show up in the odd decorative gradient. Point them all at the
        // forest greens so nothing stays blue.
        blue: ramp('accent'),
        indigo: ramp('accent'),
        sky: ramp('accent'),
        cyan: ramp('accent'),
        violet: ramp('accent'),
        purple: ramp('accent'),
        // red / amber / green keep Tailwind's own values: they carry meaning
        // (errors, warnings, success) rather than brand, and turning them
        // forest-green would make an error look like a primary button.
      },
    },
  },
  plugins: [],
};
