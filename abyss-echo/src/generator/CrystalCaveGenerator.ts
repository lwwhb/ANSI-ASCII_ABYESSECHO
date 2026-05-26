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

// Generate a small cave region within a bounded area using cellular automata
function generateSmallCave(
  map: Tile[][], biome: Biome,
  x1: number, y1: number, x2: number, y2: number,
  fillRate: number, rng: SeededRandom,
): Position[] {
  const width = map[0].length;
  const height = map.length;
  const floorTiles: Position[] = [];

  // Random fill within the bounded area
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (y < 1 || y >= height - 1 || x < 1 || x >= width - 1) continue;
      if (rng.next() < fillRate) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
  }

  // 4 rounds of cellular automata smoothing (only within bounds)
  for (let round = 0; round < 4; round++) {
    const updates: { x: number; y: number; isWall: boolean }[] = [];
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (y < 1 || y >= height - 1 || x < 1 || x >= width - 1) continue;
        let wallCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy, nx = x + dx;
            if (ny < y1 || ny > y2 || nx < x1 || nx > x2 || map[ny][nx].type === TileType.Wall) {
              wallCount++;
            }
          }
        }
        updates.push({ x, y, isWall: wallCount >= 5 });
      }
    }
    for (const u of updates) {
      if (u.isWall) {
        map[u.y][u.x] = createWallTile(biome);
      } else {
        map[u.y][u.x] = createTile(TileType.Floor, biome);
      }
    }
  }

  // Collect floor positions, keep only largest connected region within the cave
  const visited = new Set<string>();
  let bestRegion: Position[] = [];
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (map[y][x].type !== TileType.Wall && !visited.has(`${x},${y}`)) {
        // Flood fill within bounds
        const region: Position[] = [];
        const stack: Position[] = [{ x, y }];
        while (stack.length > 0) {
          const p = stack.pop()!;
          const key = `${p.x},${p.y}`;
          if (visited.has(key)) continue;
          if (p.x < x1 || p.x > x2 || p.y < y1 || p.y > y2) continue;
          if (map[p.y][p.x].type === TileType.Wall) continue;
          visited.add(key);
          region.push(p);
          stack.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
        }
        if (region.length > bestRegion.length) bestRegion = region;
      }
    }
  }

  // Remove non-largest regions (fill with wall)
  const keepSet = new Set(bestRegion.map(p => `${p.x},${p.y}`));
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (map[y][x].type !== TileType.Wall && !keepSet.has(`${x},${y}`)) {
        map[y][x] = createWallTile(biome);
      }
    }
  }

  return bestRegion;
}

