/**
 * particles.js — the atmosphere engine. One canvas, many species:
 *
 *   smoke      volumetric perfume-fog in warm white / champagne / gold
 *   bokeh      large out-of-focus light discs drifting far behind
 *   dust       tiny golden motes with depth + scroll parallax
 *   sparkles   twinkling stars that appear, drift a few px, fade
 *   petals     twelve varieties — rose (white, red, burgundy, blush,
 *              cream, champagne, ivory, lilac, violet, lavender),
 *              sakura and chamomile — each with its own size, opacity,
 *              speed, rotation and depth
 *   nearPetals a handful of big blurred petals right at the camera,
 *              painted above everything for real depth of field
 *   butterflies depth-sorted, motion-blurred, physically wandering;
 *              occasional large fly-bys cross right past the lens
 *   burst      one-shot golden explosion (open button)
 *
 * Performance strategy: soft shapes (smoke/dust/bokeh/near-petal blurs)
 * are pre-rendered once to offscreen sprites and stamped with drawImage —
 * no per-frame gradients or filters. Counts scale with viewport area,
 * DPR is capped, the loop pauses on hidden tabs, and an adaptive governor
 * lowers density if a device cannot hold the frame budget.
 * Nothing runs under prefers-reduced-motion.
 */

export const REDUCED_MOTION =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ================= petal palette ==================================== */

/** [base fill, inner shade] per rose variety. */
const ROSE_PALETTES = [
  ['rgba(255,252,246,.96)', 'rgba(232,222,200,.9)'],   // white rose
  ['rgba(197,44,66,.94)', 'rgba(148,22,42,.9)'],       // red rose
  ['rgba(126,24,48,.94)', 'rgba(86,10,30,.9)'],        // burgundy rose
  ['rgba(247,184,197,.95)', 'rgba(226,146,164,.9)'],   // soft pink rose
  ['rgba(249,240,219,.95)', 'rgba(233,216,180,.9)'],   // cream rose
  ['rgba(243,226,193,.95)', 'rgba(224,199,155,.9)'],   // champagne
  ['rgba(252,248,238,.95)', 'rgba(236,226,204,.9)'],   // ivory
  ['rgba(206,170,214,.94)', 'rgba(176,136,188,.9)'],   // lilac rose
  ['rgba(164,116,182,.92)', 'rgba(130,84,150,.9)'],    // violet rose
  ['rgba(186,166,220,.93)', 'rgba(156,134,194,.9)'],   // lavender
];

/* ================= sprite factory (built once, stamped forever) ===== */

function glowSprite(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Irregular multi-blob fog sprite so smoke doesn't look like a circle. */
function smokeSprite(tint) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 5; i++) {
    const x = size / 2 + rand(-42, 42);
    const y = size / 2 + rand(-42, 42);
    const r = rand(52, 96);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return c;
}

function tracePetalPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.95);
  ctx.bezierCurveTo(s * 1.05, -s * 0.72, s * 0.92, s * 0.52, 0, s);
  ctx.bezierCurveTo(-s * 0.92, s * 0.52, -s * 1.05, -s * 0.72, 0, -s * 0.95);
}

/**
 * Pre-blurred rose petal for the near-camera depth-of-field layer.
 * ctx.filter runs ONCE here at build time — never in the frame loop.
 */
function blurredPetalSprite(base, shade) {
  const size = 176;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.filter = 'blur(9px)';
  ctx.translate(size / 2, size / 2);
  const s = 54;
  ctx.fillStyle = base;
  tracePetalPath(ctx, s);
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.globalAlpha = 0.4;
  tracePetalPath(ctx, s * 0.6);
  ctx.fill();
  return c;
}

