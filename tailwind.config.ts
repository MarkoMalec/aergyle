import type { Config } from "tailwindcss";

const plugin = require("tailwindcss/plugin");

// Circular falloff for the game backdrop: solid through the top-left of
// the shell, fully transparent by the bottom-right corner.
const WEAVE_FADE =
  "radial-gradient(circle farthest-corner at 0% 0%, #000 25%, transparent 90%)";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      backgroundImage: {
        homepage: "url('/assets/homepage/background1.jpg')",
        // Game shell backdrop: a fine diagonal weave over a 50px minor /
        // 200px major map grid, faded out by WEAVE_FADE above.
        // Painted by <GameBackdrop />; tune both here.
        "game-weave": [
          "repeating-linear-gradient(45deg, hsl(var(--foreground) / 0.02) 0 1px, transparent 1px 8px)",
          "repeating-linear-gradient(to right, hsl(var(--primary) / 0.065) 0 1px, transparent 1px 200px)",
          "repeating-linear-gradient(to bottom, hsl(var(--primary) / 0.065) 0 1px, transparent 1px 200px)",
          "repeating-linear-gradient(to right, hsl(var(--primary) / 0.02) 0 1px, transparent 1px 50px)",
          "repeating-linear-gradient(to bottom, hsl(var(--primary) / 0.02) 0 1px, transparent 1px 50px)",
        ].join(", "),
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-geist-sans)", "Arial", "sans-serif"],
      },
      colors: {
        "surface-inset": "hsl(var(--surface-inset) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        "text-secondary": "hsl(var(--text-secondary) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
        xp: "hsl(var(--xp) / <alpha-value>)",
        currency: "hsl(var(--currency) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          primary: "hsl(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground":
            "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground":
            "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        // The quest marker hovering over an NPC's head.
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        // A travel route inked once along a path with pathLength=1.
        "route-draw": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        // Homepage. Fire, lantern and candle light in the paintings.
        flicker: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "22%": { opacity: "0.7", transform: "scale(0.95)" },
          "41%": { opacity: "0.94", transform: "scale(1.04)" },
          "63%": { opacity: "0.62", transform: "scale(0.93)" },
          "82%": { opacity: "0.97", transform: "scale(1.02)" },
        },
        // Sun, moon and anything else that glows without burning.
        breathe: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.12)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.12" },
          "50%": { opacity: "1" },
        },
        // Mist sliding along a valley.
        drift: {
          from: { transform: "translate3d(-7%, 0, 0)" },
          to: { transform: "translate3d(7%, 0, 0)" },
        },
        // One quick streak, then a long wait for the next.
        "shooting-star": {
          "0%": { opacity: "0", transform: "translate3d(0, 0, 0)" },
          "2%": { opacity: "1" },
          "8%, 100%": { opacity: "0", transform: "translate3d(-900%, 0, 0)" },
        },
        // The hero painting coming out of the dark as the page opens.
        daybreak: {
          from: {
            filter: "brightness(0.3) saturate(0.5)",
            transform: "scale(1.07)",
          },
          to: { filter: "brightness(1) saturate(1)", transform: "scale(1)" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translate3d(0, 0.55em, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        // A glint running along a crafting link; needs a narrow background.
        spark: {
          from: { backgroundPosition: "-70% 0" },
          to: { backgroundPosition: "170% 0" },
        },
        // A row flashing as an order fills.
        "row-flash": {
          from: { backgroundColor: "hsl(var(--primary) / 0.22)" },
          to: { backgroundColor: "transparent" },
        },
        // The frame's kick when a roll lands on something good.
        "drop-pop": {
          "0%": { transform: "scale(0.9)" },
          "45%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        // Enchanting (EnchantPanel).
        // The bright head running at the front of a filling line. --head is
        // its dash length plus a hair, so it starts and ends off the path.
        "enchant-head": {
          from: { strokeDashoffset: "var(--head)" },
          to: { strokeDashoffset: "-1.005" },
        },
        // A failed charge running back out the way it came.
        "enchant-drain": {
          from: { strokeDashoffset: "0" },
          to: { strokeDashoffset: "1" },
        },
        // The full circuit holding its breath before the result: a heartbeat
        // that quickens.
        "enchant-throb": {
          "0%, 30%, 58%, 80%, 94%, 100%": { opacity: "1" },
          "15%": { opacity: "0.5" },
          "45%": { opacity: "0.55" },
          "70%": { opacity: "0.6" },
          "88%": { opacity: "0.65" },
        },
        // The item straining under the charge.
        "enchant-tremble": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(-1px, 1px)" },
          "50%": { transform: "translate(1px, -1px)" },
          "75%": { transform: "translate(-1px, -1px)" },
        },
        // A failed enchant: one hard knock that dies out.
        "enchant-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "15%": { transform: "translateX(-7px)" },
          "30%": { transform: "translateX(6px)" },
          "45%": { transform: "translateX(-4px)" },
          "60%": { transform: "translateX(3px)" },
          "80%": { transform: "translateX(-1px)" },
        },
        // The rings and the flash a success throws off.
        "enchant-burst": {
          from: { opacity: "0.9", transform: "scale(0.7)" },
          to: { opacity: "0", transform: "scale(2.4)" },
        },
        // A spark thrown from the item; --dx / --dy say where it lands.
        "enchant-spark": {
          "0%": { opacity: "1", transform: "translate(0, 0) scale(1)" },
          "55%": { opacity: "1" },
          "100%": {
            opacity: "0",
            transform: "translate(var(--dx), var(--dy)) scale(0.3)",
          },
        },
        // The charge holding in the lines after a success, then fading.
        "enchant-afterglow": {
          "0%, 45%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        // A failed charge: it flickers, holds while it runs back out, and is gone.
        "enchant-fizzle": {
          "0%, 10%, 22%, 92%": { opacity: "1" },
          "5%": { opacity: "0.35" },
          "15%": { opacity: "0.45" },
          "100%": { opacity: "0" },
        },
        // An accessory breaking apart.
        "enchant-shatter": {
          "0%": { opacity: "1", transform: "scale(1)", filter: "none" },
          "30%": { opacity: "1", filter: "brightness(2.2) saturate(0)" },
          "100%": {
            opacity: "0",
            transform: "scale(1.35) rotate(8deg)",
            filter: "brightness(0.4) saturate(0) blur(3px)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        bob: "bob 2.4s ease-in-out infinite",
        "route-draw": "route-draw 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        flicker: "flicker 3.1s ease-in-out infinite",
        breathe: "breathe 7s ease-in-out infinite",
        twinkle: "twinkle 3.6s ease-in-out infinite",
        drift: "drift 34s ease-in-out infinite alternate",
        "shooting-star": "shooting-star 13s ease-out infinite",
        daybreak: "daybreak 3.4s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "rise-in": "rise-in 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        spark: "spark 2.8s linear infinite",
        "row-flash": "row-flash 0.9s ease-out",
        "drop-pop": "drop-pop 0.45s cubic-bezier(0.2, 0.7, 0.2, 1)",
        // Durations and delays of the charge are set inline, per attempt.
        "enchant-head": "enchant-head 1s linear both",
        "enchant-drain": "enchant-drain 1s linear both",
        "enchant-throb": "enchant-throb 1s linear",
        "enchant-tremble": "enchant-tremble 90ms linear infinite",
        "enchant-shake": "enchant-shake 0.5s ease-out",
        "enchant-burst": "enchant-burst 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "enchant-spark": "enchant-spark 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "enchant-afterglow": "enchant-afterglow 3.2s ease-out forwards",
        "enchant-fizzle": "enchant-fizzle 1.6s linear forwards",
        "enchant-shatter": "enchant-shatter 0.9s ease-in forwards",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(({ addUtilities }: { addUtilities: (u: object) => void }) => {
      addUtilities({
        ".mask-weave-fade": {
          maskImage: WEAVE_FADE,
          WebkitMaskImage: WEAVE_FADE,
        },
      });
    }),
  ],
} satisfies Config;

export default config;
