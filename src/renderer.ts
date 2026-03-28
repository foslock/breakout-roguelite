import type { Ball, Brick, Paddle, Particle, ScreenFlash, UpgradeCard, PlayerState, RoundSummary, ShopScrollState } from './types.ts';
import type { ParticleSystem } from './particles.ts';
import { UPGRADES, getDerivedStats, canAffordUpgrade } from './upgrades.ts';
import {
  FONT, BRICK_COLORS, PADDLE_GRADIENT_A, PADDLE_GRADIENT_B, BG_COLOR,
  SHOP_PADDING, SHOP_CARD_GAP, SHOP_CARD_H, SHOP_HEADER_H, SHOP_FOOTER_H,
} from './constants.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function glowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  glowColor: string,
  blurRadius: number,
): void {
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = blurRadius;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Background ───────────────────────────────────────────────────────────────

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chaosLevel: number,
  time: number,
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Edge glow grows with chaos
  if (chaosLevel > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    const glowAlpha = Math.min(0.25, chaosLevel * 0.06) * (0.7 + 0.3 * pulse);
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(128, 0, 255, ${glowAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

// ─── Bricks ───────────────────────────────────────────────────────────────────

export function drawBricks(
  ctx: CanvasRenderingContext2D,
  bricks: Brick[],
  chaosLevel: number,
): void {
  for (const brick of bricks) {
    if (!brick.alive) continue;

    const color = BRICK_COLORS[brick.maxHp] ?? '#ffffff';
    const [r, g, b] = hexToRgb(color);

    // HP ratio affects brightness
    const hpRatio = brick.hp / brick.maxHp;
    const brightness = 0.5 + hpRatio * 0.5;
    const fillColor = `rgb(${Math.round(r * brightness)}, ${Math.round(g * brightness)}, ${Math.round(b * brightness)})`;

    // Flash effect on hit
    const flash = brick.flashTimer > 0 ? brick.flashTimer : 0;
    const flashColor = `rgba(255, 255, 255, ${flash * 0.8})`;

    const glowBlur = 4 + chaosLevel * 2 + flash * 12;
    ctx.shadowColor = color;
    ctx.shadowBlur = glowBlur;

    drawRoundRect(ctx, brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 3);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // HP indicator — draw darker inset rects for remaining HP
    if (brick.maxHp > 1) {
      ctx.shadowBlur = 0;
      const segW = (brick.width - 6) / brick.maxHp;
      for (let i = 0; i < brick.maxHp; i++) {
        const filled = i < brick.hp;
        ctx.fillStyle = filled ? `rgba(255,255,255,0.35)` : `rgba(0,0,0,0.5)`;
        ctx.fillRect(
          brick.x + 3 + i * segW + 1,
          brick.y + brick.height - 5,
          segW - 2,
          3,
        );
      }
    }

    // Flash overlay
    if (flash > 0) {
      ctx.shadowBlur = 0;
      drawRoundRect(ctx, brick.x + 1, brick.y + 1, brick.width - 2, brick.height - 2, 3);
      ctx.fillStyle = flashColor;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }
}

// ─── Paddle ───────────────────────────────────────────────────────────────────

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  paddle: Paddle,
  chaosLevel: number,
  time: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.5);
  const glowBlur = 8 + chaosLevel * 4 + pulse * 4;

  const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.width, paddle.y);
  grad.addColorStop(0, PADDLE_GRADIENT_A);
  grad.addColorStop(0.5, '#a5b4fc');
  grad.addColorStop(1, PADDLE_GRADIENT_B);

  ctx.shadowColor = '#818cf8';
  ctx.shadowBlur = glowBlur;
  drawRoundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 4);
  ctx.fillStyle = grad;
  ctx.fill();

  // Top highlight strip
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  drawRoundRect(ctx, paddle.x + 2, paddle.y + 2, paddle.width - 4, 3, 2);
  ctx.fill();
}

// ─── Balls ────────────────────────────────────────────────────────────────────

export function drawBalls(
  ctx: CanvasRenderingContext2D,
  balls: Ball[],
  chaosLevel: number,
  time: number,
): void {
  for (const ball of balls) {
    if (!ball.alive) continue;

    const hue = ball.hue;
    const ballColor = `hsl(${hue}, 100%, 85%)`;
    const glowColor = `hsl(${hue}, 100%, 60%)`;
    const trailColor = `hsl(${hue}, 100%, 50%)`;

    // Trail
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const alpha = (1 - i / ball.trail.length) * 0.5;
      const size = ball.radius * (1 - i / ball.trail.length) * 0.8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(1, size), 0, Math.PI * 2);
      ctx.fillStyle = trailColor;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Outer glow
    const glowPulse = 0.7 + 0.3 * Math.sin(time * 8 + ball.id);
    const glowRadius = ball.radius + 4 + chaosLevel * 2 + glowPulse * 3;
    const radGrad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, glowRadius);
    radGrad.addColorStop(0, `hsla(${hue}, 100%, 80%, 0.6)`);
    radGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = radGrad;
    ctx.fill();

    // Core
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12 + chaosLevel * 3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballColor;
    ctx.fill();

    // Specular highlight
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────

export function drawParticles(ctx: CanvasRenderingContext2D, ps: ParticleSystem): void {
  ps.draw(ctx);
}

// ─── Screen Flash ─────────────────────────────────────────────────────────────

export function applyScreenFlash(
  ctx: CanvasRenderingContext2D,
  flash: ScreenFlash,
  w: number,
  h: number,
): void {
  if (flash.alpha <= 0) return;
  ctx.fillStyle = `rgba(${flash.r}, ${flash.g}, ${flash.b}, ${flash.alpha})`;
  ctx.fillRect(0, 0, w, h);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  w: number,
  round: number,
  roundPoints: number,
  totalPoints: number,
  ballCount: number,
  bricksLeft: number,
  totalBricks: number,
): void {
  ctx.font = `8px ${FONT}`;
  ctx.textBaseline = 'top';

  // Round label
  glowText(ctx, `RND ${round}`, 10, 10, '#a5b4fc', '#6366f1', 8);

  // Ball count
  const ballStr = `◉×${ballCount}`;
  const ballW = ctx.measureText(ballStr).width;
  glowText(ctx, ballStr, w / 2 - ballW / 2, 10, '#00ff88', '#00cc66', 8);

  // Points
  const pointsStr = `${totalPoints} PTS`;
  const ptsW = ctx.measureText(pointsStr).width;
  glowText(ctx, pointsStr, w - ptsW - 10, 10, '#fbbf24', '#f59e0b', 8);

  // Round points in the middle-ish
  if (roundPoints > 0) {
    ctx.font = `7px ${FONT}`;
    const rpStr = `+${roundPoints}`;
    const rpW = ctx.measureText(rpStr).width;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.fillText(rpStr, w / 2 - rpW / 2, 24);
  }

  // Progress bar
  const barY = 42;
  const barW = w - 20;
  const barH = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(10, barY, barW, barH);
  const filled = totalBricks > 0 ? ((totalBricks - bricksLeft) / totalBricks) * barW : 0;
  const barGrad = ctx.createLinearGradient(10, 0, 10 + barW, 0);
  barGrad.addColorStop(0, '#00ff88');
  barGrad.addColorStop(1, '#cc44ff');
  ctx.fillStyle = barGrad;
  ctx.fillRect(10, barY, filled, barH);
}

// ─── Launch Screen ────────────────────────────────────────────────────────────

export function drawLaunchPrompt(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.globalAlpha = 0.5 + 0.5 * pulse;
  ctx.font = `9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  glowText(ctx, 'TAP TO LAUNCH', w / 2, h - 28, '#ffffff', '#818cf8', 10);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── Title Screen ─────────────────────────────────────────────────────────────

export function drawTitleScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // Decorative brick rows in background
  const colors = ['#00ff88', '#ffdd00', '#ff8800', '#ff3366', '#cc44ff'];
  const brickW = 48, brickH = 18, brickPad = 4;
  const cols = Math.ceil(w / (brickW + brickPad)) + 1;
  for (let row = 0; row < 4; row++) {
    const color = colors[row % colors.length];
    const offset = (time * 25 * (row % 2 === 0 ? 1 : -1)) % (brickW + brickPad);
    ctx.globalAlpha = 0.12 + row * 0.04;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    for (let c = -1; c < cols; c++) {
      const x = c * (brickW + brickPad) + offset;
      const y = 60 + row * (brickH + brickPad + 2);
      drawRoundRect(ctx, x, y, brickW, brickH, 3);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Title
  const midY = h * 0.45;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow layers for depth
  for (let i = 4; i >= 0; i--) {
    const alpha = i === 0 ? 1 : 0.15;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i === 0 ? '#ffffff' : '#6366f1';
    ctx.shadowColor = '#818cf8';
    ctx.shadowBlur = i === 0 ? 20 : 0;
    ctx.fillText('BREAKOUT', w / 2 + i * 1.5, midY - 22 + i * 1.5);
  }
  ctx.globalAlpha = 1;

  ctx.font = `bold 12px ${FONT}`;
  ctx.shadowColor = '#cc44ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#cc44ff';
  ctx.fillText('ROGUELITE', w / 2, midY + 12);
  ctx.shadowBlur = 0;

  // Pulse prompt
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 2));
  ctx.globalAlpha = pulse;
  ctx.font = `8px ${FONT}`;
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#00ff88';
  ctx.fillText('TAP TO PLAY', w / 2, h * 0.68);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Footer
  ctx.font = `6px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('PROGRESS SAVES AUTOMATICALLY', w / 2, h - 20);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ─── Round Summary ────────────────────────────────────────────────────────────

export function drawRoundSummary(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  summary: RoundSummary,
  time: number,
  continueAlpha: number,
): void {
  // Dim overlay
  ctx.fillStyle = 'rgba(8, 8, 18, 0.82)';
  ctx.fillRect(0, 0, w, h);

  const panelW = Math.min(w - 40, 340);
  const panelH = 260;
  const px = (w - panelW) / 2;
  const py = (h - panelH) / 2;

  // Panel background
  ctx.fillStyle = 'rgba(15, 15, 35, 0.95)';
  ctx.strokeStyle = summary.won ? '#00ff88' : '#ff3366';
  ctx.lineWidth = 2;
  ctx.shadowColor = summary.won ? '#00ff88' : '#ff3366';
  ctx.shadowBlur = 16;
  drawRoundRect(ctx, px, py, panelW, panelH, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Title
  const title = summary.won ? 'LEVEL CLEAR!' : 'ROUND OVER';
  const titleColor = summary.won ? '#00ff88' : '#ff3366';
  ctx.font = `12px ${FONT}`;
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 14;
  ctx.fillStyle = titleColor;
  ctx.fillText(title, w / 2, py + 20);
  ctx.shadowBlur = 0;

  // Stats
  ctx.font = `8px ${FONT}`;
  ctx.fillStyle = '#a5b4fc';
  const ly = py + 56;
  const lineH = 22;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#888ab0';
  ctx.fillText('BRICKS', px + 20, ly);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(`${summary.bricksDestroyed} / ${summary.totalBricks}`, px + panelW - 20, ly);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#888ab0';
  ctx.fillText('POINTS', px + 20, ly + lineH);
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(`+${summary.pointsEarned}`, px + panelW - 20, ly + lineH);

  if (summary.bonusPoints > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#888ab0';
    ctx.fillText('WIN BONUS', px + 20, ly + lineH * 2);
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'right';
    ctx.fillText(`+${summary.bonusPoints}`, px + panelW - 20, ly + lineH * 2);
  }

  // Divider
  const divY = ly + lineH * (summary.bonusPoints > 0 ? 3 : 2) + 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 20, divY);
  ctx.lineTo(px + panelW - 20, divY);
  ctx.stroke();

  const total = summary.pointsEarned + summary.bonusPoints;
  ctx.font = `9px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#888ab0';
  ctx.fillText('TOTAL EARNED', px + 20, divY + 12);
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 10;
  ctx.textAlign = 'right';
  ctx.fillText(`+${total}`, px + panelW - 20, divY + 12);
  ctx.shadowBlur = 0;

  // Continue prompt
  const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 2.5));
  ctx.globalAlpha = continueAlpha * pulse;
  ctx.font = `7px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('TAP FOR SHOP', w / 2, py + panelH - 22);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export function drawShop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  playerState: PlayerState,
  scroll: ShopScrollState,
  time: number,
): UpgradeCard[] {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // ── Header ──
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `12px ${FONT}`;
  ctx.shadowColor = '#cc44ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#cc44ff';
  ctx.fillText('UPGRADE SHOP', w / 2, 26);
  ctx.shadowBlur = 0;

  const stats = getDerivedStats(playerState);
  const roundEst = Math.round(estimateRoundPointsLocal(stats));
  ctx.font = `7px ${FONT}`;
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 8;
  ctx.fillText(`${playerState.totalPoints} PTS`, w / 2, 50);
  ctx.shadowBlur = 0;

  ctx.font = `6px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(`~${roundEst} pts/round`, w / 2, 64);

  // ── Cards layout ──
  const cols = w < 480 ? 2 : 4;
  const cardW = (w - SHOP_PADDING * 2 - SHOP_CARD_GAP * (cols - 1)) / cols;
  const cards: UpgradeCard[] = [];

  // Clip scrollable area
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, SHOP_HEADER_H, w, h - SHOP_HEADER_H - SHOP_FOOTER_H);
  ctx.clip();

  ctx.translate(0, SHOP_HEADER_H + scroll.y);

  // Category headers
  const categories: Array<{ key: string; label: string; color: string }> = [
    { key: 'paddle', label: 'PADDLE', color: '#818cf8' },
    { key: 'ball',   label: 'BALL',   color: '#00ff88' },
    { key: 'level',  label: 'LEVEL',  color: '#ffdd00' },
  ];

  let rowY = 0;
  for (const cat of categories) {
    const catUpgrades = UPGRADES.filter(u => u.category === cat.key);

    // Category label
    ctx.font = `7px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = cat.color;
    ctx.shadowColor = cat.color;
    ctx.shadowBlur = 8;
    ctx.fillText(`— ${cat.label} —`, SHOP_PADDING, rowY + 12);
    ctx.shadowBlur = 0;
    rowY += 22;

    // Cards in rows of `cols`
    for (let i = 0; i < catUpgrades.length; i += cols) {
      for (let j = 0; j < cols && i + j < catUpgrades.length; j++) {
        const upg = catUpgrades[i + j];
        const currentLevel = playerState.upgrades[upg.id] ?? 0;
        const maxed = currentLevel >= upg.maxLevel;
        const affordable = !maxed && canAffordUpgrade(playerState, upg.id);
        const cx = SHOP_PADDING + j * (cardW + SHOP_CARD_GAP);
        const cy = rowY;

        // Store hitbox (in canvas coords, accounting for scroll)
        cards.push({
          upgradeId: upg.id,
          x: cx,
          y: cy + SHOP_HEADER_H + scroll.y,
          w: cardW,
          h: SHOP_CARD_H,
        });

        drawUpgradeCard(ctx, upg.id, upg, currentLevel, cx, cy, cardW, SHOP_CARD_H, affordable, maxed, playerState, time, cat.color);
      }
      rowY += SHOP_CARD_H + SHOP_CARD_GAP;
    }
    rowY += 8;
  }

  ctx.restore();

  // ── Footer: Start Round button ──
  const btnW = Math.min(220, w - 40);
  const btnX = (w - btnW) / 2;
  const btnY = h - SHOP_FOOTER_H + 16;
  const btnH = 38;

  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(time * 2));
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 12 * pulse;
  drawRoundRect(ctx, btnX, btnY, btnW, btnH, 6);
  ctx.fillStyle = `rgba(0, 255, 136, ${0.12 + 0.08 * pulse})`;
  ctx.fill();
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.font = `9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00ff88';
  ctx.fillText(`START ROUND ${playerState.round}`, w / 2, btnY + btnH / 2);

  // Scroll hint if content overflows
  if (scroll.maxScroll < 0) {
    ctx.font = `6px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('scroll for more', w / 2, h - SHOP_FOOTER_H + 12);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  return cards;
}