const SPRITES = {
  dustDark: glowSprite(32, [[0, 'rgba(240,218,150,.9)'], [.35, 'rgba(225,190,110,.38)'], [1, 'rgba(225,190,110,0)']]),
  dustLight: glowSprite(32, [[0, 'rgba(176,141,46,.8)'], [.35, 'rgba(176,141,46,.3)'], [1, 'rgba(176,141,46,0)']]),
  spark: glowSprite(48, [[0, 'rgba(255,248,224,.9)'], [.4, 'rgba(240,214,140,.32)'], [1, 'rgba(240,214,140,0)']]),
  bokeh: glowSprite(128, [[0, 'rgba(243,222,158,.32)'], [.55, 'rgba(240,210,140,.16)'], [.82, 'rgba(236,204,130,.05)'], [1, 'rgba(236,204,130,0)']]),
  // warm halo stamped behind butterfly wings — golden glow in flight
  wingGlow: glowSprite(64, [[0, 'rgba(243,222,158,.5)'], [.45, 'rgba(236,204,130,.18)'], [1, 'rgba(236,204,130,0)']]),
  smoke: [
    smokeSprite('rgba(255,246,232,.05)'),  // warm white
    smokeSprite('rgba(241,226,194,.055)'), // champagne
    smokeSprite('rgba(232,210,160,.05)'),  // light gold
  ],
  nearPetals: ROSE_PALETTES.map(([base, shade]) => blurredPetalSprite(base, shade)),
};

/* ================= species drawing ================================== */

function drawSparkleStar(ctx, p, a) {
  ctx.globalAlpha = a;
  // soft halo under the star
  const halo = p.r * 3.2;
  ctx.drawImage(SPRITES.spark, p.x - halo / 2, p.y - halo / 2, halo, halo);
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const s = p.r * (0.72 + 0.28 * Math.sin(p.phase * 2.3));
  ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
  ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
  const d = s * 0.4;
  ctx.moveTo(p.x - d, p.y - d); ctx.lineTo(p.x + d, p.y + d);
  ctx.moveTo(p.x - d, p.y + d); ctx.lineTo(p.x + d, p.y - d);
  ctx.stroke();
}

function drawSakura(ctx, p, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.rot);
  ctx.scale(Math.max(0.22, Math.abs(Math.sin(p.tumble))), 1);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  const s = p.r;
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.9, -s * 0.7, s * 0.75, s * 0.55, 0.18 * s, s * 0.95);
  ctx.lineTo(0, s * 0.7);
  ctx.lineTo(-0.18 * s, s * 0.95);
  ctx.bezierCurveTo(-s * 0.75, s * 0.55, -s * 0.9, -s * 0.7, 0, -s);
  ctx.fill();
  ctx.restore();
}

function drawChamomile(ctx, p, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.rot);
  ctx.scale(Math.max(0.26, Math.abs(Math.sin(p.tumble))), 1);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = 'rgba(176,141,46,.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r * 0.42, p.r, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(233,203,110,.85)';
  ctx.beginPath();
  ctx.arc(0, p.r * 0.75, p.r * 0.16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Cupped rose petal — broad body with a darker inner shade. */
function drawRosePetal(ctx, p, x, y) {
  const alpha = ctx.globalAlpha;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.rot);
  ctx.scale(Math.max(0.26, Math.abs(Math.sin(p.tumble))), 1);
  ctx.fillStyle = p.color;
  tracePetalPath(ctx, p.r);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.38;
  ctx.fillStyle = p.shade;
  tracePetalPath(ctx, p.r * 0.58);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = alpha;
}

