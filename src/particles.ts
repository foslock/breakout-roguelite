import type { Particle } from './types.ts';

export class ParticleSystem {
  private particles: Particle[] = [];

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.angle += p.spin * dt;
      p.life -= p.decay * dt;
      p.alpha = Math.max(0, p.life);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.square) {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Burst of particles when a brick is hit (but not destroyed). */
  brickHit(x: number, y: number, color: string): void {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        size: 2 + Math.random() * 2,
        color,
        alpha: 1,
        life: 1,
        decay: 2.5 + Math.random(),
        gravity: 80,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 6,
        square: true,
      });
    }
  }

  /** Big explosion when a brick is destroyed. */
  brickDestroy(x: number, y: number, w: number, h: number, color: string, chaosLevel: number): void {
    const count = 10 + chaosLevel * 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160 + chaosLevel * 20;
      const isSquare = Math.random() > 0.4;
      this.particles.push({
        x: x + Math.random() * w,
        y: y + Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: isSquare ? (3 + Math.random() * 5) : (2 + Math.random() * 3),
        color,
        alpha: 1,
        life: 1,
        decay: 0.9 + Math.random() * 0.8,
        gravity: 180,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 10,
        square: isSquare,
      });
    }

    // Extra glowing sparks at high chaos
    if (chaosLevel >= 2) {
      for (let i = 0; i < chaosLevel * 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 200;
        this.particles.push({
          x: x + w / 2,
          y: y + h / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          size: 1 + Math.random() * 2,
          color: '#ffffff',
          alpha: 1,
          life: 1,
          decay: 1.8 + Math.random(),
          gravity: 100,
          angle: 0,
          spin: 0,
          square: false,
        });
      }
    }
  }

  /** Ball trail spark. */
  ballSpark(x: number, y: number, hue: number, chaosLevel: number): void {
    if (Math.random() > 0.3 + chaosLevel * 0.15) return;
    const color = `hsl(${hue}, 100%, 70%)`;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      size: 1 + Math.random() * 2,
      color,
      alpha: 1,
      life: 1,
      decay: 4 + Math.random() * 3,
      gravity: 0,
      angle: 0,
      spin: 0,
      square: false,
    });
  }

  /** Paddle hit effect. */
  paddleHit(x: number, y: number, chaosLevel: number): void {
    const count = 5 + chaosLevel * 3;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: '#818cf8',
        alpha: 1,
        life: 1,
        decay: 2 + Math.random(),
        gravity: 60,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 8,
        square: true,
      });
    }
  }

  /** Ball lost effect. */
  ballLost(x: number, y: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: '#ff3366',
        alpha: 1,
        life: 1,
        decay: 1.2 + Math.random(),
        gravity: 80,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 8,
        square: Math.random() > 0.5,
      });
    }
  }

  /** Win celebration burst. */
  winCelebration(canvasW: number, canvasH: number): void {
    const colors = ['#00ff88', '#ffdd00', '#ff8800', '#ff3366', '#cc44ff', '#00cfff'];
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * canvasW;
      const y = canvasH * 0.2 + Math.random() * canvasH * 0.3;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        size: 3 + Math.random() * 5,
        color,
        alpha: 1,
        life: 1,
        decay: 0.5 + Math.random() * 0.5,
        gravity: 180,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 12,
        square: Math.random() > 0.4,
      });
    }
  }

  clear(): void {
    this.particles = [];
  }

  get count(): number {
    return this.particles.length;
  }
}