function drawUpgradeCard(
  ctx: CanvasRenderingContext2D,
  _id: string,
  upg: { name: string; icon: string; costs: number[]; maxLevel: number; getDescription: (l: number) => string },
  currentLevel: number,
  x: number,
  y: number,
  w: number,
  h: number,
  affordable: boolean,
  maxed: boolean,
  playerState: PlayerState,
  time: number,
  accentColor: string,
): void {
  const borderColor = maxed ? '#334' : affordable ? accentColor : '#3a3a5a';
  const bgAlpha = maxed ? 0.05 : affordable ? 0.12 : 0.08;
  const pulse = affordable ? 0.6 + 0.4 * Math.abs(Math.sin(time * 2 + x * 0.01)) : 1;

  // Card background
  ctx.fillStyle = `rgba(20, 20, 50, ${bgAlpha * 1.5})`;
  drawRoundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = affordable ? 1.5 : 1;
  if (affordable) {
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8 * pulse;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Icon + Name
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = maxed ? '#555' : '#ffffff';
  // Use a simple character since the font may not render emoji
  const iconText = upg.icon.length <= 2 ? upg.icon : '★';
  ctx.fillText(iconText, x + w / 2, y + 10);

  ctx.font = `6px ${FONT}`;
  ctx.fillStyle = maxed ? '#445' : accentColor;
  const nameLines = wrapText(ctx, upg.name.toUpperCase(), w - 8);
  for (let i = 0; i < nameLines.length; i++) {
    ctx.fillText(nameLines[i], x + w / 2, y + 32 + i * 10);
  }

  // Level pips
  const pipY = y + 56;
  const pipSize = 6;
  const pipGap = 3;
  const totalPipW = upg.maxLevel * (pipSize + pipGap) - pipGap;
  const pipStartX = x + w / 2 - totalPipW / 2;
  for (let i = 0; i < upg.maxLevel; i++) {
    const filled = i < currentLevel;
    ctx.fillStyle = filled ? accentColor : 'rgba(255,255,255,0.12)';
    if (filled) {
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 4;
    }
    ctx.fillRect(pipStartX + i * (pipSize + pipGap), pipY, pipSize, pipSize);
    ctx.shadowBlur = 0;
  }

  // Description
  ctx.font = `5px ${FONT}`;
  ctx.fillStyle = maxed ? '#445' : 'rgba(255,255,255,0.5)';
  const nextLevel = Math.min(currentLevel + 1, upg.maxLevel);
  const descLines = wrapText(ctx, upg.getDescription(nextLevel), w - 10);
  for (let i = 0; i < Math.min(descLines.length, 2); i++) {
    ctx.fillText(descLines[i], x + w / 2, y + 70 + i * 10);
  }

  // Buy button / cost / MAXED
  const btnY = y + h - 30;
  const btnW = w - 16;
  const btnH = 22;
  const btnX2 = x + 8;

  if (maxed) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    drawRoundRect(ctx, btnX2, btnY, btnW, btnH, 4);
    ctx.fill();
    ctx.font = `6px ${FONT}`;
    ctx.fillStyle = '#445566';
    ctx.fillText('MAXED', x + w / 2, btnY + btnH / 2 + 1);
  } else {
    const cost = upg.costs[currentLevel];
    const canBuy = playerState.totalPoints >= cost;
    const btnColor = canBuy ? accentColor : '#334455';
    ctx.fillStyle = canBuy ? `rgba(${hexStrToRgbStr(accentColor)}, 0.15)` : 'rgba(20,20,40,0.5)';
    drawRoundRect(ctx, btnX2, btnY, btnW, btnH, 4);
    ctx.fill();
    ctx.strokeStyle = btnColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `6px ${FONT}`;
    ctx.fillStyle = canBuy ? accentColor : '#445566';
    ctx.fillText(`${cost} PTS`, x + w / 2, btnY + btnH / 2 + 1);
  }
}

function hexStrToRgbStr(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

function estimateRoundPointsLocal(stats: { levelCols: number; levelRows: number; strongBrickChance: number }): number {
  let total = 0;
  const sc = stats.strongBrickChance;
  for (let r = 0; r < stats.levelRows; r++) {
    for (let c = 0; c < stats.levelCols; c++) {
      const avgHp = 1 * (1 - sc) + 2 * (sc * 0.55) + 3 * (sc * 0.3) + 4 * (sc * 0.15);
      const hp = Math.round(avgHp);
      total += hp === 1 ? 10 : hp === 2 ? 25 : hp === 3 ? 45 : 70;
    }
  }
  return total;
}
