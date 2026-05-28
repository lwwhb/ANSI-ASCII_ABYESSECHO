# 远古陵墓生成器重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 CryptGenerator.ts，从BSP+宽走廊改为放置式房间+Prim MST甬道，实现L/T/十字/八边形混合房间与石质地牢的视觉/结构差异化。

**Architecture:** 弃用BSP分割，改为：1) 随机放置不同形状房间(重叠检测)，2) Prim MST连接房间中心挖1格宽甬道，3) 额外1-2条循环甬道，4) 交叉点扩2×2，5) 保留现有装饰元素(石棺/火把/诅咒地面/壁龛)。

**Tech Stack:** TypeScript, SeededRandom (Mulberry32), 现有 DungeonGenerator 共享工具函数

---

### Task 1: 房间形状生成器

**Files:**
- Modify: `abyss-echo/src/generator/CryptGenerator.ts` (全量重写)

在 CryptGenerator.ts 顶部定义房间形状接口和5种形状的生成函数。所有形状返回统一的 `CryptRoom` 结构，包含 bounding box（用于重叠检测）和 floor tiles 列表（用于实际雕刻）。

- [ ] **Step 1: 定义 CryptRoom 接口和形状类型枚举**

在 CryptGenerator.ts 顶部添加：

```typescript
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
}
```

- [ ] **Step 2: 实现矩形生成函数**

```typescript
function makeRectRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const w = rng.nextInt(6, 12);
  const h = rng.nextInt(5, 9);
  const floorTiles: Position[] = [];
  for (let fy = y; fy < y + h; fy++) {
    for (let fx = x; fx < x + w; fx++) {
      floorTiles.push({ x: fx, y: fy });
    }
  }
  return { shape: 'rect', x, y, w, h, centerX: x + Math.floor(w / 2), centerY: y + Math.floor(h / 2), floorTiles };
}
```

- [ ] **Step 3: 实现L形生成函数**

```typescript
function makeLRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  // 横段
  const w1 = rng.nextInt(5, 8);
  const h1 = rng.nextInt(4, 6);
  // 竖段
  const w2 = rng.nextInt(3, 5);
  const h2 = rng.nextInt(4, 7);
  const totalW = Math.max(w1, w2 + (w1 - w2 > 0 ? rng.nextInt(0, w1 - w2) : 0));
  const totalH = h1 + h2;
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
  // 计算中心
  const sumX = floorTiles.reduce((s, p) => s + p.x, 0);
  const sumY = floorTiles.reduce((s, p) => s + p.y, 0);
  const centerX = Math.floor(sumX / floorTiles.length);
  const centerY = Math.floor(sumY / floorTiles.length);
  return { shape: 'l-shape', x, y, w: Math.max(w1, offsetX2 + w2), h: totalH, centerX, centerY, floorTiles };
}
```

- [ ] **Step 4: 实现T形生成函数**

```typescript
function makeTRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  // 横段（顶部）
  const w1 = rng.nextInt(7, 11);
  const h1 = rng.nextInt(3, 5);
  // 竖段（从横段中间向下延伸）
  const w2 = rng.nextInt(3, 5);
  const h2 = rng.nextInt(3, 6);
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
```

- [ ] **Step 5: 实现十字形生成函数**

```typescript
function makeCrossRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const cw = rng.nextInt(3, 5);
  const ch = rng.nextInt(3, 4);
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
```

- [ ] **Step 6: 实现八边形生成函数**

```typescript
function makeOctagonRoom(x: number, y: number, rng: SeededRandom): CryptRoom {
  const w = rng.nextInt(6, 10);
  const h = rng.nextInt(5, 8);
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
```

- [ ] **Step 7: 实现随机形状选择函数**

```typescript
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
```

- [ ] **Step 8: Commit**

```bash
cd abyss-echo && git add src/generator/CryptGenerator.ts
git commit -m "feat(crypt): add room shape generators (rect/L/T/cross/octagon)"
```

---

### Task 2: 房间放置与重叠检测

**Files:**
- Modify: `abyss-echo/src/generator/CryptGenerator.ts`

实现房间放置算法：随机选位置→检测重叠→放置。PADDING=2（墓室间距）。

- [ ] **Step 1: 实现重叠检测函数**

```typescript
const ROOM_PADDING = 2;

function roomsOverlap(a: CryptRoom, b: CryptRoom): boolean {
  return !(a.x + a.w + ROOM_PADDING <= b.x ||
           b.x + b.w + ROOM_PADDING <= a.x ||
           a.y + a.h + ROOM_PADDING <= b.y ||
           b.y + b.h + ROOM_PADDING <= a.y);
}
```

- [ ] **Step 2: 实现房间放置循环**

