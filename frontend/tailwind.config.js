/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a6ff",
          500: "#2f83f5",
          600: "#1a63db",
          700: "#164ec4",
          800: "#1a44a0",
          900: "#1b3c80",
        },
        clinical: {
          bg: "#f6f8fb",
          card: "#ffffff",
          ink: "#0f1b2d",
          muted: "#5b6b82",
          line: "#e5ebf3",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,27,45,0.04), 0 8px 24px rgba(16,27,45,0.06)",
        pop: "0 12px 40px rgba(16,27,45,0.18)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
