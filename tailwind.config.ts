import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#020707", panel: "#091210", brass: "#9BF56A",
        profit: "#62F6B2", loss: "#E45F59", paper: "#F4F8F5", muted: "#8D9B96"
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      backgroundImage: {
        "gold-radial": "radial-gradient(circle at 50% 0%, rgba(155,245,106,.15), transparent 54%)"
      }
    }
  },
  plugins: []
} satisfies Config;