```typescript
const TARGET_ROOM_COUNT = 6;
const MAX_PLACE_ATTEMPTS = 200;

function placeRooms(mapWidth: number, mapHeight: number, rng: SeededRandom): CryptRoom[] {
  const rooms: CryptRoom[] = [];
  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS && rooms.length < TARGET_ROOM_COUNT; attempt++) {
    const margin = 3;
    const maxX = mapWidth - 13; // 最大房间宽12 + margin
    const maxY = mapHeight - 10; // 最大房间高9 + margin
    if (maxX <= margin || maxY <= margin) continue;
    const rx = rng.nextInt(margin, maxX);
    const ry = rng.nextInt(margin, maxY);
    const room = makeCryptRoom(rx, ry, rng);
    // 边界检查
    if (room.x + room.w >= mapWidth - 1 || room.y + room.h >= mapHeight - 1) continue;
    // 重叠检查
    if (rooms.some(r => roomsOverlap(r, room))) continue;
    rooms.push(room);
  }
  return rooms;
}
```

- [ ] **Step 3: 实现房间雕刻函数**

```typescript
function carveCryptRoom(map: Tile[][], room: CryptRoom, biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  for (const pos of room.floorTiles) {
    if (pos.y >= 0 && pos.y < height && pos.x >= 0 && pos.x < width) {
      map[pos.y][pos.x] = createTile(TileType.Floor, biome);
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd abyss-echo && git add src/generator/CryptGenerator.ts
git commit -m "feat(crypt): add room placement with overlap detection"
```

---

### Task 3: Prim MST 甬道连接

**Files:**
- Modify: `abyss-echo/src/generator/CryptGenerator.ts`

实现 Prim 最小生成树连接所有房间中心，挖1格宽甬道，额外1-2条循环甬道。

- [ ] **Step 1: 实现 Prim MST 函数**

```typescript
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
```

- [ ] **Step 2: 实现甬道挖掘函数（1格宽，沿用 carveCorridor）**

MST 边 + 额外循环边直接调用 `carveCorridor(map, rooms[e.from].centerX, rooms[e.from].centerY, rooms[e.to].centerX, rooms[e.to].centerY, biome)` 即可，1格宽是默认行为。

```typescript
function carveMSTCorridors(map: Tile[][], rooms: CryptRoom[], mstEdges: Edge[], biome: Biome, rng: SeededRandom): void {
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
  // 随机挑选短边
  allEdges.sort(() => rng.next() - 0.5);
  let added = 0;
  for (const edge of allEdges) {
    if (added >= loopCount) break;
    carveCorridor(map, rooms[edge.from].centerX, rooms[edge.from].centerY, rooms[edge.to].centerX, rooms[edge.to].centerY, biome);
    added++;
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd abyss-echo && git add src/generator/CryptGenerator.ts
git commit -m "feat(crypt): add Prim MST corridor connection"
```

---

### Task 4: 交叉点扩建与装饰

**Files:**
- Modify: `abyss-echo/src/generator/CryptGenerator.ts`

甬道交叉点扩2×2小厅，放置火把。然后放置石柱(十字形)、石棺、诅咒地面、壁龛。

- [ ] **Step 1: 实现交叉点扩建**

```typescript
function expandIntersections(map: Tile[][], biome: Biome): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type !== TileType.Corridor && map[y][x].type !== TileType.Floor) continue;
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
```

- [ ] **Step 2: 实现壁龛生成**

```typescript
function addWallNiches(map: Tile[][], rooms: CryptRoom[], biome: Biome, rng: SeededRandom): void {
  const height = map.length;
  const width = map[0]?.length || 0;
  for (const room of rooms) {
    if (room.floorTiles.length < 30) continue;
    // 扫描房间边界，找"墙→地面→墙"模式
    const nicheCandidates: Position[] = [];
    for (const pos of room.floorTiles) {
      // 检查上下左右是否有"地面格但外侧是墙"的模式
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = pos.x + dx, ny = pos.y + dy;
        const nnx = pos.x + dx * 2, nny = pos.y + dy * 2;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (!map[ny][nx].walkable && map[ny][nx].type === TileType.Wall) {
            // 再检查再外面一格是否还是墙（确保不是边界）
            if (nnx >= 0 && nnx < width && nny >= 0 && nny < height && map[nny][nnx].type === TileType.Wall) {
              nicheCandidates.push({ x: nx, y: ny });
            }
          }
        }
      }
    }
    // 15%概率开壁龛，记录位置用于后续放物品/敌人
    const nichesOpened: Position[] = [];
    for (const nc of nicheCandidates) {
      if (rng.chance(0.15)) {
        map[nc.y][nc.x] = createTile(TileType.Floor, biome);
        nichesOpened.push(nc);
      }
    }
    // 凹室内50%放物品，10%放敌人（在 generateCrypt 主函数中处理）
    room._niches = nichesOpened;
  }
}
```

- [ ] **Step 3: 保留现有装饰逻辑(石柱/石棺/火把/诅咒地面)并适配新数据结构**