function drawButterflyShape(ctx, b, time, x, y, alpha) {
  const flap = Math.sin(time * b.flapSpeed + b.phase);
  const wing = 0.28 + 0.72 * Math.abs(flap);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.angle + Math.sin(time * 0.9 + b.phase) * 0.12);
  const s = (b.size * b.z) / 16;
  ctx.scale(s, s);
  // soft golden halo under the wings — brightens as the wings open
  ctx.globalAlpha = alpha * (0.3 + 0.4 * Math.abs(flap));
  ctx.drawImage(SPRITES.wingGlow, -21, -19, 42, 38);
  ctx.globalAlpha = alpha;

  const wingShape = () => {
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.bezierCurveTo(9, -15, 18, -8, 14, -1);
    ctx.bezierCurveTo(12, 1, 5, 1, 2, 0.5);
    ctx.moveTo(1.5, 1.5);
    ctx.bezierCurveTo(10, 4, 12, 12, 6, 13);
    ctx.bezierCurveTo(2, 13.5, 0.5, 7, 0.5, 3);
    ctx.fill();
  };

  const grad = ctx.createLinearGradient(0, -14, 0, 14);
  grad.addColorStop(0, b.colorTop);
  grad.addColorStop(1, b.colorBottom);
  ctx.fillStyle = grad;
  ctx.save(); ctx.scale(-wing, 1); wingShape(); ctx.restore();
  ctx.save(); ctx.scale(wing, 1); wingShape(); ctx.restore();

  ctx.fillStyle = b.body;
  ctx.beginPath();
  ctx.ellipse(0, 1, 1.2, 6.2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ================= the field ======================================== */

export class ParticleField {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { theme, dust, sparkles, sakura, chamomile,
   *                        roses, smoke, bokeh, butterflies } — densities
   *                        per Mpx² (butterflies: boolean)
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = {
      theme: 'dark',
      dust: 120, sparkles: 30, sakura: 0, chamomile: 0, roses: 0,
      smoke: 8, bokeh: 6,
      butterflies: false,
      ...opts,
    };
    this.parts = {
      smoke: [], bokeh: [], dust: [], sparkles: [],
      sakura: [], chamomile: [], roses: [], nearPetals: [],
      butterflies: [], flybys: [], burst: [],
    };
    this.running = false;
    this.petalsOn = this.opts.sakura > 0 || this.opts.chamomile > 0 || this.opts.roses > 0;
    this.density = 1;          // adaptive quality governor
    this._frames = 0;
    this._ema = 16;
    this._raf = 0;
    this._last = 0;
    // wind gusts — a breeze that suddenly picks petals up
    this._gustT = rand(4, 9);
    this._gustAge = 1e3;
    this._gustDur = 1;
    this._gustStr = 0;
    this._flybyT = rand(4, 9);
    this._onResize = () => this.resize();
    this._onVis = () => (document.hidden ? this._pause() : this._resume());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this._populate();
  }

  _count(perMpx, cap) {
    return Math.min(cap, Math.round((this.w * this.h) / 1_000_000 * perMpx * this.density));
  }

  _populate() {
    const o = this.opts;
    const fill = (arr, target, make) => {
      arr.length = Math.min(arr.length, target);
      while (arr.length < target) arr.push(make());
    };
    fill(this.parts.smoke, this._count(o.smoke, 20), () => this._makeSmoke());
    fill(this.parts.bokeh, this._count(o.bokeh, 14), () => this._makeBokeh());
    fill(this.parts.dust, this._count(o.dust, 520), () => this._makeDust());
    fill(this.parts.sparkles, this._count(o.sparkles, 130), () => this._makeSparkle());
    if (this.petalsOn) {
      fill(this.parts.sakura, this._count(o.sakura, 160), () => this._makeSakura(true));
      fill(this.parts.chamomile, this._count(o.chamomile, 90), () => this._makeChamomile(true));
      fill(this.parts.roses, this._count(o.roses, 230), () => this._makeRose(true));
      // near-camera blurred petals: few, big, unmistakably cinematic
      const nearCount = o.roses > 0 ? Math.min(14, Math.max(5, Math.round(this.w / 220))) : 0;
      fill(this.parts.nearPetals, nearCount, () => this._makeNearPetal(true));
    }
    const bCount = o.butterflies ? Math.min(26, Math.max(10, Math.round(this.w / 82 * this.density))) : 0;
    fill(this.parts.butterflies, bCount, () => this._makeButterfly());
    // near butterflies painted last (on top)
    this.parts.butterflies.sort((a, b) => a.z - b.z);
  }

  /* ---------- makers -------------------------------------------- */

  _makeSmoke() {
    return {
      x: rand(-100, this.w + 100),
      y: rand(this.h * 0.1, this.h + 80),
      z: rand(0.6, 1.5),
      sprite: pick(SPRITES.smoke),
      scale: rand(1.4, 3.4),          // of a 256px sprite
      rot: rand(0, TAU), rotV: rand(-0.03, 0.03),
      vx: rand(-7, 7), vy: rand(-9, -3.5),
      alpha: this.opts.theme === 'dark' ? rand(0.5, 1) : rand(0.35, 0.7),
      phase: rand(0, TAU),
    };
  }

  _makeBokeh() {
    return {
      x: rand(0, this.w), y: rand(0, this.h),
      r: rand(34, 110),
      vx: rand(-4, 4), vy: rand(-6, -2),
      alpha: this.opts.theme === 'dark' ? rand(0.14, 0.4) : rand(0.08, 0.2),
      phase: rand(0, TAU), pulse: rand(0.15, 0.5),
    };
  }

  _makeDust() {
    return {
      x: rand(0, this.w), y: rand(0, this.h),
      z: rand(0.45, 1.6),                     // depth: speed, size, parallax
      r: rand(0.7, 2.1),
      vx: rand(-5, 5), vy: rand(-11, -3),
      alpha: (this.opts.theme === 'dark' ? rand(0.3, 0.75) : rand(0.18, 0.42)),
      phase: rand(0, TAU), pulse: rand(0.5, 1.7),
    };
  }

  _makeSparkle() {
    const dark = this.opts.theme === 'dark';
    return {
      x: rand(0, this.w), y: rand(0, this.h),
      r: rand(2, 8.5),
      vx: rand(-7, 7), vy: rand(-7, 7),       // slow drift before dying
      alpha: dark ? rand(0.45, 1) : rand(0.28, 0.6),
      color: dark ? 'rgba(248,236,200,.95)' : 'rgba(176,141,46,.9)',
      phase: rand(0, TAU),
      life: rand(0, 1), lifeV: rand(0.22, 0.5), // full cycle 2–4.5s
      delay: rand(0, 3),                        // staggered first appearance
    };
  }

  _petalBase(seedAnywhere) {
    const fast = Math.random() < 0.22;         // some petals fall quickly
    return {
      x: rand(-40, this.w + 40),
      y: seedAnywhere ? rand(-this.h, this.h) : rand(-80, -12),
      z: rand(0.55, 1.5),
      rot: rand(0, TAU), rotV: rand(-1.3, 1.3),
      tumble: rand(0, TAU), tumbleV: rand(1, 3),
      swayPhase: rand(0, TAU), sway: rand(10, 42),
      drift: rand(-14, 20),                    // personal sideways bias
      vy: fast ? rand(52, 86) : rand(16, 40),
      gustBite: rand(0.5, 1.6),                // how strongly gusts grab it
      landed: false, landT: 0,
      willLand: Math.random() < 0.3,           // some rest before dissolving
    };
  }

  _makeSakura(seedAnywhere) {
    return {
      ...this._petalBase(seedAnywhere),
      kind: 'sakura',
      r: rand(3.5, 12),
      alpha: rand(0.35, 0.9),
      color: `rgba(${(rand(226, 246)) | 0},${(rand(162, 192)) | 0},${(rand(178, 202)) | 0},1)`,
    };
  }

  _makeChamomile(seedAnywhere) {
    return {
      ...this._petalBase(seedAnywhere),
      kind: 'chamomile',
      r: rand(4, 12.5),
      alpha: rand(0.4, 0.9),
      color: 'rgba(255,254,248,.96)',
    };
  }

  _makeRose(seedAnywhere) {
    const paletteIdx = (Math.random() * ROSE_PALETTES.length) | 0;
    const [color, shade] = ROSE_PALETTES[paletteIdx];
    return {
      ...this._petalBase(seedAnywhere),
      kind: 'rose',
      r: rand(4, 16),
      alpha: rand(0.38, 0.92),
      color, shade, paletteIdx,
    };
  }

  /** Big blurred petal drifting right past the lens. */
  _makeNearPetal(seedAnywhere) {
    return {
      x: rand(-60, this.w + 60),
      y: seedAnywhere ? rand(-this.h * 0.8, this.h) : rand(-220, -80),
      paletteIdx: (Math.random() * SPRITES.nearPetals.length) | 0,
      r: rand(38, 88),                          // on-screen half-size
      rot: rand(0, TAU), rotV: rand(-0.7, 0.7),
      tumble: rand(0, TAU), tumbleV: rand(0.5, 1.4),
      swayPhase: rand(0, TAU), sway: rand(30, 80),
      drift: rand(-30, 40),
      vy: rand(60, 160),
      gustBite: rand(1.2, 2.4),
      alpha: rand(0.28, 0.55),
    };
  }

  _makeButterfly() {
    // Depth first — it shapes everything else about the butterfly.
    const z = rand(0.45, 2.2);
    const leftSide = Math.random() < 0.5;
    const hx = leftSide ? rand(this.w * 0.03, this.w * 0.3) : rand(this.w * 0.7, this.w * 0.97);
    const hy = rand(this.h * 0.08, this.h * 0.9);
    // A quarter of the flock wears ivory-blush instead of gold.
    const ivory = Math.random() < 0.25;
    return {
      x: hx, y: hy, homeX: hx, homeY: hy, side: leftSide,
      vx: 0, vy: 0,
      z,
      angle: rand(-0.4, 0.4),
      size: rand(6, 22),
      alpha: z < 0.85 ? rand(0.4, 0.62) : rand(0.78, 0.98),
      flapSpeed: rand(3.5, 15), phase: rand(0, TAU),
      wander: rand(0, TAU),
      retarget: rand(2, 6.5),                  // curved journeys between homes
      colorTop: ivory ? 'rgba(248,238,226,.95)' : 'rgba(238,216,150,.95)',
      colorBottom: ivory ? 'rgba(216,182,150,.9)' : 'rgba(186,140,58,.9)',
      body: 'rgba(90,66,20,.95)',
      mode: 'hover',
      delay: 0, t: 0,
    };
  }

  /** A large butterfly sweeping right past the camera, then gone. */
  _makeFlyby() {
    const fromLeft = Math.random() < 0.5;
    const ivory = Math.random() < 0.35;
    return {
      x: fromLeft ? -80 : this.w + 80,
      y: rand(this.h * 0.15, this.h * 0.8),
      vx: (fromLeft ? 1 : -1) * rand(230, 460),
      vy: rand(-30, 30),
      z: rand(2.3, 3.5),
      angle: 0,
      size: rand(14, 26),
      alpha: rand(0.38, 0.55),                 // close = out of focus = softer
      flapSpeed: rand(8, 13), phase: rand(0, TAU),
      bobPhase: rand(0, TAU),
      colorTop: ivory ? 'rgba(248,238,226,.95)' : 'rgba(238,216,150,.95)',
      colorBottom: ivory ? 'rgba(216,182,150,.9)' : 'rgba(186,140,58,.9)',
      body: 'rgba(90,66,20,.95)',
      fromLeft,
    };
  }

  /* ---------- public actions ------------------------------------ */

  start() {
    if (REDUCED_MOTION || this.running) return;
    this.running = true;
    this.resize();
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVis);
    this._last = performance.now();
    this._loop(this._last);
  }

  _pause() { cancelAnimationFrame(this._raf); }
  _resume() {
    if (!this.running) return;
    this._last = performance.now();
    this._loop(this._last);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
  }

  /**
   * Butterflies explode outward from a point — near ones blast past
   * the camera, distant ones scatter slower, all with a slight stagger
   * so it reads as a startled flock, not a synchronized effect.
   */
  explodeFrom(x, y) {
    for (const b of this.parts.butterflies) {
      b.mode = 'explode';
      b.t = 0;
      b.delay = rand(0, 0.28);
      let a = Math.atan2(b.y - y, b.x - x);
      if (!Number.isFinite(a)) a = rand(0, TAU);
      a += rand(-0.35, 0.35) - 0.25;           // slight upward bias
      b.escapeAngle = a;
      b.escapeTurn = rand(-1.4, 1.4);          // spiral curl
      b.escapeSpeed = rand(260, 520) * (0.6 + b.z * 0.55);
      b.flapSpeed = rand(12, 17);
    }
  }

  /** One-shot golden burst (open button dissolve). */
  burstAt(x, y, count = 40) {
    if (REDUCED_MOTION) return;
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(50, 300);
      this.parts.burst.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        r: rand(1, 3.4),
        life: 1, decay: rand(0.45, 1.1),
      });
    }
  }

  startPetals() {
    this.petalsOn = true;
    this._populate();
  }

  /* ---------- simulation ----------------------------------------- */

  _governor(dt) {
    // Exponential moving average of the frame time; if a device can't
    // hold ~45fps, shed 25% of the particles (repeatedly, floor 40%).
    this._ema = this._ema * 0.96 + dt * 1000 * 0.04;
    if (++this._frames % 150 === 0 && this._ema > 22 && this.density > 0.4) {
      this.density = Math.max(0.4, this.density * 0.75);
      this._populate();
    }
  }

  _loop(now) {
    this._raf = requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    const time = now / 1000;
    const { ctx } = this;
    this._governor(dt);

    // Gentle global wind — everything breathes together …
    let wind = Math.sin(time * 0.13) * 14 + Math.sin(time * 0.047) * 9;
    // … and sometimes a real gust sweeps through and picks petals up.
    this._gustT -= dt;
    if (this._gustT <= 0) {
      this._gustT = rand(6, 14);
      this._gustDur = rand(1.4, 2.8);
      this._gustAge = 0;
      this._gustStr = rand(34, 85) * (Math.random() < 0.5 ? -1 : 1);
    }
    this._gustAge += dt;
    const gust = this._gustAge < this._gustDur
      ? Math.sin(Math.PI * this._gustAge / this._gustDur) * this._gustStr
      : 0;
    wind += gust * 0.45;

    // Scroll parallax for the ambient layer (fixed canvas, page scrolls).
    const scrollY = this.opts.theme === 'light' ? window.scrollY : 0;

    ctx.clearRect(0, 0, this.w, this.h);

    /* bokeh — the farthest layer, big soft light discs */
    for (const p of this.parts.bokeh) {
      p.x += (p.vx + wind * 0.12) * dt;
      p.y += p.vy * dt;
      p.phase += p.pulse * dt;
      if (p.y < -p.r * 2) { p.y = this.h + p.r; p.x = rand(0, this.w); }
      if (p.x < -p.r * 2) p.x = this.w + p.r;
      if (p.x > this.w + p.r * 2) p.x = -p.r;
      const s = p.r * 2;
      ctx.globalAlpha = p.alpha * (0.65 + 0.35 * Math.sin(p.phase));
      ctx.drawImage(SPRITES.bokeh, p.x - s / 2, p.y - s / 2 - scrollY * 0.02, s, s);
    }

    /* smoke — painted behind everything that moves fast */
    for (const p of this.parts.smoke) {
      p.x += (p.vx + wind * 0.25) * p.z * dt;
      p.y += p.vy * p.z * dt;
      p.rot += p.rotV * dt;
      p.phase += dt * 0.3;
      const size = 256 * p.scale * p.z;
      if (p.y < -size) { p.y = this.h + size * 0.4; p.x = rand(-100, this.w + 100); }
      if (p.x < -size) p.x = this.w + size * 0.5;
      if (p.x > this.w + size) p.x = -size * 0.5;
      ctx.save();
      ctx.globalAlpha = p.alpha * (0.75 + 0.25 * Math.sin(p.phase));
      ctx.translate(p.x, p.y - scrollY * (p.z - 1) * 0.04);
      ctx.rotate(p.rot);
      ctx.drawImage(p.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    /* dust */
    const dustSprite = this.opts.theme === 'dark' ? SPRITES.dustDark : SPRITES.dustLight;
    for (const p of this.parts.dust) {
      p.x += (p.vx + wind * 0.3) * p.z * dt;
      p.y += p.vy * p.z * dt;
      p.phase += p.pulse * dt;
      if (p.y < -12) { p.y = this.h + 12; p.x = rand(0, this.w); }
      if (p.x < -12) p.x = this.w + 12;
      if (p.x > this.w + 12) p.x = -12;
      const yd = p.y - scrollY * (p.z - 1) * 0.06;
      const s = p.r * 6 * p.z;
      ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
      ctx.drawImage(dustSprite, p.x - s / 2, yd - s / 2, s, s);
    }

    /* sparkles — appear, twinkle, wander a few px, dissolve */
    for (const p of this.parts.sparkles) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.phase += dt * 3;
      p.life += p.lifeV * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life >= 1) Object.assign(p, this._makeSparkle(), { life: 0, delay: 0 });
      const envelope = Math.sin(p.life * Math.PI);   // fade in → out
      drawSparkleStar(ctx, p, p.alpha * envelope);
    }

    /* petals */
    const stepPetal = (p, draw, remake) => {
      if (p.landed) {
        // Rest on the ground for a beat, then dissolve.
        p.landT += dt;
        p.tumble += dt * 0.6;
        const fade = Math.max(0, 1 - Math.max(0, p.landT - 0.7) / 0.9);
        if (fade <= 0) { Object.assign(p, remake()); return; }
        ctx.globalAlpha = p.alpha * fade;
        draw(ctx, p, p.x, p.y);
        return;
      }
      p.swayPhase += dt;
      p.x += (Math.sin(p.swayPhase) * p.sway + p.drift + wind * p.gustBite) * p.z * dt;
      // gusts also give petals a moment of lift
      p.y += (p.vy - Math.abs(gust) * 0.35 * p.gustBite) * p.z * dt;
      p.rot += p.rotV * dt;
      p.tumble += p.tumbleV * dt;
      if (p.x < -60) p.x = this.w + 50;
      if (p.x > this.w + 60) p.x = -50;
      if (p.y > this.h - rand(4, 18)) {
        if (p.willLand && !p.landed) { p.landed = true; p.landT = 0; return; }
        if (p.y > this.h + 26) { Object.assign(p, remake()); return; }
      }
      if (p.y < -this.h * 0.5) p.y = this.h + 20;   // lifted off the top — recycle
      ctx.globalAlpha = p.alpha * Math.min(1, 0.55 + p.z * 0.45);
      draw(ctx, p, p.x, p.y - scrollY * (p.z - 1) * 0.05);
    };
    for (const p of this.parts.sakura) stepPetal(p, drawSakura, () => this._makeSakura(false));
    for (const p of this.parts.chamomile) stepPetal(p, drawChamomile, () => this._makeChamomile(false));
    for (const p of this.parts.roses) stepPetal(p, drawRosePetal, () => this._makeRose(false));

    /* butterflies (depth-sorted at populate; far → near) */
    for (const b of this.parts.butterflies) {
      if (b.mode === 'hover') {
        b.retarget -= dt;
        if (b.retarget <= 0) {
          // A new destination on the same side → long curved journeys.
          b.retarget = rand(2.5, 6);
          b.homeX = b.side
            ? rand(this.w * 0.03, this.w * 0.32)
            : rand(this.w * 0.68, this.w * 0.97);
          b.homeY = rand(this.h * 0.08, this.h * 0.9);
        }
        b.wander += rand(-1.7, 1.7) * dt;
        const pullX = (b.homeX - b.x) * 0.5;
        const pullY = (b.homeY - b.y) * 0.5;
        b.vx += (Math.cos(b.wander) * 30 + pullX + gust * 0.3) * dt;
        b.vy += (Math.sin(b.wander * 0.8) * 24 + pullY) * dt;
        b.vx *= 0.985; b.vy *= 0.985;
        b.x += b.vx * b.z * dt;
        b.y += b.vy * b.z * dt + Math.sin(time * 2.2 + b.phase) * 9 * dt;
        b.angle = Math.max(-0.5, Math.min(0.5, b.vx * 0.02));
      } else {
        b.t += dt;
        if (b.t < b.delay) { drawButterflyShape(ctx, b, time, b.x, b.y, b.alpha); continue; }
        const tt = b.t - b.delay;
        const sp = b.escapeSpeed * Math.min(1, tt * 1.8);   // natural acceleration
        b.escapeAngle += b.escapeTurn * 0.4 * dt;
        b.vx = Math.cos(b.escapeAngle) * sp;
        b.vy = Math.sin(b.escapeAngle) * sp - 70;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.z > 1.15) b.z *= 1 + 1.1 * dt;                // blasts past the camera
        b.angle = Math.atan2(b.vy, b.vx) * 0.22;
        if (tt > 1.1) b.alpha = Math.max(0, b.alpha - 1.5 * dt);
      }

      // Motion blur: fast butterflies leave two fading ghosts.
      const speed = Math.hypot(b.vx, b.vy) * b.z;
      if (speed > 150 && b.alpha > 0.05) {
        const gx = b.vx * 0.016, gy = b.vy * 0.016;
        drawButterflyShape(ctx, b, time, b.x - gx * 2, b.y - gy * 2, b.alpha * 0.14);
        drawButterflyShape(ctx, b, time, b.x - gx, b.y - gy, b.alpha * 0.3);
      }
      if (b.alpha > 0.01) drawButterflyShape(ctx, b, time, b.x, b.y, b.alpha);
    }

    /* fly-bys — rare large butterflies crossing right past the lens */
    if (this.opts.butterflies) {
      this._flybyT -= dt;
      if (this._flybyT <= 0) {
        this._flybyT = rand(7, 13);
        this.parts.flybys.push(this._makeFlyby());
      }
    }
    if (this.parts.flybys.length) {
      this.parts.flybys = this.parts.flybys.filter((b) =>
        b.fromLeft ? b.x < this.w + 120 : b.x > -120);
      for (const b of this.parts.flybys) {
        b.bobPhase += dt * 2.4;
        b.x += b.vx * dt;
        b.y += (b.vy + Math.sin(b.bobPhase) * 46) * dt;
        b.angle = (b.fromLeft ? 1 : -1) * 0.18 + Math.sin(b.bobPhase) * 0.1;
        const gx = b.vx * 0.02, gy = 0;
        drawButterflyShape(ctx, b, time, b.x - gx * 2, b.y - gy, b.alpha * 0.14);
        drawButterflyShape(ctx, b, time, b.x - gx, b.y - gy, b.alpha * 0.3);
        drawButterflyShape(ctx, b, time, b.x, b.y, b.alpha);
      }
    }

    /* near-camera petals — the closest layer, painted above all */
    for (const p of this.parts.nearPetals) {
      p.swayPhase += dt;
      p.x += (Math.sin(p.swayPhase) * p.sway + p.drift + wind * p.gustBite) * dt;
      p.y += (p.vy - Math.abs(gust) * 0.5 * p.gustBite) * dt;
      p.rot += p.rotV * dt;
      p.tumble += p.tumbleV * dt;
      if (p.y > this.h + 180 || p.x < -240 || p.x > this.w + 240) {
        Object.assign(p, this._makeNearPetal(false));
        continue;
      }
      const sprite = SPRITES.nearPetals[p.paletteIdx];
      const squish = Math.max(0.3, Math.abs(Math.sin(p.tumble)));
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y - scrollY * 0.12);
      ctx.rotate(p.rot);
      ctx.scale(squish, 1);
      const s = p.r * 3.2;                     // sprite petal fills ~60% of canvas
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
    }

    /* golden burst */
    if (this.parts.burst.length) {
      this.parts.burst = this.parts.burst.filter((p) => p.life > 0);
      for (const p of this.parts.burst) {
        p.vx *= 0.96; p.vy = p.vy * 0.96 + 60 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= p.decay * dt;
        ctx.globalAlpha = Math.max(0, p.life);
        const s = p.r * 5;
        ctx.drawImage(SPRITES.spark, p.x - s / 2, p.y - s / 2, s, s);
      }
    }

    ctx.globalAlpha = 1;
  }
}
