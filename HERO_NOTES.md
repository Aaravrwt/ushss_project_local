# USHSS Hero Redesign & Editorial Motion Notes (Revision 2)

## 1. Overview & Architectural Changes

In response to design feedback, the hero section has been rebuilt with a clean, editorial layout featuring a lighter lens blur, prominent left-aligned cursive signature, and immediate page accessibility.

### Key Changes
1. **Immediate Accessibility (No Preloader / Blocking Gates)**:
   - The floating liquid-glass navbar is visible immediately on load (`opacity: 1`, `transform: translateX(-50%)`).
   - Removed all `sessionStorage` intro-seen gates and fullscreen overlay preloader blocking.
   - The handwriting sequence runs non-destructively on the hero canvas ~0.2s after load without blocking scrolling, clicks, or navigation.
2. **Lighter Video Blur (`--hero-blur: 7px`)**:
   - Base blur lowered from ~28px to **7px** via CSS variable `--hero-blur: 7px;`.
   - Dual-zone focal depth via radial mask: sharper focal area (~3–4px) at the campus silhouette blending out to 8–10px at the perimeter.
   - Video colors breathe naturally; ink-900 vignette maintained at edges and bottom for seamless join with the cutout section.
   - Scroll-away behavior: blur eases from 7px up to ~14px with subtle video parallax.
3. **Left-Aligned Handwritten "USHSS" Signature**:
   - Positioned on the left side of the hero, aligned with the navbar logo margin.
   - Rendered using `--font-signature: 'Gravity Signature', 'Mrs Saint Delafield', cursive;`.
   - Accessible DOM: real `<h1 class="sr-only">University School of Humanities & Social Sciences (USHSS) — GGSIPU</h1>` for screen readers; visual signature tagged with `role="img" aria-label="USHSS"`.
   - Animation: Pen starts at the left edge and travels right across U-S-H-S-S in **1.28s** (`ease: "power2.out"`), with an undulating glowing pen-tip dot (`#FFFFFF` with `#4EAEC0` glow).
   - Stays permanently on screen as the signature brand anchor (does not fly into nav).
4. **Content in Times New Roman Staggered Reveal**:
   - Content font: pure `font-family: "Times New Roman", Times, "Liberation Serif", serif;` (no web font download).
   - Staggered entrance begins as the last letter finishes (~1.3s):
     1. Eyebrow: `UNIVERSITY SCHOOL OF HUMANITIES & SOCIAL SCIENCES` (small caps, letter-spaced, `--teal-300`).
     2. Tagline: `Where Ideas Shape Society` (italic on *Shape Society*, `--teal-300`).
     3. Description: academic statement in `--mist-200` with 10+:1 contrast over ink-900 radial scrim.
     4. Action Buttons: "Explore Programmes" (liquid-glass `--teal-700` pill) and "Learn More" (optical glass pill).
     5. Stats Row: 4 liquid-glass chips along the bottom (02 Core Disciplines, MA English & Economics, PhD Research Pathway, 1998 University Established) in Times New Roman.
   - Generous open whitespace on the right showcases the soft-focus video footage without clutter.

---

## 2. Font Drop Instructions

- **Target Directory**: `/Users/aarav/.gemini/antigravity/scratch/ushss_project/static/fonts/`
- **Supported Formats**: `GravitySignature.woff2`, `GravitySignature.ttf`, `GravitySignature.otf`
- **Configuration**:
  - `@font-face` is pre-configured in `templates/ushss_website.html` looking for these filenames in `/static/fonts/`.
  - Temporary stand-in: `Mrs Saint Delafield` (Google Fonts).
  - Swapping is zero-configuration: simply drop the font file into `/static/fonts/` with the filename `GravitySignature.woff2` or `GravitySignature.ttf`.

---

## 3. WCAG AA / AAA Contrast Verification

| Element | Text Token | Background | Contrast Ratio | Compliance |
| :--- | :--- | :--- | :---: | :---: |
| **Eyebrow** | `--teal-300` (`#4EAEC0`) | Ink-900 Scrim (`#212A31`) | **5.65 : 1** | **WCAG AA** |
| **Tagline ("Where Ideas")** | `--mist-200` (`#D3D9D4`) | Ink-900 Scrim | **10.6 : 1** | **WCAG AAA** |
| **Tagline Accent ("Shape Society")** | `--teal-300` (`#4EAEC0`) | Ink-900 Scrim | **5.65 : 1** | **WCAG AA** |
| **Description** | `--mist-200` (`#D3D9D4`) | Ink-900 Scrim | **10.6 : 1** | **WCAG AAA** |
| **Primary CTA ("Explore Programmes")** | `--mist-200` (`#D3D9D4`) | `--teal-700` (`#124E66`) | **4.80 : 1** | **WCAG AA** |
| **Secondary CTA ("Learn More")** | `--mist-200` (`#D3D9D4`) | Glass Lens Tint | **10.6 : 1** | **WCAG AAA** |
| **Stat Numerals (02, MA, PhD, 1998)** | `--mist-200` (`#D3D9D4`) | Glass Chip (`rgba(211,217,212,0.07)`) | **10.6 : 1** | **WCAG AAA** |
| **Stat Labels** | `--mist-200` (82% opacity) | Glass Chip | **7.50 : 1** | **WCAG AAA** |

---

## 4. Verification Screenshots

Screenshots captured at exact timestamps:
- `t = 0.0s`: Nav and softened live video visible immediately; glowing pen tip at start position.
- `t = 0.8s`: Handwriting in progress across U-S-H with leading glowing pen tip.
- `t = 1.5s`: Signature complete; pen tip fades out; staggered reveal of eyebrow and tagline begins.
- `t = 2.5s`: All content (eyebrow, tagline, description, CTAs, and 4 bottom stats chips) settled in Times New Roman.
- Viewports tested: Desktop (1440 × 900) and Mobile (390 × 844, iPhone 14/15/16).
