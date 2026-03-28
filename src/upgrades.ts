import type { UpgradeDef, PlayerState, DerivedStats } from './types.ts';
import {
  PADDLE_BASE_WIDTH, PADDLE_BASE_SPEED, PADDLE_WIDTH_PER_LEVEL, PADDLE_SPEED_PER_LEVEL,
  MULTI_BALL_CHANCE_PER_LEVEL, STRONG_BRICK_CHANCE_PER_LEVEL, BALL_POWER_PER_LEVEL,
  BASE_COLS, BASE_ROWS, COLS_PER_LEVEL, ROWS_PER_LEVEL,
  UPGRADE_PADDLE_WIDTH, UPGRADE_PADDLE_SPEED, UPGRADE_AUTO_PADDLE,
  UPGRADE_BALL_POWER, UPGRADE_MULTI_BALL,
  UPGRADE_LEVEL_COLS, UPGRADE_LEVEL_ROWS, UPGRADE_STRONG_BRICKS,
} from './constants.ts';

export const UPGRADES: UpgradeDef[] = [
  {
    id: UPGRADE_PADDLE_WIDTH,
    category: 'paddle',
    name: 'Paddle Width',
    icon: '↔',
    getDescription: (lvl) => `Paddle is ${PADDLE_BASE_WIDTH + lvl * PADDLE_WIDTH_PER_LEVEL}px wide`,
    maxLevel: 5,
    costs: [300, 600, 1200, 2400, 4800],
  },
  {
    id: UPGRADE_PADDLE_SPEED,
    category: 'paddle',
    name: 'Paddle Speed',
    icon: '⚡',
    getDescription: (lvl) => `Move speed +${lvl * PADDLE_SPEED_PER_LEVEL} px/s`,
    maxLevel: 5,
    costs: [350, 700, 1400, 2800, 5600],
  },
  {
    id: UPGRADE_AUTO_PADDLE,
    category: 'paddle',
    name: 'Auto-Pilot',
    icon: '🤖',
    getDescription: (_lvl) => 'Paddle tracks nearest ball',
    maxLevel: 1,
    costs: [2500],
  },
  {
    id: UPGRADE_BALL_POWER,
    category: 'ball',
    name: 'Ball Power',
    icon: '💥',
    getDescription: (lvl) => `Ball deals ${1 + lvl * BALL_POWER_PER_LEVEL} damage`,
    maxLevel: 4,
    costs: [500, 1000, 2000, 4000],
  },
  {
    id: UPGRADE_MULTI_BALL,
    category: 'ball',
    name: 'Multi-Ball',
    icon: '✦',
    getDescription: (lvl) => `${Math.round(lvl * MULTI_BALL_CHANCE_PER_LEVEL * 100)}% clone chance`,
    maxLevel: 5,
    costs: [400, 800, 1600, 3200, 6400],
  },
  {
    id: UPGRADE_LEVEL_COLS,
    category: 'level',
    name: 'Wider Grid',
    icon: '⬛',
    getDescription: (lvl) => `${BASE_COLS + lvl * COLS_PER_LEVEL} columns of bricks`,
    maxLevel: 4,
    costs: [200, 400, 800, 1600],
  },
  {
    id: UPGRADE_LEVEL_ROWS,
    category: 'level',
    name: 'Taller Grid',
    icon: '▦',
    getDescription: (lvl) => `${BASE_ROWS + lvl * ROWS_PER_LEVEL} rows of bricks`,
    maxLevel: 4,
    costs: [250, 500, 1000, 2000],
  },
  {
    id: UPGRADE_STRONG_BRICKS,
    category: 'level',
    name: 'Hard Bricks',
    icon: '🧱',
    getDescription: (lvl) => `${Math.round(lvl * STRONG_BRICK_CHANCE_PER_LEVEL * 100)}% tough bricks`,
    maxLevel: 4,
    costs: [300, 600, 1200, 2400],
  },
];

export function getUpgradeById(id: string): UpgradeDef {
  const u = UPGRADES.find(u => u.id === id);
  if (!u) throw new Error(`Unknown upgrade: ${id}`);
  return u;
}

export function getDerivedStats(state: PlayerState): DerivedStats {
  const ups = state.upgrades;
  const paddleWidthLvl  = ups[UPGRADE_PADDLE_WIDTH]  ?? 0;
  const paddleSpeedLvl  = ups[UPGRADE_PADDLE_SPEED]  ?? 0;
  const autoPaddleLvl   = ups[UPGRADE_AUTO_PADDLE]   ?? 0;
  const ballPowerLvl    = ups[UPGRADE_BALL_POWER]    ?? 0;
  const multiBallLvl    = ups[UPGRADE_MULTI_BALL]    ?? 0;
  const levelColsLvl    = ups[UPGRADE_LEVEL_COLS]    ?? 0;
  const levelRowsLvl    = ups[UPGRADE_LEVEL_ROWS]    ?? 0;
  const strongBricksLvl = ups[UPGRADE_STRONG_BRICKS] ?? 0;

  return {
    paddleWidth:      PADDLE_BASE_WIDTH + paddleWidthLvl * PADDLE_WIDTH_PER_LEVEL,
    paddleSpeed:      PADDLE_BASE_SPEED + paddleSpeedLvl * PADDLE_SPEED_PER_LEVEL,
    autoPaddle:       autoPaddleLvl >= 1,
    ballPower:        1 + ballPowerLvl * BALL_POWER_PER_LEVEL,
    multiBallChance:  multiBallLvl * MULTI_BALL_CHANCE_PER_LEVEL,
    levelCols:        BASE_COLS + levelColsLvl * COLS_PER_LEVEL,
    levelRows:        BASE_ROWS + levelRowsLvl * ROWS_PER_LEVEL,
    strongBrickChance: strongBricksLvl * STRONG_BRICK_CHANCE_PER_LEVEL,
  };
}

/** Estimate how many points a player could earn this round (before win bonus). */
export function estimateRoundPoints(state: PlayerState): number {
  const stats = getDerivedStats(state);
  let total = 0;
  const cols = stats.levelCols;
  const rows = stats.levelRows;
  const sc = stats.strongBrickChance;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // average HP across the distribution
      const avgHp = 1 * (1 - sc) + 2 * (sc * 0.55) + 3 * (sc * 0.3) + 4 * (sc * 0.15);
      // points are based on maxHp of the brick
      const hp = Math.round(avgHp);
      const points = hp === 1 ? 10 : hp === 2 ? 25 : hp === 3 ? 45 : 70;
      total += points;
    }
  }
  return total;
}

export function canAffordUpgrade(state: PlayerState, upgradeId: string): boolean {
  const def = getUpgradeById(upgradeId);
  const currentLevel = state.upgrades[upgradeId] ?? 0;
  if (currentLevel >= def.maxLevel) return false;
  const cost = def.costs[currentLevel];
  return state.totalPoints >= cost;
}

export function buyUpgrade(state: PlayerState, upgradeId: string): boolean {
  if (!canAffordUpgrade(state, upgradeId)) return false;
  const def = getUpgradeById(upgradeId);
  const currentLevel = state.upgrades[upgradeId] ?? 0;
  const cost = def.costs[currentLevel];
  state.totalPoints -= cost;
  state.upgrades[upgradeId] = currentLevel + 1;
  return true;
}
