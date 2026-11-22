/**
 * tree.js — scroll-driven procedural 3D tree in the right margin
 *
 * Virtual coordinate system (3 equal sections):
 *   y = 0.0 → crown tips        (top of Section A / About)
 *   y = 1.0 → crown/trunk split  (top of Section B / Programmes)
 *   y = 2.0 → trunk/root split   (top of Section C / Faculty)
 *   y = 3.0 → deepest roots      (bottom of Section C / Faculty)
 *
 * Crown  → y ∈ [0, 1]   – branching upward, visible during About
 * Trunk  → y ∈ [1, 2]   – thick vertical, visible during Programmes
 * Roots  → y ∈ [2, 3]   – spreading downward, visible during Faculty
 *
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

  /* ─── 2. Sections ──────────────────────────────────────────────── */
  const sA = document.getElementById('about');
  const sB = document.getElementById('programmes');
  const sC = document.getElementById('faculty');

  let aTop = 0, cBottom = 0;
  function cacheSectionBounds() {
    const sy = window.scrollY;
    aTop    = sA.getBoundingClientRect().top    + sy;
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
  const sDepth = new Float32Array(MAX_SEG); // branch level
  const sPhase = new Float32Array(MAX_SEG); // wind phase
  const sType  = new Uint8Array(MAX_SEG);   // 0=trunk, 1=crown, 2=root
  let   segCount = 0;

  function addSeg(x1, y1, x2, y2, z, thick, alpha, depth, phase, type) {
    if (segCount >= MAX_SEG) return;
    const i = segCount++;
    sx1[i]=x1; sy1[i]=y1; sx2[i]=x2; sy2[i]=y2;
    szArr[i]=z; sThick[i]=thick; sAlpha[i]=alpha;
    sDepth[i]=depth; sPhase[i]=phase; sType[i]=type;
  }

  /* ─── 5. Tree geometry ─────────────────────────────────────────── */

  /* Crown/side-branch: y DECREASES (goes upward) */
  function branch(x, y, angle, len, thick, depth, maxDepth, z, phase, type) {
    if (depth > maxDepth || len < 0.005 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y - Math.cos(angle) * len;   // UP
    const alpha = type === 1 ? 0.48 + rng() * 0.38 : 0.58 + rng() * 0.28;
    addSeg(x, y, x2, y2, z, thick, alpha, depth, phase, type);

    const splits = depth < 2 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = (0.30 + rng() * 0.35) * (depth < 1 ? 0.65 : 1);
      const side   = s === 0 ? -spread : (s === 1 ? spread : (rng() - 0.5) * spread * 0.6);
      const dz     = (rng() - 0.5) * 0.25;
      branch(x2, y2, angle + side, len * (0.57 + rng() * 0.17),
             thick * (0.53 + rng() * 0.11), depth + 1, maxDepth,
             Math.max(-1, Math.min(1, z + dz)), phase + rng() * Math.PI * 2, type);
    }
  }

  /* Root: y INCREASES (goes downward).
   * Must reach y ≈ 2.8–3.0 from start y = 2.0.
   * With initial len ≈ 0.55 and lenMul ≈ 0.62, 7 levels:
   *   cumulative depth ≈ 0.55 × (1 − 0.62^7)/(1 − 0.62) ≈ 0.55 × 2.52 ≈ 1.38
   *   Tips reach y ≈ 2.0 + 1.38 = 3.38 → deepest are beyond y=3.0 (perfect).
   */
  function root(x, y, angle, len, thick, depth, maxDepth, z, phase) {
    if (depth > maxDepth || len < 0.005 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y + Math.cos(angle) * len;   // DOWN
    // Clamp so roots don't go below y=3.1
    if (y2 > 3.1) return;
    const alpha = 0.48 + rng() * 0.38 + (depth / maxDepth) * 0.08;
    addSeg(x, y, x2, y2, z, thick, Math.min(alpha, 0.90), depth, phase, 2);

    const splits = depth < 3 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = 0.25 + rng() * 0.40;
      const side   = s === 0 ? -spread : (s === 1 ? spread : (rng() - 0.5) * spread);
      const dz     = (rng() - 0.5) * 0.30;
      root(x2, y2, angle + side, len * (0.60 + rng() * 0.14),
           thick * (0.56 + rng() * 0.10), depth + 1, maxDepth,
           Math.max(-1, Math.min(1, z + dz)), phase + rng() * Math.PI * 2);
    }
  }

  function buildTree() {
    segCount = 0;

    /* ── TRUNK (y = 1.0 → 2.0, type=0) ─────────────────────────── */
    /* Runs the full Programmes section. 5 segments with gentle s-curve. */
    addSeg( 0.00, 1.00,  0.025, 1.20, 0.00, 13, 0.80, 0, 0.1, 0);
    addSeg( 0.025,1.20, -0.01,  1.40, 0.03, 11, 0.76, 0, 0.2, 0);
    addSeg(-0.01, 1.40,  0.02,  1.60, 0.00, 10, 0.72, 0, 0.3, 0);
    addSeg( 0.02, 1.60, -0.01,  1.80, 0.02,  9, 0.68, 0, 0.4, 0);
    addSeg(-0.01, 1.80,  0.00,  2.00, 0.00,  8, 0.64, 0, 0.5, 0);

    /* Trunk side branches (at different heights along Programmes) */
    const trunkYs  = [1.15, 1.35, 1.55, 1.75, 1.90];
    const trunkSides = [-1, 1, -1, 1, -1];
    for (let i = 0; i < 5; i++) {
      const fy   = trunkYs[i];
      const side = trunkSides[i];
      const ang  = side * (0.50 + rng() * 0.35);
      branch(0.01 + side * 0.02, fy, ang, 0.12 + rng() * 0.06,
             4.0, 0, 3, (rng() - 0.5) * 0.4, rng() * Math.PI * 2, 0);
    }

    /* ── CROWN (branches upward from y=1.0, tops at y≈0.0, type=1) ─ */
    branch( 0.01, 1.00, -0.08, 0.30, 8.5, 0, 6,  0.10, 0.0, 1);
    branch( 0.01, 1.00, -0.45, 0.25, 7.0, 0, 5, -0.20, 1.1, 1);
    branch( 0.01, 1.00,  0.38, 0.25, 7.0, 0, 5,  0.30, 2.3, 1);
    branch( 0.01, 1.00,  0.12, 0.28, 7.5, 0, 6,  0.00, 0.7, 1);
    branch( 0.01, 1.00, -0.22, 0.22, 6.5, 0, 5, -0.10, 3.5, 1);
    branch( 0.01, 1.00,  0.65, 0.18, 5.5, 0, 4,  0.20, 4.2, 1);

    /* ── ROOTS (y = 2.0 → 3.0, type=2) ─────────────────────────── */
    /* 7 primary root arms, all starting at the trunk/root junction y=2.0. */
    root( 0.00, 2.00,  0.50, 0.55, 8.5, 0, 6,  0.10, 0.0);
    root( 0.00, 2.00, -0.50, 0.55, 8.5, 0, 6, -0.10, 1.5);
    root( 0.02, 2.00,  0.18, 0.60, 9.5, 0, 7,  0.20, 0.8);
    root(-0.02, 2.00, -0.18, 0.60, 9.5, 0, 7, -0.20, 2.2);
    root( 0.00, 2.00,  0.80, 0.48, 6.5, 0, 5,  0.30, 3.1);
    root( 0.00, 2.00, -0.80, 0.48, 6.5, 0, 5, -0.30, 4.6);
    root( 0.01, 2.00,  0.00, 0.58, 7.0, 0, 6,  0.00, 5.8); // straight tap root

    /* ── TAP ROOT SPINE: glowing vertical axis y=2.0..3.0 ─────────
     * Guarantees a prominent glowing column in Faculty regardless of branching.
     * x drifts gently ±0.05 for organic look.
     */
    const tapSegs = 12;
    for (let k = 0; k < tapSegs; k++) {
      const y1  = 2.00 + k * (1.0 / tapSegs);
      const y2  = y1  + (1.0 / tapSegs) + 0.01;
      const jit = (k % 2 === 0 ? 0.03 : -0.02);
      const th  = Math.max(2.0, 8.0 - k * 0.5);
      const al  = 0.70 - k * 0.025;
      addSeg(jit, y1, -jit, y2, 0.0, th, al, 0, k * 0.5, 2);
    }
  }

  /* ─── 6. Wind & projection ─────────────────────────────────────── */
  let windT = 0;

  function windDelta(depth, phase, t) {
    const flex = Math.pow(depth / 7, 1.4);
    return (Math.sin(t * 0.35 + phase + depth * 0.7) * 0.035
          + Math.sin(t * 0.13) * 0.015) * flex * 28;
  }

  /* Project virtual (vx, vy) → screen (px).
   * vx=0 → trunkX=0.90*W; ±1 vx = ±xSpread (0.09*W)
   * vy maps linearly: aTop + vy*(totalVH/3) − scrollY
   */
  function projectPt(vx, vy, z, depth, phase, scrollY) {
    const totalVH  = cBottom - aTop;
    const screenY  = aTop + vy * (totalVH / 3) - scrollY;
    const trunkX   = 0.90 * W;
    const xSpread  = 0.09 * W;
    const persp    = 1 / (1 - z * 0.35);
    const wx       = windDelta(depth, phase, windT);
    const screenX  = trunkX + (vx * xSpread + wx) * persp;
    return { x: screenX, y: screenY };
  }

  /* ─── 7. Canvas opacity ─────────────────────────────────────────── */
  function getCanvasOpacity(sy) {
    // Fade in over first 25% of Section A entering viewport
    const enterStart = aTop - H;
    const enterEnd   = aTop - H * 0.75;
    // Fade out as Section C leaves
    const exitStart  = cBottom - H;
    const exitEnd    = cBottom;

    if (sy < enterStart) return 0;
    if (sy < enterEnd)   return (sy - enterStart) / (enterEnd - enterStart);
    if (sy < exitStart)  return 1;
    if (sy < exitEnd)    return 1 - (sy - exitStart) / (exitEnd - exitStart);
    return 0;
  }

  /* ─── 8. Colors ─────────────────────────────────────────────────── */
  function segColor(type, depth, maxDepth, alpha) {
    const t = Math.min(depth / maxDepth, 1);
    let r, g, b;
    if (type === 2) {
      // Roots: dark teal → bright teal (#124E66 → #5FB8CC)
      r = Math.round(18  + t * 77);
      g = Math.round(78  + t * 106);
      b = Math.round(102 + t * 102);
    } else if (type === 0) {
      // Trunk: #124E66 → #748D92
      r = Math.round(18  + t * 98);
      g = Math.round(78  + t * 59);
      b = Math.round(102 + t * 44);
    } else {
      // Crown: #5FB8CC → #D3D9D4
      r = Math.round(95  + t * 116);
      g = Math.round(184 + t * 33);
      b = Math.round(204 + t * 8);
    }
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  /* ─── 9. Render one frame ──────────────────────────────────────── */
  function render(sy) {
    ctx.clearRect(0, 0, W, H);
    const maxDepth = 7;

    /* Pass 1: glow (lighter blend, wide stroke, low alpha) */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segCount; i++) {
      const type = sType[i];
      if (type === 0) continue; // trunk: skip glow (already dark)

      const p1 = projectPt(sx1[i], sy1[i], szArr[i], sDepth[i], sPhase[i], sy);
      const p2 = projectPt(sx2[i], sy2[i], szArr[i], sDepth[i], sPhase[i], sy);
      if (p1.y < -80 && p2.y < -80) continue;
      if (p1.y > H + 80 && p2.y > H + 80) continue;

      const midX = (p1.x + p2.x) * 0.5;
      const edgeFade = midX < 0.72 * W ? 0 :
                       midX < 0.80 * W ? (midX - 0.72 * W) / (0.08 * W) * 0.25 : 1;
      if (edgeFade <= 0) continue;

      const glowMul  = type === 2 ? 0.12 : 0.07;
      ctx.strokeStyle = segColor(type, sDepth[i], maxDepth, sAlpha[i] * glowMul * edgeFade);
      ctx.lineWidth   = sThick[i] * 3.5;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    /* Pass 2: solid lines */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < segCount; i++) {
      const p1 = projectPt(sx1[i], sy1[i], szArr[i], sDepth[i], sPhase[i], sy);
      const p2 = projectPt(sx2[i], sy2[i], szArr[i], sDepth[i], sPhase[i], sy);
      if (p1.y < -80 && p2.y < -80) continue;
      if (p1.y > H + 80 && p2.y > H + 80) continue;

      const midX = (p1.x + p2.x) * 0.5;
      let edgeFade = midX < 0.72 * W ? 0 :
                     midX < 0.80 * W ? (midX - 0.72 * W) / (0.08 * W) : 1;
      edgeFade *= (midX < 0.80 * W ? 0.50 : 0.85);
      if (edgeFade <= 0) continue;

      const persp = 1 / (1 - szArr[i] * 0.35);
      ctx.strokeStyle = segColor(sType[i], sDepth[i], maxDepth, sAlpha[i] * edgeFade);
      ctx.lineWidth   = Math.max(0.5, sThick[i] * persp);
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    /* Root specks: 60 tiny drifting dots in root zone (y=2.0..3.0) */
    ctx.globalCompositeOperation = 'source-over';
    const totalVH    = cBottom - aTop;
    const rootTop    = aTop + 2.0 * (totalVH / 3) - sy; // y=2.0 on screen
    const rootHeight = totalVH / 3;                      // y=2.0..3.0 span
    for (let k = 0; k < 60; k++) {
      const speckX = 0.80 * W + (k / 60) * 0.18 * W + Math.sin(windT * 0.3  + k) * 2.5;
      const speckY = rootTop + (k / 60) * rootHeight    + Math.sin(windT * 0.2 + k * 1.3) * 4;
      if (speckY < -5 || speckY > H + 5) continue;
      const ef = speckX < 0.80 * W ? 0 : Math.min(1, (speckX - 0.80 * W) / (0.08 * W));
      ctx.fillStyle = `rgba(211,217,212,${(0.38 * ef).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(speckX, speckY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ─── 10. RAF loop (capped at 30fps) ───────────────────────────── */
  let lastFrame = 0, rafId = 0, running = false;

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < 33) return;
    lastFrame = now;
    if (document.hidden) return;

    windT = now * 0.001;
    const sy      = window.scrollY;
    const opacity = getCanvasOpacity(sy);
    canvas.style.opacity = opacity.toFixed(3);
    if (opacity < 0.01) return;
    render(sy);
  }

  function startLoop() { if (running) return; running = true; rafId = requestAnimationFrame(loop); }
  function stopLoop()  { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  /* ─── 11. Visibility / pause ───────────────────────────────────── */
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopLoop() : startLoop();
  });

  /* ─── 12. Resize (width-only, debounced 300ms) ─────────────────── */
  let lastBuiltWidth = 0, resizeTimer = 0;
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

  if (document.readyState === 'complete') { init(); }
  else { window.addEventListener('load', init); }

})();
