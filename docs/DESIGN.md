# Design System: TETHYS — Planetary Intelligence System

## 1. Visual Theme & Atmosphere

A mission-control-grade monitoring interface. The atmosphere is "watching Earth from orbit" — clinical precision meets cosmic beauty. The globe is the protagonist; all UI is subordinate.

- **Density:** 7/10 — Cockpit-busy but never cluttered. Every pixel carries information.
- **Variance:** 5/10 — Structured, asymmetric where it matters (globe dominant, panels secondary).
- **Motion:** 6/10 — Pulsing earthquake rings, animated correlation arcs, breathing atmosphere glow. Smooth, never flashy.

Reference: NASA Eyes on Earth, NOAA SWPC dashboard, OILTRAC globe.gl dashboard.

---

## 2. Color Palette & Roles

**NO pure black (#000000). NO pure white (#ffffff). NO neon colors.**

- **Deep Void** (#050a0f) — Primary background. Near-black with blue undertone. NOT pure black.
- **Panel Surface** (#0a1628) — Card/panel backgrounds. Dark navy, slightly lighter than background.
- **Panel Border** (#1a2a4a) — Subtle blue-gray borders. 1px, never thicker.
- **Text Primary** (#e0e6ed) — Main text. Off-white, NOT pure white.
- **Text Muted** (#5a6a7a) — Secondary text, labels, timestamps. Gray-blue.
- **Accent Amber** (#f5a623) — Branding, section headers, active states. Warm gold. ONE accent only.
- **Status Green** (#00e676) — Operational, live, nominal. Material green, NOT neon.
- **Alert Red** (#ff1744) — Critical anomalies. Material red, NOT pure red.
- **Data Blue** (#448aff) — Data points on globe, links, interactive elements.
- **Anomaly Amber** (#ff9100) — Medium severity anomalies.
- **Anomaly Yellow** (#ffea00) — Low severity anomalies.

**BANNED:** #000000, #ffffff, #00ff00, #ff00ff, any neon/saturated colors, purple gradients.

---

## 3. Typography Rules

**Dual font system — sans for UI, mono for ALL data.**

- **Display:** Space Grotesk — Track-tight, 20-26px, weight 600-700. Used for "TETHYS" logo and major section headers ONLY.
- **Body:** Space Grotesk — 13-14px, weight 400. Used for UI labels, descriptions, navigation.
- **Data/Mono:** JetBrains Mono — 11-13px, weight 400-500. Used for ALL numerical data, timestamps, coordinates, z-scores, magnitudes, counts. NEVER use sans-serif for numbers.
- **Labels:** JetBrains Mono — 10px, weight 500, uppercase, letter-spacing 1-2px. For section headers like "ANOMALIES", "DATA SOURCES".

**BANNED:** Inter font, generic serif fonts, pure white text, oversized glowing text.

---

## 4. Component Stylings

### Cards/Panels
- Background: #0a1628
- Border: 1px solid #1a2a4a
- Border-radius: 6px (small, not rounded)
- Padding: 14-16px
- No shadows (use border for definition)
- Title: uppercase mono, amber (#f5a623), 10px, letter-spacing 2px

### Status Badges
- Translucent background + border matching the color
- Example (active): bg rgba(0,230,118,0.15), border rgba(0,230,118,0.3), text #00e676
- Example (warning): bg rgba(255,145,0,0.15), border rgba(255,145,0,0.3), text #ff9100
- Example (critical): bg rgba(255,23,68,0.15), border rgba(255,23,68,0.3), text #ff1744
- Border-radius: 4px, padding: 3px 8px, font: mono 10px
### Globe Texture & Atmosphere
- Blue marble texture (realistic, NOT flat dark)
- Night sky background (NOT solid black)
- Atmosphere glow: subtle, not neon
- Auto-rotate slowly when idle, stop on interaction

### Globe Data Indicators — CLEAN MINIMAL STYLE
**NOT pulsing rings. NOT glowing dots. NOT radar animations.**

Style: Subtle, clean, confident. The globe should breathe, not scream.

- **Earthquake points:** Small solid circles, slightly raised above surface (altitude 0.01)
  - Color: muted severity gradient (not neon)
    - M<3: #64748b (slate-500, barely visible)
    - M3-4: #94a3b8 (slate-400)
    - M4-5: #f59e0b (amber-500)
    - M5-6: #ef4444 (red-500)
    - M6+: #dc2626 (red-600)
  - Size: proportional to magnitude (subtle, not exaggerated)
  - NO pulsing animation on the globe itself
  - On hover: point scales up slightly + tooltip appears (clean, minimal)
  - On click: smooth camera fly-to (600ms ease)

- **Correlation arcs:** Thin, subtle lines between correlated events
  - Color: #448aff at 0.3 opacity (barely visible unless looking)
  - Stroke: 0.5px (thin, elegant)
  - NO animated dashes — static arcs that reveal on hover
  - On hover: arc brightens to 0.8 opacity

- **Labels:** Only show on hover or for major events (M5+)
  - Text-shadow for readability over globe
  - Font: JetBrains Mono 10px
  - White text, 0.7 opacity

**Principle:** The globe should look calm and confident when idle. Data reveals itself on interaction. Not everything needs to be visible at once.

### Globe Texture
- earth-blue-marble.jpg (realistic, NOT flat dark)
- earth-topology.png (bump mapping for terrain)
- night-sky.png (background, NOT solid black)
- showAtmosphere: true
- atmosphereColor: #1a3a6a (subtle blue)
- atmosphereAltitude: 0.15

### Progress Bars
- Height: 5-6px (thin, not chunky)
- Track: rgba(255,255,255,0.05)
- Fill: semantic color (green/amber/red) with border-radius
- No animation on the bar itself

### Scrollbar
- Width: 6px
- Track: transparent
- Thumb: #1a2a4a, border-radius 3px

---

## 5. Layout Principles

**Three-column architecture:**

```
┌──────────────────────────────────────────────────────────┐
│  HEADER: Logo + Status + Navigation                       │
├────────────┬─────────────────────────┬───────────────────┤
│  LEFT      │                         │  RIGHT            │
│  PANEL     │      3D GLOBE           │  PANEL            │
│  (280px)   │      (flexible)         │  (320px)          │
│            │                         │                   │
│  Activity  │  Earth with data        │  Live Feed        │
│  Index     │  overlays, arcs,        │  Anomalies        │
│  Sources   │  pulsing rings          │  Activity         │
│            │                         │                   │
├────────────┴─────────────────────────┴───────────────────┤
│  TIME SCRUBBER: Timeline + Speed Controls + LIVE          │
└──────────────────────────────────────────────────────────┘
```

- Globe takes 60-70% of horizontal space
- Panels are fixed width, scrollable internally
- Time scrubber is full-width at bottom
- Header is 48-56px fixed height
- No overlapping elements — clean spatial separation
- CSS Grid preferred over Flexbox percentage hacks

---

## 6. Motion & Interaction

- **Globe rotation:** Auto-rotate slowly (0.2 deg/sec) when idle. Stop on user interaction.
- **Camera fly-to:** Smooth animation (600ms ease) when clicking events.
- **Hover reveal:** Data points scale up subtly on hover. Tooltips fade in (0.2s).
- **Arc reveal:** Correlation arcs brighten on hover (0.3 → 0.8 opacity).
- **Staggered list reveals:** Anomaly feed items cascade in with 50ms delay.
- **Tab transitions:** Content fades in (0.3s) when switching tabs.
- **NO perpetual animations on the globe** — calm and confident when idle.

**BANNED:** Linear easing, instant snap transitions, bouncing chevrons, scroll arrows.

---

## 7. Responsive Rules

- **Desktop (>1200px):** Full three-column layout
- **Tablet (768-1200px):** Globe full-width, panels collapse to bottom sheet
- **Mobile (<768px):** Globe full-screen, panels as swipeable drawer
- Touch targets: minimum 44px
- Typography scaling via clamp()

---

## 8. Anti-Patterns (BANNED)

- No emojis anywhere in the interface
- No Inter font — use Space Grotesk
- No pure black (#000000) — use #050a0f
- No pure white (#ffffff) — use #e0e6ed
- No neon/outer glow shadows
- No purple gradients
- No generic placeholder text ("Lorem ipsum")
- No overlapping elements
- No 3-column equal card layouts
- No AI copywriting ("Elevate", "Seamless", "Next-Gen")
- No centered Hero sections
- No bouncing scroll arrows
- No custom mouse cursors
- No oversaturated colors
- No flat colored dots on globe — use pulsing rings
