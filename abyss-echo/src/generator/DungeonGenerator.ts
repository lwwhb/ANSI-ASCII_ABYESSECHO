import { Tile, TileType, Position, Biome, EliteAffix, BossArenaData, RoomTheme } from '../types';
import { SeededRandom } from '../utils/random';
import {
  MIN_ROOM_SIZE, MAX_ROOM_SIZE, ROOM_PADDING,
  MIN_BSP_SIZE, BSP_SPLIT_MIN, BSP_SPLIT_MAX, TILE_CHARS,
  BIOME_TILES, BIOME_CONFIG, getBiomeForFloor,
  ENEMIES_PER_FLOOR_BASE, ENEMIES_PER_FLOOR_GROWTH,
  BOSS_DEFS, BOSS_ARENA_OBJECTS, SPECIAL_ROOM_CHANCES,
} from '../constants';
import { THEMED_ROOM_CONFIGS, THEMES_BY_BIOME } from '../constants/themedRooms';
import { generateStoneDungeon } from './StoneDungeonGenerator';
import { generateCrystalCave } from './CrystalCaveGenerator';
import { generateCrypt } from './CryptGenerator';
import { generateLavaCore } from './LavaCoreGenerator';
import { generateVoidAbyss } from './VoidAbyssGenerator';

// Exported interfaces for use by biome-specific generators
export interface BSPNode {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
}

export interface DungeonData {
  map: Tile[][];
  rooms: Room[];
  playerStart: Position;
  stairsDown: Position;
  enemies: { defId: string; pos: Position; isBoss: boolean }[];
  items: { defIndex: number; pos: Position }[];
  shopPos?: Position;
  eventPos?: Position;
  eliteEnemy?: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix };
  eliteRoom?: Room;
  specialRooms: { type: TileType; room: Room; pos: Position }[];
  secretWalls: Position[];
  bossArenaData?: BossArenaData;
  themedRooms: { room: Room; theme: RoomTheme }[];
  steamVentTurns: { x: number; y: number; spawnTurn: number }[];
}

// Export shared utility functions for use by biome-specific generators
export function createTile(type: TileType, biome: Biome): Tile {
  const base = TILE_CHARS[type];
  const biomeOverride = BIOME_TILES[biome]?.[type];
  return {
    type,
    char: biomeOverride?.char ?? base.char,
    fg: biomeOverride?.fg ?? base.fg,
    bg: biomeOverride?.bg ?? base.bg,
    walkable: base.walkable,
    transparent: base.transparent,
    visible: false,
    remembered: false,
  };
}

export function createWallTile(biome: Biome): Tile {
  return createTile(TileType.Wall, biome);
}

export function fillMap(biome: Biome, width: number, height: number): Tile[][] {
  const map: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      map[y][x] = createWallTile(biome);
    }
  }
  return map;
}

export function splitBSP(node: BSPNode, rng: SeededRandom): void {
  if (node.w < MIN_BSP_SIZE * 2 && node.h < MIN_BSP_SIZE * 2) return;
  const canSplitH = node.h >= MIN_BSP_SIZE * 2;
  const canSplitV = node.w >= MIN_BSP_SIZE * 2;

  let splitH: boolean;
  if (canSplitH && canSplitV) {
    splitH = rng.next() > (node.w / (node.w + node.h));
  } else {
    splitH = canSplitH;
  }

  if (splitH) {
    const split = rng.nextInt(
      Math.floor(node.h * BSP_SPLIT_MIN),
      Math.floor(node.h * BSP_SPLIT_MAX)
    );
    node.left = { x: node.x, y: node.y, w: node.w, h: split };
    node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split };
  } else {
    const split = rng.nextInt(
      Math.floor(node.w * BSP_SPLIT_MIN),
      Math.floor(node.w * BSP_SPLIT_MAX)
    );
    node.left = { x: node.x, y: node.y, w: split, h: node.h };
    node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h };
  }

  splitBSP(node.left, rng);
  splitBSP(node.right, rng);
}

