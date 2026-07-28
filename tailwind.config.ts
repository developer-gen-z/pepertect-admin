import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-base)',
        foreground: 'var(--text-primary)',
        primary: { DEFAULT: 'var(--brand-primary)', foreground: '#FFFFFF' },
        muted: { DEFAULT: 'var(--bg-surface-alt)', foreground: 'var(--text-secondary)' },
        accent: { DEFAULT: 'var(--bg-surface-alt)', foreground: 'var(--text-primary)' },
        destructive: 'var(--loss-red)',
        border: 'var(--border)',
        card: { DEFAULT: 'var(--bg-surface)', foreground: 'var(--text-primary)' },
        popover: { DEFAULT: 'var(--bg-surface)', foreground: 'var(--text-primary)' },
        ring: 'var(--focus-ring)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
export default config;
