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

  function vyToAbs(vy) {
    if (vy <= 1) return aTop + vy * (bTop - aTop);
    if (vy <= 2) return bTop + (vy - 1) * (cTop - bTop);
    return          cTop + (vy - 2) * (cBot  - cTop);
  }

  /* ═══════════════════════════════════════════════════════
     3.  SEEDED RNG (mulberry32)
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
     4.  STARS (120 static points inside glow area)
  ═══════════════════════════════════════════════════════ */
  const NS       = 120;
  const starFX   = new Float32Array(NS);
  const starFY   = new Float32Array(NS);
  const starBase = new Float32Array(NS);
  const starPh   = new Float32Array(NS);

  /* ═══════════════════════════════════════════════════════
     5.  GLOW SPRITE (radial gradient offscreen)
  ═══════════════════════════════════════════════════════ */
  let glowSprite = null;

  function buildGlowSprite() {
    const r = Math.ceil(W * 0.60);
    if (!glowSprite) glowSprite = document.createElement('canvas');
    glowSprite.width  = r;
    glowSprite.height = H;
    const gc = glowSprite.getContext('2d');
    gc.clearRect(0, 0, r, H);
    const gr = gc.createRadialGradient(r, H / 2, 0, r, H / 2, r);
    gr.addColorStop(0,    'rgba(95,184,204,0.22)');
    gr.addColorStop(0.45, 'rgba(95,184,204,0.08)');
    gr.addColorStop(1,    'rgba(95,184,204,0)');
    gc.fillStyle = gr;
    gc.fillRect(0, 0, r, H);
  }

  /* ═══════════════════════════════════════════════════════
     6.  SEGMENT STORAGE (Float32Arrays, max 9200)
  ═══════════════════════════════════════════════════════ */
  const MSEG = 9200;
  const svx1 = new Float32Array(MSEG);
  const svy1 = new Float32Array(MSEG);
  const svx2 = new Float32Array(MSEG);
  const svy2 = new Float32Array(MSEG);
  const svz  = new Float32Array(MSEG);
  const sth  = new Float32Array(MSEG);
  const sba  = new Float32Array(MSEG);
  const sra  = new Float32Array(MSEG);
  const sdp  = new Int16Array(MSEG);
  const sph  = new Float32Array(MSEG);
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
  const CMAX      = 9;
  const RMAX      = 7;
  const MAX_CROWN = 4400;
  const MAX_ROOT  = 3500;
  let   crownSegs = 0;
  let   rootSegs  = 0;

  /* ── Crown recursive branch (UPWARD & LEFTWARD) ───────── */
  function growCrown(x, y, angle, len, thick, depth, z, p) {
    if (depth > CMAX || len < 0.0030 || crownSegs >= MAX_CROWN || nSeg >= MSEG - 1) return;

    const curve = (rng() - 0.48) * 0.16;
    const curAngle = angle + curve;

    const nx = x - Math.sin(curAngle) * len;
    const ny = y - Math.cos(curAngle) * len * ASPECT;

    if (nx < -0.55 || ny < 0.005) return;

    const leftmost = Math.abs(Math.min(nx, x));
    const fade = leftmost > 0.45 ? Math.max(0, 1 - (leftmost - 0.45) / 0.10) : 1;
    const bodyA = 0.95 * (0.30 + 0.70 * fade);
    let rimA = thick > 8 ? 0.55 : (thick > 3 ? 0.25 : 0.12);
    rimA *= (0.30 + 0.70 * fade);

    pushSeg(x, y, nx, ny, z, thick, bodyA, rimA, depth, p);
    crownSegs++;

    const nK = depth < 2 ? 3 : (depth < 6 ? 2 : (rng() < 0.52 ? 2 : 1));
    const lMul = 0.74 + rng() * 0.11;
    const tMul = 0.61 + rng() * 0.08;

    for (let k = 0; k < nK; k++) {
      const spread = (0.24 + rng() * 0.26) * (depth < 1 ? 0.75 : 1);
      let cA = nK === 3
        ? (k === 0 ? curAngle + spread * 1.25 : k === 1 ? curAngle + (rng() - 0.5) * 0.18 : curAngle - spread * 0.6)
        : (k === 0 ? curAngle + spread * 1.05 : curAngle - spread * 0.55);
      cA += (rng() - 0.5) * 0.20;
      if (depth >= 5) cA += rng() * 0.07;

      const cLen = len * lMul * (1 + (rng() - 0.5) * 0.15);
      const cZ   = Math.max(-1, Math.min(1, z + (rng() - 0.5) * 0.25));
      const cP   = p + rng() * Math.PI * 1.8;
      growCrown(nx, ny, cA, cLen, Math.max(0.4, thick * tMul), depth + 1, cZ, cP);
    }
  }

  /* ── Root recursive branch (DOWNWARD & OUTWARD) ───────── */
  function growRoot(x, y, angle, len, thick, depth, z, p) {
    if (depth > RMAX || len < 0.0025 || rootSegs >= MAX_ROOT || nSeg >= MSEG - 1) return;

    const gnarl = (rng() - 0.5) * 0.28;
    const curAngle = Math.max(-0.15, Math.min(1.22, angle + gnarl));

    const nx = x - Math.sin(curAngle) * len;
    const ny = y + Math.cos(curAngle) * len * ASPECT;

    if (nx < -0.54 || ny > 3.02) return;

    const leftmost = Math.abs(Math.min(nx, x));
    const fade = leftmost > 0.45 ? Math.max(0, 1 - (leftmost - 0.45) / 0.10) : 1;
    const bodyA = 0.95 * (0.30 + 0.70 * fade);
    let rimA = thick > 8 ? 0.55 : (thick > 3 ? 0.25 : 0.12);
    rimA *= (0.30 + 0.70 * fade);

    pushSeg(x, y, nx, ny, z, thick, bodyA, rimA, depth, p);
    rootSegs++;

    const nK   = depth < 2 ? 3 : (depth < 5 ? 2 : (rng() < 0.55 ? 2 : 1));
    const lMul = 0.73 + rng() * 0.10;
    const tMul = 0.55 + rng() * 0.08; // graceful quick taper to fine tips

    for (let k = 0; k < nK; k++) {
      const spread = 0.22 + rng() * 0.28;
      let cA = Math.max(-0.10, Math.min(1.25,
        k === 0 ? curAngle + spread * 0.90
        : k === 1 ? curAngle - spread * 0.55
        : curAngle + (rng() - 0.5) * spread * 0.6));
      const cZ  = Math.max(-1, Math.min(1, z + (rng() - 0.5) * 0.25));
      const cP  = p + rng() * Math.PI * 1.5;
      growRoot(nx, ny, cA, len * lMul, Math.max(0.4, thick * tMul), depth + 1, cZ, cP);
    }
  }

  /* ── Assemble full tree ───────────────────────────────── */
  function buildTree() {
    rngReset();
    nSeg      = 0;
    crownSegs = 0;
    rootSegs  = 0;

    for (let i = 0; i < NS; i++) {
      starFX[i]   = rng() * 0.58;
      starFY[i]   = rng();
      starBase[i] = 0.20 + rng() * 0.40;
      starPh[i]   = rng() * Math.PI * 2;
    }

    /* ── Trunk (Programmes, vy 1.0 → 2.0) ──────────────────
       Wide base (~0.06w ≈ 77px), tapering to 44px, S-curve.
    ──────────────────────────────────────────────────────── */
    const trunkPts = [
      [ 0.000, 2.00, 77],
      [-0.015, 1.86, 72],
      [-0.028, 1.72, 66],
      [-0.035, 1.58, 61],
      [-0.034, 1.44, 56],
      [-0.027, 1.30, 52],
      [-0.018, 1.15, 48],
      [-0.008, 1.00, 44],
    ];
    for (let i = 0; i < trunkPts.length - 1; i++) {
      const p1 = trunkPts[i];
      const p2 = trunkPts[i + 1];
      pushSeg(p1[0], p1[1], p2[0], p2[1], 0.0, (p1[2] + p2[2]) / 2, 0.95, 0.55, 0, i * 0.1);
    }

    /* Trunk side limbs in Programmes section */
    const trunkSideLimbs = [
      [-0.018, 1.18, 0.62, 0.18, 26],
      [-0.026, 1.32, 0.82, 0.17, 24],
      [-0.034, 1.48, 0.68, 0.16, 22],
      [-0.030, 1.62, 0.88, 0.15, 20],
      [-0.020, 1.76, 0.72, 0.14, 18],
    ];
    for (const [bx, by, bA, bL, bT] of trunkSideLimbs) {
      growCrown(bx, by, bA, bL, bT, 1, 0, rng() * Math.PI * 2);
    }

    /* Flared root buttress at base of trunk */
    pushSeg( 0.000, 2.00, -0.065, 2.06, 0.00, 36, 0.95, 0.52, 1, 0.00);
    pushSeg( 0.000, 2.00, -0.115, 2.12, 0.10, 28, 0.95, 0.50, 1, 0.50);
    pushSeg( 0.000, 2.00, -0.160, 2.18, 0.00, 20, 0.95, 0.44, 1, 1.00);

    /* ── Crown (About, vy 0 → 1) ───────────────────────────
       Full-height oak canopy reaching up to vy = 0.01
    ──────────────────────────────────────────────────────── */
    const LIMBS = [
      [-0.008, 1.00,  0.35, 0.27, 40],
      [-0.008, 1.00,  0.68, 0.24, 36],
      [-0.008, 1.00,  0.96, 0.20, 30],
      [-0.008, 1.00,  0.18, 0.26, 38],
      [-0.008, 1.00,  1.22, 0.17, 24],
      [-0.008, 1.00, -0.04, 0.25, 34],
      [-0.008, 1.00,  0.50, 0.22, 32],
      [-0.008, 1.00,  1.48, 0.13, 18],
      [-0.014, 1.08,  0.58, 0.21, 28],
      [-0.022, 1.22,  0.78, 0.19, 24],
    ];
    for (const [lx, ly, lA, lL, lT] of LIMBS) {
      const z = (rng() - 0.5) * 0.70;
      const p = rng() * Math.PI * 2;
      growCrown(lx, ly, lA, lL, lT, 0, z, p);
    }

    /* ── Roots (Faculty, vy 2.0 → 3.0) ────────────────────
       Gnarly roots descending & fanning across entire Section C.
       Buttress roots emerge from trunk base and taper gracefully.
    ──────────────────────────────────────────────────────── */
    const ROOT_ORIGINS = [
      [ 0.00, 2.00, 0.12, 0.18, 36],
      [ 0.00, 2.00, 0.32, 0.19, 38],
      [ 0.00, 2.00, 0.55, 0.20, 40],
      [ 0.00, 2.00, 0.78, 0.18, 36],
      [ 0.00, 2.00, 0.98, 0.16, 32],
      [-0.015, 2.05, 0.25, 0.17, 32],
      [-0.025, 2.10, 0.50, 0.18, 34],
      [-0.035, 2.16, 0.75, 0.17, 30],
      [ 0.00, 2.22, 0.20, 0.16, 28],
      [ 0.00, 2.22, 0.55, 0.17, 30],
      [ 0.00, 2.22, 0.85, 0.16, 26],
      [ 0.00, 2.38, 0.22, 0.15, 26],
      [ 0.00, 2.38, 0.60, 0.16, 26],
      [ 0.00, 2.38, 0.90, 0.15, 24],
      [ 0.00, 2.55, 0.25, 0.14, 22],
      [ 0.00, 2.55, 0.65, 0.14, 22],
      [ 0.00, 2.70, 0.30, 0.13, 20],
      [ 0.00, 2.70, 0.70, 0.13, 20],
      [ 0.00, 2.85, 0.35, 0.12, 18],
    ];
    for (const [rx, ry, rA, rL, rT] of ROOT_ORIGINS) {
      const z = (rng() - 0.5) * 0.50;
      const p = rng() * Math.PI * 2;
      growRoot(rx, ry, rA, rL, rT, 0, z, p);
    }
  }

  /* ═══════════════════════════════════════════════════════
     8.  WIND
  ═══════════════════════════════════════════════════════ */
  let windT = 0;

  function windX(depth, phase) {
    if (depth === 0) return 0;
    const flex = Math.pow(depth / CMAX, 1.5);
    const sway = Math.sin(windT * 0.30 + phase + depth * 0.60) * 0.03 * flex
               + Math.sin(windT * 0.11) * 0.012 * flex;
    return sway * W * 0.08 * Math.sqrt(depth);
  }

  /* ═══════════════════════════════════════════════════════
     9.  PROJECTION
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

    /* 3. Rim light pass: crisp thin highlight offset 1px up-left */
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < nSeg; i++) {
      const p1 = project(svx1[i], svy1[i], svz[i], sdp[i], sph[i], scrollY);
      const p2 = project(svx2[i], svy2[i], svz[i], sdp[i], sph[i], scrollY);

      if (p1.y < -60 && p2.y < -60) continue;
      if (p1.y > H + 60 && p2.y > H + 60) continue;

      const persp = 1 / (1 - svz[i] * 0.30);
      const lw = Math.max(0.6, sth[i] * tScale * persp + 1.2);

      ctx.strokeStyle = `rgba(95,184,204,${sra[i].toFixed(3)})`;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      ctx.moveTo(p1.x - 1, p1.y - 1);
      ctx.lineTo(p2.x - 1, p2.y - 1);
      ctx.stroke();
    }

    /* 4. Body pass: dark silhouette #0B1117 drawn over rim pass */
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
     12. RAF LOOP
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
     13. RESIZE
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