export function createRooms(node: BSPNode, rng: SeededRandom): void {
  if (node.left && node.right) {
    createRooms(node.left, rng);
    createRooms(node.right, rng);
    return;
  }

  const maxW = node.w - ROOM_PADDING * 2;
  const maxH = node.h - ROOM_PADDING * 2;
  if (maxW < MIN_ROOM_SIZE || maxH < MIN_ROOM_SIZE) return;

  const roomW = rng.nextInt(MIN_ROOM_SIZE, Math.min(maxW, MAX_ROOM_SIZE));
  const roomH = rng.nextInt(MIN_ROOM_SIZE, Math.min(maxH, MAX_ROOM_SIZE));
  const maxRoomX = node.w - roomW - ROOM_PADDING;
  const maxRoomY = node.h - roomH - ROOM_PADDING;
  if (maxRoomX < ROOM_PADDING || maxRoomY < ROOM_PADDING) return;
  const roomX = node.x + rng.nextInt(ROOM_PADDING, maxRoomX);
  const roomY = node.y + rng.nextInt(ROOM_PADDING, maxRoomY);

  node.room = {
    x: roomX,
    y: roomY,
    w: roomW,
    h: roomH,
    centerX: Math.floor(roomX + roomW / 2),
    centerY: Math.floor(roomY + roomH / 2),
  };
}

export function collectRooms(node: BSPNode): Room[] {
  const rooms: Room[] = [];
  if (node.room) rooms.push(node.room);
  if (node.left) rooms.push(...collectRooms(node.left));
  if (node.right) rooms.push(...collectRooms(node.right));
  return rooms;
}

export function carveRoom(map: Tile[][], room: Room, biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y >= 0 && y < height && x >= 0 && x < width) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
  }
}

export function carveCorridor(map: Tile[][], x1: number, y1: number, x2: number, y2: number, biome: Biome): void {
  let x = x1;
  let y = y1;
  const height = map.length;
  const width = map[0]?.length || 0;

  while (x !== x2) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (map[y][x].type === TileType.Wall) {
        map[y][x] = createTile(TileType.Corridor, biome);
      }
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (map[y][x].type === TileType.Wall) {
        map[y][x] = createTile(TileType.Corridor, biome);
      }
    }
    y += y < y2 ? 1 : -1;
  }
}

export function connectRooms(node: BSPNode, map: Tile[][], biome: Biome): void {
  if (!node.left || !node.right) return;

  connectRooms(node.left, map, biome);
  connectRooms(node.right, map, biome);

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

  carveCorridor(map, bestLeft.centerX, bestLeft.centerY, bestRight.centerX, bestRight.centerY, biome);
}

export function placeDoors(map: Tile[][], rooms: Room[], biome: Biome): void {
  for (const room of rooms) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tryDoor(map, x, room.y - 1, biome);
      tryDoor(map, x, room.y + room.h, biome);
    }
    for (let y = room.y; y < room.y + room.h; y++) {
      tryDoor(map, room.x - 1, y, biome);
      tryDoor(map, room.x + room.w, y, biome);
    }
  }
}

export function tryDoor(map: Tile[][], x: number, y: number, biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) return;
  if (map[y][x].type !== TileType.Corridor && map[y][x].type !== TileType.Floor) return;
  const isVertChoke = map[y][x - 1].type === TileType.Wall && map[y][x + 1].type === TileType.Wall;
  const isHorizChoke = map[y - 1][x].type === TileType.Wall && map[y + 1][x].type === TileType.Wall;
  if (isVertChoke || isHorizChoke) {
    map[y][x] = createTile(TileType.Door, biome);
  }
}

// ============================================================
// Special Tile Creation Helpers
// ============================================================

function makeTile(type: TileType, char: string, fg: string, bg: string, walkable: boolean, transparent: boolean): Tile {
  return { type, char, fg, bg, walkable, transparent, visible: false, remembered: false };
}

