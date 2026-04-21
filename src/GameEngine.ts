import type {
  GameState, Ball, Paddle, Brick, ScreenFlash,
  RoundSummary, ShopScrollState, UpgradeCard, PlayerState,
} from './types.ts';
import { ParticleSystem } from './particles.ts';
import { generateLevel } from './levelgen.ts';
import { getDerivedStats, buyUpgrade, UPGRADES } from './upgrades.ts';
import { loadState, saveState, clearState } from './persistence.ts';
import { stepPhysics, movePaddleToward, clampPaddle } from './physics.ts';
import {
  drawBackground, drawBricks, drawPaddle, drawBalls,
  drawParticles, applyScreenFlash, drawHUD, drawLaunchPrompt,
  drawTitleScreen, drawRoundSummary, drawShop,
} from './renderer.ts';
import {
  BALL_BASE_SPEED, BALL_SPEED_PER_ROUND, BALL_MAX_SPEED,
  BALL_RADIUS, BALL_TRAIL_LENGTH, PADDLE_HEIGHT, PADDLE_BOTTOM_OFFSET,
  MAX_BALLS, WIN_BONUS_PERCENT, SHOP_FOOTER_H, SHOP_HEADER_H,
  SHOP_CARD_H, SHOP_CARD_GAP, SHOP_PADDING, SHOP_MAX_CONTENT_W,
} from './constants.ts';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  private state: GameState = 'TITLE';
  onStateChange: ((state: GameState) => void) | null = null;

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange?.(s);
  }
  private playerState!: PlayerState;

  // Round-time state
  private balls: Ball[] = [];
  private paddle!: Paddle;
  private bricks: Brick[] = [];
  private particles = new ParticleSystem();
  private screenFlash: ScreenFlash = { r: 0, g: 0, b: 0, alpha: 0, decay: 2 };
  private roundPoints = 0;
  private roundBricksDestroyed = 0;
  private roundTotalBricks = 0;
  private ballIdCounter = 0;

  // Summary state
  private roundSummary!: RoundSummary;
  private summaryTimer = 0;
  private summaryContinueAlpha = 0;

  // Shop state
  private shopScroll: ShopScrollState = { y: 0, vy: 0, touchStartY: 0, touchLastY: 0, isTouching: false, maxScroll: 0 };
  private shopCards: UpgradeCard[] = [];
  private shopBuyMessage = '';
  private shopBuyMessageTimer = 0;

  // Input
  private pointerX = 0;
  private isPointerDown = false;
  private lastPointerX = 0;

  // Auto-pilot
  private autoPaddleOffset = 0;
  private autoPaddleOffsetTarget = 0;
  private autoPaddleOffsetTimer = 0;

  // Background energy (driven by hits, decays over time)
  private bgEnergy = 0;

  // Timing
  private lastTime = 0;
  private time = 0;
  private animId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;

    this.resize();
    this.playerState = loadState();

    this.bindEvents();
    window.addEventListener('resize', () => this.resize());
  }

  // ─── Canvas sizing ──────────────────────────────────────────────────────────

  private get W(): number { return this.canvas.width / this.dpr; }
  private get H(): number { return this.canvas.height / this.dpr; }

  private resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(this.dpr, this.dpr);

    if (this.state === 'LAUNCH' || this.state === 'PLAYING') {
      this.repositionEntities();
    }
  }

  private repositionEntities(): void {
    const stats = getDerivedStats(this.playerState);

    // Reposition paddle
    this.paddle.width = stats.paddleWidth;
    this.paddle.y = this.H - PADDLE_BOTTOM_OFFSET;
    this.paddle.x = Math.max(0, Math.min(this.W - this.paddle.width, this.paddle.x));

    // Reposition bricks (scale x positions to new width)
    this.bricks = generateLevel(this.W, stats, this.playerState.round * 31337);
  }

  // ─── Event binding ──────────────────────────────────────────────────────────

  private bindEvents(): void {
    // Mouse
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
      this.lastPointerX = this.pointerX;
      this.isPointerDown = true;
      this.handlePointerDown(e.clientX - rect.left, e.clientY - rect.top);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.handlePointerUp(e.clientX - rect.left, e.clientY - rect.top);
      this.isPointerDown = false;
    });

    // Touch
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = t.clientX - rect.left;
      this.lastPointerX = this.pointerX;
      this.isPointerDown = true;
      this.handlePointerDown(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = t.clientX - rect.left;
      this.handlePointerMove(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.handlePointerUp(t.clientX - rect.left, t.clientY - rect.top);
      this.isPointerDown = false;
    }, { passive: false });

    // Keyboard (desktop)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  this.paddle.x = Math.max(0, this.paddle.x - 10);
      if (e.key === 'ArrowRight') this.paddle.x = Math.min(this.W - this.paddle.width, this.paddle.x + 10);
      if (e.key === ' ' || e.key === 'Enter') this.handleAction();
      if (e.key === 'r' && e.shiftKey) { clearState(); this.playerState = loadState(); this.setState('TITLE'); }
    });
  }

  // ─── Input routing ──────────────────────────────────────────────────────────

  private handlePointerDown(x: number, y: number): void {
    if (this.state === 'SHOP') {
      this.shopScroll.touchStartY = y;
      this.shopScroll.touchLastY = y;
      this.shopScroll.isTouching = true;
      this.shopScroll.vy = 0;
    }
  }

  private handlePointerMove(x: number, y: number): void {
    if (this.state === 'SHOP' && this.shopScroll.isTouching) {
      const dy = y - this.shopScroll.touchLastY;
      this.shopScroll.y += dy;
      this.shopScroll.vy = dy / 0.016; // approximate velocity
      this.shopScroll.touchLastY = y;
      this.clampShopScroll();
    }
  }

  private handlePointerUp(x: number, y: number): void {
    if (this.state === 'TITLE' || this.state === 'ROUND_SUMMARY') {
      this.handleAction();
      return;
    }

    if (this.state === 'LAUNCH') {
      this.launchBalls();
      return;
    }

    if (this.state === 'SHOP') {
      this.shopScroll.isTouching = false;

      // If barely scrolled, treat as a click
      const scrollDelta = Math.abs(y - this.shopScroll.touchStartY);
      if (scrollDelta < 8) {
        this.handleShopClick(x, y);
      }
    }
  }

  private handleAction(): void {
    if (this.state === 'TITLE') {
      this.startRound();
    } else if (this.state === 'ROUND_SUMMARY' && this.summaryContinueAlpha > 0.5) {
      this.goToShop();
    }
  }

  private handleShopClick(x: number, y: number): void {
    // Check start round button
    const btnW = Math.min(220, this.W - 40);
    const btnX = (this.W - btnW) / 2;
    const btnY = this.H - SHOP_FOOTER_H + 16;
    const btnH = 38;

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      this.startRound();
      return;
    }

    // Check upgrade cards
    for (const card of this.shopCards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        const bought = buyUpgrade(this.playerState, card.upgradeId);
        if (bought) {
          saveState(this.playerState);
          this.triggerFlash(251, 191, 36, 0.3);
        }
        return;
      }
    }
  }

  // ─── Round management ───────────────────────────────────────────────────────

  private startRound(): void {
    const stats = getDerivedStats(this.playerState);

    // Generate level
    this.bricks = generateLevel(this.W, stats, this.playerState.round * 31337 + 7);
    this.roundTotalBricks = this.bricks.length;
    this.roundBricksDestroyed = 0;
    this.roundPoints = 0;

    // Create paddle
    this.paddle = {
      x: (this.W - stats.paddleWidth) / 2,
      y: this.H - PADDLE_BOTTOM_OFFSET,
      width: stats.paddleWidth,
      height: PADDLE_HEIGHT,
    };

    // Clear old balls
    this.balls = [];
    this.particles.clear();
    this.spawnBallOnPaddle();

    this.setState('LAUNCH');
  }

  private spawnBallOnPaddle(): void {
    if (this.balls.filter(b => b.alive).length >= MAX_BALLS) return;
    const id = this.ballIdCounter++;
    this.balls.push({
      id,
      x: this.paddle.x + this.paddle.width / 2,
      y: this.paddle.y - BALL_RADIUS - 1,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      alive: true,
      trail: [],
      hue: (id * 47) % 360,
    });
  }

  private launchBalls(): void {
    if (this.state !== 'LAUNCH') return;
    const stats = getDerivedStats(this.playerState);
    const baseSpeed = Math.min(BALL_BASE_SPEED + BALL_SPEED_PER_ROUND * (this.playerState.round - 1), BALL_MAX_SPEED);
    const speed = Math.min(baseSpeed + stats.ballSpeedBonus, BALL_MAX_SPEED * 1.5);
    for (const ball of this.balls) {
      if (ball.vy === 0) { // only launch balls that haven't been launched
        const angle = (Math.random() - 0.5) * 0.3; // 0 = straight up, ±0.15 rad variance
        ball.vx = Math.sin(angle) * speed;
        ball.vy = Math.cos(angle) * speed * -1;
      }
    }
    this.setState('PLAYING');
  }

  private endRound(won: boolean): void {
    const bonus = won ? Math.round(this.roundPoints * WIN_BONUS_PERCENT) : 0;
    this.roundSummary = {
      pointsEarned: this.roundPoints,
      bonusPoints: bonus,
      won,
      bricksDestroyed: this.roundBricksDestroyed,
      totalBricks: this.roundTotalBricks,
    };

    this.playerState.totalPoints += this.roundPoints + bonus;
    if (won) this.playerState.round++;
    saveState(this.playerState);

    this.summaryTimer = 0;
    this.summaryContinueAlpha = 0;
    this.setState('ROUND_SUMMARY');

    if (won) {
      this.particles.winCelebration(this.W, this.H);
      this.triggerFlash(0, 255, 136, 0.5);
    }
  }

  private goToShop(): void {
    this.shopScroll = { y: 0, vy: 0, touchStartY: 0, touchLastY: 0, isTouching: false, maxScroll: 0 };
    this.setState('SHOP');
  }

  reset(): void {
    clearState();
    this.playerState = loadState();
    this.balls = [];
    this.bricks = [];
    this.particles.clear();
    this.roundPoints = 0;
    this.roundBricksDestroyed = 0;
    this.roundTotalBricks = 0;
    this.ballIdCounter = 0;
    this.screenFlash.alpha = 0;
    this.bgEnergy = 0;
    this.shopScroll = { y: 0, vy: 0, touchStartY: 0, touchLastY: 0, isTouching: false, maxScroll: 0 };
    this.setState('TITLE');
  }

  // ─── Shop scroll ────────────────────────────────────────────────────────────

  private clampShopScroll(): void {
    const maxScroll = this.shopScroll.maxScroll;
    this.shopScroll.y = Math.max(maxScroll, Math.min(0, this.shopScroll.y));
  }

  private computeShopMaxScroll(): void {
    // Approximate content height (match drawShop's centered layout)
    const contentW = Math.min(this.W - SHOP_PADDING * 2, SHOP_MAX_CONTENT_W);
    const cols = contentW < 480 ? 2 : 4;
    let contentH = SHOP_HEADER_H;
    const catCounts = [
      UPGRADES.filter(u => u.category === 'paddle').length,
      UPGRADES.filter(u => u.category === 'ball').length,
      UPGRADES.filter(u => u.category === 'level').length,
    ];
    for (const cnt of catCounts) {
      contentH += 28; // category label
      const rows = Math.ceil(cnt / cols);
      contentH += rows * (SHOP_CARD_H + SHOP_CARD_GAP);
      contentH += 8;
    }
    const visibleH = this.H - SHOP_HEADER_H - SHOP_FOOTER_H;
    this.shopScroll.maxScroll = Math.min(0, visibleH - contentH);
  }

  // ─── Visual effects ─────────────────────────────────────────────────────────

  private triggerFlash(r: number, g: number, b: number, alpha: number): void {
    this.screenFlash.r = r;
    this.screenFlash.g = g;
    this.screenFlash.b = b;
    this.screenFlash.alpha = alpha;
    this.screenFlash.decay = 2;
  }

  private get chaosLevel(): number {
    const aliveBalls = this.balls.filter(b => b.alive).length;
    return Math.max(0, aliveBalls - 1);
  }

  // ─── Main loop ──────────────────────────────────────────────────────────────

  start(): void {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loop(now: number): void {
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // clamp delta time
    this.time += dt;

    this.update(dt);
    this.render();

    this.animId = requestAnimationFrame((t) => this.loop(t));
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    // Screen flash decay
    if (this.screenFlash.alpha > 0) {
      this.screenFlash.alpha = Math.max(0, this.screenFlash.alpha - this.screenFlash.decay * dt);
    }

    // Background energy decay
    this.bgEnergy = Math.max(0, this.bgEnergy - dt * 0.8);

    if (this.state === 'LAUNCH') {
      this.updateLaunch(dt);
    } else if (this.state === 'PLAYING') {
      this.updatePlaying(dt);
    } else if (this.state === 'ROUND_SUMMARY') {
      this.summaryTimer += dt;
      this.summaryContinueAlpha = Math.min(1, (this.summaryTimer - 1.0) / 0.5);
      this.particles.update(dt);
    } else if (this.state === 'SHOP') {
      this.updateShopScroll(dt);
    }
  }

  private updateLaunch(dt: number): void {
    const stats = getDerivedStats(this.playerState);

    // Ball sticks to paddle center
    for (const ball of this.balls) {
      if (ball.vy === 0) {
        ball.x = this.paddle.x + this.paddle.width / 2;
        ball.y = this.paddle.y - ball.radius - 1;
      }
    }

    // Move paddle toward pointer; player touch overrides auto-pilot
    if (this.isPointerDown) {
      movePaddleToward(this.paddle, this.pointerX, stats.paddleSpeed * 3, this.W, dt);
    } else if (stats.autoPaddle) {
      movePaddleToward(this.paddle, this.pointerX, stats.paddleSpeed, this.W, dt);
    } else {
      movePaddleToward(this.paddle, this.pointerX, stats.paddleSpeed, this.W, dt);
    }

    this.particles.update(dt);
  }

  private updatePlaying(dt: number): void {
    const stats = getDerivedStats(this.playerState);

    // Paddle movement
    if (stats.autoPaddle && !this.isPointerDown) {
      // Update slowly-drifting aim offset so bounces aren't perfectly centered
      this.autoPaddleOffsetTimer -= dt;
      if (this.autoPaddleOffsetTimer <= 0) {
        const halfPaddle = this.paddle.width / 2;
        this.autoPaddleOffsetTarget = (Math.random() * 2 - 1) * halfPaddle * 0.5;
        this.autoPaddleOffsetTimer = 0.5 + Math.random() * 0.9;
      }
      this.autoPaddleOffset += (this.autoPaddleOffsetTarget - this.autoPaddleOffset) * Math.min(1, dt * 4);

      // Track the ball closest to the paddle (highest y = most dangerous to miss)
      const aliveBalls = this.balls.filter(b => b.alive);
      if (aliveBalls.length > 0) {
        const target = aliveBalls.reduce((a, b) => b.y > a.y ? b : a);
        movePaddleToward(this.paddle, target.x + this.autoPaddleOffset, stats.paddleSpeed, this.W, dt);
      }
    } else {
      movePaddleToward(this.paddle, this.pointerX, stats.paddleSpeed * 2.5, this.W, dt);
    }
    clampPaddle(this.paddle, this.W);

    // Brick flash timers
    for (const brick of this.bricks) {
      if (brick.flashTimer > 0) {
        brick.flashTimer = Math.max(0, brick.flashTimer - 8 * dt);
      }
    }

    // Ball spark effects
    for (const ball of this.balls) {
      if (ball.alive) {
        this.particles.ballSpark(ball.x, ball.y, ball.hue, this.chaosLevel);
      }
    }

    // Physics step
    const result = stepPhysics(
      this.balls,
      this.bricks,
      this.paddle,
      this.W,
      this.H,
      stats.ballPower,
      dt,
    );

    // Handle physics results
    if (result.paddleHit) {
      this.particles.paddleHit(result.paddleHitX, this.paddle.y, this.chaosLevel);
      this.triggerFlash(100, 100, 255, 0.08);
      this.bgEnergy = Math.min(1, this.bgEnergy + 0.3);
    }

    for (const bh of result.bricksHit) {
      const color = bh.brick.alive
        ? (bh.brick.hp > 0 ? '#ffffff' : '#888888')
        : (Object.entries({ 1: '#00ff88', 2: '#ffdd00', 3: '#ff8800', 4: '#ff3366', 5: '#cc44ff' })
            .find(([k]) => parseInt(k) === bh.brick.maxHp)?.[1] ?? '#ffffff');

      if (bh.destroyed) {
        this.particles.brickDestroy(
          bh.brick.x, bh.brick.y, bh.brick.width, bh.brick.height,
          color, this.chaosLevel,
        );
        this.roundPoints += bh.brick.points;
        this.roundBricksDestroyed++;

        // Multi-ball chance
        if (stats.multiBallChance > 0 && Math.random() < stats.multiBallChance) {
          this.spawnMultiBall(bh.hitX, bh.hitY);
        }

        this.triggerFlash(255, 200, 50, 0.06 + this.chaosLevel * 0.02);
        this.bgEnergy = Math.min(1, this.bgEnergy + 0.5);
      } else {
        this.particles.brickHit(bh.hitX, bh.hitY, color);
        this.bgEnergy = Math.min(1, this.bgEnergy + 0.1);
      }
    }

    // Handle lost balls
    if (result.ballsLost > 0) {
      const deadBalls = this.balls.filter(b => !b.alive);
      for (const b of deadBalls) {
        if (!b.trail.length) continue; // already processed
        this.particles.ballLost(b.x, this.H - 10);
        b.trail = []; // mark processed
      }
      this.triggerFlash(255, 50, 50, 0.15);
    }

    // Update particles
    this.particles.update(dt);

    // Check win/lose conditions
    const aliveBalls = this.balls.filter(b => b.alive).length;
    const aliveBricks = this.bricks.filter(b => b.alive).length;

    if (aliveBricks === 0) {
      this.endRound(true);
      return;
    }

    if (aliveBalls === 0) {
      this.endRound(false);
      return;
    }
  }

  private spawnMultiBall(fromX: number, fromY: number): void {
    const alive = this.balls.filter(b => b.alive);
    if (alive.length >= MAX_BALLS) return;

    // Clone properties from a random existing ball
    const source = alive[Math.floor(Math.random() * alive.length)];
    const speed = Math.hypot(source.vx, source.vy);
    const angle = Math.random() * Math.PI * 2;
    const id = this.ballIdCounter++;

    this.balls.push({
      id,
      x: fromX,
      y: fromY,
      vx: Math.sin(angle) * speed,
      vy: -Math.abs(Math.cos(angle) * speed),
      radius: BALL_RADIUS,
      alive: true,
      trail: [],
      hue: (id * 47) % 360,
    });

    this.triggerFlash(200, 100, 255, 0.2);
  }

  private updateShopScroll(dt: number): void {
    this.computeShopMaxScroll();

    if (!this.shopScroll.isTouching) {
      // Momentum
      this.shopScroll.y += this.shopScroll.vy * dt;
      this.shopScroll.vy *= Math.pow(0.85, dt * 60);

      // Snap back to bounds with spring
      if (this.shopScroll.y > 0) {
        this.shopScroll.y -= this.shopScroll.y * Math.min(1, dt * 12);
      } else if (this.shopScroll.y < this.shopScroll.maxScroll) {
        // maxScroll is negative; spring back toward it
        this.shopScroll.y += (this.shopScroll.maxScroll - this.shopScroll.y) * Math.min(1, dt * 12);
      }
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  private render(): void {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    ctx.clearRect(0, 0, W, H);

    if (this.state === 'TITLE') {
      drawTitleScreen(ctx, W, H, this.time);
      return;
    }

    if (this.state === 'SHOP') {
      this.shopCards = drawShop(ctx, W, H, this.playerState, this.shopScroll, this.time);
      if (this.shopBuyMessageTimer > 0) {
        this.shopBuyMessageTimer -= 0.016;
        ctx.font = `8px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00ff88';
        ctx.globalAlpha = Math.min(1, this.shopBuyMessageTimer);
        ctx.fillText(this.shopBuyMessage, W / 2, H / 2);
        ctx.globalAlpha = 1;
      }
      return;
    }

    const chaos = this.chaosLevel;

    // Background
    drawBackground(ctx, W, H, chaos, this.time, this.bgEnergy);

    // Bricks
    drawBricks(ctx, this.bricks, chaos);

    // Paddle
    drawPaddle(ctx, this.paddle, chaos, this.time);

    // Balls
    drawBalls(ctx, this.balls, chaos, this.time);

    // Particles
    drawParticles(ctx, this.particles);

    // HUD
    const aliveBalls = this.balls.filter(b => b.alive).length;
    const aliveBricks = this.bricks.filter(b => b.alive).length;
    drawHUD(ctx, W, this.playerState.round, this.roundPoints, this.playerState.totalPoints,
      aliveBalls, aliveBricks, this.roundTotalBricks);

    // Launch prompt
    if (this.state === 'LAUNCH') {
      drawLaunchPrompt(ctx, W, H, this.time);
    }

    // Round summary overlay
    if (this.state === 'ROUND_SUMMARY') {
      drawRoundSummary(ctx, W, H, this.roundSummary, this.time, this.summaryContinueAlpha);
    }

    // Screen flash
    applyScreenFlash(ctx, this.screenFlash, W, H);
  }
}
