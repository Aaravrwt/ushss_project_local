# USHSS Website — Design Changelog

## Phase 4 Implementation: "Institutional Gravitas meets Editorial Motion"

### Concept
Transform the USHSS homepage from a static institutional site into an Awwwards-calibre experience — marrying the gravitas of a university with the motion and polish of contemporary editorial design.

---

### Changes Applied

#### 🎨 Design Tokens (CSS Custom Properties)
| Token | Value | Name & Role |
|-------|-------|-------------|
| `--maroon-deep` / `--ink` | `#071B2B` (`rgb(7, 27, 43)`) | **Midnight Oceanic Navy**: Grounding dark sections (Programmes, Events, Footer), base typography, and ambient depth |
| `--maroon` | `#167D8D` (`rgb(22, 125, 141)`) | **Deep Aegean Teal**: Primary brand identity, hero emphasis, CTA buttons, active states, and seal monogram |
| `--maroon-rich` | `#0E4E58` | **Deep Teal Abyss**: Gradient bridge for 3D showcase cards |
| `--maroon-light` | `#1FA2B6` | **Vivid Cyan Sheen**: Button hover highlights and specular rim lights |
| `--gold` | `#B9E4E8` (`rgb(185, 228, 232)`) | **Powder Ice Cyan**: Luminous highlight, diamond glyphs, pill badges, and floating capsule border glow |
| `--gold-light` | `#EBF8F9` | **Crisp Ice Shimmer**: High-contrast text on dark navy surfaces |
| `--gold-deep` | `#0E5B67` | **Slate Teal**: High-contrast kickers and category labels on light surfaces |
| `--gold-glow` | `rgba(185, 228, 232, 0.35)` | **Ice Aura**: Specular liquid-glass glow |
| `--cream` | `#F6F8F8` | **Studio Porcelain Canvas**: Clean, airy background |
| `--cream-dark` | `#EEEEEE` (`rgb(238, 238, 238)`) | **Studio Light Grey**: Secondary card and section backgrounds |
| `--white` | `#FFFFFF` | **Pure White**: Primary card faces and pill buttons |
| `--border` | `#D4E3E5` | **Soft Ice Slate**: Hairline surface dividers |
| `--shadow-glass` | `0 12px 40px rgba(7, 27, 43, 0.10)` | Midnight navy ambient glass shadow |
| Motion tokens | — | `--ease-out`, `--ease-in-out`, `--ease-spring`, `--ease-smooth` |
| Duration tokens | — | `--dur-fast` (200ms), `--dur-normal` (400ms), `--dur-slow` (700ms), `--dur-dramatic` (1200ms) |
| Shadow tokens | — | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glass` |
| Radius tokens | — | `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (16px) |

#### 🖼 Preloader
- **USHSS** letters animate in one-by-one with staggered entrance
- Gold progress bar fills horizontally over ~1.8s
- Dismisses automatically or on click
- Fully skipped when `prefers-reduced-motion: reduce`

#### 🧊 Floating Capsule Navigation (Editorial Island)
- **Shape & Geometry**: Replaced the traditional full-width utility bar with a floating detached capsule island (`border-radius: 9999px; top: 18px; width: min(1220px, calc(100% - 3rem))`), allowing background imagery, gradients, and typography to breathe around it.
- **Dynamic Scroll States**: On scroll (`nav.scrolled`), smoothly compacts height from 62px to 58px, shifts top offset to 12px, tightens width, and elevates shadow depth (`box-shadow: 0 16px 42px rgba(74, 13, 13, 0.12)`).
- **Brand Identity**: Circular seal emblem with gold foil gradient border ring, deep maroon core, and serif monogram paired with tracked editorial subheadings.
- **Pill Navigation Links**: Centered navigation items styled as interactive pills with background hover highlights and active gold diamond indicator lines.
- **Jeweled Action Capsules**: Frosted glass Login button with gold rim lighting and a rich maroon Contact capsule with inner specular reflection.
- **Mobile Experience (390px)**: Compact floating mobile capsule with circular hamburger toggle that morphs into a close ("X") icon, opening into a floating liquid-glass card (`border-radius: 20px`) with full-width action buttons.
- **Mobile Menu Sheet**: Liquid glass drawer with high-blur diffusion (`blur(28px) saturate(180%)`), inner rim lighting, and subtle gold boundary line.
- **Portal Login & Registration Modal**: Liquid glass card with radial golden specular highlight (`radial-gradient(ellipse at 50% -20%, rgba(201,168,76,0.22), transparent 75%)`), deep blur (`blur(32px) saturate(190%)`), and deep ambient shadow (`rgba(35,13,10,0.35)`).
- **Glass Controls**: Faculty carousel arrow controls and floating back-to-top button upgraded to jewel-like liquid glass spheres with spring hover physics.
- **Progressive SVG Refraction**: Embedded `#liquid-refraction` filter (`feTurbulence` + `feDisplacementMap`) for organic optical edge distortion.