const NEW_TILE_DEFAULTS: Record<string, { char: string; fg: string; bg: string; walkable: boolean; transparent: boolean }> = {
  throne:         { char: '♔', fg: '#ffd700', bg: '#1a0808', walkable: false, transparent: false },
  barricade:      { char: '▦', fg: '#8b4513', bg: '#1a0808', walkable: false, transparent: true },
  webFloor:       { char: '≈', fg: '#aaaaaa', bg: '#0a0a1a', walkable: true,  transparent: true },
  spiderEgg:      { char: '◉', fg: '#cccccc', bg: '#0a0a1a', walkable: true,  transparent: true },
  altar:          { char: '⛩', fg: '#aaaaff', bg: '#140a14', walkable: true,  transparent: true },
  lavaPool:       { char: '≈', fg: '#ff4400', bg: '#1a0a04', walkable: false, transparent: true },
  voidRift:       { char: '◎', fg: '#ff44ff', bg: '#100818', walkable: true,  transparent: true },
  voidPillar:     { char: '█', fg: '#8800aa', bg: '#100818', walkable: false, transparent: false },
  corruptionPool: { char: '◎', fg: '#aa00aa', bg: '#100818', walkable: true,  transparent: true },
  healCrystal:    { char: '◆', fg: '#00ffaa', bg: '#100818', walkable: true,  transparent: true },
  eliteDoor:      { char: '▦', fg: '#ffd700', bg: 'transparent', walkable: false, transparent: true },
  fountain:       { char: '⌠', fg: '#44aaff', bg: 'transparent', walkable: true, transparent: true },
  inscription:    { char: '▐', fg: '#ddddaa', bg: 'transparent', walkable: true, transparent: true },
  secretWall:     { char: '#', fg: '#444444', bg: '#222222', walkable: true, transparent: true },
  monument:       { char: '☥', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true },
  spikeTrap:      { char: '▲', fg: '#8888ff', bg: '#222244', walkable: true, transparent: true },
  weaponRack:     { char: '⋔', fg: '#aaaaaa', bg: '#443322', walkable: false, transparent: false },
  forge:          { char: '⚒', fg: '#ff8800', bg: '#442200', walkable: false, transparent: false },
  steamVent:      { char: '≋', fg: '#cccccc', bg: '#445566', walkable: true, transparent: true },
};

// ============================================================
// Boss Arena Support
// ============================================================

export function placeBoss(rooms: Room[], floor: number, _biome: Biome): { defId: string; pos: Position; isBoss: boolean; bossRoom: Room; arenaData?: BossArenaData } | null {
  if (floor % 5 !== 0 && floor !== 30) return null;

  const bossIndex = floor === 30 ? 5 : Math.floor(floor / 5) - 1;
  const bossDef = BOSS_DEFS[Math.min(bossIndex, BOSS_DEFS.length - 1)];
  if (!bossDef) return null;

  const bossRoom = rooms.length > 2 ? rooms[rooms.length - 2] : rooms[rooms.length - 1];

  // Build arena objects
  const arenaObjectDefs = BOSS_ARENA_OBJECTS[bossDef.id];
  const arenaData: BossArenaData | undefined = arenaObjectDefs ? {
    bossDefId: bossDef.id,
    objects: arenaObjectDefs.map(o => ({
      type: o.type,
      x: bossRoom.centerX + o.relX,
      y: bossRoom.centerY + o.relY,
    })),
  } : undefined;

  return {
    defId: bossDef.id,
    pos: { x: bossRoom.centerX, y: bossRoom.centerY },
    isBoss: true,
    bossRoom,
    arenaData,
  };
}

export function placeArenaObjects(map: Tile[][], arenaData: BossArenaData): void {
  for (const obj of arenaData.objects) {
    if (obj.y >= 0 && obj.y < map.length && obj.x >= 0 && obj.x < map[0].length) {
      const defaults = NEW_TILE_DEFAULTS[obj.type];
      if (defaults) {
        map[obj.y][obj.x] = makeTile(obj.type, defaults.char, defaults.fg, defaults.bg, defaults.walkable, defaults.transparent);
      }
    }
  }
}

// ============================================================
// Elite and Special Rooms Support
// ============================================================

function findRoomDoor(map: Tile[][], room: Room): Position | null {
  // Search room boundary for corridor/door connections
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
        const t = map[y][x].type;
        if (t === TileType.Corridor || t === TileType.Door || t === TileType.DoorOpen) {
          return { x, y };
        }
      }
    }
  }
  // H10 fix: Fallback - find adjacent floor tile instead of using room boundary
  // Check around room perimeter for a walkable tile
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length && map[y][x].walkable) {
        return { x, y };
      }
    }
  }
  return { x: room.centerX, y: room.centerY };
}

