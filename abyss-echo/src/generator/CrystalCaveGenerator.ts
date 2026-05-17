import { Tile, TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import { BIOME_CONFIG } from '../constants';
import {
  DungeonData, Room,
  createTile, createWallTile, fillMap,
  carveCorridor,
  placeEnemies, placeItems, placeBoss,
  pickStartAndStairs,
} from './DungeonGenerator';

function floodFill(map: Tile[][], startX: number, startY: number, width: number, height: number, globalVisited: Set<string>): Set<string> {
  const region = new Set<string>();
  const stack: Position[] = [{ x: startX, y: startY }];
  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    const key = `${x},${y}`;
    if (region.has(key) || x < 0 || x >= width || y < 0 || y >= height) continue;
    if (map[y][x].type === TileType.Wall) continue;
    if (globalVisited.has(key)) continue;
    region.add(key);
    globalVisited.add(key);
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  return region;
}

export function generateCrystalCave(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.CrystalCavern;
  const config = BIOME_CONFIG[biome];
  const width = config.mapWidth;
  const height = config.mapHeight;

  // 1. Fill with walls
  const map = fillMap(biome, width, height);

  // 2. Random fill 55% floor
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (rng.next() < 0.55) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
  }

  // 3. Cellular automata smoothing (5 rounds)
  for (let round = 0; round < 5; round++) {
    const newMap = fillMap(biome, width, height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let wallCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (map[y + dy][x + dx].type === TileType.Wall) wallCount++;
          }
        }
        if (wallCount >= 5) {
          newMap[y][x] = createWallTile(biome);
        } else {
          newMap[y][x] = createTile(TileType.Floor, biome);
        }
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x] = newMap[y][x];
      }
    }
  }

  // 4. Flood fill — keep only largest connected region
  const visited = new Set<string>();
  let bestRegion = new Set<string>();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const key = `${x},${y}`;
      if (map[y][x].type !== TileType.Wall && !visited.has(key)) {
        const region = floodFill(map, x, y, width, height, visited);
        if (region.size > bestRegion.size) bestRegion = region;
      }
    }
  }
  // Fill non-largest regions with walls
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type !== TileType.Wall && !bestRegion.has(`${x},${y}`)) {
        map[y][x] = createWallTile(biome);
      }
    }
  }

  // 5. Place crystal clusters (3-5 small open areas)
  const clusters: Room[] = [];
  for (let i = 0; i < rng.nextInt(3, 6); i++) {
    const cw = rng.nextInt(3, 6);
    const ch = rng.nextInt(3, 6);
    const cx = rng.nextInt(3, width - cw - 3);
    const cy = rng.nextInt(3, height - ch - 3);
    for (let y = cy; y < cy + ch && y < height; y++) {
      for (let x = cx; x < cx + cw && x < width; x++) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
    clusters.push({ x: cx, y: cy, w: cw, h: ch, centerX: cx + Math.floor(cw / 2), centerY: cy + Math.floor(ch / 2) });
  }

  // 6. Connect clusters with corridors
  for (let i = 1; i < clusters.length; i++) {
    const a = clusters[i - 1];
    const b = clusters[i];
    carveCorridor(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
  }

  // 7. Add shallow water at edges (floor tiles with ≥1 adjacent wall, 30% chance)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type === TileType.Floor) {
        let adjWall = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (map[y + dy][x + dx].type === TileType.Wall) adjWall++;
          }
        }
        if (adjWall > 0 && rng.chance(0.3)) {
          map[y][x] = createTile(TileType.ShallowWater, biome);
        }
      }
    }
  }

  // 8. Use clusters as the primary rooms for entity placement
  const rooms = [...clusters];

  // Player start and stairs: randomly pick far-apart clusters
  const { startRoom, stairsRoom } = pickStartAndStairs(clusters, rng, width, height);
  const playerStart = { x: startRoom.centerX, y: startRoom.centerY };

  const stairsDown = { x: stairsRoom.centerX, y: stairsRoom.centerY };
  map[stairsDown.y][stairsDown.x] = createTile(TileType.StairsDown, biome);

  const enemies = placeEnemies(rooms, floor, rng, config.enemyIds);
  const items = placeItems(rooms, floor, rng, config.itemsPerFloorBase, config.itemsPerFloorGrowth);

  let shopPos: Position | undefined;
  let eventPos: Position | undefined;
  const specialRooms = rooms.length > 2 ? rooms.slice(1, -1) : rooms.slice(1);
  if (specialRooms.length > 0) {
    if (rng.chance(config.shopChance)) {
      const shopRoom = rng.pick(specialRooms);
      shopPos = { x: rng.nextInt(shopRoom.x + 1, shopRoom.x + shopRoom.w - 2), y: rng.nextInt(shopRoom.y + 1, shopRoom.y + shopRoom.h - 2) };
      map[shopPos.y][shopPos.x] = createTile(TileType.Shop, biome);
    }
    if (rng.chance(config.eventChance)) {
      const eventRoom = rng.pick(specialRooms);
      eventPos = { x: rng.nextInt(eventRoom.x + 1, eventRoom.x + eventRoom.w - 2), y: rng.nextInt(eventRoom.y + 1, eventRoom.y + eventRoom.h - 2) };
      if (!shopPos || eventPos.x !== shopPos.x || eventPos.y !== shopPos.y) {
        map[eventPos.y][eventPos.x] = createTile(TileType.Event, biome);
      } else {
        eventPos = undefined;
      }
    }
  }

  const boss = placeBoss(rooms, floor, biome);
  if (boss) enemies.push(boss);

  return { map, rooms, playerStart, stairsDown, enemies, items, shopPos, eventPos };
}
