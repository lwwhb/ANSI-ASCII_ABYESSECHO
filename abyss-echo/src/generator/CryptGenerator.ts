import { TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import { BIOME_CONFIG } from '../constants';
import {
  DungeonData, Room,
  createTile, fillMap,
  carveCorridor, addEnvironment,
  placeEnemies, placeItems, placeBoss, markBossRoom,
  pickStartAndStairs, placeArenaObjects, placeEliteAndSpecialRooms,
  placeThemedRooms, verifyConnectivity, findNearestWalkable,
  ensureBossReachable,
} from './DungeonGenerator';

// ── Crypt Room Types ──────────────────────────────────────────────

type CryptShapeType = 'rect' | 'l-shape' | 't-shape' | 'cross' | 'octagon';

interface CryptRoom {
  shape: CryptShapeType;
  x: number;   // bounding box 左上角
  y: number;
  w: number;   // bounding box 宽
  h: number;   // bounding box 高
  centerX: number;
  centerY: number;
  floorTiles: Position[];  // 实际需要雕刻为地面的格子坐标
  niches?: Position[];     // 壁龛位置（由 addWallNiches 填充）
}

// ── Room Shape Generators ─────────────────────────────────────────

function makeRectRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const w = rng.nextInt(8, 14);
  const h = rng.nextInt(6, 11);
  const floorTiles: Position[] = [];
  for (let fy = y; fy < y + h; fy++) {
    for (let fx = x; fx < x + w; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  return { shape: 'rect', x, y, w, h, centerX: x + Math.floor(w / 2), centerY: y + Math.floor(h / 2), floorTiles };
}

function makeLRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  // 横段
  const w1 = rng.nextInt(7, 12);
  const h1 = rng.nextInt(5, 8);
  // 竖段
  const w2 = rng.nextInt(4, 7);
  const h2 = rng.nextInt(5, 9);
  const offsetX2 = rng.nextInt(0, Math.max(0, w1 - w2));
  const floorTiles: Position[] = [];
  // 横段
  for (let fy = y; fy < y + h1; fy++) {
    for (let fx = x; fx < x + w1; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  // 竖段（从横段右下角偏移处向下延伸）
  for (let fy = y + h1; fy < y + h1 + h2; fy++) {
    for (let fx = x + offsetX2; fx < x + offsetX2 + w2; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  const sumX = floorTiles.reduce((s, p) => s + p.x, 0);
  const sumY = floorTiles.reduce((s, p) => s + p.y, 0);
  const centerX = Math.floor(sumX / floorTiles.length);
  const centerY = Math.floor(sumY / floorTiles.length);
  return { shape: 'l-shape', x, y, w: Math.max(w1, offsetX2 + w2), h: h1 + h2, centerX, centerY, floorTiles };
}

function makeTRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  // 横段（顶部）
  const w1 = rng.nextInt(9, 14);
  const h1 = rng.nextInt(4, 7);
  // 竖段（从横段中间向下延伸）
  const w2 = rng.nextInt(4, 7);
  const h2 = rng.nextInt(4, 8);
  const offsetV = Math.floor((w1 - w2) / 2);
  const totalH = h1 + h2;
  const floorTiles: Position[] = [];
  // 横段
  for (let fy = y; fy < y + h1; fy++) {
    for (let fx = x; fx < x + w1; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  // 竖段
  for (let fy = y + h1; fy < y + h1 + h2; fy++) {
    for (let fx = x + offsetV; fx < x + offsetV + w2; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  const sumX = floorTiles.reduce((s, p) => s + p.x, 0);
  const sumY = floorTiles.reduce((s, p) => s + p.y, 0);
  return { shape: 't-shape', x, y, w: w1, h: totalH, centerX: Math.floor(sumX / floorTiles.length), centerY: Math.floor(sumY / floorTiles.length), floorTiles };
}

function makeCrossRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const cw = rng.nextInt(4, 6);
  const ch = rng.nextInt(3, 5);
  const armLen = rng.nextInt(2, 4);
  const totalW = cw + armLen * 2;
  const totalH = ch + armLen * 2;
  const floorTiles: Position[] = [];
  const cx = x + armLen;
  const cy = y + armLen;
  // 中心
  for (let fy = cy; fy < cy + ch; fy++) {
    for (let fx = cx; fx < cx + cw; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  // 上臂
  for (let fy = y; fy < cy; fy++) {
    for (let fx = cx; fx < cx + cw; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  // 下臂
  for (let fy = cy + ch; fy < y + totalH; fy++) {
    for (let fx = cx; fx < cx + cw; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  // 左臂
  for (let fy = cy; fy < cy + ch; fy++) {
    for (let fx = x; fx < cx; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  // 右臂
  for (let fy = cy; fy < cy + ch; fy++) {
    for (let fx = cx + cw; fx < x + totalW; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  return { shape: 'cross', x, y, w: totalW, h: totalH, centerX: cx + Math.floor(cw / 2), centerY: cy + Math.floor(ch / 2), floorTiles };
}

function makeOctagonRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const w = rng.nextInt(8, 12);
  const h = rng.nextInt(6, 10);
  const cutSize = rng.nextInt(1, 2);
  const floorTiles: Position[] = [];
  for (let fy = y; fy < y + h; fy++) {
    for (let fx = x; fx < x + w; fx++) {
      const dx = Math.min(fx - x, x + w - 1 - fx);
      const dy = Math.min(fy - y, y + h - 1 - fy);
      if (dx + dy < cutSize + 1) continue; // 切角
      floorTiles.push({ x: fx, y: fy });
    }
  }
  const sumX = floorTiles.reduce((s, p) => s + p.x, 0);
  const sumY = floorTiles.reduce((s, p) => s + p.y, 0);
  return { shape: 'octagon', x, y, w, h, centerX: Math.floor(sumX / floorTiles.length), centerY: Math.floor(sumY / floorTiles.length), floorTiles };
}

// ── Shape Selection ───────────────────────────────────────────────

const SHAPE_WEIGHTS: [CryptShapeType, number][] = [
  ['rect', 20],
  ['l-shape', 25],
  ['t-shape', 20],
  ['cross', 20],
  ['octagon', 15],
];

function pickShape(rng: SeededRandom): CryptShapeType {
  const total = SHAPE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = rng.nextInt(0, total - 1);
  for (const [shape, weight] of SHAPE_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return shape;
  }
  return 'rect';
}

function makeCryptRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const shape = pickShape(rng);
  switch (shape) {
    case 'l-shape': return makeLRoom(x, y, rng);
    case 't-shape': return makeTRoom(x, y, rng);
    case 'cross': return makeCrossRoom(x, y, rng);
    case 'octagon': return makeOctagonRoom(x, y, rng);
    default: return makeRectRoom(x, y, rng);
  }
}

// ── Room Placement ────────────────────────────────────────────────

const ROOM_PADDING = 2;
const TARGET_ROOM_COUNT = 9;
const MAX_PLACE_ATTEMPTS = 400;

function roomsOverlap(a: CryptRoom, b: CryptRoom): boolean {
  // 用实际 floorTiles + padding 检测：确保两个房间的地面之间至少有2格墙
  const bSet = new Set(b.floorTiles.map(p => `${p.x},${p.y}`));
  for (const pos of a.floorTiles) {
    for (let dy = -ROOM_PADDING; dy <= ROOM_PADDING; dy++) {
      for (let dx = -ROOM_PADDING; dx <= ROOM_PADDING; dx++) {
        if (bSet.has(`${pos.x + dx},${pos.y + dy}`)) return true;
      }
    }
  }
  return false;
}

function placeRooms(mapWidth: number, mapHeight: number, rng: SeededRandom): CryptRoom[] {
  const rooms: CryptRoom[] = [];
  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS && rooms.length < TARGET_ROOM_COUNT; attempt++) {
    const margin = 2;
    const rx = rng.nextInt(margin, mapWidth - 15);
    const ry = rng.nextInt(margin, mapHeight - 12);
    if (rx < margin || ry < margin) continue;
    const room = makeCryptRoom(rx, ry, rng);
    // 边界检查（确保房间四边都有墙）
    if (room.x < 1 || room.y < 1 || room.x + room.w >= mapWidth - 1 || room.y + room.h >= mapHeight - 1) continue;
    // 重叠检查（使用实际 floorTiles + padding）
    if (rooms.some(r => roomsOverlap(r, room))) continue;
    rooms.push(room);
  }
  return rooms;
}

function carveCryptRoom(map: import('../types').Tile[][], room: CryptRoom, biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  for (const pos of room.floorTiles) {
    if (pos.y >= 0 && pos.y < height && pos.x >= 0 && pos.x < width) {
      map[pos.y][pos.x] = createTile(TileType.Floor, biome);
    }
  }
}

// ── Prim MST Corridor Connection ─────────────────────────────────

interface Edge {
  from: number;
  to: number;
  dist: number;
}

function primMST(rooms: CryptRoom[]): Edge[] {
  const n = rooms.length;
  if (n <= 1) return [];
  const inTree = new Array(n).fill(false);
  const edges: Edge[] = [];
  inTree[0] = true;
  let count = 1;
  while (count < n) {
    let bestDist = Infinity;
    let bestFrom = -1;
    let bestTo = -1;
    for (let i = 0; i < n; i++) {
      if (!inTree[i]) continue;
      for (let j = 0; j < n; j++) {
        if (inTree[j]) continue;
        const d = Math.abs(rooms[i].centerX - rooms[j].centerX) + Math.abs(rooms[i].centerY - rooms[j].centerY);
        if (d < bestDist) {
          bestDist = d;
          bestFrom = i;
          bestTo = j;
        }
      }
    }
    if (bestTo === -1) break;
    inTree[bestTo] = true;
    edges.push({ from: bestFrom, to: bestTo, dist: bestDist });
    count++;
  }
  return edges;
}

function carveMSTCorridors(map: import('../types').Tile[][], rooms: CryptRoom[], mstEdges: Edge[], biome: Biome, rng: SeededRandom): void {
  // MST 边
  for (const edge of mstEdges) {
    carveCorridor(map, rooms[edge.from].centerX, rooms[edge.from].centerY, rooms[edge.to].centerX, rooms[edge.to].centerY, biome);
  }
  // 额外 1-2 条循环甬道
  const loopCount = rng.nextInt(1, 2);
  const allEdges: Edge[] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (!mstEdges.some(e => (e.from === i && e.to === j) || (e.from === j && e.to === i))) {
        allEdges.push({ from: i, to: j, dist: Math.abs(rooms[i].centerX - rooms[j].centerX) + Math.abs(rooms[i].centerY - rooms[j].centerY) });
      }
    }
  }
  // 随机挑选边作为循环甬道（Fisher-Yates shuffle）
  for (let i = allEdges.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [allEdges[i], allEdges[j]] = [allEdges[j], allEdges[i]];
  }
  let added = 0;
  for (const edge of allEdges) {
    if (added >= loopCount) break;
    carveCorridor(map, rooms[edge.from].centerX, rooms[edge.from].centerY, rooms[edge.to].centerX, rooms[edge.to].centerY, biome);
    added++;
  }
}

// ── Intersection Expansion ───────────────────────────────────────

function expandIntersections(map: import('../types').Tile[][], biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // 只在走廊格上扩建（不在房间Floor上，避免房间内连锁扩展）
      if (map[y][x].type !== TileType.Corridor) continue;
      let walkableNeighbors = 0;
      for (const [dx, dy] of dirs) {
        if (map[y + dy]?.[x + dx]?.walkable) walkableNeighbors++;
      }
      // 3条及以上通路交汇 → 扩为2×2
      if (walkableNeighbors >= 3) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const ty = y + dy, tx = x + dx;
            if (ty < height && tx < width && !map[ty][tx].walkable && map[ty][tx].type === TileType.Wall) {
              map[ty][tx] = createTile(TileType.Floor, biome);
            }
          }
        }
      }
    }
  }
}

// ── Wall Niches ───────────────────────────────────────────────────

function addWallNiches(map: import('../types').Tile[][], rooms: CryptRoom[], biome: Biome, rng: SeededRandom): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  for (const room of rooms) {
    if (room.floorTiles.length < 30) continue;
    const nicheCandidates: Position[] = [];
    for (const pos of room.floorTiles) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = pos.x + dx, ny = pos.y + dy;
        const nnx = pos.x + dx * 2, nny = pos.y + dy * 2;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (!map[ny][nx].walkable && map[ny][nx].type === TileType.Wall) {
            if (nnx >= 0 && nnx < width && nny >= 0 && nny < height && map[nny][nnx].type === TileType.Wall) {
              nicheCandidates.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
    // 15%概率开壁龛
    const nichesOpened: Position[] = [];
    for (const nc of nicheCandidates) {
      if (rng.chance(0.15)) {
        map[nc.y][nc.x] = createTile(TileType.Floor, biome);
        nichesOpened.push(nc);
      }
    }
    // 壁龛内容：50%放石棺（高级物品），10%空凹室，40%普通地面
    for (const nc of nichesOpened) {
      if (rng.chance(0.5)) {
        map[nc.y][nc.x] = createTile(TileType.Sarcophagus, biome);
      }
    }
    room.niches = nichesOpened;
  }
}

// ── Crypt Decorations ─────────────────────────────────────────────

function addCryptDecorations(map: import('../types').Tile[][], rooms: CryptRoom[], biome: Biome, rng: SeededRandom): void {
  const height = map.length;
  const width = map[0]?.length || 0;

  // 1. 诅咒地面：10% 的地面格（跳过交叉点扩建区域）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((map[y][x].type === TileType.Floor || map[y][x].type === TileType.Corridor) && rng.chance(0.1)) {
        // 跳过交叉点扩建区域：Floor格且有≥2个相邻Corridor
        if (map[y][x].type === TileType.Floor) {
          let adjCorr = 0;
          if (y > 0 && map[y - 1][x].type === TileType.Corridor) adjCorr++;
          if (y < height - 1 && map[y + 1][x].type === TileType.Corridor) adjCorr++;
          if (x > 0 && map[y][x - 1].type === TileType.Corridor) adjCorr++;
          if (x < width - 1 && map[y][x + 1].type === TileType.Corridor) adjCorr++;
          if (adjCorr >= 2) continue; // 交叉点扩建区，不加诅咒
        }
        map[y][x] = createTile(TileType.CursedGround, biome);
      }
    }
  }

  // 2. 十字形房间放石柱
  for (const room of rooms) {
    if (room.shape !== 'cross') continue;
    const cx = room.centerX;
    const cy = room.centerY;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const px = cx + dx, py = cy + dy;
      if (py >= 0 && py < height && px >= 0 && px < width && map[py][px].walkable) {
        map[py][px] = { ...createTile(TileType.Wall, biome), char: '▓', fg: '#556655' };
      }
    }
  }

  // 2b. 矩形/L/T/八边形大房间也放石柱（2-4个），制造走廊战
  for (const room of rooms) {
    if (room.shape === 'cross') continue;
    if (room.w < 7 || room.h < 6) continue; // 只在较大房间
    const pillarCount = rng.nextInt(2, 5);
    for (let p = 0; p < pillarCount; p++) {
      const tile = room.floorTiles[rng.nextInt(0, room.floorTiles.length - 1)];
      if (map[tile.y][tile.x].type === TileType.Floor || map[tile.y][tile.x].type === TileType.CursedGround) {
        // 不在房间中心放石柱（留给Boss/特殊物件）
        if (tile.x === room.centerX && tile.y === room.centerY) continue;
        map[tile.y][tile.x] = { ...createTile(TileType.Wall, biome), char: '▓', fg: '#556655' };
      }
    }
  }

  // 3. 火把：甬道交叉点（≥3方向通行的走廊格或扩建后的Floor格）
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type !== TileType.Corridor && map[y][x].type !== TileType.Floor) continue;
      // 只在非房间区域放火把（排除房间内部Floor）
      if (map[y][x].type === TileType.Floor) {
        // 检查是否为交叉点扩建区域：上下左右中至少2个Corridor
        let adjacentCorridors = 0;
        if (map[y - 1][x].type === TileType.Corridor) adjacentCorridors++;
        if (map[y + 1][x].type === TileType.Corridor) adjacentCorridors++;
        if (map[y][x - 1].type === TileType.Corridor) adjacentCorridors++;
        if (map[y][x + 1].type === TileType.Corridor) adjacentCorridors++;
        if (adjacentCorridors < 2) continue;
      }
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

  // 4. 石棺：2-3个房间
  const sarcCount = rng.nextInt(2, 4);
  const sarcRooms = [...rooms].sort(() => rng.next() - 0.5).slice(0, sarcCount);
  for (const room of sarcRooms) {
    const tile = room.floorTiles[rng.nextInt(0, room.floorTiles.length - 1)];
    if (map[tile.y][tile.x].type === TileType.Floor || map[tile.y][tile.x].type === TileType.CursedGround) {
      map[tile.y][tile.x] = createTile(TileType.Sarcophagus, biome);
    }
  }
}

// ── CryptRoom → Room conversion ──────────────────────────────────

function cryptRoomToRoom(cr: CryptRoom): Room {
  return { x: cr.x, y: cr.y, w: cr.w, h: cr.h, centerX: cr.centerX, centerY: cr.centerY };
}

// ── Main Generator ────────────────────────────────────────────────

export function generateCrypt(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.AncientCrypt;
  const config = BIOME_CONFIG[biome];
  const width = config.mapWidth;
  const height = config.mapHeight;

  // 1. 放置不同形状的墓室
  const cryptRooms = placeRooms(width, height, rng);
  if (cryptRooms.length === 0) {
    cryptRooms.push(makeRectRoom(5, 5, rng));
  }

  // 2. 雕刻墓室
  const map = fillMap(biome, width, height);
  for (const room of cryptRooms) {
    carveCryptRoom(map, room, biome);
  }

  // 3. MST 甬道连接 + 循环甬道
  const mstEdges = primMST(cryptRooms);
  carveMSTCorridors(map, cryptRooms, mstEdges, biome, rng);

  // 4. 交叉点扩建
  expandIntersections(map, biome);

  // 5. 壁龛
  addWallNiches(map, cryptRooms, biome, rng);

  // 6. 装饰（诅咒地面、石柱、火把、石棺）
  addCryptDecorations(map, cryptRooms, biome, rng);

  // 转换为 Room[] 用于共享函数
  const rooms = cryptRooms.map(cryptRoomToRoom);

  // Environment (traps, gas)
  addEnvironment(map, rooms, biome, rng, floor);

  // Player start and stairs: randomly pick far-apart rooms
  const { startRoom, stairsRoom } = pickStartAndStairs(rooms, rng, width, height);
  const playerStart = { x: startRoom.centerX, y: startRoom.centerY };
  const stairsDown = { x: stairsRoom.centerX, y: stairsRoom.centerY };
  map[stairsDown.y][stairsDown.x] = createTile(TileType.StairsDown, biome);

  const enemies = placeEnemies(rooms, floor, rng, config.enemyIds, map, startRoom);
  const items = placeItems(rooms, floor, rng, config.itemsPerFloorBase, config.itemsPerFloorGrowth, map);

  let shopPos: Position | undefined;
  let eventPos: Position | undefined;
  const eligibleRooms = rooms.length > 2 ? rooms.slice(1, -1) : rooms.slice(1);
  if (eligibleRooms.length > 0) {
    if (rng.chance(config.shopChance)) {
      const shopRoom = rng.pick(eligibleRooms);
      // 非矩形房间 bounding box 内可能有墙格，找可行走位置
      let shopFound = false;
      for (let attempt = 0; attempt < 15 && !shopFound; attempt++) {
        const sx = rng.nextInt(shopRoom.x + 1, shopRoom.x + shopRoom.w - 2);
        const sy = rng.nextInt(shopRoom.y + 1, shopRoom.y + shopRoom.h - 2);
        if (map[sy][sx].walkable && map[sy][sx].type !== TileType.StairsDown) {
          shopPos = { x: sx, y: sy };
          shopFound = true;
        }
      }
      if (shopPos) {
        map[shopPos.y][shopPos.x] = createTile(TileType.Shop, biome);
      } else {
        shopPos = undefined;
      }
    }
    if (rng.chance(config.eventChance)) {
      const eventRoom = rng.pick(eligibleRooms);
      let eventFound = false;
      for (let attempt = 0; attempt < 15 && !eventFound; attempt++) {
        const ex = rng.nextInt(eventRoom.x + 1, eventRoom.x + eventRoom.w - 2);
        const ey = rng.nextInt(eventRoom.y + 1, eventRoom.y + eventRoom.h - 2);
        if (map[ey][ex].walkable && map[ey][ex].type !== TileType.StairsDown &&
            (!shopPos || ex !== shopPos.x || ey !== shopPos.y)) {
          eventPos = { x: ex, y: ey };
          eventFound = true;
        }
      }
      if (eventPos) {
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
    const walkStart = findNearestWalkable(map, playerStart);
    const walkStairs = findNearestWalkable(map, stairsDown);
    carveCorridor(map, walkStart.x, walkStart.y, walkStairs.x, walkStairs.y, biome);
    // Brute-force fallback: carve every non-walkable tile on the direct path
    if (!verifyConnectivity(map, playerStart, stairsDown)) {
      let x = walkStart.x, y = walkStart.y;
      const ex = walkStairs.x, ey = walkStairs.y;
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
