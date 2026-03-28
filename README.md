# Breakout Roguelite

A browser-based breakout game with persistent roguelite progression. Earn points by breaking bricks, then spend them in the upgrade shop between rounds to grow your paddle, power up your balls, and expand the level — all while the game gets progressively wilder and more chaotic.

## Play

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser. Fully playable on mobile too.

## How to Play

- **Mouse / Touch**: Move the paddle by moving the mouse or dragging on the screen
- **Click / Tap**: Launch the ball (in Launch phase), or buy upgrades (in Shop)
- **Goal**: Destroy all bricks to win the round and earn a 25% bonus on points
- **Survive**: If all balls fall off the bottom, the round ends and you go to the shop with whatever points you earned
- **Shop**: Between rounds, spend accumulated points on upgrades, then start the next round

### Controls
| Action | Input |
|---|---|
| Move paddle | Mouse / Touch drag |
| Launch ball | Click / Tap |
| Continue (summary) | Click / Tap |
| Buy upgrade | Click / Tap upgrade card |
| Start round | Click "START ROUND" button |
| Reset save | Shift+R |

## Upgrades

### Paddle
| Upgrade | Effect | Levels | Cost (per level) |
|---|---|---|---|
| Paddle Width | +22px width per level | 5 | 300 → 600 → 1,200 → 2,400 → 4,800 |
| Paddle Speed | +100 px/s per level | 5 | 350 → 700 → 1,400 → 2,800 → 5,600 |
| Auto-Pilot | Paddle automatically tracks the nearest ball | 1 | 2,500 |

### Ball
| Upgrade | Effect | Levels | Cost (per level) |
|---|---|---|---|
| Ball Power | +1 damage per hit (bricks lose more HP per hit) | 4 | 500 → 1,000 → 2,000 → 4,000 |
| Multi-Ball | +12% chance to clone ball on brick destruction | 5 | 400 → 800 → 1,600 → 3,200 → 6,400 |

### Level
| Upgrade | Effect | Levels | Cost (per level) |
|---|---|---|---|
| Wider Grid | +2 brick columns | 4 | 200 → 400 → 800 → 1,600 |
| Taller Grid | +1 brick row | 4 | 250 → 500 → 1,000 → 2,000 |
| Hard Bricks | +18% chance of multi-HP bricks per level | 4 | 300 → 600 → 1,200 → 2,400 |

## Point Economy

Starting round (9×5 grid, all 1-HP bricks): ~450 points + 25% win bonus = ~562 points

The first cheap upgrades (Wider Grid: 200pts, Multi-Ball lvl 1: 400pts) are reachable after the very first round. The cost of each upgrade level doubles, meaning players need to play several rounds before accessing higher tiers. The shop shows a per-round point estimate dynamically based on current upgrades.

## Chaos System

The "chaos level" equals `(number of alive balls - 1)`. As multi-ball upgrades spawn more balls, the visual effects scale up:

- Glow radius on bricks, paddle, and balls grows
- More particles per brick destruction
- Longer ball trails
- Background edge glow pulses more intensely
- Screen flashes grow stronger

## Repository Layout

```
breakout-roguelite/
├── index.html              # Entry HTML — full-screen canvas, Press Start 2P font
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts             # Entry point — waits for fonts, starts GameEngine
    ├── types.ts            # All TypeScript interfaces (Ball, Brick, Paddle, Particle, etc.)
    ├── constants.ts        # Tuning constants (speeds, sizes, colors, upgrade rates)
    ├── upgrades.ts         # Upgrade definitions, derived-stats calculation, buy logic
    ├── persistence.ts      # localStorage save/load with graceful fallback
    ├── levelgen.ts         # Procedural brick grid generation (seeded RNG, HP distribution)
    ├── particles.ts        # ParticleSystem class — burst effects, trails, celebrations
    ├── physics.ts          # Ball/brick/paddle collision, reflection, step function
    ├── renderer.ts         # All canvas drawing (bricks, balls, paddle, HUD, shop, screens)
    └── GameEngine.ts       # Main game loop, state machine, input routing, round management
```

## Implementation Notes

### Game Loop
`GameEngine` runs a `requestAnimationFrame` loop with delta-time capped at 50ms to prevent physics tunneling on tab wake. Game states are `TITLE → LAUNCH → PLAYING → ROUND_SUMMARY → SHOP → LAUNCH`.

### Physics
Ball/brick collision uses AABB-circle intersection (closest-point-on-rect to circle center). The collision normal is derived from the closest-point vector, giving correct corner bounces. Paddle collision uses a custom angular deflection: hit position on the paddle (−1 = left edge, +1 = right edge) maps to a ±60° angle, with a minimum vertical speed enforced to prevent infinite horizontal loops.

### Level Generation
Bricks are generated with a seeded mulberry32 RNG (seed = `round × 31337 + 7`) for reproducibility. HP per brick is sampled from a distribution weighted by `strongBrickChance`: HP 1 at `(1 − chance)`, then HP 2/3/4 at 55%/30%/15% of the remaining chance.

### Rendering
Everything renders on a single `<canvas>` at `devicePixelRatio` scale for sharp retina display. Glow effects use `ctx.shadowBlur` and `ctx.shadowColor`. Ball trails store the last 14 positions as fading circles. The shop screen is also canvas-rendered with a manual scroll implementation (touch inertia + spring snap-back at bounds).

### Persistence
Player state (`totalPoints`, `round`, `upgrades` map) is JSON-serialised to `localStorage` on every purchase and at round end. A schema check on load prevents crashes from corrupted saves. Shift+R resets the save.

### Mobile Support
- `viewport` meta tag prevents zoom/scroll
- `touch-action: none` and `user-select: none` on canvas
- Touch events use `passive: false` to call `preventDefault()` and stop page scrolling
- Pointer input uses the same logical `pointerX` variable for both mouse and touch
- Shop scroll supports swipe inertia with momentum decay and elastic snap-back
