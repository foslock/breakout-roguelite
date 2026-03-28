import type { Ball, Brick, Paddle } from './types.ts';
import { BALL_MIN_VY_RATIO } from './constants.ts';

interface HitResult {
  hit: boolean;
  nx: number;
  ny: number;
}

const NO_HIT: HitResult = { hit: false, nx: 0, ny: 0 };

/** Reflect velocity vector off a surface with given normal. */
function reflect(vx: number, vy: number, nx: number, ny: number): [number, number] {
  const dot = vx * nx + vy * ny;
  return [vx - 2 * dot * nx, vy - 2 * dot * ny];
}

/** Check ball vs AABB brick collision, returns surface normal pointing outward. */
function ballVsBrick(ball: Ball, brick: Brick): HitResult {
  const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
  const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const distSq = dx * dx + dy * dy;

  if (distSq >= ball.radius * ball.radius) return NO_HIT;

  // Ball center inside brick — use closest edge as normal
  if (distSq === 0) {
    const overlapL = ball.x - brick.x;
    const overlapR = brick.x + brick.width - ball.x;
    const overlapT = ball.y - brick.y;
    const overlapB = brick.y + brick.height - ball.y;
    const min = Math.min(overlapL, overlapR, overlapT, overlapB);
    if (min === overlapT) return { hit: true, nx: 0, ny: -1 };
    if (min === overlapB) return { hit: true, nx: 0, ny: 1 };
    if (min === overlapL) return { hit: true, nx: -1, ny: 0 };
    return { hit: true, nx: 1, ny: 0 };
  }

  const dist = Math.sqrt(distSq);
  return { hit: true, nx: dx / dist, ny: dy / dist };
}

export interface PhysicsResult {
  ballsLost: number;
  bricksHit: { brick: Brick; destroyed: boolean; hitX: number; hitY: number }[];
  paddleHit: boolean;
  paddleHitX: number;
}

export function stepPhysics(
  balls: Ball[],
  bricks: Brick[],
  paddle: Paddle,
  canvasWidth: number,
  canvasHeight: number,
  ballPower: number,
  dt: number,
): PhysicsResult {
  const result: PhysicsResult = {
    ballsLost: 0,
    bricksHit: [],
    paddleHit: false,
    paddleHitX: 0,
  };

  for (const ball of balls) {
    if (!ball.alive) continue;

    // Store trail before moving
    ball.trail.unshift({ x: ball.x, y: ball.y });
    if (ball.trail.length > 14) ball.trail.pop();

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // --- Wall collisions ---
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius > canvasWidth) {
      ball.x = canvasWidth - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    // --- Ball falls off bottom ---
    if (ball.y - ball.radius > canvasHeight) {
      ball.alive = false;
      result.ballsLost++;
      continue;
    }

    // --- Paddle collision ---
    const paddleTop = paddle.y;
    const paddleLeft = paddle.x;
    const paddleRight = paddle.x + paddle.width;

    if (
      ball.vy > 0 &&
      ball.y + ball.radius >= paddleTop &&
      ball.y - ball.radius <= paddle.y + paddle.height &&
      ball.x >= paddleLeft - ball.radius &&
      ball.x <= paddleRight + ball.radius
    ) {
      // Custom angular deflection based on hit position on paddle
      const hitPos = Math.max(-1, Math.min(1, (ball.x - (paddleLeft + paddle.width / 2)) / (paddle.width / 2)));
      const angle = hitPos * (Math.PI / 3); // max ±60° from vertical
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.abs(Math.cos(angle) * speed);

      // Enforce minimum vertical component so ball doesn't go too horizontal
      const minVy = speed * BALL_MIN_VY_RATIO;
      if (Math.abs(ball.vy) < minVy) {
        ball.vy = -minVy;
        const remaining = Math.sqrt(Math.max(0, speed * speed - minVy * minVy));
        ball.vx = Math.sign(ball.vx) * remaining;
      }

      ball.y = paddleTop - ball.radius;
      result.paddleHit = true;
      result.paddleHitX = ball.x;
    }

    // --- Brick collisions ---
    for (const brick of bricks) {
      if (!brick.alive) continue;

      const res = ballVsBrick(ball, brick);
      if (!res.hit) continue;

      // Reflect ball
      const [nvx, nvy] = reflect(ball.vx, ball.vy, res.nx, res.ny);
      ball.vx = nvx;
      ball.vy = nvy;

      // Push ball out of brick along normal
      const penetration = ball.radius - Math.hypot(
        ball.x - Math.max(brick.x, Math.min(ball.x, brick.x + brick.width)),
        ball.y - Math.max(brick.y, Math.min(ball.y, brick.y + brick.height)),
      );
      if (penetration > 0) {
        ball.x += res.nx * (penetration + 0.5);
        ball.y += res.ny * (penetration + 0.5);
      }

      // Apply damage
      brick.hp -= ballPower;
      brick.flashTimer = 1;
      const destroyed = brick.hp <= 0;
      if (destroyed) brick.alive = false;

      result.bricksHit.push({
        brick,
        destroyed,
        hitX: brick.x + brick.width / 2,
        hitY: brick.y + brick.height / 2,
      });

      // Only collide with one brick per step to avoid tunneling issues
      break;
    }

    // Clamp speed to prevent runaway acceleration (shouldn't happen but safety)
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 1000) {
      ball.vx = (ball.vx / speed) * 1000;
      ball.vy = (ball.vy / speed) * 1000;
    }
  }

  return result;
}

/** Move paddle toward target x (for auto-paddle or input). */
export function movePaddleToward(
  paddle: Paddle,
  targetX: number,
  speed: number,
  canvasWidth: number,
  dt: number,
): void {
  const centerX = paddle.x + paddle.width / 2;
  const diff = targetX - centerX;
  const maxMove = speed * dt;
  const move = Math.sign(diff) * Math.min(Math.abs(diff), maxMove);
  paddle.x = Math.max(0, Math.min(canvasWidth - paddle.width, paddle.x + move));
}

/** Clamp paddle within canvas bounds. */
export function clampPaddle(paddle: Paddle, canvasWidth: number): void {
  paddle.x = Math.max(0, Math.min(canvasWidth - paddle.width, paddle.x));
}
