/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lavender: {
          50: '#F8F4FF',
          100: '#F0EAFF',
          200: '#DDD0FF',
          300: '#C9B5FF',
          400: '#B48FFF',
          500: '#C1A3FF',
          600: '#A07BDD',
          700: '#7E54BB',
          800: '#5C2D99',
          900: '#3A0677',
        },
        sage: {
          100: '#F0EAFF',
          200: '#DDD0FF',
          300: '#C9B5FF',
          400: '#B48FFF',
          500: '#C1A3FF',
          600: '#A07BDD',
          700: '#7E54BB',
          800: '#5C2D99',
          900: '#3A0677',
        },
        cream: {
          DEFAULT: '#F5F5F0',
          dark: '#EBEBE5',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          light: '#2A2A2A',
        },
        charcoal: '#333333',
        slate: '#6B6B6B',
        silver: '#9A9A9A',
        'border-light': '#D9D9D3',
        'border-dark': '#3A3A3A',
        'status-pass': '#5A8F5E',
        'status-fail': '#D4524A',
        'status-running': '#E8A838',
        'status-pending': '#9A9A9A',
        'status-info': '#4A90D9',
        'sev-critical': '#D4524A',
        'sev-high': '#E87D3A',
        'sev-medium': '#E8A838',
        'sev-low': '#5A8F5E',
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'card': '0 1px 3px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.08)',
        'pipeline': '0 12px 32px rgba(90,143,94,0.1)',
        'hero': '0 24px 64px rgba(0,0,0,0.12)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(-8px)" },
          "50%": { transform: "translateY(8px)" },
        },
        "pulse-sage": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "float": "float 3s ease-in-out infinite",
        "float-delayed": "float 3s ease-in-out 1.5s infinite",
        "pulse-sage": "pulse-sage 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
