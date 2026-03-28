export type GameState = 'TITLE' | 'LAUNCH' | 'PLAYING' | 'ROUND_SUMMARY' | 'SHOP';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  trail: Vec2[];
  hue: number; // for colorful multi-balls
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  points: number;
  alive: boolean;
  flashTimer: number; // 0-1, counts down after hit
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;   // 0..1, starts at 1 and decreases
  decay: number;  // life lost per second
  gravity: number;
  angle: number;
  spin: number;
  square: boolean;
}

export interface UpgradeDef {
  id: string;
  category: 'paddle' | 'ball' | 'level';
  name: string;
  icon: string;
  getDescription: (nextLevel: number) => string;
  maxLevel: number;
  costs: number[];
}

export interface PlayerState {
  totalPoints: number;
  round: number;
  upgrades: Record<string, number>;
}

export interface DerivedStats {
  paddleWidth: number;
  paddleSpeed: number;
  autoPaddle: boolean;
  ballPower: number;
  multiBallChance: number;
  levelCols: number;
  levelRows: number;
  strongBrickChance: number;
}

export interface RoundSummary {
  pointsEarned: number;
  bonusPoints: number;
  won: boolean;
  bricksDestroyed: number;
  totalBricks: number;
}

export interface ShopScrollState {
  y: number;
  vy: number;
  touchStartY: number;
  touchLastY: number;
  isTouching: boolean;
  maxScroll: number;
}

export interface ScreenFlash {
  r: number;
  g: number;
  b: number;
  alpha: number;
  decay: number;
}

export interface UpgradeCard {
  upgradeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
