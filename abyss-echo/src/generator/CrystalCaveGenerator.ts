import { Tile, TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import { BIOME_CONFIG } from '../constants';
import {
  DungeonData, Room,
  createTile, createWallTile, fillMap,
  carveCorridor, placeEnemies, placeItems, placeBoss, markBossRoom,
  pickStartAndStairs, placeArenaObjects, placeEliteAndSpecialRooms,
  placeThemedRooms, verifyConnectivity, findNearestWalkable, findWalkableInRoom,
  ensureBossReachable,
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

// Carve a plus/cross shaped room
function carvePlusRoom(map: Tile[][], cx: number, cy: number, armW: number, armH: number, biome: Biome) {
  const halfW = Math.floor(armW / 2);
  const halfH = Math.floor(armH / 2);
  // Horizontal arm
  for (let dx = -halfW; dx <= halfW; dx++) {
    const x = cx + dx;
    if (x >= 1 && x < map[0].length - 1 && cy >= 1 && cy < map.length - 1) {
      map[cy][x] = createTile(TileType.Floor, biome);
    }
  }
  // Vertical arm
  for (let dy = -halfH; dy <= halfH; dy++) {
    const y = cy + dy;
    if (y >= 1 && y < map.length - 1 && cx >= 1 && cx < map[0].length - 1) {
      map[y][cx] = createTile(TileType.Floor, biome);
    }
  }
  // Thicken the cross (2-wide arms)
  for (let dx = -halfW; dx <= halfW; dx++) {
    const x = cx + dx;
    if (x >= 1 && x < map[0].length - 1 && cy - 1 >= 1) {
      map[cy - 1][x] = createTile(TileType.Floor, biome);
    }
    if (x >= 1 && x < map[0].length - 1 && cy + 1 < map.length - 1) {
      map[cy + 1][x] = createTile(TileType.Floor, biome);
    }
  }
  for (let dy = -halfH; dy <= halfH; dy++) {
    const y = cy + dy;
    if (y >= 1 && y < map.length - 1 && cx - 1 >= 1) {
      map[y][cx - 1] = createTile(TileType.Floor, biome);
    }
    if (y >= 1 && y < map.length - 1 && cx + 1 < map[0].length - 1) {
      map[y][cx + 1] = createTile(TileType.Floor, biome);
    }
  }
}

// Carve an L-shaped room
function carveLRoom(map: Tile[][], x: number, y: number, w1: number, h1: number, w2: number, h2: number, biome: Biome) {
  const height = map.length;
  const width = map[0].length;
  // Vertical part
  for (let dy = 0; dy < h1; dy++) {
    for (let dx = 0; dx < w1; dx++) {
      const px = x + dx, py = y + dy;
      if (px >= 1 && px < width - 1 && py >= 1 && py < height - 1) {
        map[py][px] = createTile(TileType.Floor, biome);
      }
    }
  }
  // Horizontal part (extending right from bottom of vertical)
  for (let dy = 0; dy < h2; dy++) {
    for (let dx = 0; dx < w2; dx++) {
      const px = x + dx, py = y + h1 - h2 + dy;
      if (px >= 1 && px < width - 1 && py >= 1 && py < height - 1) {
        map[py][px] = createTile(TileType.Floor, biome);
      }
    }
  }
}

// Wide corridor (2-tile wide)
function carveWideCorridor(map: Tile[][], x1: number, y1: number, x2: number, y2: number, biome: Biome) {
  // Carve two parallel corridors offset by 1
  carveCorridor(map, x1, y1, x2, y2, biome);
  if (x1 !== x2) {
    // Horizontal-ish: offset vertically
    if (y1 + 1 < map.length - 1) carveCorridor(map, x1, y1 + 1, x2, y2 + 1, biome);
  }
  if (y1 !== y2) {
    // Vertical-ish: offset horizontally
    if (x1 + 1 < map[0].length - 1) carveCorridor(map, x1 + 1, y1, x2 + 1, y2, biome);
  }
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

  // 5. Place varied room clusters
  const clusters: Room[] = [];
  const clusterCount = rng.nextInt(4, 7);

  // First cluster is always a large chamber
  {
    const cw = rng.nextInt(10, 16);
    const ch = rng.nextInt(8, 14);
    const cx = rng.nextInt(4, width - cw - 4);
    const cy = rng.nextInt(4, height - ch - 4);
    for (let y = cy; y < cy + ch && y < height; y++) {
      for (let x = cx; x < cx + cw && x < width; x++) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
    clusters.push({ x: cx, y: cy, w: cw, h: ch, centerX: cx + Math.floor(cw / 2), centerY: cy + Math.floor(ch / 2) });
  }

  for (let i = 1; i < clusterCount; i++) {
    const shapeType = rng.nextInt(0, 3);
    if (shapeType === 0) {
      // Standard rectangle (small)
      const cw = rng.nextInt(3, 7);
      const ch = rng.nextInt(3, 7);
      const cx = rng.nextInt(3, width - cw - 3);
      const cy = rng.nextInt(3, height - ch - 3);
      for (let y = cy; y < cy + ch && y < height; y++) {
        for (let x = cx; x < cx + cw && x < width; x++) {
          map[y][x] = createTile(TileType.Floor, biome);
        }
      }
      clusters.push({ x: cx, y: cy, w: cw, h: ch, centerX: cx + Math.floor(cw / 2), centerY: cy + Math.floor(ch / 2) });
    } else if (shapeType === 1) {
      // Large chamber
      const cw = rng.nextInt(8, 14);
      const ch = rng.nextInt(6, 12);
      const cx = rng.nextInt(4, width - cw - 4);
      const cy = rng.nextInt(4, height - ch - 4);
      for (let y = cy; y < cy + ch && y < height; y++) {
        for (let x = cx; x < cx + cw && x < width; x++) {
          map[y][x] = createTile(TileType.Floor, biome);
        }
      }
      clusters.push({ x: cx, y: cy, w: cw, h: ch, centerX: cx + Math.floor(cw / 2), centerY: cy + Math.floor(ch / 2) });
    } else if (shapeType === 2) {
      // Plus/cross shaped room
      const cx = rng.nextInt(8, width - 8);
      const cy = rng.nextInt(8, height - 8);
      const armW = rng.nextInt(5, 10);
      const armH = rng.nextInt(4, 8);
      carvePlusRoom(map, cx, cy, armW, armH, biome);
      const roomW = armW + 2;
      const roomH = armH + 2;
      clusters.push({ x: cx - Math.floor(armW / 2), y: cy - Math.floor(armH / 2), w: roomW, h: roomH, centerX: cx, centerY: cy });
    } else {
      // L-shaped room
      const w1 = rng.nextInt(3, 6);
      const h1 = rng.nextInt(5, 10);
      const w2 = rng.nextInt(5, 10);
      const h2 = rng.nextInt(3, 5);
      const rx = rng.nextInt(3, width - Math.max(w1, w2) - 3);
      const ry = rng.nextInt(3, height - h1 - 3);
      carveLRoom(map, rx, ry, w1, h1, w2, h2, biome);
      clusters.push({ x: rx, y: ry, w: Math.max(w1, w2), h: h1, centerX: rx + Math.floor(w2 / 2), centerY: ry + Math.floor(h1 / 2) });
    }
  }

  // 6. Connect clusters with varied corridors
  for (let i = 1; i < clusters.length; i++) {
    const a = clusters[i - 1];
    const b = clusters[i];
    // 50% chance of wide corridor, 50% normal
    if (rng.chance(0.5)) {
      carveWideCorridor(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
    } else {
      carveCorridor(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
    }
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

  // 8. Add 2-3 small side-caves reachable by narrow tunnels
  const sideCaveCount = rng.nextInt(2, 4);
  const sideCaves: Room[] = [];
  for (let i = 0; i < sideCaveCount; i++) {
    const cw = rng.nextInt(3, 6);
    const ch = rng.nextInt(3, 6);
    // Find a wall tile adjacent to an existing floor tile (cave edge)
    let _placed = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const cx = rng.nextInt(2, width - cw - 2);
      const cy = rng.nextInt(2, height - ch - 2);
      // Check: all tiles in the candidate area are currently walls
      let allWalls = true;
      for (let dy = 0; dy < ch && allWalls; dy++) {
        for (let dx = 0; dx < cw && allWalls; dx++) {
          if (map[cy + dy][cx + dx].type !== TileType.Wall) allWalls = false;
        }
      }
      if (!allWalls) continue;

      // Find nearest existing floor tile to connect from
      let bestDist = Infinity;
      let connectFrom: Position | null = null;
      const searchRadius = 12;
      for (let sy = Math.max(0, cy - searchRadius); sy < Math.min(height, cy + ch + searchRadius); sy++) {
        for (let sx = Math.max(0, cx - searchRadius); sx < Math.min(width, cx + cw + searchRadius); sx++) {
          if (map[sy][sx].type === TileType.Floor || map[sy][sx].type === TileType.ShallowWater) {
            const d = Math.abs(sx - cx) + Math.abs(sy - cy);
            if (d < bestDist && d > 2) { bestDist = d; connectFrom = { x: sx, y: sy }; }
          }
        }
      }
      if (!connectFrom || bestDist > 15) continue;

      // Carve the side-cave
      for (let dy = 0; dy < ch; dy++) {
        for (let dx = 0; dx < cw; dx++) {
          map[cy + dy][cx + dx] = createTile(TileType.Floor, biome);
        }
      }
      const sideCenter = { x: cx + Math.floor(cw / 2), y: cy + Math.floor(ch / 2) };
      // Connect with a narrow (1-tile) tunnel
      carveCorridor(map, connectFrom.x, connectFrom.y, sideCenter.x, sideCenter.y, biome);

      sideCaves.push({ x: cx, y: cy, w: cw, h: ch, centerX: sideCenter.x, centerY: sideCenter.y });
      _placed = true;
      break;
    }
  }

  // 9. Use clusters + side-caves as rooms for entity placement
  const rooms = [...clusters, ...sideCaves];

  // Player start and stairs: randomly pick far-apart clusters
  const { startRoom, stairsRoom } = pickStartAndStairs(clusters, rng, width, height);
  const playerStart = { x: startRoom.centerX, y: startRoom.centerY };
  // Ensure player start is on a walkable tile within the room
  const startWalkable = findWalkableInRoom(map, startRoom);
  if (startWalkable) { playerStart.x = startWalkable.x; playerStart.y = startWalkable.y; }

  const stairsDown = { x: stairsRoom.centerX, y: stairsRoom.centerY };
  // Ensure stairs position is on a walkable tile within the room
  const stairsWalkable = findWalkableInRoom(map, stairsRoom);
  if (stairsWalkable) { stairsDown.x = stairsWalkable.x; stairsDown.y = stairsWalkable.y; }
  map[stairsDown.y][stairsDown.x] = createTile(TileType.StairsDown, biome);

  const enemies = placeEnemies(rooms, floor, rng, config.enemyIds);
  const items = placeItems(rooms, floor, rng, config.itemsPerFloorBase, config.itemsPerFloorGrowth);

  let shopPos: Position | undefined;
  let eventPos: Position | undefined;
  const eligibleRooms = rooms.length > 2 ? rooms.slice(1, -1) : rooms.slice(1);
  if (eligibleRooms.length > 0) {
    if (rng.chance(config.shopChance)) {
      const shopRoom = rng.pick(eligibleRooms);
      shopPos = { x: rng.nextInt(shopRoom.x + 1, shopRoom.x + shopRoom.w - 2), y: rng.nextInt(shopRoom.y + 1, shopRoom.y + shopRoom.h - 2) };
      if (map[shopPos.y][shopPos.x].type !== TileType.StairsDown) {
        map[shopPos.y][shopPos.x] = createTile(TileType.Shop, biome);
      } else {
        shopPos = undefined;
      }
    }
    if (rng.chance(config.eventChance)) {
      const eventRoom = rng.pick(eligibleRooms);
      eventPos = { x: rng.nextInt(eventRoom.x + 1, eventRoom.x + eventRoom.w - 2), y: rng.nextInt(eventRoom.y + 1, eventRoom.y + eventRoom.h - 2) };
      if (!shopPos || eventPos.x !== shopPos.x || eventPos.y !== shopPos.y) {
        if (map[eventPos.y][eventPos.x].type !== TileType.StairsDown) {
          map[eventPos.y][eventPos.x] = createTile(TileType.Event, biome);
        } else {
          eventPos = undefined;
        }
      } else {
        eventPos = undefined;
      }
    }
  }

  const boss = placeBoss(rooms, floor, biome);
  if (boss) { enemies.push(boss); markBossRoom(map, boss.bossRoom, biome); }

  // Boss arena
  if (boss?.arenaData) {
    placeArenaObjects(map, boss.arenaData);
  }

  // Ensure boss is reachable from player start
  if (boss) {
    const updatedBossPos = ensureBossReachable(map, playerStart, boss.pos, biome);
    boss.pos = updatedBossPos;
  }

  // Elite + special rooms + secret walls
  const { eliteEnemy, eliteRoom, specialRooms, secretWalls, hiddenRooms } = placeEliteAndSpecialRooms(map, rooms, floor, rng, config.enemyIds, biome);

  // Themed rooms (excluding start, boss, shop, event, elite rooms)
  const reservedRooms: Room[] = [startRoom];
  if (stairsRoom) reservedRooms.push(stairsRoom);
  if (boss?.bossRoom) reservedRooms.push(boss.bossRoom);
  if (eliteRoom) reservedRooms.push(eliteRoom);
  if (shopPos) {
    const shopRoom = rooms.find(r => shopPos.x >= r.x && shopPos.x < r.x + r.w && shopPos.y >= r.y && shopPos.y < r.y + r.h);
    if (shopRoom) reservedRooms.push(shopRoom);
  }
  if (eventPos) {
    const eventRoom = rooms.find(r => eventPos.x >= r.x && eventPos.x < r.x + r.w && eventPos.y >= r.y && eventPos.y < r.y + r.h);
    if (eventRoom) reservedRooms.push(eventRoom);
  }
  specialRooms.forEach(sr => {
    if (!reservedRooms.includes(sr.room)) reservedRooms.push(sr.room);
  });

  const { themedRooms, steamVentTurns } = placeThemedRooms(map, rooms, biome, rng, reservedRooms);

  // Verify connectivity — if stairs unreachable, carve emergency corridor
  if (!verifyConnectivity(map, playerStart, stairsDown)) {
    // Aggressive fallback: carve wide path (2 corridors offset by 1)
    const walkStart = findNearestWalkable(map, playerStart);
    const walkStairs = findNearestWalkable(map, stairsDown);
    carveCorridor(map, walkStart.x, walkStart.y, walkStairs.x, walkStairs.y, biome);
    // Also carve offset corridor for wider path
    if (walkStart.y + 1 < map.length && walkStairs.y + 1 < map.length) {
      carveCorridor(map, walkStart.x, walkStart.y + 1, walkStairs.x, walkStairs.y + 1, biome);
    }
    // If STILL unreachable, brute-force: carve every tile on the path
    if (!verifyConnectivity(map, playerStart, stairsDown)) {
      let x = walkStart.x, y = walkStart.y;
      const ex = walkStairs.x, ey = walkStairs.y;
      while (x !== ex) {
        if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
          if (!map[y][x].walkable) map[y][x] = createTile(TileType.Corridor, biome);
        }
        x += x < ex ? 1 : -1;
      }
      while (y !== ey) {
        if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
          if (!map[y][x].walkable) map[y][x] = createTile(TileType.Corridor, biome);
        }
        y += y < ey ? 1 : -1;
      }
    }
  }

  return {
    map,
    rooms,
    playerStart,
    stairsDown,
    enemies,
    items,
    shopPos,
    eventPos,
    eliteEnemy,
    eliteRoom,
    specialRooms,
    secretWalls,
    bossArenaData: boss?.arenaData,
    themedRooms,
    steamVentTurns,
    hiddenRooms,
  };
}
