/** @type {import('tailwindcss').Config} */
// Marka rengi firma temasından (AuthContext.applyTheme) CSS değişkenleri üzerinden gelir.
// Değişkenler "R G B" üçlüsü olarak tutulur; böylece bg-brand-500/15 gibi opaklık modifier'ları çalışır.
const brand = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Chivo", "IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        brand: {
          DEFAULT: brand("--brand-rgb"),
          50: brand("--brand-soft-rgb"),
          100: brand("--brand-soft-rgb"),
          200: brand("--brand-soft-rgb"),
          300: brand("--brand-rgb"),
          400: brand("--brand-rgb"),
          500: brand("--brand-rgb"),
          600: brand("--brand-hover-rgb"),
          700: brand("--brand-strong-rgb"),
          800: brand("--brand-strong-rgb"),
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        pop: "0 10px 30px -8px rgb(15 23 42 / 0.18), 0 2px 6px -2px rgb(15 23 42 / 0.08)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "page-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "page-in": "page-in 0.28s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
