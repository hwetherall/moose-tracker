import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Muted, professional palette — placeholder values; swap in exact
        // Innovera client-onboarding shades when Harry shares them.
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          mute: "#64748b"
        },
        paper: {
          DEFAULT: "#ffffff",
          soft: "#f8fafc",
          mute: "#f1f5f9",
          line: "#e2e8f0"
        },
        brand: {
          DEFAULT: "#1d4ed8",
          soft: "#eff6ff"
        },
        status: {
          done: "#16a34a",
          blocked: "#dc2626",
          indev: "#2563eb",
          ready: "#0891b2",
          discovery: "#ca8a04",
          design: "#7c3aed",
          experiment: "#db2777",
          backlog: "#64748b",
          unknown: "#94a3b8"
        },
        type: {
          epic: "#7c3aed",
          story: "#2563eb",
          task: "#64748b"
        }
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
