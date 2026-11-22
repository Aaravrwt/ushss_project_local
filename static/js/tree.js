/**
 * tree.js — scroll-driven procedural 3D tree in the right margin
 * Spans: Section A (About/crown) → Section B (Programmes/trunk) → Section C (Faculty/roots)
 * Vanilla Canvas 2D, no libraries. DPR capped at 1.5. Max 30fps.
 */
(function () {
  'use strict';

  /* ─── 0. Reduced-motion check ─────────────────────────────────── */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── 1. Canvas setup ──────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '0',
    pointerEvents: 'none',
    opacity: '0',
    willChange: 'opacity',
  });
  document.body.prepend(canvas);

  /* hide on mobile */
  const mq = window.matchMedia('(max-width: 768px)');
  if (mq.matches) { canvas.style.display = 'none'; return; }

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

  /* ─── 2. Sections ──────────────────────────────────────────────── */
  const sA = document.getElementById('about');
  const sB = document.getElementById('programmes');
  const sC = document.getElementById('faculty');

  /* cached absolute bounds, refreshed on width-resize */
  let aTop = 0, cBottom = 0, bTop = 0, bBottom = 0, cTop = 0;
  function cacheSectionBounds() {
    const sy = window.scrollY;
    aTop    = sA.getBoundingClientRect().top    + sy;
    bTop    = sB.getBoundingClientRect().top    + sy;
    bBottom = sB.getBoundingClientRect().bottom + sy;
    cTop    = sC.getBoundingClientRect().top    + sy;
    cBottom = sC.getBoundingClientRect().bottom + sy;
  }

  /* ─── 3. Seeded RNG (mulberry32) ───────────────────────────────── */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(0xDEADBEEF);

  /* ─── 4. Segment storage (Float32Arrays, max 3500) ─────────────── */
  const MAX_SEG = 3500;
  const sx1    = new Float32Array(MAX_SEG);
  const sy1    = new Float32Array(MAX_SEG);
  const sx2    = new Float32Array(MAX_SEG);
  const sy2    = new Float32Array(MAX_SEG);
  const szArr  = new Float32Array(MAX_SEG); // z  -1..1
  const sThick = new Float32Array(MAX_SEG); // thickness (px)
  const sAlpha = new Float32Array(MAX_SEG); // base alpha
  const sDepth = new Float32Array(MAX_SEG); // branch level (0=trunk)
  const sPhase = new Float32Array(MAX_SEG); // wind phase
  const sType  = new Uint8Array(MAX_SEG);   // 0=trunk, 1=crown, 2=root
  let   segCount = 0;

  /* ─── 5. Tree geometry generation ─────────────────────────────── */
  /*
   * Virtual coordinate system:
   *   - Tree total height = 3 "vh units" (3×H in real pixels at render time)
   *   - y=0   → crown tips (top of Section A)
   *   - y=1.0 → trunk/root junction (Section A/B boundary)
   *   - y=2.0 → midway through roots (middle of Section B/C)
   *   - y=3.0 → deepest roots (bottom of Section C)
   *   - x=0   → trunk centre-line; ±1 = ±(0.09*W) wide at max spread
   *   - z=-1..1 depth
   */

  function addSeg(x1, y1, x2, y2, z, thick, alpha, depth, phase, type) {
    if (segCount >= MAX_SEG) return;
    const i = segCount++;
    sx1[i]=x1; sy1[i]=y1; sx2[i]=x2; sy2[i]=y2;
    szArr[i]=z; sThick[i]=thick; sAlpha[i]=alpha;
    sDepth[i]=depth; sPhase[i]=phase; sType[i]=type;
  }

  /* Crown/trunk brancher (y decreases = upward) */
  function branch(x, y, angle, len, thick, depth, maxDepth, z, phase, type) {
    if (depth > maxDepth || len < 0.006 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y - Math.cos(angle) * len;
    const alpha = type === 1 ? (0.50 + rng() * 0.35) : (0.60 + rng() * 0.30);
    addSeg(x, y, x2, y2, z, thick, alpha, depth, phase, type);

    const splits = depth < 2 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = (0.32 + rng() * 0.32) * (depth < 1 ? 0.6 : 1);
      const side   = s === 0 ? -spread : (s === 1 ? spread : (rng() - 0.5) * spread * 0.6);
      const dz     = (rng() - 0.5) * 0.25;
      branch(x2, y2, angle + side, len * (0.58 + rng() * 0.16),
             thick * (0.54 + rng() * 0.10), depth + 1, maxDepth,
             Math.max(-1, Math.min(1, z + dz)), phase + rng() * Math.PI * 2, type);
    }
  }

  /* Root brancher (y INCREASES = downward).
   * Roots must reach y ≈ 2.8–3.0 so they are visible during Faculty scroll.
   * Starting length is large (0.5-0.7) so even after 6 levels of 0.60x reduction
   * they still reach: 0.6 * 0.6^5 ≈ 0.047 → total cumulative depth ≈ 0.6*(1-0.6^6)/(1-0.6) ≈ 1.5
   * So starting from y=1.0 we reach y ≈ 2.5. Good.
   */
  function root(x, y, angle, len, thick, depth, maxDepth, z, phase) {
    if (depth > maxDepth || len < 0.005 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y + Math.cos(angle) * len; // roots go DOWN
    // Brighter towards tips (deeper depth) for glowing root mass look
    const alpha = 0.45 + rng() * 0.40 + (depth / maxDepth) * 0.10;
    addSeg(x, y, x2, y2, z, thick, Math.min(alpha, 0.90), depth, phase, 2);

    const splits = depth < 3 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = 0.28 + rng() * 0.38;
      const side   = s === 0 ? -spread : (s === 1 ? spread : (rng() - 0.5) * spread);
      const dz     = (rng() - 0.5) * 0.30;
      root(x2, y2, angle + side, len * (0.60 + rng() * 0.14),
           thick * (0.56 + rng() * 0.10), depth + 1, maxDepth,
           Math.max(-1, Math.min(1, z + dz)), phase + rng() * Math.PI * 2);
    }
  }

  function buildTree() {
    segCount = 0;

    // ── TRUNK (type 0, y=0.65..1.0 virtual) ──
    // Three segments with gentle s-curve
    addSeg( 0.00, 1.00,  0.02, 0.85, 0.00, 12, 0.78, 0, 0.1, 0);
    addSeg( 0.02, 0.85,  0.00, 0.70, 0.04,  9, 0.72, 0, 0.2, 0);
    addSeg( 0.00, 0.70,  0.01, 0.55, 0.00,  8, 0.68, 0, 0.3, 0);

    // ── TRUNK SIDE BRANCHES (type 0) ──
    for (let i = 0; i < 4; i++) {
      const fy   = 0.60 + i * 0.10;
      const side = i % 2 === 0 ? -1 : 1;
      const ang  = side * (0.55 + rng() * 0.30);
      branch(0.01 + side * 0.02, fy, ang, 0.14 + rng() * 0.06,
             4.5, 0, 3, (rng() - 0.5) * 0.4, rng() * Math.PI * 2, 0);
    }

    // ── CROWN (type 1, y=0..0.65 virtual) ──
    branch( 0.01, 0.65, -0.08, 0.30, 8.5, 0, 6,  0.10, 0.0, 1);
    branch( 0.01, 0.65, -0.45, 0.24, 7.0, 0, 5, -0.20, 1.1, 1);
    branch( 0.01, 0.65,  0.38, 0.24, 7.0, 0, 5,  0.30, 2.3, 1);
    branch( 0.01, 0.65,  0.12, 0.28, 7.5, 0, 6,  0.00, 0.7, 1);
    branch( 0.01, 0.65, -0.22, 0.22, 6.5, 0, 5, -0.10, 3.5, 1);
    branch( 0.01, 0.55,  0.20, 0.18, 5.0, 0, 4,  0.15, 4.2, 1);

    // ── ROOTS (type 2, y=1.0..3.0 virtual) ──
    // Large initial length so they reach deep into Faculty scroll zone.
    // 6 primary roots spreading in different directions.
    root( 0.00, 1.00,  0.50, 0.65, 8.0, 0, 6,  0.10, 0.0);
    root( 0.00, 1.00, -0.50, 0.65, 8.0, 0, 6, -0.10, 1.5);
    root( 0.02, 1.00,  0.15, 0.70, 9.0, 0, 7,  0.20, 0.8);
    root(-0.02, 1.00, -0.15, 0.70, 9.0, 0, 7, -0.20, 2.2);
    root( 0.00, 1.00,  0.80, 0.55, 6.5, 0, 5,  0.30, 3.1);
    root( 0.00, 1.00, -0.80, 0.55, 6.5, 0, 5, -0.30, 4.6);

    // ── TAP ROOT: glowing vertical spine running straight down (y=1.0..2.8) ──
    // This guarantees something is always visible in the Faculty zone.
    for (let k = 0; k < 9; k++) {
      const y1 = 1.00 + k * 0.20;
      const y2 = y1 + 0.22;
      const jit = (k % 2 === 0 ? 0.008 : -0.008);
      const th  = Math.max(1.5, 7.5 - k * 0.7);
      addSeg(jit, y1, -jit, y2, 0.0, th, 0.72 - k * 0.04, 0, k * 0.4, 2);
    }
  }

  /* ─── 6. Projection helpers ─────────────────────────────────────── */
  let windT = 0;

  function windDeltaX(depth, phase, t) {
    const flex = Math.pow(depth / 7, 1.4);
    return (Math.sin(t * 0.35 + phase + depth * 0.7) * 0.035
          + Math.sin(t * 0.13) * 0.015) * flex * 28; // px
  }

  /* project virtual→screen for a point */
  function projectPt(vx, vy, z, depth, phase, scrollY) {
    const totalVirtualH = cBottom - aTop;
    const screenY = aTop + vy * (totalVirtualH / 3) - scrollY;
    const trunkX  = 0.90 * W;
    const xSpread = 0.09 * W;
    const perspective = 1 / (1 - z * 0.35);
    const wx = windDeltaX(depth, phase, windT);
    const screenX = trunkX + (vx * xSpread + wx) * perspective;
    return { x: screenX, y: screenY };
  }

  /* ─── 7. Canvas opacity from scroll position ───────────────────── */
  function getCanvasOpacity(sy) {
    const enterStart = aTop - H;        // section A bottom enters viewport
    const enterEnd   = aTop - H * 0.75; // 25% of Section A in view → fully visible
    const exitStart  = cBottom - H;
    const exitEnd    = cBottom;

    if (sy < enterStart) return 0;
    if (sy < enterEnd)   return (sy - enterStart) / (enterEnd - enterStart);
    if (sy < exitStart)  return 1;
    if (sy < exitEnd)    return 1 - (sy - exitStart) / (exitEnd - exitStart);
    return 0;
  }

  /* ─── 8. Color per segment type ────────────────────────────────── */
  function segColor(type, depth, maxDepth, alpha) {
    if (type === 2) {
      // roots: deep teal → bright teal (brighter at tips)
      const t = Math.min(depth / maxDepth, 1);
      const r = Math.round(18  + t * 77);    // 18→95
      const g = Math.round(78  + t * 105);   // 78→183
      const b = Math.round(102 + t * 101);   // 102→203
      return `rgba(${r},${g},${b},${alpha})`;
    } else if (type === 0) {
      // trunk: dark ink-900 → grey-teal
      const t = Math.min(depth / 4, 1);
      const r = Math.round(18  + t * 98);
      const g = Math.round(78  + t * 58);
      const b = Math.round(102 + t * 44);
      return `rgba(${r},${g},${b},${alpha})`;
    } else {
      // crown: soft grey-green tips (#5FB8CC → #D3D9D4)
      const t = Math.min(depth / 6, 1);
      const r = Math.round(95  + t * 116);   // 95→211
      const g = Math.round(184 + t * 33);    // 184→217
      const b = Math.round(204 + t * 8);     // 204→212
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }

  /* ─── 9. Render one frame ──────────────────────────────────────── */
  function render(sy) {
    ctx.clearRect(0, 0, W, H);

    const maxDepth = 7;

    // ── Pass 1: glow (lighter blend, wide stroke, low alpha) ──
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segCount; i++) {
      const type = sType[i];
      // Glow on crown and roots; skip trunk glow (it's dark, glow washes out)
      if (type !== 2 && type !== 1) continue;

      const p1 = projectPt(sx1[i], sy1[i], szArr[i], sDepth[i], sPhase[i], sy);
      const p2 = projectPt(sx2[i], sy2[i], szArr[i], sDepth[i], sPhase[i], sy);
      if (p1.y < -80 && p2.y < -80) continue;
      if (p1.y > H + 80 && p2.y > H + 80) continue;

      const midX = (p1.x + p2.x) * 0.5;
      // fade to 0 at x=0.72w, full at x=0.80w
      const edgeFade = midX < 0.72 * W ? 0 :
                       midX < 0.80 * W ? (midX - 0.72 * W) / (0.08 * W) * 0.25 : 1;
      if (edgeFade <= 0) continue;

      // Roots glow extra bright
      const glowMul = type === 2 ? 0.10 : 0.06;
      const glowAlpha = sAlpha[i] * glowMul * edgeFade;
      ctx.strokeStyle = segColor(type, sDepth[i], maxDepth, glowAlpha);
      ctx.lineWidth   = sThick[i] * 3.5;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // ── Pass 2: solid lines ──
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < segCount; i++) {
      const type = sType[i];
      const p1 = projectPt(sx1[i], sy1[i], szArr[i], sDepth[i], sPhase[i], sy);
      const p2 = projectPt(sx2[i], sy2[i], szArr[i], sDepth[i], sPhase[i], sy);
      if (p1.y < -80 && p2.y < -80) continue;
      if (p1.y > H + 80 && p2.y > H + 80) continue;

      const midX = (p1.x + p2.x) * 0.5;
      let edgeFade = midX < 0.72 * W ? 0 :
                     midX < 0.80 * W ? (midX - 0.72 * W) / (0.08 * W) : 1;
      edgeFade *= (midX < 0.80 * W ? 0.5 : 0.85); // cap at 0.85 max
      if (edgeFade <= 0) continue;

      const alpha = sAlpha[i] * edgeFade;
      ctx.strokeStyle = segColor(type, sDepth[i], maxDepth, alpha);
      const persp = 1 / (1 - szArr[i] * 0.35);
      ctx.lineWidth = Math.max(0.5, sThick[i] * persp);
      ctx.lineCap   = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // ── Root specks: ~60 tiny slow-drifting dots in the root zone ──
    ctx.globalCompositeOperation = 'source-over';
    // Root zone = y_virtual [1.0 .. 3.0], mapped to screen
    const totalVH = cBottom - aTop;
    const rootZoneTop = aTop + 1.0 * (totalVH / 3) - sy;
    const rootZoneH   = (totalVH / 3) * 2.0;  // spans y=1.0..3.0 virtual
    for (let k = 0; k < 60; k++) {
      const speckX = 0.80 * W + (k / 60) * 0.18 * W + Math.sin(windT * 0.3  + k) * 2.5;
      const speckY = rootZoneTop + (k / 60) * rootZoneH + Math.sin(windT * 0.2 + k * 1.3) * 4;
      if (speckY < -5 || speckY > H + 5) continue;
      const edgeFade = speckX < 0.80 * W ? 0 : Math.min(1, (speckX - 0.80 * W) / (0.08 * W));
      ctx.fillStyle = `rgba(211,217,212,${0.38 * edgeFade})`;
      ctx.beginPath();
      ctx.arc(speckX, speckY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ─── 10. RAF loop ──────────────────────────────────────────────── */
  let lastFrame = 0;
  let rafId     = 0;
  let running   = false;

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < 33) return; // cap 30fps
    lastFrame = now;

    if (document.hidden) return;

    windT = now * 0.001;
    const sy = window.scrollY;
    const opacity = getCanvasOpacity(sy);
    canvas.style.opacity = opacity.toFixed(3);
    if (opacity < 0.01) return;

    render(sy);
  }

  function startLoop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ─── 11. Visibility / pause ───────────────────────────────────── */
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopLoop() : startLoop();
  });

  /* ─── 12. Resize (width-only, debounced 300ms) ─────────────────── */
  let lastBuiltWidth = 0;
  let resizeTimer    = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastBuiltWidth) < 40) return;
      lastBuiltWidth = window.innerWidth;
      resizeCanvas();
      cacheSectionBounds();
    }, 300);
  });

  /* ─── 13. Init ──────────────────────────────────────────────────── */
  function init() {
    resizeCanvas();
    cacheSectionBounds();
    buildTree();
    lastBuiltWidth = W;

    if (prefersReduced) {
      windT = 0;
      const sy = window.scrollY;
      canvas.style.opacity = getCanvasOpacity(sy).toFixed(3);
      render(sy);
      return;
    }

    startLoop();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