function findRoomBoundaryWall(map: Tile[][], room: Room, rng: SeededRandom): Position | null {
  const candidates: Position[] = [];
  // H8 fix: Secret wall placement should only target normal Wall tiles, not special tiles like Shop, Altar, etc.
  const specialTileTypes = [TileType.Shop, TileType.Altar, TileType.Fountain, TileType.Inscription,
                           TileType.LavaPool, TileType.CorruptionPool, TileType.VoidRift,
                           TileType.HealCrystal, TileType.SpikeTrap, TileType.SteamVent,
                           TileType.WeaponRack, TileType.Forge, TileType.Monument, TileType.Throne];

  // Check top and bottom walls of room
  for (let x = room.x; x < room.x + room.w; x++) {
    if (room.y > 0 && room.y < map.length && x >= 0 && x < map[0].length) {
      const tile = map[room.y][x];
      if (tile.type === TileType.Wall && !specialTileTypes.includes(tile.type)) candidates.push({ x, y: room.y });
    }
    const by = room.y + room.h;
    if (by > 0 && by < map.length && x >= 0 && x < map[0].length) {
      const tile = map[by][x];
      if (tile.type === TileType.Wall && !specialTileTypes.includes(tile.type)) candidates.push({ x, y: by });
    }
  }
  // Check left and right walls
  for (let y = room.y; y < room.y + room.h; y++) {
    if (room.x > 0 && y >= 0 && y < map.length && room.x < map[0].length) {
      const tile = map[y][room.x];
      if (tile.type === TileType.Wall && !specialTileTypes.includes(tile.type)) candidates.push({ x: room.x, y });
    }
    const rx = room.x + room.w;
    if (rx > 0 && rx < map[0].length && y >= 0 && y < map.length) {
      const tile = map[y][rx];
      if (tile.type === TileType.Wall && !specialTileTypes.includes(tile.type)) candidates.push({ x: rx, y });
    }
  }
  return candidates.length > 0 ? rng.pick(candidates) : null;
}

export function placeEliteAndSpecialRooms(
  map: Tile[][],
  rooms: Room[],
  floor: number,
  rng: SeededRandom,
  enemyIds: string[],
  _biome: Biome,
): {
  eliteEnemy: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix } | undefined;
  eliteRoom: Room | undefined;
  specialRooms: { type: TileType; room: Room; pos: Position }[];
  secretWalls: Position[];
} {
  let eliteEnemy: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix } | undefined = undefined;
  let eliteRoom: Room | undefined = undefined;
  const specialRooms: { type: TileType; room: Room; pos: Position }[] = [];
  const secretWalls: Position[] = [];

  const nonStartRooms = rooms.slice(1);
  if (nonStartRooms.length < 2) return { eliteEnemy, eliteRoom, specialRooms, secretWalls };

  // Elite room (40% chance, not on boss floors)
  if (floor % 5 !== 0 && rng.next() < SPECIAL_ROOM_CHANCES.eliteRoom) {
    const roomIdx = rng.nextInt(0, nonStartRooms.length - 1);
    const room = nonStartRooms[roomIdx];
    eliteRoom = room;

    // Place elite door at room entrance
    const doorPos = findRoomDoor(map, room);
    if (doorPos) {
      const d = NEW_TILE_DEFAULTS['eliteDoor']!;
      map[doorPos.y][doorPos.x] = makeTile(TileType.EliteDoor, d.char, d.fg, d.bg, d.walkable, d.transparent);
    }

    // Pick random affix
    const affixValues = Object.values(EliteAffix);
    const affix = rng.pick(affixValues) as EliteAffix;
    const pos = {
      x: rng.nextInt(room.x + 1, room.x + room.w - 2),
      y: rng.nextInt(room.y + 1, room.y + room.h - 2),
    };
    const defId = rng.pick(enemyIds);
    eliteEnemy = { defId, pos, isElite: true, eliteAffix: affix };
  }

  // Inscription room (20% chance)
  if (rng.next() < SPECIAL_ROOM_CHANCES.inscriptionRoom && nonStartRooms.length > 2) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const pos = { x: room.centerX, y: room.centerY };
    const d = NEW_TILE_DEFAULTS['inscription']!;
    map[pos.y][pos.x] = makeTile(TileType.Inscription, d.char, d.fg, d.bg, d.walkable, d.transparent);
    specialRooms.push({ type: TileType.Inscription, room, pos });
  }

  // Fountain room (10% chance)
  if (rng.next() < SPECIAL_ROOM_CHANCES.fountainRoom && nonStartRooms.length > 3) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const pos = { x: room.centerX, y: room.centerY };
    const d = NEW_TILE_DEFAULTS['fountain']!;
    map[pos.y][pos.x] = makeTile(TileType.Fountain, d.char, d.fg, d.bg, d.walkable, d.transparent);
    specialRooms.push({ type: TileType.Fountain, room, pos });
  }

  // Secret walls (1-2 per floor)
  const wallCount = rng.nextInt(1, 2);
  for (let i = 0; i < wallCount; i++) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const wallPos = findRoomBoundaryWall(map, room, rng);
    if (wallPos) {
      const outsideX = wallPos.x < room.centerX ? wallPos.x - 2 : wallPos.x + 2;
      const outsideY = wallPos.y < room.centerY ? wallPos.y - 2 : wallPos.y + 2;
      // Create small hidden room (3x3)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = outsideX + dx;
          const ny = outsideY + dy;
          if (ny >= 2 && ny < map.length - 2 && nx >= 2 && nx < map[0].length - 2) {
            map[ny][nx] = makeTile(TileType.Floor, '.', '#555555', 'transparent', true, true);
          }
        }
      }
      // Replace wall with secret wall (H8 fix: only if current tile is not a special type)
      const currentTile = map[wallPos.y][wallPos.x];
      if (!currentTile.walkable) {
        const d = NEW_TILE_DEFAULTS['secretWall']!;
        map[wallPos.y][wallPos.x] = makeTile(TileType.SecretWall, d.char, d.fg, d.bg, d.walkable, d.transparent);
        secretWalls.push(wallPos);
      }
    }
  }

  return { eliteEnemy, eliteRoom, specialRooms, secretWalls };
}

