import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: "#20c47a",
        midnight: "#07111f",
        ink: "#0d1828"
      },
      boxShadow: {
        glow: "0 0 32px rgba(32, 196, 122, 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
