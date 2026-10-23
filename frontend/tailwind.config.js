import forms from "@tailwindcss/forms";

// Colors, sizes and type scale of the Muhojir design (Material 3 style token names).
// Minimal: deep blue for main actions and dark blocks, one blue accent (primary), neutral greys for surfaces;
// "warning" (amber) is only for deadlines that end soon, so they never look like "expired" (error red).
// "navy"/"banner" are the deep blue of dark blocks; "ink" the main buttons (white in the night theme).
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Every color is a CSS variable from index.css, so dark mode (html.dark) only swaps the variables.
      colors: {
        banner: "rgb(var(--c-banner) / <alpha-value>)",
        navy: "rgb(var(--c-navy) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        "on-ink": "rgb(var(--c-on-ink) / <alpha-value>)",
        "on-navy": "rgb(var(--c-on-navy) / <alpha-value>)",
        "navy-muted": "rgb(var(--c-navy-muted) / <alpha-value>)",
        gold: "rgb(var(--c-gold) / <alpha-value>)",
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--c-primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--c-on-primary-container) / <alpha-value>)",
        "primary-fixed": "rgb(var(--c-primary-fixed) / <alpha-value>)",
        "on-primary-fixed": "rgb(var(--c-on-primary-fixed) / <alpha-value>)",
        secondary: "rgb(var(--c-secondary) / <alpha-value>)",
        "on-secondary": "rgb(var(--c-on-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--c-secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--c-on-secondary-container) / <alpha-value>)",
        "secondary-fixed": "rgb(var(--c-secondary-fixed) / <alpha-value>)",
        "on-secondary-fixed": "rgb(var(--c-on-secondary-fixed) / <alpha-value>)",
        warning: "rgb(var(--c-warning) / <alpha-value>)",
        "on-warning": "rgb(var(--c-on-warning) / <alpha-value>)",
        "warning-container": "rgb(var(--c-warning-container) / <alpha-value>)",
        "on-warning-container": "rgb(var(--c-on-warning-container) / <alpha-value>)",
        "warning-fixed": "rgb(var(--c-warning-fixed) / <alpha-value>)",
        "on-warning-fixed": "rgb(var(--c-on-warning-fixed) / <alpha-value>)",
        tertiary: "rgb(var(--c-tertiary) / <alpha-value>)",
        "on-tertiary": "rgb(var(--c-on-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--c-tertiary-container) / <alpha-value>)",
        "tertiary-fixed": "rgb(var(--c-tertiary-fixed) / <alpha-value>)",
        "on-tertiary-fixed": "rgb(var(--c-on-tertiary-fixed) / <alpha-value>)",
        error: "rgb(var(--c-error) / <alpha-value>)",
        "on-error": "rgb(var(--c-on-error) / <alpha-value>)",
        "error-container": "rgb(var(--c-error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--c-on-error-container) / <alpha-value>)",
        background: "rgb(var(--c-background) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "on-surface": "rgb(var(--c-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--c-on-surface-variant) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--c-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--c-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--c-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--c-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--c-surface-container-highest) / <alpha-value>)",
        "inverse-surface": "rgb(var(--c-inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--c-inverse-on-surface) / <alpha-value>)",
        outline: "rgb(var(--c-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--c-outline-variant) / <alpha-value>)",
      },
      fontFamily: {
        // One family for everything: Onest has every Tajik letter (ӣ ӯ ҳ қ ғ ҷ), checked in the font files; many
        // popular fonts (Unbounded, Manrope, Playfair, Jost...) lack them. To switch fonts, change these two lines
        // and the Google Fonts link in index.html, and check the letters first.
        sans: ["Onest", "system-ui", "sans-serif"],
        // Headings: the same family, semibold and a little tighter (h1/h2/h3 get it in index.css).
        display: ["Onest", "system-ui", "sans-serif"],
      },
      fontSize: {
        "label-sm": ["11px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "600" }],
        "label-md": ["13px", { lineHeight: "18px", fontWeight: "600" }],
        "label-lg": ["15px", { lineHeight: "20px", fontWeight: "600" }],
        "body-sm": ["13px", { lineHeight: "18px" }],
        "body-md": ["15px", { lineHeight: "22px" }],
        "body-lg": ["16px", { lineHeight: "24px" }],
        "headline-sm": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "headline-md": ["22px", { lineHeight: "28px", fontWeight: "600" }],
        "headline-lg": ["28px", { lineHeight: "36px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "headline-xl": ["36px", { lineHeight: "44px", fontWeight: "600", letterSpacing: "-0.025em" }],
      },
    },
  },
  plugins: [forms],
};