export function addEnvironment(map: Tile[][], rooms: Room[], biome: Biome, rng: SeededRandom, floor: number): void {
  const config = BIOME_CONFIG[biome];
  const height = map.length;
  const width = map[0]?.length || 0;

  if (config.hasWater || config.hasLava) {
    for (const room of rooms) {
      if (rng.chance(0.3)) {
        const poolX = rng.nextInt(room.x + 1, room.x + room.w - 2);
        const poolY = rng.nextInt(room.y + 1, room.y + room.h - 2);
        const poolSize = rng.nextInt(1, 3);
        for (let dy = 0; dy < poolSize; dy++) {
          for (let dx = 0; dx < poolSize; dx++) {
            const px = poolX + dx;
            const py = poolY + dy;
            if (px >= 0 && px < width && py >= 0 && py < height && map[py][px].walkable) {
              map[py][px] = createTile(config.hasLava ? TileType.Lava : TileType.Water, biome);
            }
          }
        }
      }
    }
  }

  if (config.hasGas) {
    for (const room of rooms) {
      if (rng.chance(0.2)) {
        const gx = rng.nextInt(room.x + 1, room.x + room.w - 2);
        const gy = rng.nextInt(room.y + 1, room.y + room.h - 2);
        if (map[gy][gx].walkable) {
          map[gy][gx] = createTile(TileType.PoisonGas, biome);
        }
      }
    }
  }

  for (const room of rooms) {
    if (rng.chance(config.trapChance * (1 + floor * 0.05))) {
      const trapTypes = [TileType.TrapSpike, TileType.TrapFire, TileType.TrapTeleport, TileType.TrapPoison];
      const trapType = rng.pick(trapTypes);
      const tx = rng.nextInt(room.x + 1, room.x + room.w - 2);
      const ty = rng.nextInt(room.y + 1, room.y + room.h - 2);
      if (map[ty][tx].type === TileType.Floor) {
        map[ty][tx] = createTile(trapType, biome);
      }
    }
  }
}

