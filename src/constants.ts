// Physics
export const BALL_BASE_SPEED = 380;
export const BALL_SPEED_PER_ROUND = 12;  // speed added each round
export const BALL_MAX_SPEED = 680;
export const BALL_RADIUS = 8;
export const BALL_TRAIL_LENGTH = 14;
export const BALL_MIN_VY_RATIO = 0.25; // min |vy|/speed ratio to avoid too-horizontal shots

// Paddle
export const PADDLE_HEIGHT = 14;
export const PADDLE_BASE_WIDTH = 110;
export const PADDLE_BASE_SPEED = 520;
export const PADDLE_BOTTOM_OFFSET = 48;
export const PADDLE_WIDTH_PER_LEVEL = 22;  // px per upgrade level
export const PADDLE_SPEED_PER_LEVEL = 100; // px/s per upgrade level

// Bricks
export const BRICK_TOP_MARGIN = 75;    // space reserved for HUD at top
export const BRICK_SIDE_MARGIN = 14;
export const BRICK_PADDING = 5;
export const BRICK_HEIGHT = 20;

// Level
export const BASE_COLS = 9;
export const BASE_ROWS = 5;
export const COLS_PER_LEVEL = 2;
export const ROWS_PER_LEVEL = 1;

// Points per brick HP tier
export const BRICK_POINTS = [0, 10, 25, 45, 70, 100]; // index = HP

// Win bonus
export const WIN_BONUS_PERCENT = 0.25;

// Multi-ball
export const MULTI_BALL_CHANCE_PER_LEVEL = 0.12;
export const MAX_BALLS = 20;

// Strong brick chance per level
export const STRONG_BRICK_CHANCE_PER_LEVEL = 0.18;

// Ball power
export const BALL_POWER_PER_LEVEL = 1;

// Ball speed upgrade
export const BALL_SPEED_BONUS_PER_LEVEL = 40; // px/s added per upgrade level

// Particle
export const BASE_PARTICLES_PER_BRICK = 9;
export const CHAOS_PARTICLES_PER_BALL = 2;

// Visual
export const FONT = '"Press Start 2P", monospace';

export const BRICK_COLORS: Record<number, string> = {
  1: '#00ff88',  // neon green
  2: '#ffdd00',  // neon yellow
  3: '#ff8800',  // neon orange
  4: '#ff3366',  // neon red/pink
  5: '#cc44ff',  // neon purple
};

export const BRICK_GLOW_COLORS: Record<number, string> = {
  1: '#00ff8844',
  2: '#ffdd0044',
  3: '#ff880044',
  4: '#ff336644',
  5: '#cc44ff44',
};

export const PADDLE_GRADIENT_A = '#6366f1';
export const PADDLE_GRADIENT_B = '#818cf8';
export const BG_COLOR = '#080812';

// Shop layout
export const SHOP_PADDING = 14;
export const SHOP_CARD_GAP = 10;
export const SHOP_CARD_H = 172;
export const SHOP_HEADER_H = 92;
export const SHOP_FOOTER_H = 84;
export const SHOP_MAX_CONTENT_W = 640;

// Upgrade IDs
export const UPGRADE_PADDLE_WIDTH  = 'paddle_width';
export const UPGRADE_PADDLE_SPEED  = 'paddle_speed';
export const UPGRADE_AUTO_PADDLE   = 'auto_paddle';
export const UPGRADE_BALL_POWER    = 'ball_power';
export const UPGRADE_BALL_SPEED    = 'ball_speed';
export const UPGRADE_MULTI_BALL    = 'multi_ball';
export const UPGRADE_LEVEL_COLS    = 'level_cols';
export const UPGRADE_LEVEL_ROWS    = 'level_rows';
export const UPGRADE_STRONG_BRICKS = 'strong_bricks';
