import { Tile, TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import { BIOME_CONFIG } from '../constants';
import {
  DungeonData, Room,
  createTile,
  placeEnemies, placeItems, placeBoss,
  pickStartAndStairs,
} from './DungeonGenerator';

function carveBridge(map: Tile[][], x1: number, y1: number, x2: number, y2: number, biome: Biome, width: number): void {
  const mapHeight = map.length;
  const mapWidth = map[0]?.length || 0;
  let x = x1, y = y1;
  while (x !== x2) {
    for (let w = 0; w < width; w++) {
      const py = y + w;
      if (x >= 0 && x < mapWidth && py >= 0 && py < mapHeight) {
        map[py][x] = createTile(TileType.Corridor, biome);
      }
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    for (let w = 0; w < width; w++) {
      const px = x + w;
      if (px >= 0 && px < mapWidth && y >= 0 && y < mapHeight) {
        map[y][px] = createTile(TileType.Corridor, biome);
      }
    }
    y += y < y2 ? 1 : -1;
  }
}

export function generateLavaCore(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.LavaCore;
  const config = BIOME_CONFIG[biome];
  const width = config.mapWidth;
  const height = config.mapHeight;

  // 1. Fill with lava
  const map: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      map[y][x] = createTile(TileType.Lava, biome);
    }
  }

  // 2. Place 8-12 islands
  const islandCount = rng.nextInt(8, 13);
  const islands: Room[] = [];
  let attempts = 0;
  for (let i = 0; i < islandCount && attempts < 100; i++) {
    const iw = rng.nextInt(4, 9);
    const ih = rng.nextInt(4, 9);
    const ix = rng.nextInt(3, width - iw - 3);
    const iy = rng.nextInt(3, height - ih - 3);

    // Check no overlap (3-tile margin)
    let overlaps = false;
    for (const ex of islands) {
      if (ix < ex.x + ex.w + 4 && ix + iw + 4 > ex.x && iy < ex.y + ex.h + 4 && iy + ih + 4 > ex.y) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) { attempts++; i--; continue; }

    for (let y = iy; y < iy + ih && y < height; y++) {
      for (let x = ix; x < ix + iw && x < width; x++) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
    islands.push({ x: ix, y: iy, w: iw, h: ih, centerX: ix + Math.floor(iw / 2), centerY: iy + Math.floor(ih / 2) });
    attempts = 0;
  }

  // 3. Connect islands with MST (2-width bridges)
  const connected = new Set<number>([0]);
  while (connected.size < islands.length) {
    let bestDist = Infinity, bestFrom = -1, bestTo = -1;
    for (const ci of connected) {
      for (let j = 0; j < islands.length; j++) {
        if (connected.has(j)) continue;
        const d = Math.abs(islands[ci].centerX - islands[j].centerX) + Math.abs(islands[ci].centerY - islands[j].centerY);
        if (d < bestDist) { bestDist = d; bestFrom = ci; bestTo = j; }
      }
    }
    if (bestTo === -1) break;
    connected.add(bestTo);
    carveBridge(map, islands[bestFrom].centerX, islands[bestFrom].centerY, islands[bestTo].centerX, islands[bestTo].centerY, biome, 2);
  }

  // 4. Add 2-3 shortcut bridges (1-width)
  for (let i = 0; i < rng.nextInt(2, 4); i++) {
    const a = rng.nextInt(0, islands.length - 1);
    const b = rng.nextInt(0, islands.length - 1);
    if (a !== b) {
      carveBridge(map, islands[a].centerX, islands[a].centerY, islands[b].centerX, islands[b].centerY, biome, 1);
    }
  }

  // 5. Cooled lava at island edges
  for (const island of islands) {
    for (let y = island.y - 1; y <= island.y + island.h; y++) {
      for (let x = island.x - 1; x <= island.x + island.w; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height && map[y][x].type === TileType.Lava) {
          // Check if adjacent to floor
          let adjFloor = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy, nx = x + dx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width && map[ny][nx].type === TileType.Floor) {
                adjFloor = true;
              }
            }
          }
          if (adjFloor && rng.chance(0.2)) {
            map[y][x] = createTile(TileType.CooledLava, biome);
          }
        }
      }
    }
  }

  // 6. Player start, stairs, enemies, items, shop, event, boss
  if (islands.length === 0) {
    // Fallback: create a single island in the center
    const cx = Math.floor(width / 2) - 4;
    const cy = Math.floor(height / 2) - 3;
    for (let y = cy; y < cy + 6 && y < height; y++) {
      for (let x = cx; x < cx + 8 && x < width; x++) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
    islands.push({ x: cx, y: cy, w: 8, h: 6, centerX: cx + 4, centerY: cy + 3 });
  }
  const { startRoom, stairsRoom } = pickStartAndStairs(islands, rng, width, height);
  const playerStart = { x: startRoom.centerX, y: startRoom.centerY };
  const stairsDown = { x: stairsRoom.centerX, y: stairsRoom.centerY };
  map[stairsDown.y][stairsDown.x] = createTile(TileType.StairsDown, biome);

  const enemies = placeEnemies(islands, floor, rng, config.enemyIds);
  const items = placeItems(islands, floor, rng, config.itemsPerFloorBase, config.itemsPerFloorGrowth);

  let shopPos: Position | undefined;
  let eventPos: Position | undefined;
  const specialIslands = islands.length > 2 ? islands.slice(1, -1) : islands.slice(1);
  if (specialIslands.length > 0) {
    if (rng.chance(config.shopChance)) {
      const shopIsland = rng.pick(specialIslands);
      shopPos = { x: rng.nextInt(shopIsland.x + 1, shopIsland.x + shopIsland.w - 2), y: rng.nextInt(shopIsland.y + 1, shopIsland.y + shopIsland.h - 2) };
      map[shopPos.y][shopPos.x] = createTile(TileType.Shop, biome);
    }
    if (rng.chance(config.eventChance)) {
      const eventIsland = rng.pick(specialIslands);
      eventPos = { x: rng.nextInt(eventIsland.x + 1, eventIsland.x + eventIsland.w - 2), y: rng.nextInt(eventIsland.y + 1, eventIsland.y + eventIsland.h - 2) };
      if (!shopPos || eventPos.x !== shopPos.x || eventPos.y !== shopPos.y) {
        map[eventPos.y][eventPos.x] = createTile(TileType.Event, biome);
      } else {
        eventPos = undefined;
      }
    }
  }

  const boss = placeBoss(islands, floor, biome);
  if (boss) enemies.push(boss);

  return { map, rooms: islands, playerStart, stairsDown, enemies, items, shopPos, eventPos };
}
