import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

const CELL_SIZE = 16;
const FONT_SIZE = 14;

const MapView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = useGameStore(s => s.map);
  const player = useGameStore(s => s.player);
  const enemies = useGameStore(s => s.enemies);
  const items = useGameStore(s => s.items);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !player || map.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = map[0]?.length ?? 0;
    const height = map.length;
    canvas.width = width * CELL_SIZE;
    canvas.height = height * CELL_SIZE;

    ctx.font = `${FONT_SIZE}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Clear
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Build position lookup maps for O(1) access
    const itemMap = new Map<string, typeof items[0]>();
    for (const fi of items) {
      itemMap.set(`${fi.pos.x},${fi.pos.y}`, fi);
    }

    const enemyMap = new Map<string, typeof enemies[0]>();
    for (const e of enemies) {
      if (e.hp > 0) enemyMap.set(`${e.pos.x},${e.pos.y}`, e);
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
            char = enemyHere.char;
            fg = enemyHere.fg;
          }

          // Player
          if (player.pos.x === x && player.pos.y === y) {
            char = player.char;
            fg = player.fg;
          }
        } else if (tile.remembered) {
          char = tile.rememberedChar || tile.char;
          fg = dimColor(tile.rememberedFg || tile.fg, 0.35);
          bg = dimColor(tile.rememberedBg || tile.bg, 0.35);
        } else {
          continue; // Skip completely unseen tiles (already cleared to black)
        }

        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;

        // Draw background
        ctx.fillStyle = bg;
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

        // Draw character
        if (char !== ' ') {
          ctx.fillStyle = fg;
          ctx.fillText(char, px + CELL_SIZE / 2, py + CELL_SIZE / 2);
        }
      }
    }
  }, [map, player, enemies, items]);

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

export default React.memo(MapView);
