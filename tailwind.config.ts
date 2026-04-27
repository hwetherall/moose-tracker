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
        bg: {
          page: "var(--color-bg-page)",
          surface: "var(--color-bg-surface)",
          muted: "var(--color-bg-muted)",
          inset: "var(--color-bg-inset)"
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)"
        },
        border: {
          subtle: "var(--color-border-subtle)",
          medium: "var(--color-border-medium)",
          strong: "var(--color-border-strong)"
        },
        brand: {
          DEFAULT: "var(--color-brand-primary)",
          soft: "var(--color-brand-primary-soft)"
        },
        priority: {
          p1: {
            text: "var(--color-priority-p1-text)",
            bg: "var(--color-priority-p1-bg)"
          },
          p2: {
            text: "var(--color-priority-p2-text)",
            bg: "var(--color-priority-p2-bg)"
          },
          p3: {
            text: "var(--color-priority-p3-text)",
            bg: "var(--color-priority-p3-bg)"
          }
        },
        ink: {
          DEFAULT: "var(--color-text-primary)",
          soft: "var(--color-text-secondary)",
          mute: "var(--color-text-tertiary)"
        },
        paper: {
          DEFAULT: "var(--color-bg-surface)",
          soft: "var(--color-bg-page)",
          mute: "var(--color-bg-muted)",
          line: "var(--color-border-subtle)"
        },
        status: {
          done: "var(--color-status-done-dot)",
          "done-soft": "var(--color-status-done-soft)",
          "done-text": "var(--color-status-done-text)",
          blocked: "var(--color-status-blocked-dot)",
          "blocked-soft": "var(--color-status-blocked-soft)",
          "blocked-text": "var(--color-status-blocked-text)",
          indev: "var(--color-status-in-dev-dot)",
          "indev-soft": "var(--color-status-in-dev-soft)",
          "indev-text": "var(--color-status-in-dev-text)",
          ready: "var(--color-status-ready-for-dev-dot)",
          "ready-soft": "var(--color-status-ready-for-dev-soft)",
          "ready-text": "var(--color-status-ready-for-dev-text)",
          discovery: "var(--color-status-discovery-dot)",
          "discovery-soft": "var(--color-status-discovery-soft)",
          "discovery-text": "var(--color-status-discovery-text)",
          design: "var(--color-status-discovery-dot)",
          experiment: "var(--color-status-experiment-dot)",
          "experiment-soft": "var(--color-status-experiment-soft)",
          "experiment-text": "var(--color-status-experiment-text)",
          backlog: "var(--color-status-backlog-dot)",
          "backlog-soft": "var(--color-status-backlog-soft)",
          "backlog-text": "var(--color-status-backlog-text)",
          unknown: "var(--color-status-unknown-dot)",
          "unknown-soft": "var(--color-status-unknown-soft)",
          "unknown-text": "var(--color-status-unknown-text)"
        },
        type: {
          "epic-soft": "var(--color-type-epic-soft)",
          "epic-text": "var(--color-type-epic-text)",
          "story-soft": "var(--color-type-story-soft)",
          "story-text": "var(--color-type-story-text)",
          "task-soft": "var(--color-type-task-soft)",
          "task-text": "var(--color-type-task-text)"
        }
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["var(--font-fraunces)", "Iowan Old Style", "Georgia", "serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"]
      },
      fontSize: {
        body: ["13.5px", { lineHeight: "1.5", fontWeight: "400" }],
        item: ["13.5px", { lineHeight: "1.4", fontWeight: "400" }],
        compact: ["12.5px", { lineHeight: "1.35", fontWeight: "400" }],
        label: ["11px", { lineHeight: "1.3", fontWeight: "400" }],
        badge: ["10px", { lineHeight: "1", fontWeight: "500", letterSpacing: "0.02em" }],
        section: ["17px", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "-0.015em" }],
        page: ["26px", { lineHeight: "1.2", fontWeight: "500", letterSpacing: "-0.015em" }],
        display: ["28px", { lineHeight: "1", fontWeight: "500" }]
      }
    }
  },
  plugins: []
};

export default config;
