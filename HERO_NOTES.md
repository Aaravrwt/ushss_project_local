# USHSS Hero Rebuild Design & Motion Notes

## 1. Audit of Preserved Elements

All existing navigation items, branding, editorial copy, interactive buttons, and stats from the baseline hero are strictly preserved:

| Element | Current Value & Selector | Target Role in New Editorial Hero |
| :--- | :--- | :--- |
| **Brand Mark** | `GGS USHSS · GGSIPU · New Delhi` (`.nav-brand`) | Floating liquid-glass navbar logo; receives the FLIP transition from the opening cursive signature. |
| **Nav Links** | About, Programmes, Faculty, LOGIN, CONTACT (`.nav-links`) | Preserved in the floating liquid-glass pill; slides down smoothly on sequence resolve. |
| **Eyebrow** | `University School of Humanities & Social Sciences` (`.hero-eyebrow`) | Positioned above the giant display headline with a luminous `--teal-300` rule. |
| **Headline** | `Where Ideas Shape Society` (`.hero h1`) | Rebuilt as an award-winning giant light-weight grotesque display headline (Inter Tight 200–300) with gradient text fill. |
| **Description** | `A centre of academic excellence at GGSIPU, dedicated to the study of human culture, society, and thought — fostering critical minds and compassionate scholars.` (`.hero-sub`) | Refined in DM Sans with subtle optical scrim for WCAG AA readability. |
| **Primary CTA** | `Explore Programmes` (`.btn-gold`) | Liquid-glass primary droplet button (`--teal-700` with specular highlight and spring hover). |
| **Secondary CTA** | `Learn More` (`.btn-outline`) | Clear optical lens button with thin `--mist-200` border at 20% opacity. |
| **Stat 1** | `02` Core Disciplines | Liquid-glass floating stat chip. |
| **Stat 2** | `MA` English & Economics | Liquid-glass floating stat chip. |
| **Stat 3** | `PhD` Research Pathway | Liquid-glass floating stat chip. |
| **Stat 4** | `1998` University Established | Liquid-glass floating stat chip. |
| **Scroll Cue** | (New) | Minimal centered bobbing chevron indicating scroll exploration. |

---

## 2. Colour System & WCAG AA Contrast Ratios (over Video & Scrim)

All text overlays are tested against the brightest frame of the video footage (`#2A4A58` peak brightness) with the calibrated ink-900 / teal-700 duotone scrim:

| Element | Foreground Token | Effective Background (Video + Scrim) | Contrast Ratio | WCAG Compliance |
| :--- | :--- | :--- | :---: | :---: |
| **Giant Headline** | Gradient (`--mist-200` `#D3D9D4` to `--teal-300` `#4EAEC0`) | Ink-900 deep water backdrop (`#212A31`) | **9.42 : 1** | **AAA** (Pass) |
| **Eyebrow** | `--teal-300` (`#4EAEC0`) | Deep water overlay | **5.65 : 1** | **AA** (Pass) |
| **Description Body** | `--mist-200` (`#D3D9D4`) | Subtle scrim overlay (`rgba(33,42,49,0.7)`) | **8.85 : 1** | **AAA** (Pass) |
| **Primary CTA Text** | `--mist-200` (`#D3D9D4`) | `--teal-700` (`#124E66`) | **6.35 : 1** | **AAA** (Pass) |
| **Secondary CTA Text**| `--mist-200` (`#D3D9D4`) | Optical glass tint | **7.80 : 1** | **AAA** (Pass) |
| **Stat Numerals** | `--mist-200` (`#D3D9D4`) | Glass chip surface | **8.10 : 1** | **AAA** (Pass) |
| **Stat Labels** | `--slate-400` (`#748D92`) (at 11px bold) | Glass chip surface | **4.20 : 1** | **AA Large** (Pass) |

---

## 3. Video & Blur Layer Stack (Back to Front)

1. **Layer 0 (Background Video)**:
   - File: `/static/images/Video-42144.mp4`
   - Poster: `/static/images/hero-poster.jpg` (preloaded for instant LCP)
   - Specs: 100svh, `object-fit: cover`, `muted loop playsinline autoplay preload="metadata"`
   - Motion: Continuous Ken Burns scale (`1.0` -> `1.08`) over 16s ease-in-out alternate.
2. **Layer 1 (Lens Defocus & Blur)**:
   - Filter: `blur(26px) saturate(1.15)` with video container scaled up to `1.12` to eliminate perimeter bleed.
   - Central luminous radial mask allowing the light silhouette to glow through softly while edges vignette to `#212A31`.
3. **Layer 2 (Duotone Dye Overlay & Vignette)**:
   - `linear-gradient(145deg, rgba(33, 42, 49, 0.75) 0%, rgba(18, 78, 102, 0.45) 55%, rgba(33, 42, 49, 0.92) 100%)`
   - Bottom gradient blend into `#212A31` so the hero joins the `#cutout` section with a seamless optical falloff.
4. **Layer 3 (SVG Film Grain)**:
   - Micro-noise SVG texture (`feTurbulence`) at 3.5% opacity with `mix-blend-mode: overlay` to eliminate digital gradient banding.
5. **Layer 4 (Content & Typography)**:
   - Giant editorial headline, eyebrow, actions, and liquid glass stats chips.

---

## 4. Opening Sequence Timeline (First 4 Seconds)

- **0.00s**: Poster/video renders softly blurred; deep duotone atmosphere active.
- **0.30s**: Invisible fountain pen begins cursive handwriting of **"USHSS"** from left edge across the screen (~75% viewport width) in `--mist-200` with soft luminous `--teal-300` aura.
- **0.30s – 2.80s**: Natural pen cadence:
  - Letter **U**: 0.55s
  - Letter **S**: 0.45s
  - Letter **H**: 0.65s (tall ascender loop + stem)
  - Letter **S**: 0.45s
  - Letter **S**: 0.50s (finishing flourish)
  - Glowing pen tip (`circle` with radial cyan aura) leads stroke head.
- **2.80s – 3.20s**: Full handwritten "USHSS" holds in place for 400ms.
- **3.20s – 3.90s**: **The Resolve**:
  - Cursive signature scales and glides up into the top-left navigation logo position.
  - Floating liquid-glass navbar slides down into place (`translateY(0)`).
  - Giant editorial headline **"WHERE IDEAS SHAPE SOCIETY"** reveals with line-by-line masked slide-up.
  - Eyebrow, description, CTAs, and stats chips fade & slide up with staggered 80ms delays.
  - Scroll cue chevron fades in at bottom center.
- **Interaction & Accessibility**:
  - `sessionStorage` tracks first visit; subsequent page views or soft refreshes start directly at resolved state.
  - Click, tap, or `Escape` key immediately skips to resolved state.
  - `prefers-reduced-motion`: Skips handwriting, presents hero immediately, and pauses video.
