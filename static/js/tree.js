/**
 * tree.js — dark-silhouette tree at right screen edge
 *
 * Trunk centre pinned to x = W (right edge); only the LEFT half is visible.
 * Crown  → Section A (About,       vy 0 → 1)
 * Trunk  → Section B (Programmes,  vy 1 → 2)
 * Roots  → Section C (Faculty,     vy 2 → 3)
 *
 * vx coordinate: fraction of W, measured leftward from right edge.
 *   vx =  0.000  → x = W  (right edge, trunk centre)
 *   vx = -0.550  → x = 0.45·W (crown's widest reach)
 * vy coordinate: virtual [0 … 3] mapped to real section boundaries.
 *
 * Vanilla Canvas 2D. DPR cap 1.5. 30 fps. No libraries.
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     0.  REDUCED-MOTION PREFERENCE
  ═══════════════════════════════════════════════════════ */
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════════════════
     1.  CANVAS
  ═══════════════════════════════════════════════════════ */
  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '0', pointerEvents: 'none', opacity: '0', willChange: 'opacity',
  });
  document.body.prepend(canvas);

  if (window.matchMedia('(max-width: 768px)').matches) {
    canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  let DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0;

  function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ═══════════════════════════════════════════════════════
     2.  SECTION BOUNDS
  ═══════════════════════════════════════════════════════ */
  const elA = document.getElementById('about');
  const elB = document.getElementById('programmes');
  const elC = document.getElementById('faculty');
  if (!elA || !elB || !elC) return;

  let aTop = 0, bTop = 0, cTop = 0, cBot = 0;

  function cacheBounds() {
    const sy = window.scrollY;
    aTop = elA.getBoundingClientRect().top    + sy;
    bTop = elB.getBoundingClientRect().top    + sy;
    cTop = elC.getBoundingClientRect().top    + sy;
    cBot = elC.getBoundingClientRect().bottom + sy;
  }

  /* virtual y → absolute page y */
  function vyToAbs(vy) {
    if (vy <= 1) return aTop + vy * (bTop - aTop);
    if (vy <= 2) return bTop + (vy - 1) * (cTop - bTop);
    return          cTop + (vy - 2) * (cBot  - cTop);
  }

  /* ═══════════════════════════════════════════════════════
     3.  SEEDED RNG  (mulberry32)
  ═══════════════════════════════════════════════════════ */
  let _r = 0xCAFEBABE;
  function rng() {
    _r |= 0; _r = _r + 0x6D2B79F5 | 0;
    let t = Math.imul(_r ^ _r >>> 15, 1 | _r);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function rngReset() { _r = 0xCAFEBABE; }

  /* ═══════════════════════════════════════════════════════
     4.  STARS  (120, pre-generated)
  ═══════════════════════════════════════════════════════ */
  const NS       = 120;
  const starFX   = new Float32Array(NS);   // leftward fraction of W from right edge [0, 0.58]
  const starFY   = new Float32Array(NS);   // vertical fraction of H [0, 1]
  const starBase = new Float32Array(NS);   // base alpha [0.20, 0.60]
  const starPh   = new Float32Array(NS);   // twinkle phase

  /* ═══════════════════════════════════════════════════════
     5.  GLOW SPRITE  (offscreen canvas, radial gradient)
         Centre at right screen edge, radius 0.6·W.
  ═══════════════════════════════════════════════════════ */
  let glowSprite = null;

  function buildGlowSprite() {
    const r = Math.ceil(W * 0.60);
    if (!glowSprite) glowSprite = document.createElement('canvas');
    glowSprite.width  = r;
    glowSprite.height = H;
    const gc = glowSprite.getContext('2d');
    gc.clearRect(0, 0, r, H);
    /* Gradient centre at (r, H/2) = right edge of this sub-canvas */
    const gr = gc.createRadialGradient(r, H / 2, 0, r, H / 2, r);
    gr.addColorStop(0,    'rgba(95,184,204,0.22)');
    gr.addColorStop(0.42, 'rgba(95,184,204,0.09)');
    gr.addColorStop(1,    'rgba(95,184,204,0)');
    gc.fillStyle = gr;
    gc.fillRect(0, 0, r, H);
  }

  /* ═══════════════════════════════════════════════════════
     6.  FLAT SEGMENT ARRAYS  (up to 8 500)
  ═══════════════════════════════════════════════════════ */
  const MSEG = 8500;
  const svx1 = new Float32Array(MSEG);   // vx of segment start
  const svy1 = new Float32Array(MSEG);   // vy of segment start
  const svx2 = new Float32Array(MSEG);   // vx of segment end
  const svy2 = new Float32Array(MSEG);   // vy of segment end
  const svz  = new Float32Array(MSEG);   // depth z  [-1, +1]
  const sth  = new Float32Array(MSEG);   // ref thickness (px at W=1 280)
  const sba  = new Float32Array(MSEG);   // body alpha
  const sra  = new Float32Array(MSEG);   // rim alpha
  const sdp  = new Int16Array(MSEG);     // recursion depth
  const sph  = new Float32Array(MSEG);   // wind phase
  let   nSeg = 0;

  function pushSeg(x1, y1, x2, y2, z, t, a, r, d, p) {
    if (nSeg >= MSEG) return;
    const i = nSeg++;
    svx1[i]=x1; svy1[i]=y1; svx2[i]=x2; svy2[i]=y2;
    svz[i]=z;   sth[i]=t;   sba[i]=a;   sra[i]=r;
    sdp[i]=d;   sph[i]=p;
  }

  /* ═══════════════════════════════════════════════════════
     7.  TREE GENERATION

     ASPECT: vy-units per vx-unit that makes a visually ~45° branch.
       Assumes section height ≈ 0.90·W.  ASPECT = W/sectionH ≈ 1.11.

     Crown angle θ (radians from vertical-upward):
       θ = 0  → straight up   (vy decreasing, vx unchanged)
       θ > 0  → lean LEFT     (vx decreasing, vy decreasing)
       dvx = −sin(θ)·len
       dvy = −cos(θ)·len·ASPECT

     Root angle θ (radians from horizontal-left):
       θ = 0    → straight left (vx decreasing, vy unchanged)
       θ = π/2  → straight down (vx unchanged, vy increasing)
       dvx = −cos(θ)·len
       dvy = +sin(θ)·len·ASPECT·0.65   (compressed vertically for gnarly look)
  ═══════════════════════════════════════════════════════ */
  const ASPECT = 1.12;
  const CMAX   = 10;    // crown max depth
  const RMAX   =  7;    // root  max depth

  /* ── Crown recursive branch ───────────────────────────── */
  function crownBranch(x, y, angle, len, thick, depth, z, p) {
    if (depth > CMAX || len < 0.0030 || nSeg >= MSEG - 1) return;

    const nx = x - Math.sin(angle) * len;
    const ny = y - Math.cos(angle) * len * ASPECT;

    /* Clamp: left boundary vx = −0.57, top boundary vy = 0 */
    const cx = Math.max(-0.57, Math.min(0.0, nx));
    const cy = Math.max(0.0, ny);

    /* Alpha: fade branches that reach into the text column (vx < −0.45) */
    const leftmost = Math.abs(Math.min(cx, x));
    const bodyA = leftmost > 0.45
      ? 0.95 * (0.30 + 0.70 * Math.max(0, 1 - (leftmost - 0.45) / 0.12))
      : 0.95;

    /* Rim: 0.55 on major limbs (>8 ref-px), 0.25 on mid, 0.12 on twigs */
    const rimA = thick > 8 ? 0.55 : (thick > 3 ? 0.25 : 0.12);

    pushSeg(x, y, cx, cy, z, thick, bodyA, rimA, depth, p);

    if (cy <= 0 || cx <= -0.57) return;    // hit boundary — stop

    /* Number of children: 3 at low depth, then 2, then 1-2 on twigs */
    const nK = depth < 3 ? (rng() < 0.55 ? 3 : 2)
              : depth < 7 ? 2
              : (rng() < 0.55 ? 2 : 1);

    const lMul = 0.73 + rng() * 0.13;     // 0.73–0.86 length multiplier
    const tMul = 0.60 + rng() * 0.08;     // 0.60–0.68 taper

    for (let k = 0; k < nK; k++) {
      let cA;
      if (nK === 3) {
        const sp = 0.28 + rng() * 0.26;   // split spread 0.28–0.54 rad
        cA = k === 0 ? angle + sp * 1.4                     // far-left child
           : k === 1 ? angle + sp * 0.4 + (rng()-0.5)*0.14  // central
           :            angle - sp * 0.5;                    // right/vertical
      } else {
        const sp = 0.20 + rng() * 0.30;
        cA = k === 0 ? angle + sp * 1.2 : angle - sp * 0.5;
      }
      /* Jitter ±12° */
      cA += (rng() - 0.5) * 0.21;
      /* Gravity droop on deep twigs */
      if (depth >= 6) cA += rng() * 0.07;

      const cLen = len * lMul * (1 + (rng()-0.5)*0.15);  // ±15% variation
      const cZ   = Math.max(-1, Math.min(1, z + (rng()-0.5)*0.28));
      const cP   = p + rng() * Math.PI * 1.8;
      crownBranch(cx, cy, cA, cLen, Math.max(0.4, thick * tMul), depth+1, cZ, cP);
    }
  }

  /* ── Root recursive branch ────────────────────────────── */
  function rootBranch(x, y, angle, len, thick, depth, z, p) {
    if (depth > RMAX || len < 0.0028 || nSeg >= MSEG - 1) return;

    const nx = x - Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len * ASPECT * 0.65;

    if (ny > 3.09 || nx < -0.58) return;

    const leftmost = Math.abs(Math.min(nx, x));
    const bodyA = leftmost > 0.45
      ? 0.95 * (0.30 + 0.70 * Math.max(0, 1 - (leftmost - 0.45) / 0.12))
      : 0.95;
    const rimA = thick > 8 ? 0.55 : (thick > 3 ? 0.25 : 0.12);

    pushSeg(x, y, nx, ny, z, thick, bodyA, rimA, depth, p);

    const nK   = depth < 3 ? 3 : 2;
    const lMul = 0.63 + rng() * 0.13;
    const tMul = 0.57 + rng() * 0.11;

    for (let k = 0; k < nK; k++) {
      const sp = 0.24 + rng() * 0.38;
      /* Clamp to [0, π/2 + 0.3] so roots stay leftward or downward */
      const cA = Math.max(0, Math.min(1.87,
        k === 0 ? angle + sp
        : k === 1 ? angle - sp * 0.4 + rng() * 0.1
        :            angle + sp * 0.2 + rng() * 0.1));
      const cZ  = Math.max(-1, Math.min(1, z + (rng()-0.5)*0.28));
      const cP  = p + rng() * Math.PI * 1.5;
      rootBranch(nx, ny, cA, len * lMul, Math.max(0.4, thick * tMul), depth+1, cZ, cP);
    }
  }

  /* ── Assemble the full tree ───────────────────────────── */
  function buildTree() {
    rngReset();
    nSeg = 0;

    /* Stars — consume RNG before tree so star positions are stable */
    for (let i = 0; i < NS; i++) {
      starFX[i]   = rng() * 0.58;
      starFY[i]   = rng();
      starBase[i] = 0.20 + rng() * 0.40;
      starPh[i]   = rng() * Math.PI * 2;
    }

    /* ── Trunk  (Programmes, vy 1.0 → 2.0) ─────────────────
       S-curve silhouette. Ref thickness: base ≈ 77 px (~0.06·W at 1 280).
    ──────────────────────────────────────────────────────── */
    pushSeg( 0.000, 2.00, -0.018, 1.80, 0.00, 77, 0.95, 0.55, 0, 0.00);
    pushSeg(-0.018, 1.80, -0.034, 1.60, 0.01, 65, 0.95, 0.55, 0, 0.10);
    pushSeg(-0.034, 1.60, -0.027, 1.40, 0.00, 56, 0.95, 0.52, 0, 0.20);
    pushSeg(-0.027, 1.40, -0.016, 1.20, 0.01, 50, 0.95, 0.50, 0, 0.30);
    pushSeg(-0.016, 1.20, -0.008, 1.00, 0.00, 44, 0.95, 0.48, 0, 0.40);

    /* Flared root buttress at trunk base */
    pushSeg( 0.000, 2.00, -0.065, 2.075, 0.00, 32, 0.95, 0.52, 1, 0.00);
    pushSeg( 0.000, 2.00, -0.108, 2.130, 0.10, 24, 0.95, 0.50, 1, 0.50);
    pushSeg( 0.000, 2.00, -0.152, 2.200, 0.00, 17, 0.95, 0.44, 1, 1.00);
    pushSeg( 0.000, 2.00, -0.188, 2.255,-0.10, 12, 0.95, 0.38, 1, 1.50);
    pushSeg( 0.000, 2.03, -0.088, 2.145, 0.20, 20, 0.95, 0.46, 1, 2.00);

    /* ── Crown  (About, vy 0 → 1) ───────────────────────────
       Major limbs from trunk top; slight left-and-upper asymmetry.
       Angles in radians from vertical (0 = up, +ve = lean left).
       Ref thickness in px at W=1 280.
    ──────────────────────────────────────────────────────── */
    const LIMBS = [
      //   vx,     vy,   angle, len,  th
      [-0.008, 1.00,  0.44, 0.27,  42],   // primary   ~25°
      [-0.008, 1.00,  0.72, 0.23,  36],   // secondary ~41°
      [-0.008, 1.00,  0.98, 0.19,  30],   // tertiary  ~56°
      [-0.008, 1.00,  0.24, 0.26,  38],   // near-vert ~14°
      [-0.008, 1.00,  1.24, 0.15,  24],   // wide-left ~71°
      [-0.008, 1.00,  0.00, 0.24,  34],   // straight up
      [-0.008, 1.00,  0.54, 0.21,  30],   // fill gap
      [-0.008, 1.00,  1.50, 0.11,  18],   // near-horizontal
      // From partway up trunk (adds lower crown fill)
      [-0.020, 1.14,  0.62, 0.18,  28],
      [-0.026, 1.28,  0.84, 0.16,  22],
      [-0.012, 1.09,  0.36, 0.20,  26],
      [-0.030, 1.42,  0.68, 0.14,  20],
    ];

    for (const [lx, ly, lA, lL, lT] of LIMBS) {
      const z = (rng() - 0.5) * 0.70;
      const p = rng() * Math.PI * 2;
      crownBranch(lx, ly, lA, lL, lT, 0, z, p);
    }

    /* ── Roots  (Faculty, vy 2.0 → 3.0) ────────────────────
       Gnarly buttress roots. angle: 0 = going left; π/2 = going down.
    ──────────────────────────────────────────────────────── */
    const ROOTS = [
      //   vx,     vy,   angle,  len,  th
      [ 0.000, 2.00,  0.22, 0.21, 50],   // near-horizontal
      [ 0.000, 2.00,  0.60, 0.19, 42],   // mid angle
      [ 0.000, 2.00,  0.97, 0.17, 36],   // steeper
      [ 0.000, 2.00,  1.32, 0.14, 28],   // near-vertical
      [ 0.000, 2.00,  0.07, 0.19, 46],   // almost horizontal
      [ 0.000, 2.03,  0.44, 0.17, 34],   // from slightly lower
      [ 0.000, 2.00,  1.12, 0.13, 24],   // steep
      [-0.010, 2.02,  0.72, 0.15, 30],   // second offset root
    ];

    for (const [rx, ry, rA, rL, rT] of ROOTS) {
      const z = (rng() - 0.5) * 0.50;
      const p = rng() * Math.PI * 2;
      rootBranch(rx, ry, rA, rL, rT, 0, z, p);
    }
  }

  /* ═══════════════════════════════════════════════════════
     8.  WIND
         Per-spec formula: Δangle = sin(t·0.3+phase+depth·0.6)·0.03·flex
           + sin(t·0.11)·0.012·flex   where flex=(depth/maxD)^1.5
         Converted to pixel X-displacement via lever-arm approximation.
         Trunk segments (depth=0) never move.
  ═══════════════════════════════════════════════════════ */
  let windT = 0;

  function windX(depth, phase) {
    if (depth === 0) return 0;
    const flex = Math.pow(depth / CMAX, 1.5);
    const sway = Math.sin(windT * 0.30 + phase + depth * 0.60) * 0.03 * flex
               + Math.sin(windT * 0.11) * 0.012 * flex;
    /* Lever arm: deeper = further from trunk = more displacement */
    return sway * W * 0.09 * Math.sqrt(depth);
  }

  /* ═══════════════════════════════════════════════════════
     9.  PROJECTION
         Trunk centre always at screen x = W (right edge).
         Perspective: scale = 1/(1 − z·0.30). Far branches are smaller.
         Camera rotation (p−0.5)·0.25 rad creates parallax with scroll.
  ═══════════════════════════════════════════════════════ */
  function project(x, y, z, d, p, scrollY) {
    const absY  = vyToAbs(y);
    const sy    = absY - scrollY;

    /* Scroll-driven camera rotation for parallax */
    const totalH = Math.max(1, cBot - aTop);
    const pct    = Math.min(1, Math.max(0, (scrollY - aTop) / totalH));
    const cam    = (pct - 0.5) * 0.25;          // −0.125 … +0.125 rad

    /* Perspective — near (z>0) bigger, far (z<0) smaller */
    const persp = 1 / (1 - z * 0.30);

    /* vx in pixels (negative = left of right edge) */
    const vxPx  = x * W;

    /* Camera rotation creates left/right parallax shift */
    const rotX  = vxPx * Math.cos(cam) + z * W * 0.04 * Math.sin(cam);

    /* Wind lateral offset */
    const wx    = windX(d, p);

    return { x: W + (rotX + wx) * persp, y: sy };
  }

  /* ═══════════════════════════════════════════════════════
     10. OPACITY  (fade in as About enters, out at Faculty exit)
  ═══════════════════════════════════════════════════════ */
  function getOpacity(sy) {
    const enterStart = aTop - H;
    const enterEnd   = aTop - H * 0.75;
    const exitStart  = cTop + (cBot - cTop) * 0.70;
    const exitEnd    = cBot;
    if (sy < enterStart) return 0;
    if (sy < enterEnd)   return (sy - enterStart) / (enterEnd - enterStart);
    if (sy < exitStart)  return 1;
    if (sy < exitEnd)    return 1 - (sy - exitStart) / (exitEnd - exitStart);
    return 0;
  }

  /* ═══════════════════════════════════════════════════════
     11. RENDER
         Order: clearRect → glow sprite → stars → rim pass → body pass.
         No shadowBlur, no filters.
  ═══════════════════════════════════════════════════════ */
  function render(scrollY) {
    ctx.clearRect(0, 0, W, H);

    /* Glow sprite (radial gradient, pre-rendered offscreen) */
    if (glowSprite) {
      const r = glowSprite.width;
      ctx.drawImage(glowSprite, W - r, 0, r, H);
    }

    /* Stars — twinkling with slow sin modulation */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < NS; i++) {
      const sx = W - starFX[i] * W;
      const sy = starFY[i] * H;
      const twinkle = REDUCED ? 1 : (0.70 + 0.30 * Math.sin(windT * 0.9 + starPh[i] * 2.5));
      const a = starBase[i] * twinkle;
      ctx.fillStyle = `rgba(211,217,212,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Thickness scale factor (reference: W = 1 280 px) */
    const tScale = W / 1280;

    ctx.lineCap = 'round';

    /* ── Rim light pass ──────────────────────────────────
       Every segment drawn again, 1 px up-left, in teal.
       Alpha: 0.55 on major limbs/trunk, 0.25 on mid, 0.12 on twigs.
    ─────────────────────────────────────────────────────── */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < nSeg; i++) {
      const p1 = project(svx1[i], svy1[i], svz[i], sdp[i], sph[i], scrollY);
      const p2 = project(svx2[i], svy2[i], svz[i], sdp[i], sph[i], scrollY);

      if (p1.y < -60 && p2.y < -60) continue;
      if (p1.y > H+60 && p2.y > H+60) continue;

      const persp = 1 / (1 - svz[i] * 0.30);
      const lw    = Math.max(0.4, sth[i] * tScale * persp * 0.55);

      ctx.strokeStyle = `rgba(95,184,204,${sra[i].toFixed(3)})`;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      ctx.moveTo(p1.x - 1, p1.y - 1);
      ctx.lineTo(p2.x - 1, p2.y - 1);
      ctx.stroke();
    }

    /* ── Body pass ───────────────────────────────────────
       Dark silhouette #0B1117.  Far branches (z<0): 30% fainter.
    ─────────────────────────────────────────────────────── */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < nSeg; i++) {
      const p1 = project(svx1[i], svy1[i], svz[i], sdp[i], sph[i], scrollY);
      const p2 = project(svx2[i], svy2[i], svz[i], sdp[i], sph[i], scrollY);

      if (p1.y < -60 && p2.y < -60) continue;
      if (p1.y > H+60 && p2.y > H+60) continue;

      const persp  = 1 / (1 - svz[i] * 0.30);
      const lw     = Math.max(0.4, sth[i] * tScale * persp);
      const dFade  = svz[i] < 0 ? (0.70 + svz[i] * 0.30) : 1.0;
      const a      = sba[i] * dFade;

      ctx.strokeStyle = `rgba(11,17,23,${a.toFixed(3)})`;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  /* ═══════════════════════════════════════════════════════
     12. RAF LOOP  (capped at 30 fps; pauses when hidden)
  ═══════════════════════════════════════════════════════ */
  let lastFrame = 0, rafId = 0, running = false;

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < 33) return;
    lastFrame = now;
    if (document.hidden) return;

    windT    = now * 0.001;
    const sy = window.scrollY;
    const op = getOpacity(sy);
    canvas.style.opacity = op.toFixed(3);
    if (op < 0.01) return;
    render(sy);
  }

  function startLoop() { if (running) return; running = true; rafId = requestAnimationFrame(loop); }
  function stopLoop()  { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopLoop() : startLoop();
  });

  /* ═══════════════════════════════════════════════════════
     13. RESIZE  (width-only, debounced 300 ms)
  ═══════════════════════════════════════════════════════ */
  let _lW = 0, _rT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(_rT);
    _rT = setTimeout(() => {
      if (Math.abs(window.innerWidth - _lW) < 40) return;
      _lW = window.innerWidth;
      resizeCanvas();
      cacheBounds();
      buildGlowSprite();
      /* Geometry is in virtual coords so no rebuild needed on resize */
    }, 300);
  });

  /* ═══════════════════════════════════════════════════════
     14. INIT
  ═══════════════════════════════════════════════════════ */
  function init() {
    resizeCanvas();
    cacheBounds();
    buildGlowSprite();
    buildTree();
    _lW = W;

    if (REDUCED) {
      windT = 0;
      const sy = window.scrollY;
      canvas.style.opacity = getOpacity(sy).toFixed(3);
      render(sy);
      return;
    }
    startLoop();
  }

  if (document.readyState === 'complete') { init(); }
  else { window.addEventListener('load', init); }

})();