// Carve a plus/cross shaped room
function carvePlusRoom(map: Tile[][], cx: number, cy: number, armW: number, armH: number, biome: Biome) {
  const halfW = Math.floor(armW / 2);
  const halfH = Math.floor(armH / 2);
  for (let dx = -halfW; dx <= halfW; dx++) {
    const x = cx + dx;
    if (x >= 1 && x < map[0].length - 1 && cy >= 1 && cy < map.length - 1) {
      map[cy][x] = createTile(TileType.Floor, biome);
    }
  }
  for (let dy = -halfH; dy <= halfH; dy++) {
    const y = cy + dy;
    if (y >= 1 && y < map.length - 1 && cx >= 1 && cx < map[0].length - 1) {
      map[y][cx] = createTile(TileType.Floor, biome);
    }
  }
  for (let dx = -halfW; dx <= halfW; dx++) {
    const x = cx + dx;
    if (x >= 1 && x < map[0].length - 1 && cy - 1 >= 1) map[cy - 1][x] = createTile(TileType.Floor, biome);
    if (x >= 1 && x < map[0].length - 1 && cy + 1 < map.length - 1) map[cy + 1][x] = createTile(TileType.Floor, biome);
  }
  for (let dy = -halfH; dy <= halfH; dy++) {
    const y = cy + dy;
    if (y >= 1 && y < map.length - 1 && cx - 1 >= 1) map[y][cx - 1] = createTile(TileType.Floor, biome);
    if (y >= 1 && y < map.length - 1 && cx + 1 < map[0].length - 1) map[y][cx + 1] = createTile(TileType.Floor, biome);
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

  // 2. Generate 5-8 small caves in different regions of the map
  const caveCount = rng.nextInt(5, 8);
  const caves: { center: Position; positions: Position[]; room: Room }[] = [];

  // Divide map into a grid for cave placement to ensure spread
  const cols = Math.ceil(Math.sqrt(caveCount * width / height));
  const rows = Math.ceil(caveCount / cols);
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);

  // Create shuffled cell indices for random placement
  const cellIndices: number[] = [];
  for (let i = 0; i < rows * cols; i++) cellIndices.push(i);
  // Fisher-Yates shuffle
  for (let i = cellIndices.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [cellIndices[i], cellIndices[j]] = [cellIndices[j], cellIndices[i]];
  }

  for (let ci = 0; ci < caveCount; ci++) {
    const cellIdx = cellIndices[ci % cellIndices.length];
    const col = cellIdx % cols;
    const row = Math.floor(cellIdx / cols);

    // Cave area with some randomness within the cell
    const margin = 3;
    const caveW = rng.nextInt(12, 22);
    const caveH = rng.nextInt(8, 16);
    const cx = Math.min(Math.max(col * cellW + rng.nextInt(1, Math.max(2, cellW - caveW)), margin), width - caveW - margin);
    const cy = Math.min(Math.max(row * cellH + rng.nextInt(1, Math.max(2, cellH - caveH)), margin), height - caveH - margin);

    // Generate the small cave using cellular automata in this bounded area
    const fillRate = 0.45 + rng.next() * 0.13; // 0.45 ~ 0.58
    const positions = generateSmallCave(map, biome, cx, cy, cx + caveW - 1, cy + caveH - 1, fillRate, rng);

    if (positions.length < 8) continue; // Skip if cave is too small

    // Find bounding box of the generated cave
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (const p of positions) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const center = { x: Math.floor((minX + maxX) / 2), y: Math.floor((minY + maxY) / 2) };
    const room: Room = {
      x: minX, y: minY,
      w: maxX - minX + 1, h: maxY - minY + 1,
      centerX: center.x, centerY: center.y,
    };

    caves.push({ center, positions, room });
  }

  // Fallback: if too few caves generated, add some rectangular rooms
  while (caves.length < 3) {
    const cw = rng.nextInt(6, 12);
    const ch = rng.nextInt(5, 10);
    const rx = rng.nextInt(3, width - cw - 3);
    const ry = rng.nextInt(3, height - ch - 3);
    const positions: Position[] = [];
    for (let y = ry; y < ry + ch; y++) {
      for (let x = rx; x < rx + cw; x++) {
        map[y][x] = createTile(TileType.Floor, biome);
        positions.push({ x, y });
      }
    }
    const center = { x: rx + Math.floor(cw / 2), y: ry + Math.floor(ch / 2) };
    caves.push({ center, positions, room: { x: rx, y: ry, w: cw, h: ch, centerX: center.x, centerY: center.y } });
  }

  // 3. Connect caves with corridors (sequential + some cross-connections)
  const rooms = caves.map(c => c.room);

  // Sequential connections (ensures basic connectivity)
  for (let i = 1; i < caves.length; i++) {
    const a = caves[i - 1].center;
    const b = caves[i].center;
    // Wavy corridor: carve with slight random offsets for organic feel
    let x = a.x, y = a.y;
    while (x !== b.x) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        map[y][x] = createTile(TileType.Floor, biome);
        // Occasional wider section
        if (rng.chance(0.3) && y + 1 < height - 1) map[y + 1][x] = createTile(TileType.Floor, biome);
      }
      x += x < b.x ? 1 : -1;
      // Occasional vertical wiggle
      if (rng.chance(0.15) && y !== b.y) {
        y += y < b.y ? 1 : -1;
        if (y >= 0 && y < height && x >= 0 && x < width) map[y][x] = createTile(TileType.Floor, biome);
      }
    }
    while (y !== b.y) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        map[y][x] = createTile(TileType.Floor, biome);
        if (rng.chance(0.3) && x + 1 < width - 1) map[y][x + 1] = createTile(TileType.Floor, biome);
      }
      y += y < b.y ? 1 : -1;
    }
  }

  // 2-3 extra cross-connections for alternative paths
  const extraConnections = rng.nextInt(2, 3);
  for (let i = 0; i < extraConnections; i++) {
    const a = rng.pick(caves);
    const b = rng.pick(caves);
    if (a === b) continue;
    carveCorridor(map, a.center.x, a.center.y, b.center.x, b.center.y, biome);
  }

  // 4. Add crystal-themed room variations in some caves
  const plusRooms = rng.nextInt(0, 2);
  for (let i = 0; i < plusRooms; i++) {
    const cx = rng.nextInt(8, width - 8);
    const cy = rng.nextInt(8, height - 8);
    const armW = rng.nextInt(4, 8);
    const armH = rng.nextInt(3, 6);
    carvePlusRoom(map, cx, cy, armW, armH, biome);
    rooms.push({ x: cx - Math.floor(armW / 2), y: cy - Math.floor(armH / 2), w: armW + 2, h: armH + 2, centerX: cx, centerY: cy });
  }

  // 5. Add shallow water at edges (floor tiles with ≥1 adjacent wall, 30% chance)
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

  // 6. Add 2-3 small side-caves reachable by narrow tunnels
  const sideCaveCount = rng.nextInt(2, 3);
  const sideCaves: Room[] = [];
  for (let i = 0; i < sideCaveCount; i++) {
    const cw = rng.nextInt(3, 6);
    const ch = rng.nextInt(3, 6);
    let _placed = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const cx = rng.nextInt(2, width - cw - 2);
      const cy = rng.nextInt(2, height - ch - 2);
      let allWalls = true;
      for (let dy = 0; dy < ch && allWalls; dy++) {
        for (let dx = 0; dx < cw && allWalls; dx++) {
          if (map[cy + dy][cx + dx].type !== TileType.Wall) allWalls = false;
        }
      }
      if (!allWalls) continue;

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

      for (let dy = 0; dy < ch; dy++) {
        for (let dx = 0; dx < cw; dx++) {
          map[cy + dy][cx + dx] = createTile(TileType.Floor, biome);
        }
      }
      const sideCenter = { x: cx + Math.floor(cw / 2), y: cy + Math.floor(ch / 2) };
      carveCorridor(map, connectFrom.x, connectFrom.y, sideCenter.x, sideCenter.y, biome);

      sideCaves.push({ x: cx, y: cy, w: cw, h: ch, centerX: sideCenter.x, centerY: sideCenter.y });
      _placed = true;
      break;
    }
  }

  const allRooms = [...rooms, ...sideCaves];

  // Player start and stairs: pick far-apart caves
  const { startRoom, stairsRoom } = pickStartAndStairs(caves.map(c => c.room), rng, width, height);
  const playerStart = { x: startRoom.centerX, y: startRoom.centerY };
  const startWalkable = findWalkableInRoom(map, startRoom);
  if (startWalkable) { playerStart.x = startWalkable.x; playerStart.y = startWalkable.y; }

  const stairsDown = { x: stairsRoom.centerX, y: stairsRoom.centerY };
  const stairsWalkable = findWalkableInRoom(map, stairsRoom);
  if (stairsWalkable) { stairsDown.x = stairsWalkable.x; stairsDown.y = stairsWalkable.y; }
  map[stairsDown.y][stairsDown.x] = createTile(TileType.StairsDown, biome);

  const enemies = placeEnemies(allRooms, floor, rng, config.enemyIds, undefined, startRoom);
  const items = placeItems(allRooms, floor, rng, config.itemsPerFloorBase, config.itemsPerFloorGrowth);

  let shopPos: Position | undefined;
  let eventPos: Position | undefined;
  const eligibleRooms = allRooms.length > 2 ? allRooms.slice(1, -1) : allRooms.slice(1);
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

  const boss = placeBoss(allRooms, floor, biome);
  if (boss) { enemies.push(boss); markBossRoom(map, boss.bossRoom, biome); }

  if (boss?.arenaData) {
    placeArenaObjects(map, boss.arenaData);
  }

  if (boss) {
    const updatedBossPos = ensureBossReachable(map, playerStart, boss.pos, biome);
    boss.pos = updatedBossPos;
  }

  const { eliteEnemy, eliteRoom, specialRooms, secretWalls, hiddenRooms } = placeEliteAndSpecialRooms(map, allRooms, floor, rng, config.enemyIds, biome);

  const reservedRooms: Room[] = [startRoom];
  if (stairsRoom) reservedRooms.push(stairsRoom);
  if (boss?.bossRoom) reservedRooms.push(boss.bossRoom);
  if (eliteRoom) reservedRooms.push(eliteRoom);
  if (shopPos) {
    const shopRoom = allRooms.find(r => shopPos.x >= r.x && shopPos.x < r.x + r.w && shopPos.y >= r.y && shopPos.y < r.y + r.h);
    if (shopRoom) reservedRooms.push(shopRoom);
  }
  if (eventPos) {
    const eventRoom = allRooms.find(r => eventPos.x >= r.x && eventPos.x < r.x + r.w && eventPos.y >= r.y && eventPos.y < r.y + r.h);
    if (eventRoom) reservedRooms.push(eventRoom);
  }
  specialRooms.forEach(sr => {
    if (!reservedRooms.includes(sr.room)) reservedRooms.push(sr.room);
  });

  const { themedRooms, steamVentTurns } = placeThemedRooms(map, allRooms, biome, rng, reservedRooms);

  // Verify connectivity — if stairs unreachable, carve emergency corridor
  if (!verifyConnectivity(map, playerStart, stairsDown)) {
    const walkStart = findNearestWalkable(map, playerStart);
    const walkStairs = findNearestWalkable(map, stairsDown);
    carveCorridor(map, walkStart.x, walkStart.y, walkStairs.x, walkStairs.y, biome);
    if (walkStart.y + 1 < map.length && walkStairs.y + 1 < map.length) {
      carveCorridor(map, walkStart.x, walkStart.y + 1, walkStairs.x, walkStairs.y + 1, biome);
    }
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
    rooms: allRooms,
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
