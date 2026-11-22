/**
 * tree.js — scroll-driven procedural 3D tree in the right margin
 *
 * Virtual coordinate system (maps to ACTUAL section boundaries):
 *   y = 0.0 → aTop   (top of About)       — crown tips
 *   y = 1.0 → bTop   (top of Programmes)  — crown base / trunk top
 *   y = 2.0 → cTop   (top of Faculty)     — trunk base / root start
 *   y = 3.0 → cBottom (bottom of Faculty) — deepest roots
 *
 * Crown  → y ∈ [0, 1]  (About)
 * Trunk  → y ∈ [1, 2]  (Programmes)
 * Roots  → y ∈ [2, 3]  (Faculty)
 *
 * X coordinates are ABSOLUTE screen pixels — no virtual-to-screen mapping needed.
 * The trunk centre is pinned to 0.84*W. Everything is clamped to [0.68*W, W+8].
 * This guarantees the tree stays in the right ~32% of the viewport.
 *
 * Vanilla Canvas 2D, no libraries. DPR capped at 1.5. Max 30 fps.
 */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── 1. Canvas setup ──────────────────────────────────────────── */
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

  /* ─── 2. Sections ──────────────────────────────────────────────── */
  const sA = document.getElementById('about');
  const sB = document.getElementById('programmes');
  const sC = document.getElementById('faculty');
  if (!sA || !sB || !sC) return;

  let aTop = 0, bTop = 0, cTop = 0, cBottom = 0;

  function cacheSectionBounds() {
    const sy = window.scrollY;
    aTop    = sA.getBoundingClientRect().top    + sy;
    bTop    = sB.getBoundingClientRect().top    + sy;
    cTop    = sC.getBoundingClientRect().top    + sy;
    cBottom = sC.getBoundingClientRect().bottom + sy;
  }

  /* Convert virtual y → absolute page-y */
  function vyToAbs(vy) {
    if (vy <= 1) return aTop + vy * (bTop - aTop);
    if (vy <= 2) return bTop + (vy - 1) * (cTop - bTop);
    return          cTop + (vy - 2) * (cBottom - cTop);
  }

  /* ─── 3. Seeded RNG ─────────────────────────────────────────────── */
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
  /* X/Y stored as VIRTUAL coordinates: vx in [−1,1], vy in [0,3] */
  const sx1    = new Float32Array(MAX_SEG);
  const sy1    = new Float32Array(MAX_SEG);
  const sx2    = new Float32Array(MAX_SEG);
  const sy2    = new Float32Array(MAX_SEG);
  const szArr  = new Float32Array(MAX_SEG);
  const sThick = new Float32Array(MAX_SEG);
  const sAlpha = new Float32Array(MAX_SEG);
  const sDepth = new Float32Array(MAX_SEG);
  const sPhase = new Float32Array(MAX_SEG);
  const sType  = new Uint8Array(MAX_SEG);  // 0=trunk 1=crown 2=root
  let   segCount = 0;

  function addSeg(x1, y1, x2, y2, z, thick, alpha, depth, phase, type) {
    if (segCount >= MAX_SEG) return;
    const i = segCount++;
    sx1[i]=x1; sy1[i]=y1; sx2[i]=x2; sy2[i]=y2;
    szArr[i]=z; sThick[i]=thick; sAlpha[i]=alpha;
    sDepth[i]=depth; sPhase[i]=phase; sType[i]=type;
  }

  /* ─── 5. Tree geometry ─────────────────────────────────────────── */
  /*
   * Virtual X: 0 = trunk centre. Branches spread ±0.5 at most.
   * When projected, screenX = trunkX + vx * xSpread (+ wind + perspective).
   * trunkX = 0.84*W, xSpread = 0.09*W  →  range = 0.84*W ± 0.045*W = [0.795W, 0.885W].
   * Crown branches can spread a bit wider but are clamped in projectPt.
   */

  /* Crown/side-branch: y DECREASES going upward */
  function branch(x, y, angle, len, thick, depth, maxDepth, z, phase, type) {
    if (depth > maxDepth || len < 0.004 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y - Math.cos(angle) * len;
    /* Clamp x2 to stay roughly in the right margin (vx ∈ [-0.70, 1.0]) */
    const x2c = Math.max(-0.70, Math.min(1.0, x2));
    const alpha = type === 1 ? 0.52 + rng() * 0.32 : 0.60 + rng() * 0.24;
    addSeg(x, y, x2c, y2, z, thick, alpha, depth, phase, type);
    const splits = depth < 2 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = (0.22 + rng() * 0.28) * (depth < 1 ? 0.70 : 1);
      const side   = s === 0 ? -spread : (s === 1 ? spread : (rng()-0.5)*spread*0.5);
      branch(x2c, y2, angle+side, len*(0.58+rng()*0.15), thick*(0.54+rng()*0.10),
             depth+1, maxDepth, Math.max(-1,Math.min(1,z+(rng()-0.5)*0.22)),
             phase+rng()*Math.PI*2, type);
    }
  }

  /* Root: y INCREASES downward. Starts at y=2.0 → y≈3.0 */
  function root(x, y, angle, len, thick, depth, maxDepth, z, phase) {
    if (depth > maxDepth || len < 0.004 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y + Math.cos(angle) * len;
    if (y2 > 3.05) return;
    /* Clamp x; roots spread outward but stay in right third */
    const x2c = Math.max(-0.65, Math.min(1.0, x2));
    const alpha = Math.min(0.92, 0.52 + rng()*0.34 + (depth/maxDepth)*0.06);
    addSeg(x, y, x2c, y2, z, thick, alpha, depth, phase, 2);
    const splits = depth < 3 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = 0.22 + rng() * 0.38;
      const side   = s===0 ? -spread : (s===1 ? spread : (rng()-0.5)*spread);
      root(x2c, y2, angle+side, len*(0.60+rng()*0.14), thick*(0.57+rng()*0.09),
           depth+1, maxDepth, Math.max(-1,Math.min(1,z+(rng()-0.5)*0.28)),
           phase+rng()*Math.PI*2);
    }
  }

  function buildTree() {
    segCount = 0;

    /* ── TRUNK (type 0, y = 1.0 → 2.0, Programmes section) ──── */
    addSeg( 0.000, 1.00,  0.025, 1.20, 0.00, 13, 0.80, 0, 0.1, 0);
    addSeg( 0.025, 1.20, -0.010, 1.40, 0.03, 11, 0.76, 0, 0.2, 0);
    addSeg(-0.010, 1.40,  0.020, 1.60, 0.00, 10, 0.72, 0, 0.3, 0);
    addSeg( 0.020, 1.60, -0.010, 1.80, 0.02,  9, 0.68, 0, 0.4, 0);
    addSeg(-0.010, 1.80,  0.000, 2.00, 0.00,  8, 0.64, 0, 0.5, 0);

    /* Trunk side branches — small, stay near trunk */
    const tYs = [1.15, 1.35, 1.55, 1.75, 1.90];
    const tSd = [-1,    1,   -1,    1,   -1];
    for (let i = 0; i < 5; i++) {
      const ang = tSd[i] * (0.40 + rng()*0.25);
      branch(0.01+tSd[i]*0.015, tYs[i], ang, 0.09+rng()*0.05,
             3.5, 0, 3, (rng()-0.5)*0.3, rng()*Math.PI*2, 0);
    }

    /* ── CROWN (type 1, branches upward from y=1.0, tops at y≈0.0) ── */
    branch( 0.00, 1.00, -0.08, 0.28, 8.0, 0, 6,  0.10, 0.0, 1);
    branch( 0.00, 1.00, -0.40, 0.23, 6.5, 0, 5, -0.20, 1.1, 1);
    branch( 0.00, 1.00,  0.35, 0.23, 6.5, 0, 5,  0.30, 2.3, 1);
    branch( 0.00, 1.00,  0.12, 0.26, 7.0, 0, 6,  0.00, 0.7, 1);
    branch( 0.00, 1.00, -0.20, 0.20, 6.0, 0, 5, -0.10, 3.5, 1);
    branch( 0.00, 1.00,  0.55, 0.16, 5.0, 0, 4,  0.20, 4.2, 1);

    /* ── ROOTS (type 2, downward from y=2.0 → y≈3.0) ── */
    root( 0.00, 2.00,  0.45, 0.55, 8.5, 0, 6,  0.10, 0.0);
    root( 0.00, 2.00, -0.45, 0.55, 8.5, 0, 6, -0.10, 1.5);
    root( 0.02, 2.00,  0.18, 0.60, 9.0, 0, 7,  0.20, 0.8);
    root(-0.02, 2.00, -0.18, 0.60, 9.0, 0, 7, -0.20, 2.2);
    root( 0.00, 2.00,  0.75, 0.46, 6.0, 0, 5,  0.30, 3.1);
    root( 0.00, 2.00, -0.75, 0.46, 6.0, 0, 5, -0.30, 4.6);
    root( 0.00, 2.00,  0.00, 0.58, 7.0, 0, 6,  0.00, 5.8);

    /* Glowing vertical tap-root spine spanning Faculty zone */
    for (let k = 0; k < 12; k++) {
      const y1  = 2.00 + k * (1.0/12);
      const y2  = y1  + (1.0/12) + 0.01;
      const jit = (k % 2 === 0 ? 0.03 : -0.02);
      addSeg(jit, y1, -jit, y2, 0.0,
             Math.max(2.0, 8.0 - k*0.5),
             0.80 - k*0.018, 3, k*0.5, 2);
    }
  }

  /* ─── 6. Wind & projection ─────────────────────────────────────── */
  let windT = 0;

  function windDelta(depth, phase, t) {
    const flex = Math.pow(depth / 7, 1.4);
    return (Math.sin(t*0.35 + phase + depth*0.7)*0.030
          + Math.sin(t*0.13)*0.012) * flex * W * 0.028;
  }

  /* Project virtual (vx, vy) → screen pixels.
   * trunkX is ALWAYS recomputed from current W so it adapts to viewport width.
   * xSpread: 1 unit of vx = this many screen pixels of spread from trunk centre.
   * Edge clamp: nothing renders left of 0.68*W (soft fade from 0.68–0.76).
   */
  function projectPt(vx, vy, z, depth, phase, scrollY) {
    const absY   = vyToAbs(vy);
    const screenY = absY - scrollY;
    const trunkX  = 0.84 * W;
    const xSpread = 0.085 * W;
    const persp   = 1 / (1 - z * 0.32);
    const wx      = windDelta(depth, phase, windT);
    const screenX = trunkX + (vx * xSpread + wx) * persp;
    return { x: screenX, y: screenY };
  }

  /* ─── 7. Canvas opacity (fade in/out) ───────────────────────────── */
  function getCanvasOpacity(sy) {
    const enterStart = aTop - H;
    const enterEnd   = aTop - H * 0.75;
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
      /* Roots: bright teal #5FB8CC → silver #D3D9D4 */
      r = Math.round(95  + t * 116);
      g = Math.round(184 + t * 33);
      b = Math.round(204 + t * 8);
    } else if (type === 0) {
      /* Trunk: dark teal #124E66 → grey-blue #748D92 */
      r = Math.round(18  + t * 98);
      g = Math.round(78  + t * 59);
      b = Math.round(102 + t * 44);
    } else {
      /* Crown: teal-silver */
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
    /* Left edge below which nothing renders (soft fade band) */
    const leftBound  = 0.68 * W;
    const fadeStart  = 0.68 * W;
    const fadeEnd    = 0.76 * W;

    /* Pass 1: glow (lighter blend) for crown & roots */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segCount; i++) {
      const type = sType[i];
      if (type === 0) continue; // trunk: skip glow pass

      const p1 = projectPt(sx1[i], sy1[i], szArr[i], sDepth[i], sPhase[i], sy);
      const p2 = projectPt(sx2[i], sy2[i], szArr[i], sDepth[i], sPhase[i], sy);
      if (p1.y < -100 && p2.y < -100) continue;
      if (p1.y > H+100 && p2.y > H+100) continue;

      const midX = (p1.x + p2.x) * 0.5;
      if (midX < leftBound) continue;
      const edgeFade = midX < fadeEnd ? (midX - fadeStart) / (fadeEnd - fadeStart) : 1;
      if (edgeFade <= 0) continue;

      ctx.strokeStyle = segColor(type, sDepth[i], maxDepth,
                                 sAlpha[i] * (type===2 ? 0.18 : 0.06) * edgeFade);
      ctx.lineWidth = sThick[i] * 3.0;
      ctx.lineCap   = 'round';
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
      if (p1.y < -100 && p2.y < -100) continue;
      if (p1.y > H+100 && p2.y > H+100) continue;

      const midX = (p1.x + p2.x) * 0.5;
      if (midX < leftBound) continue;
      let edgeFade = midX < fadeEnd ? (midX - fadeStart) / (fadeEnd - fadeStart) : 1;
      edgeFade *= (midX < fadeEnd ? 0.55 : 0.88);
      if (edgeFade <= 0.01) continue;

      const persp = 1 / (1 - szArr[i] * 0.32);
      ctx.strokeStyle = segColor(sType[i], sDepth[i], maxDepth, sAlpha[i]*edgeFade);
      ctx.lineWidth   = Math.max(0.5, sThick[i] * persp);
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    /* Root specks: tiny ambient glints in Faculty zone */
    ctx.globalCompositeOperation = 'source-over';
    const rootTop    = vyToAbs(2.0) - sy;
    const rootHeight = cBottom - cTop;
    for (let k = 0; k < 55; k++) {
      const speckX = 0.76*W + (k/55)*0.22*W + Math.sin(windT*0.3 + k)*2;
      const speckY = rootTop + (k/55)*rootHeight + Math.sin(windT*0.2 + k*1.3)*3.5;
      if (speckY < -5 || speckY > H+5) continue;
      const ef = Math.min(1, (speckX - 0.80*W) / (0.06*W));
      if (ef <= 0) continue;
      ctx.fillStyle = `rgba(211,217,212,${(0.32*ef).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(speckX, speckY, 0.9, 0, Math.PI*2);
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

  function startLoop() { if (running) return; running=true; rafId=requestAnimationFrame(loop); }
  function stopLoop()  { running=false; if(rafId) cancelAnimationFrame(rafId); rafId=0; }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopLoop() : startLoop();
  });

  /* ─── 11. Resize (width-only, debounced 300ms) ─────────────────── */
  let lastBuiltWidth = 0, resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastBuiltWidth) < 40) return;
      lastBuiltWidth = window.innerWidth;
      resizeCanvas();
      cacheSectionBounds();
      /* No rebuild needed — geometry is in virtual coords; projectPt uses live W */
    }, 300);
  });

  /* ─── 12. Init ──────────────────────────────────────────────────── */
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
