import { Tile, TileType, Position, Biome, EliteAffix, BossArenaData, RoomTheme, HiddenRoomType, HiddenRoomData } from '../types';
import { SeededRandom } from '../utils/random';
import {
  MIN_ROOM_SIZE, MAX_ROOM_SIZE, ROOM_PADDING,
  MIN_BSP_SIZE, BSP_SPLIT_MIN, BSP_SPLIT_MAX, TILE_CHARS,
  BIOME_TILES, BIOME_CONFIG, getBiomeForFloor,
  ENEMIES_PER_FLOOR_BASE, ENEMIES_PER_FLOOR_GROWTH,
  BOSS_DEFS, BOSS_ARENA_OBJECTS, SPECIAL_ROOM_CHANCES,
  HIDDEN_ROOM_WEIGHTS,
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
  hiddenRooms: HiddenRoomData[];
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
  // Tiles that corridors can carve through (Wall + VoidWall + Lava + CooledLava + non-walkable obstacles + Water)
  const carveable = new Set([
    TileType.Wall, TileType.VoidWall, TileType.Lava, TileType.CooledLava,
    TileType.Sarcophagus, TileType.HiddenSarcophagus, TileType.Throne,
    TileType.Barricade, TileType.WeaponRack, TileType.Forge,
    TileType.Water, TileType.ShallowWater, TileType.PoisonGas,
  ]);

  while (x !== x2) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (carveable.has(map[y][x].type)) {
        map[y][x] = createTile(TileType.Corridor, biome);
      }
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      if (carveable.has(map[y][x].type)) {
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
  throne:            { char: '♔', fg: '#ffd700', bg: '#1a0808', walkable: false, transparent: false },
  barricade:         { char: '▦', fg: '#8b4513', bg: '#1a0808', walkable: false, transparent: true },
  webFloor:          { char: '≈', fg: '#aaaaaa', bg: '#0a0a1a', walkable: true,  transparent: true },
  spiderEgg:         { char: '◉', fg: '#cccccc', bg: '#0a0a1a', walkable: true,  transparent: true },
  altar:             { char: '⛩', fg: '#aaaaff', bg: '#140a14', walkable: true,  transparent: true },
  lavaPool:          { char: '≈', fg: '#ff4400', bg: '#1a0a04', walkable: false, transparent: true },
  voidRift:          { char: '◎', fg: '#ff44ff', bg: '#100818', walkable: true,  transparent: true },
  voidPillar:        { char: '█', fg: '#8800aa', bg: '#100818', walkable: false, transparent: false },
  corruptionPool:    { char: '◎', fg: '#aa00aa', bg: '#100818', walkable: true,  transparent: true },
  healCrystal:       { char: '◆', fg: '#00ffaa', bg: '#100818', walkable: true,  transparent: true },
  eliteDoor:         { char: '▦', fg: '#ffd700', bg: 'transparent', walkable: false, transparent: true },
  fountain:          { char: '⌠', fg: '#44aaff', bg: 'transparent', walkable: true, transparent: true },
  inscription:       { char: '▐', fg: '#ddddaa', bg: 'transparent', walkable: true, transparent: true },
  secretWall:        { char: '█', fg: '#555566', bg: '#555566', walkable: true, transparent: false },
  hiddenFloor:      { char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: false },
  monument:          { char: '☥', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true },
  spikeTrap:         { char: '▲', fg: '#8888ff', bg: '#222244', walkable: true, transparent: true },
  weaponRack:        { char: '⋔', fg: '#aaaaaa', bg: '#443322', walkable: false, transparent: false },
  forge:             { char: '⚒', fg: '#ff8800', bg: '#442200', walkable: false, transparent: false },
  steamVent:         { char: '≋', fg: '#cccccc', bg: '#445566', walkable: true, transparent: true },
  goldPile:          { char: '¤', fg: '#ffcc44', bg: '#1a0a2a', walkable: true, transparent: true },
  magicSpring:       { char: '∉', fg: '#44ccff', bg: '#0a1a2a', walkable: true, transparent: true },
  hiddenAltar:       { char: '☂', fg: '#cc88ff', bg: '#1a0a2a', walkable: true, transparent: true },
  libraryShelf:      { char: '≡', fg: '#ccaa66', bg: '#1a0a2a', walkable: true, transparent: true },
  fungiPatch:        { char: '♣', fg: '#44cc44', bg: '#0a1a0a', walkable: true, transparent: true },
  hiddenSarcophagus: { char: '▶', fg: '#aa8866', bg: '#1a0a2a', walkable: false, transparent: false },
};

// ============================================================
// Connectivity verification — ensures stairs are reachable from start
// ============================================================

export function verifyConnectivity(map: Tile[][], playerStart: Position, stairsDown: Position): boolean {
  return bfsReachable(map, playerStart, stairsDown);
}

/**
 * BFS reachability check between two positions.
 * Also exported for direct use when checking boss connectivity.
 */
export function bfsReachable(map: Tile[][], from: Position, to: Position): boolean {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  const visited = new Set<string>();
  const queue: [number, number][] = [[from.x, from.y]];
  visited.add(`${from.x},${from.y}`);
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h || visited.has(key)) continue;
      const tile = map[ny]?.[nx];
      if (!tile) continue;
      if (tile.walkable || tile.type === TileType.Door || tile.type === TileType.DoorOpen || tile.type === TileType.EliteDoor) {
        visited.add(key);
        if (nx === to.x && ny === to.y) return true;
        queue.push([nx, ny]);
      }
    }
  }
  return visited.has(`${to.x},${to.y}`);
}

