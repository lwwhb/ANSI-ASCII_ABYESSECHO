import { TileType, Biome, Position, Tile } from '../types';
import { SeededRandom } from '../utils/random';
import {
  BIOME_CONFIG,
} from '../constants';
import {
  DungeonData, BSPNode, Room,
  createTile, fillMap,
  splitBSP, createRooms, collectRooms,
  carveRoom, carveCorridor, connectRooms,
  placeDoors, addEnvironment,
  placeEnemies, placeItems, placeBoss, markBossRoom,
  pickStartAndStairs,
} from './DungeonGenerator';

function addLoopCorridors(map: Tile[][], rooms: Room[], biome: Biome, rng: SeededRandom): void {
  const loopCount = Math.max(1, Math.floor(rooms.length * 0.3));
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
      carveCorridor(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
    }
  }
}

export function generateStoneDungeon(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.StoneDungeon;
  const config = BIOME_CONFIG[biome];
  const { width, height } = { width: config.mapWidth, height: config.mapHeight };

  const root: BSPNode = { x: 0, y: 0, w: width, h: height };
  splitBSP(root, rng);
  createRooms(root, rng);

  const rooms = collectRooms(root);
  if (rooms.length === 0) {
    rooms.push({ x: 5, y: 5, w: 10, h: 10, centerX: 10, centerY: 10 });
  }

  const map = fillMap(biome, width, height);
  for (const room of rooms) carveRoom(map, room, biome);
  connectRooms(root, map, biome);
  addLoopCorridors(map, rooms, biome, rng);
  placeDoors(map, rooms, biome);
  addEnvironment(map, rooms, biome, rng, floor);

  if (rooms.length === 0) {
    // Fallback room
    rooms.push({ x: 5, y: 5, w: 10, h: 8, centerX: 10, centerY: 9 });
    carveRoom(map, rooms[0], biome);
  }

  const { startRoom, stairsRoom } = pickStartAndStairs(rooms, rng, width, height);
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
      shopPos = {
        x: rng.nextInt(shopRoom.x + 1, shopRoom.x + shopRoom.w - 2),
        y: rng.nextInt(shopRoom.y + 1, shopRoom.y + shopRoom.h - 2),
      };
      map[shopPos.y][shopPos.x] = createTile(TileType.Shop, biome);
    }

    if (rng.chance(config.eventChance)) {
      const eventRoom = rng.pick(specialRooms);
      eventPos = {
        x: rng.nextInt(eventRoom.x + 1, eventRoom.x + eventRoom.w - 2),
        y: rng.nextInt(eventRoom.y + 1, eventRoom.y + eventRoom.h - 2),
      };
      if (!shopPos || eventPos.x !== shopPos.x || eventPos.y !== shopPos.y) {
        map[eventPos.y][eventPos.x] = createTile(TileType.Event, biome);
      } else {
        eventPos = undefined;
      }
    }
  }

  const boss = placeBoss(rooms, floor, biome);
  if (boss) { enemies.push(boss); markBossRoom(map, boss.bossRoom, biome); }

  return { map, rooms, playerStart, stairsDown, enemies, items, shopPos, eventPos };
}
