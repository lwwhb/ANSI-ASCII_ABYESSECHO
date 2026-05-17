import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TileType, Biome } from '../types';
import { getBiomeForFloor } from '../constants';

const MiniMap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = useGameStore(s => s.map);
  const player = useGameStore(s => s.player);
  const enemies = useGameStore(s => s.enemies);
  const rememberedMap = useGameStore(s => s.rememberedMap);
  const visibleTiles = useGameStore(s => s.visibleTiles);
  const currentFloor = useGameStore(s => s.currentFloor);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !player || map.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mapWidth = map[0]?.length ?? 80;
    const mapHeight = map.length ?? 28;
    const scale = 2;
    canvas.width = mapWidth * scale;
    canvas.height = mapHeight * scale;

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const key = `${x},${y}`;
        const isVisible = visibleTiles.has(key);
        const isRemembered = rememberedMap.has(key);

        if (!isVisible && !isRemembered) continue;

        const tile = map[y]?.[x];
        let color = '#333344';

        if (isVisible) {
          if (tile) {
            switch (tile.type) {
              case TileType.Floor: case TileType.Corridor: color = '#333355'; break;
              case TileType.Door: case TileType.DoorOpen: color = '#665522'; break;
              case TileType.StairsDown: color = '#ffcc44'; break;
              case TileType.Water: case TileType.ShallowWater: color = '#2244aa'; break;
              case TileType.Lava: case TileType.CooledLava: color = '#aa2200'; break;
              case TileType.CursedGround: color = '#553388'; break;
              case TileType.Torch: color = '#ffaa44'; break;
              case TileType.Sarcophagus: color = '#777766'; break;
              case TileType.Shop: color = '#ffcc44'; break;
              case TileType.Event: color = '#aa44ff'; break;
              case TileType.Portal: color = '#cc44ff'; break;
              case TileType.VoidWall: color = '#0a0015'; break;
              default: color = '#333355';
            }
          }
        } else {
          color = '#1a1a22';
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    // Echo mechanic: show faint indicators for nearby out-of-FOV enemies in Stone Dungeon
    const biome = getBiomeForFloor(currentFloor);
    if (biome === Biome.StoneDungeon) {
      for (const e of enemies) {
        if (e.hp > 0 && !visibleTiles.has(`${e.pos.x},${e.pos.y}`)) {
          const dist = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
          if (dist <= 5) {
            ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
            ctx.fillRect(e.pos.x * scale, e.pos.y * scale, scale, scale);
          }
        }
      }
    }

    // Draw enemies in FOV
    for (const e of enemies) {
      if (e.hp > 0 && visibleTiles.has(`${e.pos.x},${e.pos.y}`)) {
        ctx.fillStyle = e.isBoss ? '#ff8844' : '#ff4444';
        ctx.fillRect(e.pos.x * scale, e.pos.y * scale, scale, scale);
      }
    }

    // Draw player
    ctx.fillStyle = player.fg;
    ctx.fillRect(player.pos.x * scale, player.pos.y * scale, scale, scale);

  }, [map, player, enemies, rememberedMap, visibleTiles, currentFloor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        border: '1px solid #222244',
        display: 'block',
        imageRendering: 'pixelated',
      }}
    />
  );
};

export default MiniMap;