export function placeEnemies(rooms: Room[], floor: number, rng: SeededRandom, enemyIds: string[], map?: Tile[][]): { defId: string; pos: Position; isBoss: boolean }[] {
  const count = Math.floor(ENEMIES_PER_FLOOR_BASE + ENEMIES_PER_FLOOR_GROWTH * Math.sqrt(floor));
  const enemies: { defId: string; pos: Position; isBoss: boolean }[] = [];
  const spawnRooms = rooms.slice(1);

  // H9 fix: helper to find walkable position in room
  const findWalkablePos = (room: Room): Position | null => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const pos = {
        x: rng.nextInt(room.x + 1, room.x + room.w - 2),
        y: rng.nextInt(room.y + 1, room.y + room.h - 2),
      };
      if (!map || map[pos.y]?.[pos.x]?.walkable) return pos;
    }
    // Fallback: room center
    const center = { x: room.centerX, y: room.centerY };
    if (!map || map[center.y]?.[center.x]?.walkable) return center;
    return null;
  };

  // 先给每个非起始房间分配至少1只怪，确保无空房
  for (const room of spawnRooms) {
    const pos = findWalkablePos(room);
    if (!pos) continue;
    const defId = rng.pick(enemyIds);
    enemies.push({ defId, pos, isBoss: false });
  }

  // 再随机分配剩余怪物
  const remaining = Math.max(0, count - spawnRooms.length);
  for (let i = 0; i < remaining; i++) {
    const room = rng.pick(spawnRooms);
    if (!room) continue;
    const pos = findWalkablePos(room);
    if (!pos) continue;
    const defId = rng.pick(enemyIds);
    enemies.push({ defId, pos, isBoss: false });
  }

  return enemies;
}

export function placeItems(rooms: Room[], floor: number, rng: SeededRandom, itemsBase: number, itemsGrowth: number): { defIndex: number; pos: Position }[] {
  const count = Math.floor(itemsBase + itemsGrowth * Math.sqrt(floor));
  const items: { defIndex: number; pos: Position }[] = [];
  const spawnRooms = rooms.slice(1);

  for (let i = 0; i < count; i++) {
    const room = rng.pick(spawnRooms);
    if (!room) continue;
    const pos = {
      x: rng.nextInt(room.x + 1, room.x + room.w - 2),
      y: rng.nextInt(room.y + 1, room.y + room.h - 2),
    };
    items.push({ defIndex: i, pos });
  }

  return items;
}

// Router function that dispatches to biome-specific generators
export function generateDungeon(floor: number, seed: number): DungeonData {
  const biome = getBiomeForFloor(floor);
  switch (biome) {
    case Biome.StoneDungeon:
      // Import dynamically to avoid circular dependency
      return generateStoneDungeon(floor, seed);
    case Biome.CrystalCavern:
      return generateCrystalCave(floor, seed);
    case Biome.AncientCrypt:
      return generateCrypt(floor, seed);
    case Biome.LavaCore:
      return generateLavaCore(floor, seed);
    case Biome.VoidAbyss:
      return generateVoidAbyss(floor, seed);
    // Other biomes will be added in later tasks
    default:
      return generateStoneDungeon(floor, seed);
  }
}

// Pick two rooms that are far enough apart for player start and stairs-down
export function pickStartAndStairs(rooms: Room[], rng: SeededRandom, mapWidth: number, mapHeight: number): { startRoom: Room; stairsRoom: Room } {
  if (rooms.length <= 1) {
    // Single room: place start at center, stairs at opposite corner of the room
    const room = rooms[0];
    const startRoom = { ...room, centerX: room.x + 2, centerY: room.y + 2 };
    const stairsRoom = { ...room, centerX: room.x + room.w - 3, centerY: room.y + room.h - 3 };
    return { startRoom, stairsRoom };
  }

  const diagonal = Math.sqrt(mapWidth * mapWidth + mapHeight * mapHeight);
  const minDist = diagonal * 0.3;

  let bestA = 0;
  let bestB = rooms.length - 1;
  let bestDist = 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    const a = rng.nextInt(0, rooms.length - 1);
    const b = rng.nextInt(0, rooms.length - 1);
    if (a === b) continue;
    const dist = Math.abs(rooms[a].centerX - rooms[b].centerX) + Math.abs(rooms[a].centerY - rooms[b].centerY);
    if (dist >= minDist) {
      if (rng.chance(0.5)) {
        return { startRoom: rooms[a], stairsRoom: rooms[b] };
      }
      return { startRoom: rooms[b], stairsRoom: rooms[a] };
    }
    if (dist > bestDist) {
      bestDist = dist;
      bestA = a;
      bestB = b;
    }
  }

  // Fallback: use the farthest pair found
  if (rng.chance(0.5)) {
    return { startRoom: rooms[bestA], stairsRoom: rooms[bestB] };
  }
  return { startRoom: rooms[bestB], stairsRoom: rooms[bestA] };
}

