/* ============================================================
   FLY/TM — 2D Canvas Hero Scene  (dark premium theme)

   TOP-DOWN commercial airliner silhouette.
   • 5 equal-width diagonal stripes, full-bleed
   • One plane per stripe, spawns LEFT, flies diagonally RIGHT
   • Plane stays on its stripe centre-line
   • City name at visual centre of each stripe
   • Deep midnight navy / indigo palette
   ============================================================ */

(function () {
  "use strict";

  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let _cachedBounds = null;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    _cachedBounds = null;
  }
  resize();
  window.addEventListener('resize', resize);

  window.__flySceneStatus = { earth: 'ready', aircraft: 'ready' };
  setTimeout(() => window.dispatchEvent(new CustomEvent('flyscene:status',
    { detail: { earth: 'ready', aircraft: 'ready' } })), 60);

  /* ─── Stripe geometry ─────────────────────────────────────── */
  const STRIPE_ANGLE = 22;
  const RAD  = STRIPE_ANGLE * Math.PI / 180;
  const TAN  = Math.tan(RAD);
  const N    = 5;

  function buildBounds() {
    if (_cachedBounds) return _cachedBounds;
    const aspect = W / H;
    const bleed  = 0.12;
    const yStart = -bleed;
    const yEnd   = 1.0 + aspect * TAN + bleed;
    const step   = (yEnd - yStart) / N;
    const b = [];
    for (let i = 0; i <= N; i++) b.push(yStart + i * step);
    _cachedBounds = b;
    return b;
  }

  function edgeY(frac, x) { return frac * H - x * TAN; }

  /* ─── Dark night-sky palette ──────────────────────────────── */
  const STRIPE_FILL = [
    'rgba(18,  30,  58,  0.90)',   // deep navy
    'rgba(14,  24,  50,  0.88)',
    'rgba(10,  18,  42,  0.86)',
    'rgba(16,  26,  56,  0.88)',
    'rgba(20,  32,  64,  0.90)',
  ];
  const STRIPE_GLOW = [
    'rgba(93,  232, 212, 0.06)',   // cyan shimmer
    'rgba(93,  232, 212, 0.04)',
    'rgba(232, 200, 122, 0.04)',   // gold shimmer (middle)
    'rgba(93,  232, 212, 0.04)',
    'rgba(93,  232, 212, 0.06)',
  ];
  const STRIPE_SEAM = [
    'rgba(232, 200, 122, 0.22)',   // gold seam lines
    'rgba(232, 200, 122, 0.18)',
    'rgba(232, 200, 122, 0.14)',
    'rgba(232, 200, 122, 0.18)',
    'rgba(232, 200, 122, 0.22)',
  ];

  /* ─── Background ────────────────────────────────────────────  */
  function drawBackground() {
    // Deep night-sky base
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0.00, '#07091200');
    g.addColorStop(0.00, '#080c14');
    g.addColorStop(0.40, '#0a1020');
    g.addColorStop(0.80, '#080d1c');
    g.addColorStop(1.00, '#060a16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Subtle cyan glow top-right (like a city glow on the horizon)
    const tl = ctx.createRadialGradient(W * 0.82, H * 0.1, 0, W * 0.82, H * 0.1, W * 0.55);
    tl.addColorStop(0,   'rgba(30, 80, 140, 0.30)');
    tl.addColorStop(0.5, 'rgba(10, 30, 70, 0.12)');
    tl.addColorStop(1,   'rgba(10, 30, 70, 0.00)');
    ctx.fillStyle = tl;
    ctx.fillRect(0, 0, W, H);

    // Gold warmth bottom-left
    const bl = ctx.createRadialGradient(W * 0.1, H * 0.9, 0, W * 0.1, H * 0.9, W * 0.45);
    bl.addColorStop(0,   'rgba(90, 60, 10, 0.22)');
    bl.addColorStop(1,   'rgba(90, 60, 10, 0.00)');
    ctx.fillStyle = bl;
    ctx.fillRect(0, 0, W, H);

    // Vignette
    const v = ctx.createRadialGradient(W/2, H/2, H * 0.1, W/2, H/2, Math.max(W,H) * 0.9);
    v.addColorStop(0, 'rgba(0,0,0,0.00)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    // Distant star-field — tiny random dots
    drawStars();
  }

  /* ─── Stars ─────────────────────────────────────────────────  */
  // Pre-generate star positions once
  const STARS = (function() {
    const rng = (function() { let s = 42; return function(){ s=(s*16807)%2147483647; return (s-1)/2147483646; }; })();
    const arr = [];
    for (let i = 0; i < 120; i++) {
      arr.push({ x: rng(), y: rng(), r: rng() * 1.2 + 0.2, a: rng() * 0.5 + 0.1 });
    }
    return arr;
  })();

  function drawStars() {
    STARS.forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /* ─── Stripes ───────────────────────────────────────────────  */
  function drawStripes() {
    const B = buildBounds();
    for (let i = 0; i < N; i++) {
      const t = B[i], b = B[i + 1];

      // Base
      ctx.beginPath();
      ctx.moveTo(0, edgeY(t, 0)); ctx.lineTo(W, edgeY(t, W));
      ctx.lineTo(W, edgeY(b, W)); ctx.lineTo(0, edgeY(b, 0));
      ctx.closePath();
      ctx.fillStyle = STRIPE_FILL[i];
      ctx.fill();

      // Centre glow
      const cy0 = (edgeY(t,0) + edgeY(b,0)) / 2;
      const gh  = Math.abs(edgeY(b, W/2) - edgeY(t, W/2)) * 0.55;
      const ig  = ctx.createLinearGradient(0, cy0 - gh, 0, cy0 + gh);
      ig.addColorStop(0,   'rgba(0,0,0,0)');
      ig.addColorStop(0.5, STRIPE_GLOW[i]);
      ig.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.moveTo(0, edgeY(t,0)); ctx.lineTo(W, edgeY(t,W));
      ctx.lineTo(W, edgeY(b,W)); ctx.lineTo(0, edgeY(b,0));
      ctx.closePath();
      ctx.fillStyle = ig;
      ctx.fill();

      // Gold seam at top edge
      const sy0 = edgeY(t, 0);
      const sm  = ctx.createLinearGradient(0, sy0, 0, sy0 + 10);
      sm.addColorStop(0, STRIPE_SEAM[i]);
      sm.addColorStop(1, 'rgba(232,200,122,0)');
      ctx.beginPath();
      ctx.moveTo(0, sy0); ctx.lineTo(W, edgeY(t,W));
      ctx.lineTo(W, edgeY(t,W)+10); ctx.lineTo(0, sy0+10);
      ctx.closePath();
      ctx.fillStyle = sm;
      ctx.fill();
    }
  }

  /* ─── UI shield (readability oval in centre) ────────────────  */
  function drawUiShield() {
    const cx = W/2, cy = H/2;
    const rW = Math.min(W * 0.65, 820);
    const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, rW * 0.88);
    g.addColorStop(0.00, 'rgba(8,12,20,0.82)');
    g.addColorStop(0.35, 'rgba(8,12,20,0.72)');
    g.addColorStop(0.70, 'rgba(8,12,20,0.35)');
    g.addColorStop(1.00, 'rgba(8,12,20,0.00)');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rW, H * 0.62, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  /* ─── TOP-DOWN PLANE SILHOUETTE ─────────────────────────────  */
  function drawPlaneTopDown(ctx) {
    // Dark-theme colours: white fuselage with cyan + gold accents
    const white      = 'rgba(255, 255, 255, 0.96)';
    const offWhite   = 'rgba(230, 240, 255, 0.92)';
    const cyanTint   = 'rgba(180, 230, 245, 0.88)';
    const goldTint   = 'rgba(232, 200, 122, 0.72)';
    const darkStroke = 'rgba(60, 100, 160, 0.45)';
    const LW         = 0.012;

    ctx.lineWidth   = LW;
    ctx.strokeStyle = darkStroke;

    /* ── FUSELAGE ──────────────────────────────────────────── */
    ctx.beginPath();
    ctx.moveTo(0.52, 0);
    ctx.bezierCurveTo(0.48, -0.042,  0.30, -0.058,  0.10, -0.060);
    ctx.lineTo(-0.40, -0.058);
    ctx.bezierCurveTo(-0.48, -0.055, -0.54, -0.030, -0.56,  0.000);
    ctx.bezierCurveTo(-0.54,  0.030, -0.48,  0.055, -0.40,  0.058);
    ctx.lineTo( 0.10,  0.060);
    ctx.bezierCurveTo( 0.30,  0.058,  0.48,  0.042,  0.52,  0.000);
    ctx.closePath();
    ctx.fillStyle = white;
    ctx.fill(); ctx.stroke();

    /* ── COCKPIT VISOR ──────────────────────────────────────  */
    ctx.beginPath();
    ctx.moveTo(0.52,  0.000);
    ctx.bezierCurveTo(0.50, -0.028,  0.44, -0.042,  0.36, -0.042);
    ctx.lineTo( 0.34, -0.040);
    ctx.bezierCurveTo(0.32, -0.036,  0.32,  0.036,  0.34,  0.040);
    ctx.lineTo( 0.36,  0.042);
    ctx.bezierCurveTo(0.44,  0.042,  0.50,  0.028,  0.52,  0.000);
    ctx.closePath();
    ctx.fillStyle = cyanTint;
    ctx.fill();

    /* ── CABIN WINDOWS ──────────────────────────────────────  */
    ctx.fillStyle = cyanTint;
    for (let wx = -0.30; wx < 0.30; wx += 0.060) {
      ctx.beginPath();
      ctx.roundRect(wx, -0.052, 0.036, 0.022, 0.006);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(wx,  0.030, 0.036, 0.022, 0.006);
      ctx.fill();
    }

    /* ── MAIN WINGS ─────────────────────────────────────────  */
    // Port wing (negative y = up on canvas)
    ctx.beginPath();
    ctx.moveTo( 0.12, -0.058);
    ctx.bezierCurveTo( 0.08, -0.12,  -0.04, -0.36,  -0.14, -0.41);
    ctx.bezierCurveTo(-0.18, -0.41,  -0.22, -0.39,  -0.24, -0.36);
    ctx.bezierCurveTo(-0.16, -0.32,  -0.08, -0.14,  -0.08, -0.060);
    ctx.closePath();
    ctx.fillStyle = offWhite; ctx.fill(); ctx.stroke();

    // Starboard wing (positive y)
    ctx.beginPath();
    ctx.moveTo( 0.12,  0.058);
    ctx.bezierCurveTo( 0.08,  0.12,  -0.04,  0.36,  -0.14,  0.41);
    ctx.bezierCurveTo(-0.18,  0.41,  -0.22,  0.39,  -0.24,  0.36);
    ctx.bezierCurveTo(-0.16,  0.32,  -0.08,  0.14,  -0.08,  0.060);
    ctx.closePath();
    ctx.fillStyle = offWhite; ctx.fill(); ctx.stroke();

    /* ── ENGINE PODS ─────────────────────────────────────────  */
    function drawEngine(ex, ey) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.085, 0.026, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,210,230,0.92)';
      ctx.fill(); ctx.stroke();
      // intake
      ctx.beginPath();
      ctx.ellipse(0.062, 0, 0.020, 0.020, 0, 0, Math.PI * 2);
      ctx.fillStyle = goldTint;
      ctx.fill();
      ctx.restore();
    }
    drawEngine(-0.04, -0.22);
    drawEngine(-0.04,  0.22);

    /* ── H-STABS (rear) ─────────────────────────────────────  */
    // Port
    ctx.beginPath();
    ctx.moveTo(-0.38, -0.058);
    ctx.bezierCurveTo(-0.40, -0.08, -0.46, -0.15, -0.50, -0.17);
    ctx.bezierCurveTo(-0.52, -0.17, -0.54, -0.16, -0.55, -0.15);
    ctx.bezierCurveTo(-0.50, -0.12, -0.44, -0.06, -0.44, -0.058);
    ctx.closePath();
    ctx.fillStyle = offWhite; ctx.fill(); ctx.stroke();
    // Starboard
    ctx.beginPath();
    ctx.moveTo(-0.38,  0.058);
    ctx.bezierCurveTo(-0.40,  0.08, -0.46,  0.15, -0.50,  0.17);
    ctx.bezierCurveTo(-0.52,  0.17, -0.54,  0.16, -0.55,  0.15);
    ctx.bezierCurveTo(-0.50,  0.12, -0.44,  0.06, -0.44,  0.058);
    ctx.closePath();
    ctx.fillStyle = offWhite; ctx.fill(); ctx.stroke();

    /* ── WINGLETS ─────────────────────────────────────────── */
    function drawWinglet(wx, wy, sign) {
      ctx.beginPath();
      ctx.moveTo(wx, wy * sign);
      ctx.bezierCurveTo(wx - 0.025, (wy + 0.012) * sign, wx - 0.030, (wy + 0.020) * sign, wx - 0.015, (wy + 0.028) * sign);
      ctx.bezierCurveTo(wx - 0.005, (wy + 0.022) * sign, wx + 0.002, (wy + 0.010) * sign, wx, wy * sign);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,210,230,0.90)';
      ctx.fill(); ctx.stroke();
    }
    drawWinglet(-0.14,  0.41,  1);
    drawWinglet(-0.14,  0.41, -1);
  }

  /* ─── City names ─────────────────────────────────────────── */
  let CITY_NAMES = [];
  (function seedCities() {
    const fallback = [
      'Istanbul','London','Dubai','Tokyo','Paris','New York',
      'Singapore','Sydney','Berlin','Bangkok','Seoul','Cairo',
      'Amsterdam','Rome','Madrid','Zurich','Vienna','Athens',
      'Hong Kong','Mumbai','Delhi','Toronto','Moscow',
      'São Paulo','Nairobi','Lagos','Lisbon','Helsinki','Dublin',
    ];
    CITY_NAMES = (typeof AIRPORTS !== 'undefined') ? AIRPORTS.map(a => a.city) : fallback;
    for (let i = CITY_NAMES.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [CITY_NAMES[i], CITY_NAMES[j]] = [CITY_NAMES[j], CITY_NAMES[i]];
    }
  })();

  /* ─── Stripe helpers ─────────────────────────────────────── */
  function stripeCentreY(si) {
    const B = buildBounds();
    return ((B[si] + B[si + 1]) / 2) * H;
  }

  function getPosition(t, si) {
    const sy  = stripeCentreY(si);
    const dx  = Math.cos(-RAD);
    const dy  = Math.sin(-RAD);
    const len = W / dx;
    const extra = 200;
    const dist  = -extra + t * (len + extra * 2);
    return { x: dist * dx, y: sy + dist * dy };
  }

  function textCentre(si) {
    const B  = buildBounds();
    const mx = W * 0.50;
    const my = (edgeY(B[si], mx) + edgeY(B[si+1], mx)) / 2;
    return { x: mx, y: my };
  }

  /* ─── Plane class ────────────────────────────────────────── */
  let nameCursor = 0;

  class Plane {
    constructor(si, sz, sp) {
      this.si   = si;
      this.sz   = sz;
      this.sp   = sp;
      this.t    = 0;
      this.name = CITY_NAMES[nameCursor % CITY_NAMES.length];
      nameCursor++;
      this.ta   = 0;
      this.ts   = 'hidden';
      this.ws   = Math.min(W, H) * 0.155;
    }

    tick(dt) {
      this.t += dt * (1 / 39) * this.sp;
      const px = getPosition(this.t, this.si).x;
      if (this.ts === 'hidden' && px > -this.ws) {
        this.ts = 'fadingIn'; this.ta = 0;
      }
      if (this.ts === 'fadingIn') {
        this.ta = Math.min(1, this.ta + dt * 4.0);
        if (px > W * 0.85) this.ts = 'fadingOut';
      }
      if (this.ts === 'fadingOut') {
        this.ta = Math.max(0, this.ta - dt * 1.2);
        if (this.ta <= 0) this.ts = 'done';
      }
    }

    done() {
      return this.t > 1.08 && (this.ts === 'done' || this.ts === 'hidden');
    }

    drawText() {
      if (this.ts === 'hidden' || this.ts === 'done') return;
      const alpha = this.ta * 0.45;
      if (alpha <= 0) return;

      const B  = buildBounds();
      const sh = Math.abs(edgeY(B[this.si+1], W*0.5) - edgeY(B[this.si], W*0.5));
      const fs = Math.min(sh * 0.52, W * 0.056, 76);
      const c  = textCentre(this.si);
      const planePos = getPosition(this.t, this.si);

      const cos = Math.cos(-RAD);
      const sin = Math.sin(-RAD);
      const dx  = planePos.x - c.x;
      const dy  = planePos.y - c.y;
      const alongDiag = dx * cos + dy * sin;
      const revealEdge = alongDiag + this.ws * 0.25;
      const halfW = fs * this.name.length * 0.38;

      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(-RAD);
      ctx.beginPath();
      ctx.rect(-halfW - 20, -fs * 1.2, revealEdge + halfW + 20, fs * 2.4);
      ctx.clip();
      ctx.font         = `800 ${fs}px 'Syne', 'Space Grotesk', sans-serif`;
      // Gold text on dark stripes
      ctx.fillStyle    = 'rgba(232, 200, 122, 0.85)';
      ctx.textBaseline = 'middle';
      ctx.textAlign    = 'center';
      ctx.fillText(this.name, 0, 0);
      ctx.restore();
    }

    drawPlane() {
      const pos = getPosition(this.t, this.si);
      if (pos.x < -this.ws * 2 || pos.x > W + this.ws * 2) return;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-RAD);
      ctx.scale(this.ws, this.ws);
      drawPlaneTopDown(ctx);
      ctx.restore();
    }
  }

  /* ─── Plane pool ─────────────────────────────────────────── */
  const SPEEDS = [0.88, 1.00, 0.92, 1.05, 0.95];
  let planes = [];
  const GAP_T = 0.28;
  const gapTimer = new Array(N).fill(GAP_T);

  function spawn(si) {
    const p = new Plane(si, 1.0, SPEEDS[si % SPEEDS.length]);
    p.t = 0; p.ts = 'hidden'; p.ta = 0;
    planes.push(p);
  }

  const INIT_T = [0.00, 0.22, 0.44, 0.11, 0.33];
  for (let i = 0; i < N; i++) {
    const p = new Plane(i, 1.0, SPEEDS[i % SPEEDS.length]);
    p.t = INIT_T[i];
    const px = getPosition(p.t, i).x;
    if (px > -p.ws) { p.ts = 'fadingIn'; p.ta = 1.0; }
    planes.push(p);
    gapTimer[i] = GAP_T;
  }

  function updatePlanes(dt) {
    planes.forEach(p => p.tick(dt));
    for (let si = 0; si < N; si++) {
      const active = planes.filter(p => p.si === si && !p.done());
      if (active.length === 0) {
        gapTimer[si] += dt * (1 / 39) * SPEEDS[si % SPEEDS.length];
        if (gapTimer[si] >= GAP_T) { gapTimer[si] = 0; spawn(si); }
      } else {
        gapTimer[si] = 0;
      }
    }
    planes = planes.filter(p => !p.done());
  }

  /* ─── Animation loop ──────────────────────────────────────── */
  let lastT = null;
  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tick(now) {
    requestAnimationFrame(tick);
    if (noMotion) {
      drawBackground(); drawStripes(); drawUiShield();
      return;
    }
    const dt = lastT === null ? 0 : Math.min((now - lastT) / 1000, 0.06);
    lastT = now;
    updatePlanes(dt);
    drawBackground();
    drawStripes();
    planes.forEach(p => p.drawText());
    planes.forEach(p => p.drawPlane());
    drawUiShield();
  }

  requestAnimationFrame(tick);
  window.__flyScene = { canvas };

})();