#### 🎬 Lenis Smooth Scroll
- Buttery-smooth scroll via [Lenis](https://lenis.dev/) with GSAP ticker integration
- Custom easing: `1.001 - Math.pow(2, -10 * t)` (exponential decay)
- Anchor links work seamlessly with `lenis.scrollTo()`
- Falls back to native `scrollIntoView()` if Lenis fails to load

#### ✨ GSAP ScrollTrigger Animations
| Animation | Elements | Behavior |
|-----------|----------|----------|
| Fade-up reveals | `.fade-up` elements | `y:40→0, opacity:0→1` on scroll into view |
| Word-split reveals | `.section-title` | Each word animates from `y:110%→0%` with stagger |
| Section label slide | `.section-label` | `x:-24→0` slide-in |
| Cutout text scale | `#cutout .cutout-mask h2` | `scale:0.85→1` scrubbed to scroll position |
| Value card stagger | `.value-card` | `y:30→0, scale:0.96→1` with 80ms stagger |
| Programme card stagger | `.prog-card` | `y:30→0` with 100ms stagger |
| Faculty card reveal | `.faculty-card` | `y:24→0` with 80ms stagger |
| Gallery item reveal | `.gallery-item` | `y:20→0, scale:0.95→1` with 60ms stagger |
| Contact section reveal | `.contact-grid` children | `y:30→0` with 150ms stagger |
| Hero staggered entry | Hero elements | Sequential reveal after preloader dismissal |

#### 🎯 Custom Cursor (Desktop Only)
- Small 8px maroon dot follows mouse with lerped movement
- Expands to 40px gold circle on hover over interactive elements
- `mix-blend-mode: difference` for visibility against any background
- Guarded behind `@media(hover:hover)` — hidden on touch devices
- Disabled when `prefers-reduced-motion: reduce`

#### 🧲 Magnetic Buttons
- CTA buttons (`.btn-gold`, `.btn-outline`, `.nav-cta`, `.nav-login-btn`) attract toward cursor on hover
- Subtle `translate()` proportional to cursor distance from element center (20% strength)
- Desktop-only, reduced-motion-safe

#### 📱 iOS Safari Fix
- `background-attachment: fixed` replaced with scroll + GSAP parallax on iOS/touch devices
- Cutout section retains visual effect across all platforms

#### ♿ Accessibility
- All motion wrapped in `prefers-reduced-motion` guard
- Preloader skipped entirely for reduced-motion users
- CSS keyframe animations kept as no-JS fallback
- Skip link, focus-visible, semantic HTML preserved
- ARIA labels on preloader and cursor elements

#### 🔧 Technical
- Reconciled duplicate `:root` token declarations
- Updated CSP to allow `cdn.jsdelivr.net` for external libraries
- Old IntersectionObserver retained as CSS fallback if GSAP fails to load
- Old smooth-scroll handler guarded behind `__lenisActive` flag

---

### Libraries Added
| Library | Version | Size (gzipped) | Purpose |
|---------|---------|----------------|---------|
| [Lenis](https://lenis.dev/) | v1 | ~3.5 KB | Smooth scroll |
| [GSAP](https://gsap.com/) | v3 | ~25 KB | Animation engine |
| [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) | v3 | ~12 KB | Scroll-driven animations |
| **Total** | — | **~40.5 KB** | Under 80 KB budget ✅ |

---

### Before / After Screenshots
*(To be added after Phase 5 verification)*

### Lighthouse Delta
*(To be captured after Phase 5 verification)*

---

> [!NOTE]
> Phase 5 verification (Lighthouse scoring, before/after screenshots, 60fps scroll test) is pending.
