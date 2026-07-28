import type { Config } from "tailwindcss";

/**
 * Warm paper palette. The planner and the cook view share one palette but not
 * one type scale — cook sizes live in index.css under `.cook`.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: "#F7F2E9",
          surface: "#FFFDF8",
          sunk: "#F0E9DC",
          border: "#E8DECD",
          line: "#D9CDB8",
        },
        ink: {
          DEFAULT: "#29231C",
          muted: "#7C6F60",
          faint: "#A2968E",
        },
        clay: {
          DEFAULT: "#C0562E",
          soft: "#F6E5D8",
          deep: "#8F3D1E",
        },
        leaf: {
          DEFAULT: "#4E7A4E",
          soft: "#E3EDDF",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(41, 35, 28, 0.04), 0 8px 24px -12px rgba(41, 35, 28, 0.12)",
        lift: "0 12px 40px -16px rgba(41, 35, 28, 0.28)",
      },
      spacing: {
        nav: "var(--app-nav-height)",
      },
      inset: {
        nav: "var(--app-nav-height)",
      },
      height: {
        nav: "var(--app-nav-height)",
      },
    },
  },
  plugins: [],
};

export default config;
