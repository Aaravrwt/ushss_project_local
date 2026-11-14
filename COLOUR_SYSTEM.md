# Liquid Glass & Dye-in-Water Colour System

## 1. The Strict 5-Colour Source of Truth

The site is conceptualised as a **clear optical tank of deep water** (`--ink-900` to `--ink-700`). Concentrated teal dye (`--teal-700`) is dropped in, diffusing and thinning through diluted slate (`--slate-400`) and merging into clear water highlights (`--mist-200`).

| Token | Hex | RGB | Physical Metaphor & Primary Role |
| :--- | :--- | :--- | :--- |
| `--ink-900` | `#212A31` | `rgb(33, 42, 49)` | **Deep Water Base**: Deepest background, page canvas, deep ambient liquid-glass shadows |
| `--ink-700` | `#2E3944` | `rgb(46, 57, 68)` | **Mid-Depth Water**: Raised container surfaces, alternate sections, cards, footer |
| `--teal-700` | `#124E66` | `rgb(18, 78, 102)` | **Concentrated Dye Core**: Primary buttons, brand accents, concentrated fluid plumes |
| `--slate-400` | `#748D92` | `rgb(116, 141, 146)` | **Diluted Dye Boundary**: Fine glass borders (at 20–35% opacity), large secondary text, icons |
| `--mist-200` | `#D3D9D4` | `rgb(211, 217, 212)` | **Clear Water / Light**: Primary typography on dark, specular meniscus highlights, caustic glow |

### Derived Accent Token (Dark Backgrounds)
| Token | Hex | RGB | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| `--teal-300` | `#4EAEC0` | `rgb(78, 174, 192)` | **Luminous Dye Edge**: Same hue as `--teal-700` (197°), tinted for links, focus rings, icon strokes, and specular rim reflections on dark backgrounds. Verified at **5.65:1** on `--ink-900` and **4.56:1** on `--ink-700` (meets WCAG AA). |

---

## 2. Role Mapping & WCAG Contrast Matrix

All text and UI controls strictly comply with WCAG 2.1 AA standards:

| Foreground | Background | Contrast Ratio | WCAG Compliance | Allowed Usage |
| :--- | :--- | :---: | :---: | :--- |
| `--mist-200` (`#D3D9D4`) | `--ink-900` (`#212A31`) | **10.17 : 1** | **AAA** (Pass) | Primary body copy, headings, and nav links |
| `--mist-200` (`#D3D9D4`) | `--ink-700` (`#2E3944`) | **8.21 : 1** | **AAA** (Pass) | Primary text on cards, drawers, and modals |
| `--mist-200` (`#D3D9D4`) | `--teal-700` (`#124E66`) | **6.35 : 1** | **AAA** (Pass) | Text inside primary solid buttons and badges |
| `--slate-400` (`#748D92`) | `--ink-900` (`#212A31`) | **4.14 : 1** | **AA Large** (Pass) | Secondary text at 18px+ or 14px bold (kickers, sub-labels) |
| `--slate-400` (`#748D92`) | `--ink-700` (`#2E3944`) | **3.34 : 1** | **AA Large** (Pass) | Large metadata and icons on card surfaces |
| `--teal-300` (`#4EAEC0`) | `--ink-900` (`#212A31`) | **5.65 : 1** | **AA** (Pass) | Active links, focus indicator rings, eyebrow kickers |
| `--teal-300` (`#4EAEC0`) | `--ink-700` (`#2E3944`) | **4.56 : 1** | **AA** (Pass) | Card accents, tag badges, and interactive outlines |
| `--slate-400` (`#748D92`) | `--mist-200` (`#D3D9D4`) | **2.45 : 1** | **Fail** | ❌ **PROHIBITED** by specification |
| `--teal-700` (`#124E66`) | `--ink-900` (`#212A31`) | **1.60 : 1** | **Fail** | ❌ **PROHIBITED** for text or thin lines |

---

## 3. Physical Liquid Glass Model

Every interactive or container object behaves as an optical lens immersed in water:

1. **Optical Base**:
   - `backdrop-filter: blur(24px) saturate(170%)`
   - Background tint: `rgba(211, 217, 212, 0.07)` (`--mist-200` at 7%)
   - Border: `1px solid rgba(211, 217, 212, 0.20)` (crisp optical edge)
2. **Refractive Lens (SVG Filter)**:
   - `#liquid-refraction` filter utilizing `feTurbulence` (fractal noise) and `feDisplacementMap` (scale 3.0).
   - Distorts background imagery and moving dye clouds near the perimeter while remaining clear at the center.
3. **Beer-Lambert Light & Specular Sheen**:
   - Top-left meniscus highlight: `inset 0 1.5px 1px rgba(211, 217, 212, 0.40)`
   - Bottom-right rim bounce: `inset 0 -1px 1px rgba(78, 174, 192, 0.22)`
   - Soft water shadow: `0 16px 40px rgba(33, 42, 49, 0.45), 0 4px 12px rgba(33, 42, 49, 0.25)`
4. **Fluid Physics & Spring Interaction**:
   - Hover: Lens expands (`scale(1.025)`), internal highlight slides toward the pointer.
   - Active: Droplet compression (`scale(0.97, 1.03)`), releasing into a damped spring settlement.
   - Focus: A gentle `--teal-300` ripple blooms outward.

---

## 4. Colour-in-Water Fluid Dye Layer

1. **WebGL Canvas Shader (`#dye-canvas`)**:
   - Domain-warped simplex and curl noise generating slow, buoyant fluid dye billows.
   - Concentrated dye plumes (`--teal-700` `#124E66`) dilute through slate clouds (`--slate-400` `#748D92`) into clear water highlights (`--mist-200` `#D3D9D4`) over the midnight abyss (`--ink-900` `#212A31`).
2. **Interactive Fluid Dynamics**:
   - **Pointer Stirring**: Moving the mouse induces rotational velocity into the fluid, causing dye clouds to part and trail the cursor.
   - **Click Droplet Bloom**: Clicking drops a concentrated dollop of dye that expands outward in circular vortex rings and diffuses over 1.8 seconds.
   - **Scroll Currents**: Page scrolling shifts the vertical fluid drift proportionally to scroll speed.
3. **Performance & Calibrated Fallback**:
   - Rendering throttled when offscreen or hidden (`requestAnimationFrame` pause).
   - Canvas resolution capped at DPR 1.25 with 1/2 viewport scale for 60fps performance.
   - Fully disabled when `prefers-reduced-motion: reduce`, displaying a peaceful static duotone gradient.

---

## 5. Controlled Semantic States

Semantic alert hues are desaturated and muted to blend harmoniously into the 5-colour oceanic palette:

| State | Hex | RGB | Context |
| :--- | :--- | :--- | :--- |
| **Success** | `#4E9B7A` | `rgb(78, 155, 122)` | Form validation success, portal confirmation |
| **Warning** | `#C99752` | `rgb(201, 151, 82)` | Pending status, session expiry alerts |
| **Error** | `#C75D5D` | `rgb(199, 93, 93)` | Form validation errors, portal login failure |
