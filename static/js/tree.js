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
     6.  FLAT SEGMENT ARRAYS  (up to 9000 max)
  ═══════════════════════════════════════════════════════ */
  const MSEG = 9200;
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
  ═══════════════════════════════════════════════════════ */
  const ASPECT    = 1.12;
  const CMAX      = 9;     // crown max depth
  const RMAX      = 7;     // root  max depth
  const MAX_CROWN = 4400;  // cap on crown segments so roots always have budget
  const MAX_ROOT  = 3600;  // cap on root segments
  let   crownSegs = 0;
  let   rootSegs  = 0;

  /* ── Crown recursive branch ───────────────────────────── */
  function crownBranch(x, y, angle, len, thick, depth, z, p) {
    if (depth > CMAX || len < 0.0030 || crownSegs >= MAX_CROWN || nSeg >= MSEG - 1) return;

    const nx = x - Math.sin(angle) * len;
    const ny = y - Math.cos(angle) * len * ASPECT;

    /* Clamp: left boundary vx = −0.56, top boundary vy = 0 */
    const cx = Math.max(-0.56, Math.min(0.0, nx));
    const cy = Math.max(0.0, ny);

    /* Fade branches that reach into the text column (vx < −0.45) */
    const leftmost = Math.abs(Math.min(cx, x));
    const bodyA = leftmost > 0.45
      ? 0.95 * (0.30 + 0.70 * Math.max(0, 1 - (leftmost - 0.45) / 0.11))
      : 0.95;

    const rimA = thick > 8 ? 0.55 : (thick > 3 ? 0.25 : 0.12);

    pushSeg(x, y, cx, cy, z, thick, bodyA, rimA, depth, p);
    crownSegs++;

    if (cy <= 0.01 || cx <= -0.55) return;

    const nK = depth < 3 ? 3 : (depth < 6 ? 2 : (rng() < 0.60 ? 2 : 1));
    const lMul = 0.74 + rng() * 0.11;
    const tMul = 0.62 + rng() * 0.08;

    for (let k = 0; k < nK; k++) {
      const sp = 0.24 + rng() * 0.28;
      let cA = nK === 3
        ? (k === 0 ? angle + sp * 1.3 : k === 1 ? angle + sp * 0.3 : angle - sp * 0.5)
        : (k === 0 ? angle + sp * 1.1 : angle - sp * 0.5);
      cA += (rng() - 0.5) * 0.20;
      if (depth >= 5) cA += rng() * 0.06;

      const cLen = len * lMul * (1 + (rng() - 0.5) * 0.15);
      const cZ   = Math.max(-1, Math.min(1, z + (rng() - 0.5) * 0.28));
      const cP   = p + rng() * Math.PI * 1.8;
      crownBranch(cx, cy, cA, cLen, Math.max(0.4, thick * tMul), depth + 1, cZ, cP);
    }
  }

  /* ── Root recursive branch ────────────────────────────── */
  function rootBranch(x, y, angle, len, thick, depth, z, p) {
    if (depth > RMAX || len < 0.0028 || rootSegs >= MAX_ROOT || nSeg >= MSEG - 1) return;

    const nx = x - Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len * ASPECT;

    const cx = Math.max(-0.56, Math.min(0.0, nx));
    const cy = Math.max(2.0, Math.min(3.08, ny));

    const leftmost = Math.abs(Math.min(cx, x));
    const bodyA = leftmost > 0.45
      ? 0.95 * (0.30 + 0.70 * Math.max(0, 1 - (leftmost - 0.45) / 0.11))
      : 0.95;
    const rimA = thick > 8 ? 0.55 : (thick > 3 ? 0.25 : 0.12);

    pushSeg(x, y, cx, cy, z, thick, bodyA, rimA, depth, p);
    rootSegs++;

    if (cy >= 3.06 && Math.sin(angle) > 0.3) return;

    const nK   = depth < 3 ? 3 : 2;
    const lMul = 0.73 + rng() * 0.10;
    const tMul = 0.64 + rng() * 0.08;

    for (let k = 0; k < nK; k++) {
      const sp = 0.24 + rng() * 0.32;
      const cA = Math.max(0.05, Math.min(1.52,
        k === 0 ? angle + sp * 0.8
        : k === 1 ? angle - sp * 0.5
        : angle + (rng() - 0.5) * sp * 0.7));
      const cZ  = Math.max(-1, Math.min(1, z + (rng() - 0.5) * 0.28));
      const cP  = p + rng() * Math.PI * 1.5;
      rootBranch(cx, cy, cA, len * lMul, Math.max(0.4, thick * tMul), depth + 1, cZ, cP);
    }
  }

  /* ── Assemble the full tree ───────────────────────────── */
  function buildTree() {
    rngReset();
    nSeg      = 0;
    crownSegs = 0;
    rootSegs  = 0;

    /* Stars — 120 twinkling points in glow zone */
    for (let i = 0; i < NS; i++) {
      starFX[i]   = rng() * 0.58;
      starFY[i]   = rng();
      starBase[i] = 0.20 + rng() * 0.40;
      starPh[i]   = rng() * Math.PI * 2;
    }

    /* ── Trunk (Programmes, vy 1.0 → 2.0) ──────────────────
       Wide at base (~0.06w = ~77px at 1280), strong taper to 46px,
       subtle S-curve hugging right edge.
    ──────────────────────────────────────────────────────── */
    pushSeg( 0.000, 2.00, -0.022, 1.75, 0.00, 77, 0.95, 0.55, 0, 0.00);
    pushSeg(-0.022, 1.75, -0.038, 1.50, 0.01, 68, 0.95, 0.55, 0, 0.10);
    pushSeg(-0.038, 1.50, -0.028, 1.25, 0.00, 58, 0.95, 0.52, 0, 0.20);
    pushSeg(-0.028, 1.25, -0.012, 1.00, 0.01, 48, 0.95, 0.50, 0, 0.30);

    /* Trunk side branches in Programmes section */
    const trunkBranches = [
      [-0.020, 1.20, 0.65, 0.18, 24],
      [-0.030, 1.35, 0.85, 0.17, 22],
      [-0.038, 1.50, 0.70, 0.16, 20],
      [-0.032, 1.65, 0.90, 0.15, 18],
      [-0.024, 1.80, 0.75, 0.14, 16],
    ];
    for (const [bx, by, bA, bL, bT] of trunkBranches) {
      crownBranch(bx, by, bA, bL, bT, 1, 0, rng() * Math.PI * 2);
    }

    /* Flared buttress at trunk base */
    pushSeg( 0.000, 2.00, -0.070, 2.06, 0.00, 34, 0.95, 0.52, 1, 0.00);
    pushSeg( 0.000, 2.00, -0.120, 2.12, 0.10, 26, 0.95, 0.50, 1, 0.50);
    pushSeg( 0.000, 2.00, -0.165, 2.18, 0.00, 18, 0.95, 0.44, 1, 1.00);
    pushSeg( 0.000, 2.03, -0.095, 2.13, 0.20, 22, 0.95, 0.46, 1, 2.00);

    /* ── Crown (About, vy 0 → 1) ───────────────────────────
       Major limbs from top of trunk, spreading leftward.
    ──────────────────────────────────────────────────────── */
    const LIMBS = [
      [-0.008, 1.00,  0.44, 0.27,  42],
      [-0.008, 1.00,  0.72, 0.23,  36],
      [-0.008, 1.00,  0.98, 0.19,  30],
      [-0.008, 1.00,  0.24, 0.26,  38],
      [-0.008, 1.00,  1.24, 0.15,  24],
      [-0.008, 1.00,  0.00, 0.24,  34],
      [-0.008, 1.00,  0.54, 0.21,  30],
      [-0.008, 1.00,  1.50, 0.11,  18],
      [-0.014, 1.08,  0.58, 0.20,  28],
      [-0.020, 1.15,  0.80, 0.18,  24],
    ];

    for (const [lx, ly, lA, lL, lT] of LIMBS) {
      const z = (rng() - 0.5) * 0.70;
      const p = rng() * Math.PI * 2;
      crownBranch(lx, ly, lA, lL, lT, 0, z, p);
    }

    /* ── Roots (Faculty, vy 2.0 → 3.0) ────────────────────
       Thick gnarly buttress roots spreading left and down
       across the entire height of the Faculty section.
    ──────────────────────────────────────────────────────── */
    const ROOT_ORIGINS = [
      // Base buttress cluster emerging at vy = 2.00
      [0.00, 2.00, 0.20, 0.24, 46],
      [0.00, 2.00, 0.45, 0.26, 50],
      [0.00, 2.00, 0.70, 0.28, 52],
      [0.00, 2.00, 0.95, 0.28, 48],
      [0.00, 2.00, 1.25, 0.26, 44],
      [0.00, 2.00, 1.45, 0.24, 40],

      // Roots cascading down along the right edge through Faculty
      [0.00, 2.15, 0.30, 0.22, 38],
      [0.00, 2.15, 0.75, 0.25, 40],
      [0.00, 2.15, 1.15, 0.24, 38],

      [0.00, 2.30, 0.35, 0.20, 34],
      [0.00, 2.30, 0.80, 0.22, 35],
      [0.00, 2.30, 1.20, 0.21, 32],

      [0.00, 2.45, 0.40, 0.18, 30],
      [0.00, 2.45, 0.85, 0.20, 30],
      [0.00, 2.45, 1.25, 0.19, 28],

      [0.00, 2.60, 0.45, 0.16, 26],
      [0.00, 2.60, 0.90, 0.18, 26],

      [0.00, 2.75, 0.50, 0.15, 22],
      [0.00, 2.75, 0.95, 0.16, 22],

      [0.00, 2.90, 0.55, 0.14, 18],
      [0.00, 2.90, 1.00, 0.14, 18],
    ];

    for (const [rx, ry, rA, rL, rT] of ROOT_ORIGINS) {
      const z = (rng() - 0.5) * 0.50;
      const p = rng() * Math.PI * 2;
      rootBranch(rx, ry, rA, rL, rT, 0, z, p);
    }
  }

  /* ═══════════════════════════════════════════════════════
     8.  WIND
         Per-branch sway formula per spec.
         Trunk (depth=0) never shifts.
  ═══════════════════════════════════════════════════════ */
  let windT = 0;

  function windX(depth, phase) {
    if (depth === 0) return 0;
    const flex = Math.pow(depth / CMAX, 1.5);
    const sway = Math.sin(windT * 0.30 + phase + depth * 0.60) * 0.03 * flex
               + Math.sin(windT * 0.11) * 0.012 * flex;
    return sway * W * 0.09 * Math.sqrt(depth);
  }

  /* ═══════════════════════════════════════════════════════
     9.  PROJECTION
         Trunk centre pinned at screen x = W (zero gap).
         Perspective scale = 1 / (1 - z * 0.30).
         Camera rotation parallax: (p - 0.5) * 0.25 rad.
  ═══════════════════════════════════════════════════════ */
  function project(x, y, z, d, p, scrollY) {
    const absY   = vyToAbs(y);
    const sy     = absY - scrollY;

    const totalH = Math.max(1, cBot - aTop);
    const pct    = Math.min(1, Math.max(0, (scrollY - aTop) / totalH));
    const cam    = (pct - 0.5) * 0.25;

    const persp  = 1 / (1 - z * 0.30);
    const vxPx   = x * W;
    const rotX   = vxPx * Math.cos(cam) + z * W * 0.04 * Math.sin(cam);
    const wx     = windX(d, p);

    return { x: W + (rotX + wx) * persp, y: sy };
  }

  /* ═══════════════════════════════════════════════════════
     10. OPACITY
         Fade in over first 25% of Section A entering.
         Fade out as Section C leaves the viewport.
  ═══════════════════════════════════════════════════════ */
  function getOpacity(sy) {
    const enterStart = aTop - H;
    const enterEnd   = aTop - H * 0.75;
    const exitStart  = cBot - H;
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
  ═══════════════════════════════════════════════════════ */
  function render(scrollY) {
    ctx.clearRect(0, 0, W, H);

    /* 1. Backdrop glow sprite */
    if (glowSprite) {
      const r = glowSprite.width;
      ctx.drawImage(glowSprite, W - r, 0, r, H);
    }

    /* 2. Twinkling stars */
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

    const tScale = W / 1280;
    ctx.lineCap = 'round';

    /* 3. Rim light pass (thin teal line offset 1px up-left) */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < nSeg; i++) {
      const p1 = project(svx1[i], svy1[i], svz[i], sdp[i], sph[i], scrollY);
      const p2 = project(svx2[i], svy2[i], svz[i], sdp[i], sph[i], scrollY);

      if (p1.y < -60 && p2.y < -60) continue;
      if (p1.y > H + 60 && p2.y > H + 60) continue;

      const persp = 1 / (1 - svz[i] * 0.30);
      const lw    = Math.max(0.4, sth[i] * tScale * persp * 0.55);

      ctx.strokeStyle = `rgba(95,184,204,${sra[i].toFixed(3)})`;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      ctx.moveTo(p1.x - 1, p1.y - 1);
      ctx.lineTo(p2.x - 1, p2.y - 1);
      ctx.stroke();
    }

    /* 4. Body pass (near-black blue #0B1117 silhouette) */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < nSeg; i++) {
      const p1 = project(svx1[i], svy1[i], svz[i], sdp[i], sph[i], scrollY);
      const p2 = project(svx2[i], svy2[i], svz[i], sdp[i], sph[i], scrollY);

      if (p1.y < -60 && p2.y < -60) continue;
      if (p1.y > H + 60 && p2.y > H + 60) continue;

      const persp = 1 / (1 - svz[i] * 0.30);
      const lw    = Math.max(0.4, sth[i] * tScale * persp);
      const dFade = svz[i] < 0 ? (0.70 + svz[i] * 0.30) : 1.0;
      const a     = sba[i] * dFade;

      ctx.strokeStyle = `rgba(11,17,23,${a.toFixed(3)})`;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  /* ═══════════════════════════════════════════════════════
     12. RAF LOOP (capped at 30 fps)
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
     13. RESIZE (width-only, debounced 300 ms)
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
