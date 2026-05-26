import React, { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { StatusEffectType } from '../types';

const CELL_SIZE = 16;
const FONT_SIZE = 14;
const FLOAT_DURATION = 1000; // 1 second animation
const FLOAT_CLEANUP = 1200; // remove from store after 1.2s
const FLOAT_RISE_PX = 30; // pixels to float upward
const SHAKE_DURATION = 400; // screen shake lasts 400ms
const SHAKE_CLEANUP = 500; // remove from store after 500ms

const MapView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  const map = useGameStore(s => s.map);
  const player = useGameStore(s => s.player);
  const enemies = useGameStore(s => s.enemies);
  const items = useGameStore(s => s.items);
  const floatingTexts = useGameStore(s => s.floatingTexts);

  // Render main map to offscreen canvas when game state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !player || map.length === 0) return;

    const width = map[0]?.length ?? 0;
    const height = map.length;

    // Create or resize offscreen canvas
    if (!offscreenRef.current || offscreenRef.current.width !== width * CELL_SIZE || offscreenRef.current.height !== height * CELL_SIZE) {
      offscreenRef.current = document.createElement('canvas');
      offscreenRef.current.width = width * CELL_SIZE;
      offscreenRef.current.height = height * CELL_SIZE;
    }
    const offCtx = offscreenRef.current.getContext('2d');
    if (!offCtx) return;

    // Resize visible canvas
    canvas.width = width * CELL_SIZE;
    canvas.height = height * CELL_SIZE;

    offCtx.font = `${FONT_SIZE}px "Courier New", monospace`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';

    // Clear
    offCtx.fillStyle = '#0a0a12';
    offCtx.fillRect(0, 0, offscreenRef.current.width, offscreenRef.current.height);

    // Build position lookup maps for O(1) access
    const itemMap = new Map<string, typeof items[0]>();
    for (const fi of items) {
      itemMap.set(`${fi.pos.x},${fi.pos.y}`, fi);
    }

    const enemyMap = new Map<string, typeof enemies[0]>();
    for (const e of enemies) {
      if (e.hp > 0 && !e.hidden) enemyMap.set(`${e.pos.x},${e.pos.y}`, e);
    }

    // Render tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        let char: string;
        let fg: string;
        let bg: string;

        if (tile.visible) {
          char = tile.char;
          fg = tile.fg;
          bg = tile.bg;

          // Item at this position
          const itemHere = itemMap.get(`${x},${y}`);
          if (itemHere) {
            char = itemHere.item.char;
            fg = itemHere.item.fg;
          }

          // Enemy at this position
          const enemyHere = enemyMap.get(`${x},${y}`);
          if (enemyHere) {
            if (enemyHere.isElite) {
              char = '★';
              fg = '#ffd700';
            } else {
              char = enemyHere.char;
              fg = enemyHere.fg;
            }
          }

          // Player
          if (player.pos.x === x && player.pos.y === y) {
            char = player.char;
            fg = player.fg;
          }

          const px = x * CELL_SIZE;
          const py = y * CELL_SIZE;

          // Draw background
          offCtx.fillStyle = bg;
          offCtx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

          // Draw character
          if (char !== ' ') {
            offCtx.fillStyle = fg;
            offCtx.fillText(char, px + CELL_SIZE / 2, py + CELL_SIZE / 2);
          }

          // Status effect icons above enemy
          if (enemyHere && enemyHere.statusEffects.length > 0) {
            const icons: string[] = [];
            for (const se of enemyHere.statusEffects) {
              if (se.type === StatusEffectType.Poison) icons.push('☠');
              else if (se.type === StatusEffectType.Burn) icons.push('🔥');
              else if (se.type === StatusEffectType.Freeze) icons.push('❄');
              else if (se.type === StatusEffectType.Confusion) icons.push('⚡');
              else if (se.type === StatusEffectType.Bleed) icons.push('🩸');
            }
            offCtx.font = '8px sans-serif';
            offCtx.fillStyle = '#ff4444';
            const iconStr = icons.slice(0, 3).join('');
            offCtx.fillText(iconStr, px + CELL_SIZE / 2, py - 2);
            // Restore font
            offCtx.font = `${FONT_SIZE}px "Courier New", monospace`;
          }
        } else if (tile.remembered) {
          char = tile.rememberedChar || tile.char;
          fg = dimColor(tile.rememberedFg || tile.fg, 0.45);
          bg = dimColor(tile.rememberedBg || tile.bg, 0.45);

          const px = x * CELL_SIZE;
          const py = y * CELL_SIZE;

          // Draw background
          offCtx.fillStyle = bg;
          offCtx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

          // Draw character
          if (char !== ' ') {
            offCtx.fillStyle = fg;
            offCtx.fillText(char, px + CELL_SIZE / 2, py + CELL_SIZE / 2);
          }
        }
      }
    }
  }, [map, player, enemies, items]);

  // Animation loop for floating texts
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const now = performance.now();
    const currentTexts = useGameStore.getState().floatingTexts || [];
    const shakeData = useGameStore.getState().screenShake;

    // Clean up expired texts
    const expired = currentTexts.some(ft => now - ft.createdAt > FLOAT_CLEANUP);
    if (expired) {
      useGameStore.setState({ floatingTexts: currentTexts.filter(ft => now - ft.createdAt <= FLOAT_CLEANUP) });
    }

    // Clean up expired screen shake
    if (shakeData && now - shakeData.createdAt > SHAKE_CLEANUP) {
      useGameStore.setState({ screenShake: null });
    }

    // Clear and draw base map from offscreen
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply time-based screen shake with ease-out decay
    const shakeDataNow = useGameStore.getState().screenShake;
    if (shakeDataNow) {
      const elapsed = now - shakeDataNow.createdAt;
      if (elapsed < SHAKE_DURATION) {
        // Ease-out: shake starts strong and decays to 0 over SHAKE_DURATION
        const progress = elapsed / SHAKE_DURATION;
        const decay = 1 - Math.pow(progress, 2); // ease-out quadratic
        const currentIntensity = shakeDataNow.intensity * decay;
        const shakeX = (Math.random() - 0.5) * currentIntensity * 2;
        const shakeY = (Math.random() - 0.5) * currentIntensity * 2;
        ctx.translate(shakeX, shakeY);
      }
    }

    // Draw offscreen map
    ctx.drawImage(offscreen, 0, 0);

    // Render floating texts with animation
    const activeTexts = currentTexts.filter(ft => now - ft.createdAt <= FLOAT_DURATION);
    for (const ft of activeTexts) {
      const elapsed = now - ft.createdAt;
      const progress = Math.min(elapsed / FLOAT_DURATION, 1); // 0 → 1

      const px = ft.x * CELL_SIZE + CELL_SIZE / 2;
      const baseY = ft.y * CELL_SIZE;
      const py = baseY - progress * FLOAT_RISE_PX;

      // Ease-out curve for smoother deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 2);
      const finalY = baseY - easeProgress * FLOAT_RISE_PX;

      // Alpha: full for first 30%, then fade out
      const alpha = progress < 0.3 ? 1 : Math.max(0, 1 - (progress - 0.3) / 0.7);

      // Font size: 12→10 for damage, 10→8 for status
      const baseFontSize = ft.type === 'crit' ? 14 : ft.type === 'status' ? 10 : 12;
      const fontSize = baseFontSize - progress * 2;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(ft.text, px, finalY);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // Start/stop animation loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  if (!player || map.length === 0) return null;

  const width = map[0]?.length ?? 80;
  const height = map.length;

  return (
    <canvas
      ref={canvasRef}
      width={width * CELL_SIZE}
      height={height * CELL_SIZE}
      style={{
        backgroundColor: '#0a0a12',
        imageRendering: 'pixelated',
        display: 'block',
      }}
    />
  );
};

function dimColor(hex: string, factor: number): string {
  if (!hex || hex === 'transparent') return '#111122';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

export default MapView;
