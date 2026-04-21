import { GameEngine } from './GameEngine.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Canvas element not found');

// Wait for fonts to load so "Press Start 2P" renders correctly
document.fonts.ready.then(() => {
  const engine = new GameEngine(canvas);
  engine.start();

  const resetBtn = document.getElementById('reset-btn');
  resetBtn?.addEventListener('click', () => {
    const ok = window.confirm('Reset all progress? This cannot be undone.');
    if (ok) engine.reset();
  });
});
