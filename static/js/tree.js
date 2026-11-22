/**
 * tree.js — scroll-driven procedural 3D tree in the right margin
 *
 * Virtual coordinate system (maps to ACTUAL section boundaries, not equal thirds):
 *   y = 0.0 → aTop   (top of Section A / About)      crown tips
 *   y = 1.0 → bTop   (top of Section B / Programmes)  crown base / trunk top
 *   y = 2.0 → cTop   (top of Section C / Faculty)     trunk base / ROOT START
 *   y = 3.0 → cBottom (bottom of Faculty)              deepest roots
 *
 * Crown  → y ∈ [0, 1]  — Section A (About)
 * Trunk  → y ∈ [1, 2]  — Section B (Programmes)
 * Roots  → y ∈ [2, 3]  — Section C (Faculty)
 *
 * Vanilla Canvas 2D, no libraries. DPR capped at 1.5. Max 30fps.
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

  /* Absolute page-y for each section boundary */
  let aTop = 0, bTop = 0, cTop = 0, cBottom = 0;

  function cacheSectionBounds() {
    const sy = window.scrollY;
    aTop    = sA.getBoundingClientRect().top    + sy;
    bTop    = sB.getBoundingClientRect().top    + sy;
    cTop    = sC.getBoundingClientRect().top    + sy;
    cBottom = sC.getBoundingClientRect().bottom + sy;
  }

  /* Convert virtual y → absolute page-y, honouring actual section heights */
  function vyToAbs(vy) {
    if (vy <= 1) return aTop + vy * (bTop - aTop);           // About zone
    if (vy <= 2) return bTop + (vy - 1) * (cTop - bTop);    // Programmes zone
    return          cTop + (vy - 2) * (cBottom - cTop);     // Faculty zone
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

  /* Crown/side-branch: y DECREASES (goes upward in the page) */
  function branch(x, y, angle, len, thick, depth, maxDepth, z, phase, type) {
    if (depth > maxDepth || len < 0.005 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y - Math.cos(angle) * len;
    const alpha = type === 1 ? 0.48 + rng() * 0.38 : 0.58 + rng() * 0.28;
    addSeg(x, y, x2, y2, z, thick, alpha, depth, phase, type);
    const splits = depth < 2 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = (0.30 + rng() * 0.35) * (depth < 1 ? 0.65 : 1);
      const side   = s === 0 ? -spread : (s === 1 ? spread : (rng()-0.5)*spread*0.6);
      branch(x2, y2, angle+side, len*(0.57+rng()*0.17), thick*(0.53+rng()*0.11),
             depth+1, maxDepth, Math.max(-1,Math.min(1,z+(rng()-0.5)*0.25)),
             phase+rng()*Math.PI*2, type);
    }
  }

  /* Root: y INCREASES (goes downward).
   * Starts at y=2.0, must reach y≈3.0.
   * With initial len≈0.55 and lenMul≈0.62 over 7 levels:
   *   cumulative = 0.55×(1−0.62^7)/(1−0.62) ≈ 1.38 → tips at y≈3.38 (clamped 3.05)
   */
  function root(x, y, angle, len, thick, depth, maxDepth, z, phase) {
    if (depth > maxDepth || len < 0.005 || segCount >= MAX_SEG - 1) return;
    const x2 = x + Math.sin(angle) * len;
    const y2 = y + Math.cos(angle) * len;
    if (y2 > 3.05) return;
    const alpha = Math.min(0.90, 0.48 + rng()*0.38 + (depth/maxDepth)*0.08);
    addSeg(x, y, x2, y2, z, thick, alpha, depth, phase, 2);
    const splits = depth < 3 ? 3 : 2;
    for (let s = 0; s < splits; s++) {
      const spread = 0.25 + rng() * 0.40;
      const side   = s===0 ? -spread : (s===1 ? spread : (rng()-0.5)*spread);
      root(x2, y2, angle+side, len*(0.60+rng()*0.14), thick*(0.56+rng()*0.10),
           depth+1, maxDepth, Math.max(-1,Math.min(1,z+(rng()-0.5)*0.30)),
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

    /* Trunk side branches */
    const tYs = [1.15, 1.35, 1.55, 1.75, 1.90];
    const tSd = [-1,    1,   -1,    1,   -1];
    for (let i = 0; i < 5; i++) {
      const ang = tSd[i] * (0.50 + rng()*0.35);
      branch(0.01+tSd[i]*0.02, tYs[i], ang, 0.12+rng()*0.06,
             4.0, 0, 3, (rng()-0.5)*0.4, rng()*Math.PI*2, 0);
    }

    /* ── CROWN (type 1, branches upward from y=1.0, tops at y≈0.0) ── */
    branch( 0.01, 1.00, -0.08, 0.30, 8.5, 0, 6,  0.10, 0.0, 1);
    branch( 0.01, 1.00, -0.45, 0.25, 7.0, 0, 5, -0.20, 1.1, 1);
    branch( 0.01, 1.00,  0.38, 0.25, 7.0, 0, 5,  0.30, 2.3, 1);
    branch( 0.01, 1.00,  0.12, 0.28, 7.5, 0, 6,  0.00, 0.7, 1);
    branch( 0.01, 1.00, -0.22, 0.22, 6.5, 0, 5, -0.10, 3.5, 1);
    branch( 0.01, 1.00,  0.65, 0.18, 5.5, 0, 4,  0.20, 4.2, 1);

    /* ── ROOTS (type 2, downward from y=2.0 → y≈3.0, Faculty zone) ── */
    root( 0.00, 2.00,  0.50, 0.55, 8.5, 0, 6,  0.10, 0.0);
    root( 0.00, 2.00, -0.50, 0.55, 8.5, 0, 6, -0.10, 1.5);
    root( 0.02, 2.00,  0.18, 0.60, 9.5, 0, 7,  0.20, 0.8);
    root(-0.02, 2.00, -0.18, 0.60, 9.5, 0, 7, -0.20, 2.2);
    root( 0.00, 2.00,  0.80, 0.48, 6.5, 0, 5,  0.30, 3.1);
    root( 0.00, 2.00, -0.80, 0.48, 6.5, 0, 5, -0.30, 4.6);
    root( 0.01, 2.00,  0.00, 0.58, 7.0, 0, 6,  0.00, 5.8); // vertical tap root

    /* ── TAP ROOT SPINE: glowing vertical axis y=2.0..3.0 ──────── */
    /* Guarantees a visible glowing column throughout the Faculty scroll zone.
     * depth=3 gives t=3/7=0.43 → bright teal rgb(145,198,208) on dark background. */
    for (let k = 0; k < 12; k++) {
      const y1  = 2.00 + k * (1.0 / 12);
      const y2  = y1  + (1.0 / 12) + 0.01;
      const jit = (k % 2 === 0 ? 0.03 : -0.02);
      addSeg(jit, y1, -jit, y2, 0.0,
             Math.max(2.0, 8.0 - k*0.5),
             0.80 - k*0.020, 3, k*0.5, 2);  // depth=3 → bright teal, not dark base
    }
  }

  /* ─── 6. Wind & projection ─────────────────────────────────────── */
  let windT = 0;

  function windDelta(depth, phase, t) {
    const flex = Math.pow(depth / 7, 1.4);
    return (Math.sin(t*0.35 + phase + depth*0.7)*0.035
          + Math.sin(t*0.13)*0.015) * flex * 28;
  }

  /* Project virtual (vx, vy) → screen pixels */
  function projectPt(vx, vy, z, depth, phase, scrollY) {
    const screenY  = vyToAbs(vy) - scrollY;      // ← key: uses actual section heights
    const trunkX   = 0.90 * W;
    const xSpread  = 0.09 * W;
    const persp    = 1 / (1 - z * 0.35);
    const wx       = windDelta(depth, phase, windT);
    const screenX  = trunkX + (vx * xSpread + wx) * persp;
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
      // Roots: bright teal → luminous silver (spec: #5FB8CC → #D3D9D4)
      // Start BRIGHT so roots glow against the dark Faculty background.
      r = Math.round(95  + t * 116);  // 95→211  (#5FB8CC → #D3D9D4)
      g = Math.round(184 + t * 33);   // 184→217
      b = Math.round(204 + t * 8);    // 204→212
    } else if (type === 0) {
      r = Math.round(18  + t * 98);   // #124E66 → #748D92
      g = Math.round(78  + t * 59);
      b = Math.round(102 + t * 44);
    } else {
      r = Math.round(95  + t * 116);  // #5FB8CC → #D3D9D4
      g = Math.round(184 + t * 33);
      b = Math.round(204 + t * 8);
    }
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  /* ─── 9. Render one frame ──────────────────────────────────────── */
  function render(sy) {
    ctx.clearRect(0, 0, W, H);
    const maxDepth = 7;

    /* Pass 1: glow (lighter blend) */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < segCount; i++) {
      const type = sType[i];
      if (type === 0) continue; // trunk: skip glow

      const p1 = projectPt(sx1[i], sy1[i], szArr[i], sDepth[i], sPhase[i], sy);
      const p2 = projectPt(sx2[i], sy2[i], szArr[i], sDepth[i], sPhase[i], sy);
      if (p1.y < -80 && p2.y < -80) continue;
      if (p1.y > H+80 && p2.y > H+80) continue;

      const midX = (p1.x + p2.x) * 0.5;
      const edgeFade = midX < 0.72*W ? 0 :
                       midX < 0.80*W ? (midX - 0.72*W)/(0.08*W) * 0.25 : 1;
      if (edgeFade <= 0) continue;

      ctx.strokeStyle = segColor(type, sDepth[i], maxDepth,
                                 sAlpha[i] * (type===2 ? 0.20 : 0.07) * edgeFade);
      ctx.lineWidth = sThick[i] * 3.5;
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
      if (p1.y < -80 && p2.y < -80) continue;
      if (p1.y > H+80 && p2.y > H+80) continue;

      const midX = (p1.x + p2.x) * 0.5;
      let edgeFade = midX < 0.72*W ? 0 :
                     midX < 0.80*W ? (midX - 0.72*W)/(0.08*W) : 1;
      edgeFade *= (midX < 0.80*W ? 0.50 : 0.85);
      if (edgeFade <= 0) continue;

      const persp = 1 / (1 - szArr[i] * 0.35);
      ctx.strokeStyle = segColor(sType[i], sDepth[i], maxDepth, sAlpha[i]*edgeFade);
      ctx.lineWidth   = Math.max(0.5, sThick[i] * persp);
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    /* Root specks: 60 tiny drifting dots in Faculty zone (y=2.0..3.0) */
    ctx.globalCompositeOperation = 'source-over';
    const rootTop    = vyToAbs(2.0) - sy;          // = cTop - sy (top of Faculty)
    const rootHeight = cBottom - cTop;              // actual Faculty section height
    for (let k = 0; k < 60; k++) {
      const speckX = 0.80*W + (k/60)*0.18*W + Math.sin(windT*0.3 + k)*2.5;
      const speckY = rootTop + (k/60)*rootHeight   + Math.sin(windT*0.2 + k*1.3)*4;
      if (speckY < -5 || speckY > H+5) continue;
      const ef = speckX < 0.80*W ? 0 : Math.min(1,(speckX-0.80*W)/(0.08*W));
      ctx.fillStyle = `rgba(211,217,212,${(0.38*ef).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(speckX, speckY, 1, 0, Math.PI*2);
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