/**
 * Find nearest walkable tile from a position (BFS).
 * Used by emergency corridor carving when start/stairs might be on non-walkable tiles.
 */
export function findNearestWalkable(map: Tile[][], pos: Position): Position {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  // If already walkable, return as-is
  if (pos.y >= 0 && pos.y < h && pos.x >= 0 && pos.x < w) {
    const tile = map[pos.y]?.[pos.x];
    if (tile && (tile.walkable || tile.type === TileType.Door || tile.type === TileType.DoorOpen || tile.type === TileType.EliteDoor)) {
      return pos;
    }
  }
  // BFS for nearest walkable tile
  const visited = new Set<string>([`${pos.x},${pos.y}`]);
  const queue: [number, number][] = [[pos.x, pos.y]];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h || visited.has(key)) continue;
      visited.add(key);
      const tile = map[ny]?.[nx];
      if (tile && (tile.walkable || tile.type === TileType.Door || tile.type === TileType.DoorOpen || tile.type === TileType.EliteDoor)) {
        return { x: nx, y: ny };
      }
      queue.push([nx, ny]);
    }
  }
  return pos; // Fallback
}

/**
 * Find a walkable tile within a specific room boundary.
 * Avoids finding tiles in disconnected regions outside the room.
 */
export function findWalkableInRoom(map: Tile[][], room: Room): Position | null {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  // Check center first
  if (room.centerY >= 0 && room.centerY < h && room.centerX >= 0 && room.centerX < w) {
    const tile = map[room.centerY]?.[room.centerX];
    if (tile && (tile.walkable || tile.type === TileType.Door || tile.type === TileType.DoorOpen || tile.type === TileType.EliteDoor)) {
      return { x: room.centerX, y: room.centerY };
    }
  }
  // Scan room interior for any walkable tile
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
    for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const tile = map[y]?.[x];
        if (tile && (tile.walkable || tile.type === TileType.Door || tile.type === TileType.DoorOpen || tile.type === TileType.EliteDoor)) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

/**
 * Ensure boss position is reachable from playerStart.
 * If not, carve an emergency corridor and brute-force if needed.
 * Returns the (potentially updated) boss position.
 */
export function ensureBossReachable(
  map: Tile[][],
  playerStart: Position,
  bossPos: Position,
  biome: Biome,
): Position {
  if (bfsReachable(map, playerStart, bossPos)) return bossPos;

  // Boss unreachable — carve emergency corridor
  const walkStart = findNearestWalkable(map, playerStart);
  const walkBoss = findNearestWalkable(map, bossPos);
  carveCorridor(map, walkStart.x, walkStart.y, walkBoss.x, walkBoss.y, biome);

  if (bfsReachable(map, playerStart, walkBoss)) return walkBoss;

  // Brute-force: carve every non-walkable tile on direct path
  let x = walkStart.x, y = walkStart.y;
  const ex = walkBoss.x, ey = walkBoss.y;
  while (x !== ex) {
    if (y >= 0 && y < map.length && x >= 0 && x < map[0].length && !map[y][x].walkable) {
      map[y][x] = createTile(TileType.Corridor, biome);
    }
    x += x < ex ? 1 : -1;
  }
  while (y !== ey) {
    if (y >= 0 && y < map.length && x >= 0 && x < map[0].length && !map[y][x].walkable) {
      map[y][x] = createTile(TileType.Corridor, biome);
    }
    y += y < ey ? 1 : -1;
  }
  return walkBoss;
}

// ============================================================
// Boss Arena Support
// ============================================================

export function placeBoss(rooms: Room[], floor: number, _biome: Biome): { defId: string; pos: Position; isBoss: boolean; bossRoom: Room; arenaData?: BossArenaData } | null {
  if (floor % 5 !== 0 && floor !== 30) return null;

  const bossIndex = floor === 30 ? 5 : Math.floor(floor / 5) - 1;
  const bossDef = BOSS_DEFS[Math.min(bossIndex, BOSS_DEFS.length - 1)];
  if (!bossDef) return null;

  // Pick the largest room for the boss arena (skip start room if known)
  const bossRoom = rooms.reduce((best, room) => {
    const area = room.w * room.h;
    const bestArea = best.w * best.h;
    return area > bestArea ? room : best;
  }, rooms[rooms.length - 1]);

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
      // Never overwrite StairsDown — player must be able to descend
      if (map[obj.y][obj.x].type === TileType.StairsDown) continue;
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

function placeHiddenRoomContent(
  map: Tile[][],
  roomType: HiddenRoomType,
  positions: Position[],
  center: Position,
  roomW: number,
  roomH: number,
  hx: number,
  hy: number,
  rng: SeededRandom,
  floor: number,
): void {
  switch (roomType) {
    case HiddenRoomType.Slaughterhouse:
    case HiddenRoomType.Treasury:
    case HiddenRoomType.Armory:
    case HiddenRoomType.AlchemyLab:
    case HiddenRoomType.Library:
    case HiddenRoomType.FungiPatch:
    case HiddenRoomType.Empty:
    case HiddenRoomType.MonsterNest:
      // Populated in enterFloor() with items/enemies
      break;

    case HiddenRoomType.MagicSpring: {
      const tile = NEW_TILE_DEFAULTS['magicSpring']!;
      map[center.y][center.x] = makeTile(TileType.MagicSpring, tile.char, tile.fg, tile.bg, tile.walkable, tile.transparent);
      break;
    }

    case HiddenRoomType.HiddenAltar: {
      const tile = NEW_TILE_DEFAULTS['hiddenAltar']!;
      map[center.y][center.x] = makeTile(TileType.HiddenAltar, tile.char, tile.fg, tile.bg, tile.walkable, tile.transparent);
      break;
    }

    case HiddenRoomType.AncientTomb: {
      const tile = NEW_TILE_DEFAULTS['hiddenSarcophagus']!;
      map[center.y][center.x] = makeTile(TileType.HiddenSarcophagus, tile.char, tile.fg, tile.bg, tile.walkable, tile.transparent);
      break;
    }

    case HiddenRoomType.VoidRift: {
      const tile = NEW_TILE_DEFAULTS['voidRift']!;
      map[center.y][center.x] = makeTile(TileType.VoidRiftRoom, tile.char, tile.fg, tile.bg, tile.walkable, tile.transparent);
      break;
    }
  }
}

function findRoomDoor(map: Tile[][], room: Room): Position | null {
  // Priority 1: Find Door/DoorOpen on room boundary (actual room entrance)
  const doors: Position[] = [];
  for (let y = room.y; y <= room.y + room.h; y++) {
    for (let x = room.x; x <= room.x + room.w; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
        const t = map[y][x].type;
        if (t === TileType.Door || t === TileType.DoorOpen) {
          doors.push({ x, y });
        }
      }
    }
  }
  if (doors.length > 0) return doors[0];

  // Priority 2: Find Corridor on room boundary
  for (let y = room.y; y <= room.y + room.h; y++) {
    for (let x = room.x; x <= room.x + room.w; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
        if (map[y][x].type === TileType.Corridor) {
          return { x, y };
        }
      }
    }
  }

  // Priority 3: Find any walkable tile on room boundary
  for (let y = room.y; y <= room.y + room.h; y++) {
    for (let x = room.x; x <= room.x + room.w; x++) {
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
  biome: Biome,
): {
  eliteEnemy: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix } | undefined;
  eliteRoom: Room | undefined;
  specialRooms: { type: TileType; room: Room; pos: Position }[];
  secretWalls: Position[];
  hiddenRooms: HiddenRoomData[];
} {
  let eliteEnemy: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix } | undefined = undefined;
  let eliteRoom: Room | undefined = undefined;
  const specialRooms: { type: TileType; room: Room; pos: Position }[] = [];
  const secretWalls: Position[] = [];
  const hiddenRooms: HiddenRoomData[] = [];

  const nonStartRooms = rooms.slice(1);
  if (nonStartRooms.length < 2) return { eliteEnemy, eliteRoom, specialRooms, secretWalls, hiddenRooms };

  // Elite room (40% chance, not on boss floors)
  if (floor % 5 !== 0 && rng.next() < SPECIAL_ROOM_CHANCES.eliteRoom) {
    const roomIdx = rng.nextInt(0, nonStartRooms.length - 1);
    const room = nonStartRooms[roomIdx];
    eliteRoom = room;

    // Place elite door at room entrance (but never overwrite StairsDown)
    const doorPos = findRoomDoor(map, room);
    if (doorPos && map[doorPos.y][doorPos.x].type !== TileType.StairsDown) {
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

  // Inscription room (20% chance) — skip if would overwrite StairsDown
  if (rng.next() < SPECIAL_ROOM_CHANCES.inscriptionRoom && nonStartRooms.length > 2) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const pos = { x: room.centerX, y: room.centerY };
    if (map[pos.y][pos.x].type !== TileType.StairsDown) {
      const d = NEW_TILE_DEFAULTS['inscription']!;
      map[pos.y][pos.x] = makeTile(TileType.Inscription, d.char, d.fg, d.bg, d.walkable, d.transparent);
      specialRooms.push({ type: TileType.Inscription, room, pos });
    }
  }

  // Fountain room (10% chance) — skip if would overwrite StairsDown
  if (rng.next() < SPECIAL_ROOM_CHANCES.fountainRoom && nonStartRooms.length > 3) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const pos = { x: room.centerX, y: room.centerY };
    if (map[pos.y][pos.x].type !== TileType.StairsDown) {
      const d = NEW_TILE_DEFAULTS['fountain']!;
      map[pos.y][pos.x] = makeTile(TileType.Fountain, d.char, d.fg, d.bg, d.walkable, d.transparent);
      specialRooms.push({ type: TileType.Fountain, room, pos });
    }
  }

  // Secret walls (1-2 per floor): create hidden rooms with secret wall entrances
  const wallCount = rng.nextInt(1, 2);
  for (let i = 0; i < wallCount; i++) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const wallPos = findRoomBoundaryWall(map, room, rng);
    if (!wallPos) continue;

    // Determine which direction is "outside" the room from the wall
    let dirX = 0;
    let dirY = 0;
    if (wallPos.y === room.y) dirY = -1;                    // Top wall → go up
    else if (wallPos.y === room.y + room.h) dirY = 1;      // Bottom wall → go down
    else if (wallPos.x === room.x) dirX = -1;              // Left wall → go left
    else if (wallPos.x === room.x + room.w) dirX = 1;      // Right wall → go right
    else {
      // Fallback: use direction toward room center
      dirX = room.centerX > wallPos.x ? -1 : room.centerX < wallPos.x ? 1 : 0;
      dirY = room.centerY > wallPos.y ? -1 : room.centerY < wallPos.y ? 1 : 0;
      if (dirX !== 0) dirY = 0;
    }

    // Variable hidden room size (3-5 each dimension)
    const roomW = rng.nextInt(3, 5);
    const roomH = rng.nextInt(3, 5);

    // Calculate hidden room top-left corner, ensuring it's directly adjacent to the wall
    let hx: number;
    let hy: number;
    if (dirY === -1) {
      hx = wallPos.x - Math.floor(roomW / 2);
      hy = wallPos.y - roomH;
    } else if (dirY === 1) {
      hx = wallPos.x - Math.floor(roomW / 2);
      hy = wallPos.y + 1;
    } else if (dirX === -1) {
      hx = wallPos.x - roomW;
      hy = wallPos.y - Math.floor(roomH / 2);
    } else {
      hx = wallPos.x + 1;
      hy = wallPos.y - Math.floor(roomH / 2);
    }

    // Pre-check: verify the hidden room area is entirely within Wall tiles (no overlap with existing rooms)
    let canCarve = true;
    for (let dy = 0; dy < roomH; dy++) {
      for (let dx = 0; dx < roomW; dx++) {
        const cx = hx + dx;
        const cy = hy + dy;
        if (cy < 1 || cy >= map.length - 1 || cx < 1 || cx >= map[0].length - 1) {
          canCarve = false;
          break;
        }
        // Only carve into Wall tiles; skip if tile is already walkable (existing room/corridor)
        if (map[cy][cx].walkable) {
          canCarve = false;
          break;
        }
      }
      if (!canCarve) break;
    }
    if (!canCarve) continue;

    // Additional perimeter check: ensure no walkable tile is adjacent to the hidden room boundary
    // (except at the secret wall entrance) to prevent open connections to regular rooms
    let perimeterClear = true;
    for (let dy = -1; dy <= roomH && perimeterClear; dy++) {
      for (let dx = -1; dx <= roomW && perimeterClear; dx++) {
        // Skip interior tiles and the secret wall entrance side
        const isInterior = dy >= 0 && dy < roomH && dx >= 0 && dx < roomW;
        if (isInterior) continue;
        const px = hx + dx;
        const py = hy + dy;
        if (px < 0 || px >= map[0].length || py < 0 || py >= map.length) continue;
        // Skip the secret wall position and its immediate neighbors
        if (Math.abs(px - wallPos.x) <= 1 && Math.abs(py - wallPos.y) <= 1) continue;
        if (map[py][px].walkable) {
          perimeterClear = false;
        }
      }
    }
    if (!perimeterClear) continue;

    // Carve hidden room with HiddenFloor tiles (all tiles confirmed to be Wall above)
    const roomPositions: Position[] = [];
    const d = NEW_TILE_DEFAULTS['hiddenFloor']!;
    for (let dy = 0; dy < roomH; dy++) {
      for (let dx = 0; dx < roomW; dx++) {
        const cx = hx + dx;
        const cy = hy + dy;
        map[cy][cx] = makeTile(TileType.HiddenFloor, d.char, d.fg, d.bg, d.walkable, d.transparent);
        roomPositions.push({ x: cx, y: cy });
      }
    }

    // Place secret wall at the entrance
    const sw = NEW_TILE_DEFAULTS['secretWall']!;
    map[wallPos.y][wallPos.x] = makeTile(TileType.SecretWall, sw.char, sw.fg, sw.bg, sw.walkable, sw.transparent);
    secretWalls.push(wallPos);

    // Pick hidden room type based on weights
    const typeEntries = Object.entries(HIDDEN_ROOM_WEIGHTS) as [HiddenRoomType, number][];
    const totalWeight = typeEntries.reduce((sum, [, w]) => sum + w, 0);
    let roll = rng.nextInt(1, totalWeight);
    let roomType: HiddenRoomType = HiddenRoomType.Empty;
    for (const [t, w] of typeEntries) {
      roll -= w;
      if (roll <= 0) { roomType = t; break; }
    }

    const center: Position = {
      x: hx + Math.floor(roomW / 2),
      y: hy + Math.floor(roomH / 2),
    };

    placeHiddenRoomContent(map, roomType, roomPositions, center, roomW, roomH, hx, hy, rng, floor);

    hiddenRooms.push({ type: roomType, positions: roomPositions, center, secretWallPos: wallPos });
  }

  return { eliteEnemy, eliteRoom, specialRooms, secretWalls, hiddenRooms };
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
      const trapTypes = [TileType.TrapSpike, TileType.TrapFire, TileType.TrapTeleport, TileType.TrapPoison,
        TileType.TrapParalysis, TileType.TrapConfusion, TileType.TrapBlind, TileType.TrapAlarm];
      const trapType = rng.pick(trapTypes);
      const tx = rng.nextInt(room.x + 1, room.x + room.w - 2);
      const ty = rng.nextInt(room.y + 1, room.y + room.h - 2);
      if (map[ty][tx].type === TileType.Floor) {
        map[ty][tx] = createTile(trapType, biome);
      }
    }
  }
}

export function placeEnemies(rooms: Room[], floor: number, rng: SeededRandom, enemyIds: string[], map?: Tile[][], startRoom?: Room): { defId: string; pos: Position; isBoss: boolean }[] {
  const count = Math.floor(ENEMIES_PER_FLOOR_BASE + ENEMIES_PER_FLOOR_GROWTH * Math.sqrt(floor));
  const enemies: { defId: string; pos: Position; isBoss: boolean }[] = [];
  // Exclude start room so player doesn't land on enemies when descending
  const spawnRooms = rooms.filter(r => r !== startRoom);
  if (spawnRooms.length === 0) return enemies;

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
