import type { PlayerState } from './types.ts';

const SAVE_KEY = 'breakout_roguelite_v1';

export function defaultPlayerState(): PlayerState {
  return {
    totalPoints: 0,
    round: 1,
    upgrades: {},
  };
}

export function saveState(state: PlayerState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage might be unavailable in some environments
  }
}

export function loadState(): PlayerState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultPlayerState();
    const parsed = JSON.parse(raw) as PlayerState;
    // Validate basic shape
    if (
      typeof parsed.totalPoints !== 'number' ||
      typeof parsed.round !== 'number' ||
      typeof parsed.upgrades !== 'object'
    ) {
      return defaultPlayerState();
    }
    return parsed;
  } catch {
    return defaultPlayerState();
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
