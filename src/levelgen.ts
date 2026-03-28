import type { Brick, DerivedStats } from './types.ts';
import { BRICK_TOP_MARGIN, BRICK_SIDE_MARGIN, BRICK_PADDING, BRICK_HEIGHT, BRICK_POINTS } from './constants.ts';

/** Randomly pick brick HP based on strongBrickChance. */
function pickBrickHp(strongChance: number, rng: () => number): number {
  const r = rng();
  if (r >= strongChance) return 1;
  // Among "strong" bricks, distribute across HP 2-4
  const r2 = rng();
  if (r2 < 0.55) return 2;
  if (r2 < 0.85) return 3;
  return 4;
}

/** Generate bricks for a new level, laid out within the given canvas dimensions. */
export function generateLevel(
  canvasWidth: number,
  stats: DerivedStats,
  seed: number,
): Brick[] {
  // Simple seeded RNG (mulberry32)
  let s = seed >>> 0;
  const rng = () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const cols = stats.levelCols;
  const rows = stats.levelRows;
  const totalWidth = canvasWidth - BRICK_SIDE_MARGIN * 2;
  const brickW = (totalWidth - BRICK_PADDING * (cols - 1)) / cols;
  const brickH = BRICK_HEIGHT;

  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hp = pickBrickHp(stats.strongBrickChance, rng);
      const x = BRICK_SIDE_MARGIN + col * (brickW + BRICK_PADDING);
      const y = BRICK_TOP_MARGIN + row * (brickH + BRICK_PADDING);
      bricks.push({
        x,
        y,
        width: brickW,
        height: brickH,
        col,
        row,
        hp,
        maxHp: hp,
        points: BRICK_POINTS[hp] ?? 10,
        alive: true,
        flashTimer: 0,
      });
    }
  }

  return bricks;
}

/** Bottom edge of the brick grid (used for ball clamping). */
export function brickGridBottom(rows: number): number {
  return BRICK_TOP_MARGIN + rows * (BRICK_HEIGHT + BRICK_PADDING);
}