将现有 CryptGenerator 中的石柱、石棺、火把、诅咒地面逻辑适配到 CryptRoom。关键变化：
- 石柱：十字形房间四角自动放置（替代原随机放置）
- 石棺：2-3个房间的中心附近
- 火把：甬道交叉点（替代原走廊交叉检测）
- 诅咒地面：10%地面格

```typescript
function addCryptDecorations(map: Tile[][], rooms: CryptRoom[], biome: Biome, rng: SeededRandom): void {
  const height = map.length;
  const width = map[0]?.length || 0;

  // 1. 诅咒地面：10% 的地面格
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((map[y][x].type === TileType.Floor || map[y][x].type === TileType.Corridor) && rng.chance(0.1)) {
        map[y][x] = createTile(TileType.CursedGround, biome);
      }
    }
  }

  // 2. 十字形房间放石柱
  for (const room of rooms) {
    if (room.shape !== 'cross') continue;
    const cx = room.centerX;
    const cy = room.centerY;
    // 四角石柱
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = cx + dx, py = cy + dy;
      if (py >= 0 && py < height && px >= 0 && px < width && map[py][px].walkable) {
        map[py][px] = { ...createTile(TileType.Wall, biome), char: '▓', fg: '#556655' };
      }
    }
  }

  // 3. 火把：甬道交叉点（≥3方向通行的走廊格）
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type !== TileType.Corridor) continue;
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
```

- [ ] **Step 4: Commit**

```bash
cd abyss-echo && git add src/generator/CryptGenerator.ts
git commit -m "feat(crypt): add intersections, niches, and decorations"
```

---

### Task 5: 重写 generateCrypt 主函数

**Files:**
- Modify: `abyss-echo/src/generator/CryptGenerator.ts`

用新的放置式架构替换BSP架构。保留所有现有DungeonData输出、Boss/精英/隐藏房间/主题房间逻辑。

- [ ] **Step 1: 重写 generateCrypt 函数**

将主函数改为：

1. `placeRooms()` 放置 5-8 个不同形状的墓室
2. `carveCryptRoom()` 雕刻每个墓室
3. `primMST()` + `carveMSTCorridors()` 连通
4. `expandIntersections()` 扩建交叉点
5. `addWallNiches()` 壁龛
6. `addCryptDecorations()` 装饰
7. `pickStartAndStairs()` 选择起点/楼梯
8. 放置楼梯、商店、事件
9. `placeBoss()` / `markBossRoom()`
10. `ensureBossReachable()`
11. `placeEliteAndSpecialRooms()`
12. `placeThemedRooms()`
13. `verifyConnectivity()` + 紧急走廊

关键：将 `CryptRoom[]` 转为 `Room[]`（用于共享函数如 placeEnemies、placeBoss 等），转换方式为使用 bounding box 作为 Room：

```typescript
function cryptRoomToRoom(cr: CryptRoom): Room {
  return { x: cr.x, y: cr.y, w: cr.w, h: cr.h, centerX: cr.centerX, centerY: cr.centerY };
}
```

- [ ] **Step 2: 移除旧的BSP相关函数**

删除旧的 `carveWideCorridorReal`、`connectRoomsWide`、`addLoopCorridorsWide` 函数和旧的 `generateCrypt` 函数体。

- [ ] **Step 3: Commit**

```bash
cd abyss-echo && git add src/generator/CryptGenerator.ts
git commit -m "feat(crypt): rewrite generator with placement+MST architecture"
```

---

### Task 6: 验证与调优

**Files:**
- Modify: `abyss-echo/src/generator/CryptGenerator.ts` (微调参数)

- [ ] **Step 1: Type-check**

```bash
cd abyss-echo && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 2: Build**

```bash
cd abyss-echo && npm run build
```

Expected: 构建成功

- [ ] **Step 3: 运行模拟验证连通性**

```bash
cd abyss-echo && npx tsx simulation/run.ts --runs=5 --floors=15 --class=warrior 2>&1 | head -30
```

Expected: 无崩溃，F11-F15正常通过

- [ ] **Step 4: 开发服务器手动检查**

```bash
cd abyss-echo && npm run dev
```

进入11-15层观察：
- 房间形状是否多样化（L/T/十/八边形可见）
- 走廊是否1格宽
- 交叉点是否2×2
- 石棺/火把/诅咒地面/壁龛是否正常出现
- 与1-5层石质地牢是否有明显视觉差异

- [ ] **Step 5: 根据测试微调参数**

可能需要调整的参数：
- `TARGET_ROOM_COUNT`：6→5-7
- `ROOM_PADDING`：2→3（如走廊太长）
- `SHAPE_WEIGHTS`：调整各形状比例
- 十字形石柱位置

- [ ] **Step 6: Commit**

```bash
cd abyss-echo && git add -A && git commit -m "feat(crypt): verify and tune crypt generator"
```
