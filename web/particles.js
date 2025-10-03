// Overlay de partículas para la barra de HP del jefe.
// Usa un <canvas> posicionado encima de la barra y spawnea 2–4 partículas dentro del "chunk" visible.
// El shimmer principal está en CSS (clase .shimmer); esto solo añade vida sutil (puntitos ascendentes).

export class BossHpParticles {
  constructor(containerEl, chunkEl, canvasEl) {
    this.container = containerEl;
    this.chunk = chunkEl;
    this.canvas = canvasEl;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.phase = 0;
    this.paused = false;
    this.lastT = 0;

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(this.container);
    this._resize();

    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  setProgress(val, max) {
    this.value = Math.max(0, val|0);
    this.max = Math.max(1, max|0);
    // Si no hay HP, pausar efectos
    if (this.value <= 0) this.setPaused(true);
    else this.setPaused(false);
  }

  setPaused(p) { this.paused = !!p; }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _spawn() {
    // mantener 2–4 partículas vivas; spawnear dentro del chunk
    const alive = this.particles.filter(p => p.life > 0 && p.y >= 2);
    this.particles = alive;
    const want = 4 - this.particles.length;
    const tries = Math.max(0, want);

    const contW = this.container.clientWidth;
    const contH = this.container.clientHeight;
    const chunkW = this.chunk.clientWidth - 6;

    for (let i = 0; i < tries; i++) {
      if (chunkW <= 12 || Math.random() > 0.35) continue;
      const y = 3 + Math.random() * Math.max(1, contH - 6);
      const x = 4 + Math.random() * Math.max(1, chunkW);
      this.particles.push({
        x, y,
        vy: -0.3 - Math.random()*0.5,
        life: 1.0,
        alpha: 0.5 + Math.random()*0.4,
        r: 1.0 + Math.random()*1.2
      });
    }
  }

  _step(dt) {
    // shimmer extra ligero con alpha variable (opcional)
    // partículas
    for (const p of this.particles) {
      p.y += p.vy * dt * 60;  // normalizar a 60fps
      p.life -= 0.02 * dt * 60;
      if (p.life < 0) p.life = 0;
    }
    this.particles = this.particles.filter(p => p.life > 0 && p.y >= 2);
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Clip al chunk
    const clipW = Math.max(0, this.chunk.clientWidth - 4);
    if (clipW <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(2, 2, clipW, h - 4);
    ctx.clip();

    // Partículas (puntitos blancos suaves)
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.alpha * p.life));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r, 0, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }

  _tick(ts) {
    const dt = this.lastT ? (ts - this.lastT) / 1000 : 0;
    this.lastT = ts;

    if (!this.paused) {
      if (document.visibilityState === 'visible') {
        this._spawn();
        this._step(Math.max(0.016, dt)); // ~60fps clamp
        this._draw();
      }
    }
    requestAnimationFrame(this._tick);
  }
}

