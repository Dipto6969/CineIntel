# CineIntel UI & Styling Guidelines

This document describes the design language, color scheme, typography, and interactive components for CineIntel. The goal is to deliver a premium, immersive interface that feels like a modern media operating system.

---

## 1. Visual Theme: Glassmorphic Dark Mode

CineIntel defaults to a dark mode aesthetic that mimics an interactive dashboard overlay.

### Color Palette (Tailwind CSS v4 oklch base)
We use a dark base color palette enriched with glowing, neon state indicators:

* **Background**: `oklch(0.13 0.02 250)` — Deep obsidian blue-black.
* **Surface / Card**: `oklch(0.18 0.02 250 / 60%)` — Semi-transparent slate-black.
* **Border**: `oklch(1 0 0 / 8%)` — Hairline overlay borders.
* **Primary / Accent**: `oklch(0.70 0.16 195)` — Glowing neon teal.
* **Hover State**: Glow effects (`box-shadow: 0 0 15px oklch(var(--primary) / 25%)`).

### Inventory Status Accents (Glassmorphism Neon)
State indicators must have distinct, premium glow colors:

* **Completed**: Neon Emerald `oklch(0.75 0.15 140)`
* **Plan to Watch**: Neon Amber `oklch(0.78 0.14 75)`
* **On Hold**: Neon Cobalt `oklch(0.68 0.15 230)`
* **Dropped**: Neon Crimson `oklch(0.65 0.18 25)`

---

## 2. Typography

We use modern typography to keep screens legible and premium:
* **Headers**: `var(--font-sans)` (Geist Sans/Outfit) with wide tracking and medium weight.
* **Body**: `var(--font-sans)` (Geist Sans/Inter) with tight leading.
* **Power-Search / Syntax**: `var(--font-mono)` (Geist Mono) to make query parameters feel functional and typewriter-sharp.

---

## 3. UI Patterns & Animations

### 3.1 Glassmorphism Utilities
Cards and popovers should utilize backdrop filter blur to maintain depth over posters and backdrops.
```css
.glass-panel {
  background: rgba(18, 22, 28, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### 3.2 Smooth Transitions & Micro-Animations
Avoid abrupt visual state changes. Enable hover scaling and keyframe-driven fading:
* **Poster Hover**: Scale `1.03` with a soft drop shadow glow.
* **Page Transitions**: Fading transitions on view layouts using Next.js 16 transitions.
* **Button Clicks**: Subtle click shrinking (`active:scale-95`).

### 3.3 Dynamic Movie Detail Backdrops
Movie detail pages should feature a blurred, high-contrast version of the movie's TMDb backdrop image as a ambient backdrop cover, fading into the dark solid background at the bottom.
```css
.backdrop-mask {
  mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
}
```
This mimics premium streaming platforms (e.g. Apple TV, Spotify) and creates an immersive visual environment.