// Mark boss room floor tiles with a distinctive background color
export function markBossRoom(map: Tile[][], bossRoom: Room, biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  // Each biome gets a themed boss room floor color
  const bossFloorBg: Record<string, string> = {
    stoneDungeon: '#1a0808',    // dark crimson
    crystalCavern: '#0a0a1a',  // deep indigo
    ancientCrypt: '#140a14',   // dark purple
    lavaCore: '#1a0a04',       // dark ember
    voidAbyss: '#100818',       // void purple
  };
  const bg = bossFloorBg[biome] || '#1a0808';

  for (let y = bossRoom.y; y < bossRoom.y + bossRoom.h; y++) {
    for (let x = bossRoom.x; x < bossRoom.x + bossRoom.w; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height && map[y][x].walkable) {
        map[y][x] = { ...map[y][x], bg };
      }
    }
  }
}

// ============================================================
// Themed Rooms Support
// ============================================================

export function placeThemedRooms(
  map: Tile[][],
  rooms: Room[],
  biome: Biome,
  rng: SeededRandom,
  reservedRooms: Room[],
): {
  themedRooms: { room: Room; theme: RoomTheme }[];
  steamVentTurns: { x: number; y: number; spawnTurn: number }[];
} {
  const themedRooms: { room: Room; theme: RoomTheme }[] = [];
  const steamVentTurns: { x: number; y: number; spawnTurn: number }[] = [];

  // Get available themes for this biome
  const availableThemes = THEMES_BY_BIOME[biome];
  if (!availableThemes || availableThemes.length === 0) {
    return { themedRooms, steamVentTurns };
  }

  // Filter eligible rooms (not reserved, minimum size 5×5)
  const eligibleRooms = rooms.filter(room =>
    !reservedRooms.includes(room) &&
    room.w >= 5 &&
    room.h >= 5
  );

  if (eligibleRooms.length === 0) {
    return { themedRooms, steamVentTurns };
  }

  // Randomly select 3-5 rooms to become themed
  const numThemedRooms = rng.nextInt(3, Math.min(5, eligibleRooms.length));
  const shuffledRooms = [...eligibleRooms].sort(() => rng.next() - 0.5);
  const selectedRooms = shuffledRooms.slice(0, numThemedRooms);

  const mapHeight = map.length;
  const mapWidth = map[0]?.length || 0;

  // For each selected room, assign a theme and place terrain
  for (const room of selectedRooms) {
    // Pick a random theme from available themes
    const theme = rng.pick(availableThemes) as RoomTheme;
    const themeConfig = THEMED_ROOM_CONFIGS[theme];

    if (!themeConfig) continue;

    // Place terrain from the theme's template
    for (const terrain of themeConfig.terrainTemplate) {
      const targetX = room.centerX + terrain.offsetX;
      const targetY = room.centerY + terrain.offsetY;

      // Check bounds and only place on floor/corridor tiles (avoid overwriting walls, doors, special tiles)
      if (targetX >= 0 && targetX < mapWidth && targetY >= 0 && targetY < mapHeight) {
        const currentTile = map[targetY][targetX];
        if (currentTile.type !== TileType.Floor && currentTile.type !== TileType.Corridor) continue;
        const defaults = NEW_TILE_DEFAULTS[terrain.type];
        if (defaults) {
          // Place the terrain tile
          map[targetY][targetX] = makeTile(
            terrain.type,
            defaults.char,
            defaults.fg,
            defaults.bg,
            defaults.walkable,
            defaults.transparent
          );

          // Track SteamVent positions for the steamVentTurns field
          if (terrain.type === TileType.SteamVent) {
            steamVentTurns.push({
              x: targetX,
              y: targetY,
              spawnTurn: -1, // Will be set to current turn when floor is entered
            });
          }
        }
      }
    }

    // Record the themed room
    themedRooms.push({ room, theme });
  }

  return { themedRooms, steamVentTurns };
}
