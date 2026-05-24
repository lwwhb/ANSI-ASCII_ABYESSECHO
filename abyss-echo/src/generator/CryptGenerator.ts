import { TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import { BIOME_CONFIG } from '../constants';
import {
  DungeonData, BSPNode, Room,
  createTile, fillMap,
  splitBSP, createRooms, collectRooms,
  carveRoom, addEnvironment,
  placeEnemies, placeItems, placeBoss, markBossRoom,
  pickStartAndStairs, placeArenaObjects, placeEliteAndSpecialRooms,
  placeThemedRooms,
} from './DungeonGenerator';

function carveWideCorridorReal(map: import('../types').Tile[][], x1: number, y1: number, x2: number, y2: number, biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  let x = x1, y = y1;

  while (x !== x2) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      for (let dy = 0; dy < 2 && y + dy < height; dy++) {
        if (y + dy >= 0 && map[y + dy][x].type === TileType.Wall) {
          map[y + dy][x] = createTile(TileType.Corridor, biome);
        }
      }
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      for (let dx = 0; dx < 2 && x + dx < width; dx++) {
        if (x + dx >= 0 && map[y][x + dx].type === TileType.Wall) {
          map[y][x + dx] = createTile(TileType.Corridor, biome);
        }
      }
    }
    y += y < y2 ? 1 : -1;
  }
}

function connectRoomsWide(node: BSPNode, map: import('../types').Tile[][], biome: Biome): void {
  if (!node.left || !node.right) return;
  connectRoomsWide(node.left, map, biome);
  connectRoomsWide(node.right, map, biome);

  const leftRooms = collectRooms(node.left).filter(r => r);
  const rightRooms = collectRooms(node.right).filter(r => r);
  if (leftRooms.length === 0 || rightRooms.length === 0) return;

  let minDist = Infinity;
  let bestLeft = leftRooms[0];
  let bestRight = rightRooms[0];
  for (const lr of leftRooms) {
    for (const rr of rightRooms) {
      const dist = Math.abs(lr.centerX - rr.centerX) + Math.abs(lr.centerY - rr.centerY);
      if (dist < minDist) {
        minDist = dist;
        bestLeft = lr;
        bestRight = rr;
      }
    }
  }
  carveWideCorridorReal(map, bestLeft.centerX, bestLeft.centerY, bestRight.centerX, bestRight.centerY, biome);
}

function addLoopCorridorsWide(map: import('../types').Tile[][], rooms: Room[], biome: Biome, rng: SeededRandom): void {
  const loopCount = Math.max(1, Math.floor(rooms.length * 0.15));
  const used = new Set<string>();
  for (let i = 0; i < loopCount; i++) {
    const a = rooms[rng.nextInt(0, rooms.length - 1)];
    const b = rooms[rng.nextInt(0, rooms.length - 1)];
    if (a === b) continue;
    const key = `${a.centerX},${a.centerY}-${b.centerX},${b.centerY}`;
    if (used.has(key)) continue;
    used.add(key);
    const dist = Math.abs(a.centerX - b.centerX) + Math.abs(a.centerY - b.centerY);
    if (dist > 10) {
      carveWideCorridorReal(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
    }
  }
}

export function generateCrypt(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.AncientCrypt;
  const config = BIOME_CONFIG[biome];
  const width = config.mapWidth;
  const height = config.mapHeight;

  const root: BSPNode = { x: 0, y: 0, w: width, h: height };
  splitBSP(root, rng);
  createRooms(root, rng);

  const rooms = collectRooms(root);
  if (rooms.length === 0) {
    rooms.push({ x: 5, y: 5, w: 10, h: 10, centerX: 10, centerY: 10 });
  }

  const map = fillMap(biome, width, height);
  for (const room of rooms) carveRoom(map, room, biome);
  connectRoomsWide(root, map, biome);
  addLoopCorridorsWide(map, rooms, biome, rng);

  // Environment (traps, gas)
  addEnvironment(map, rooms, biome, rng, floor);

  // Cursed ground: 10% of floor tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (map[y][x].type === TileType.Floor && rng.chance(0.1)) {
        map[y][x] = createTile(TileType.CursedGround, biome);
      }
    }
  }

  // Torch at corridor intersections
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type === TileType.Corridor) {
        let openDirs = 0;
        if (map[y - 1][x].walkable) openDirs++;
        if (map[y + 1][x].walkable) openDirs++;
        if (map[y][x - 1].walkable) openDirs++;
        if (map[y][x + 1].walkable) openDirs++;
        if (openDirs >= 3 && rng.chance(0.15)) {
          map[y][x] = createTile(TileType.Torch, biome);
        }
      }
    }
  }

  // Sarcophagus in 2-3 rooms
  const sarcRoomCount = rng.nextInt(2, 4);
  const sarcRooms = rooms.slice(1).sort(() => rng.next() - 0.5).slice(0, sarcRoomCount);
  for (const room of sarcRooms) {
    const sx = rng.nextInt(room.x + 1, room.x + room.w - 2);
    const sy = rng.nextInt(room.y + 1, room.y + room.h - 2);
    if (map[sy][sx].type === TileType.Floor || map[sy][sx].type === TileType.CursedGround) {
      map[sy][sx] = createTile(TileType.Sarcophagus, biome);
    }
  }

  // Pillars in 3-5 rooms: place stone pillars that block movement and line-of-sight
  const pillarRoomCount = rng.nextInt(3, 6);
  const pillarRooms = rooms.slice(1).sort(() => rng.next() - 0.5).slice(0, pillarRoomCount);
  for (const room of pillarRooms) {
    if (room.w < 6 || room.h < 6) continue; // Only in larger rooms
    // Place 2-4 pillars in a grid pattern
    const pillarCount = rng.nextInt(2, 5);
    for (let p = 0; p < pillarCount; p++) {
      const px = rng.nextInt(room.x + 2, room.x + room.w - 3);
      const py = rng.nextInt(room.y + 2, room.y + room.h - 3);
      if (map[py][px].type === TileType.Floor || map[py][px].type === TileType.CursedGround) {
        // Pillar is a wall tile with crypt wall appearance
        map[py][px] = { ...createTile(TileType.Wall, biome), char: '▓', fg: '#556655' };
      }
    }
  }

  // Player start and stairs: randomly pick far-apart rooms
  const { startRoom, stairsRoom } = pickStartAndStairs(rooms, rng, width, height);
  const playerStart = { x: startRoom.centerX, y: startRoom.centerY };
  const stairsDown = { x: stairsRoom.centerX, y: stairsRoom.centerY };
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
      map[shopPos.y][shopPos.x] = createTile(TileType.Shop, biome);
    }
    if (rng.chance(config.eventChance)) {
      const eventRoom = rng.pick(eligibleRooms);
      eventPos = { x: rng.nextInt(eventRoom.x + 1, eventRoom.x + eventRoom.w - 2), y: rng.nextInt(eventRoom.y + 1, eventRoom.y + eventRoom.h - 2) };
      if (!shopPos || eventPos.x !== shopPos.x || eventPos.y !== shopPos.y) {
        map[eventPos.y][eventPos.x] = createTile(TileType.Event, biome);
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

  // Elite + special rooms + secret walls
  const { eliteEnemy, eliteRoom, specialRooms, secretWalls } = placeEliteAndSpecialRooms(map, rooms, floor, rng, config.enemyIds, biome);

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
  };
}
