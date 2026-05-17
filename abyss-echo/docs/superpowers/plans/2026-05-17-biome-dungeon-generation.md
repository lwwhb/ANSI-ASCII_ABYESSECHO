# Biome-Specific Dungeon Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single BSP dungeon generator with 5 biome-specific generators, each with unique map layout, size, enemies, supply pacing, and mechanics.

**Architecture:** The existing `generateDungeon()` becomes a router that dispatches to biome-specific generator functions. Each generator lives in its own file under `src/generator/` and returns the same `DungeonData` interface. New TileType enums, enemy defs, and biome mechanics are added incrementally.

**Tech Stack:** TypeScript, existing SeededRandom, Canvas rendering, Zustand store

**Spec:** `docs/superpowers/specs/2026-05-17-biome-dungeon-generation-design.md`

---

## File Structure

### New Files
- `src/generator/StoneDungeonGenerator.ts` — BSP + loop corridors (1-5F)
- `src/generator/CrystalCaveGenerator.ts` — Cellular automata caves (6-10F)
- `src/generator/CryptGenerator.ts` — Wide-corridor BSP (11-15F)
- `src/generator/LavaCoreGenerator.ts` — Island + bridge (16-20F)
- `src/generator/VoidAbyssGenerator.ts` — Fragment + portal (21F+)

### Modified Files
- `src/types/index.ts` — New TileType values, PotionEffect, ScrollEffect, GameState fields
- `src/constants/index.ts` — Map size as function, new ENEMY_DEFS, BIOME_CONFIG updates, new tile chars, new items
- `src/generator/DungeonGenerator.ts` — Becomes router, shared utilities extracted
- `src/store/gameStore.ts` — New mechanics (lava tide, void corruption, echo, cursed ground, portal interaction)
- `src/components/MiniMap.tsx` — Echo mechanic rendering, dynamic map size
- `src/components/MapView.tsx` — New TileType rendering, dynamic map size
- `src/engine/FOV.ts` — Refraction mechanic
- `src/engine/Combat.ts` — Reflect damage, mirror explode
- `src/entities/Enemy.ts` — New enemy special abilities
- `src/entities/Items.ts` — New item types (fire resist potion, portal scroll)

---

## Task 1: Types & Constants Foundation

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/constants/index.ts`

This task establishes all new types and constants that later tasks depend on. No behavioral changes yet.

- [ ] **Step 1: Add new TileType values to `src/types/index.ts`**

Add these new values to the `TileType` enum:

```typescript
export enum TileType {
  Wall = 'wall',
  Floor = 'floor',
  Corridor = 'corridor',
  Door = 'door',
  DoorOpen = 'doorOpen',
  StairsDown = 'stairsDown',
  Water = 'water',
  Lava = 'lava',
  PoisonGas = 'poisonGas',
  TrapSpike = 'trapSpike',
  TrapFire = 'trapFire',
  TrapTeleport = 'trapTeleport',
  TrapPoison = 'trapPoison',
  Shop = 'shop',
  Event = 'event',
  // New tile types
  ShallowWater = 'shallowWater',    // Walkable but costs 2 turns (crystal cavern)
  CursedGround = 'cursedGround',    // Curses equipped items on step (crypt)
  CooledLava = 'cooledLava',        // Walkable but 5 dmg/turn (lava core)
  VoidWall = 'voidWall',            // Impassable, blocks vision (void abyss)
  Portal = 'portal',                // Teleport between fragments (void abyss)
  Torch = 'torch',                  // Decorative + 3-tile permanent light (crypt)
  Sarcophagus = 'sarcophagus',      // Interactable: 50% item, 50% trap (crypt)
}
```

Add new PotionEffect:

```typescript
export enum PotionEffect {
  Healing = 'healing',
  ManaRestore = 'manaRestore',
  Strength = 'strength',
  Dexterity = 'dexterity',
  Intelligence = 'intelligence',
  Poison = 'poisonEffect',
  Paralysis = 'paralysis',
  Confusion = 'confusion',
  FullHeal = 'fullHeal',
  FireResist = 'fireResist',        // New: 5-turn fire immunity
}
```

Add new ScrollEffect:

```typescript
export enum ScrollEffect {
  Identify = 'identify',
  Mapping = 'mapping',
  Teleport = 'teleport',
  Fireball = 'fireball',
  IceStorm = 'iceStorm',
  Lightning = 'lightning',
  Enchant = 'enchant',
  RemoveCurse = 'removeCurse',
  CreatePortal = 'createPortal',    // New: create temp portal
}
```

- [ ] **Step 2: Add new tile chars to `src/constants/index.ts` TILE_CHARS**

Add entries for all new TileType values in the `TILE_CHARS` object:

```typescript
[TileType.ShallowWater]: { char: '≈', fg: '#5599dd', bg: '#112244', walkable: true,  transparent: true },
[TileType.CursedGround]: { char: '·', fg: '#776699', bg: '#151020', walkable: true,  transparent: true },
[TileType.CooledLava]:   { char: '≈', fg: '#994433', bg: '#221100', walkable: true,  transparent: true },
[TileType.VoidWall]:     { char: '█', fg: '#442288', bg: '#0a0015', walkable: false, transparent: false },
[TileType.Portal]:       { char: '⊙', fg: '#cc44ff', bg: '#0a0a1e', walkable: true,  transparent: true },
[TileType.Torch]:        { char: '♫', fg: '#ffaa44', bg: '#1a221a', walkable: false, transparent: true },
[TileType.Sarcophagus]:  { char: '■', fg: '#888877', bg: '#1a221a', walkable: false, transparent: false },
```

- [ ] **Step 3: Add biome tile overrides for new types in `BIOME_TILES`**

Add entries in each biome's `BIOME_TILES` for the new tile types they use:

```typescript
[Biome.CrystalCavern]: {
  // ...existing entries...
  [TileType.ShallowWater]: { char: '≈', fg: '#88aaff', bg: '#1a1a4e' },
},
[Biome.AncientCrypt]: {
  // ...existing entries...
  [TileType.CursedGround]: { char: '·', fg: '#8877aa', bg: '#151020' },
  [TileType.Torch]:        { char: '♫', fg: '#ffaa44', bg: '#1a221a' },
  [TileType.Sarcophagus]:  { char: '■', fg: '#999988', bg: '#1a221a' },
},
[Biome.LavaCore]: {
  // ...existing entries...
  [TileType.CooledLava]: { char: '≈', fg: '#aa5533', bg: '#221100' },
},
[Biome.VoidAbyss]: {
  // ...existing entries...
  [TileType.VoidWall]: { char: '█', fg: '#5533aa', bg: '#0a0015' },
  [TileType.Portal]:   { char: '⊙', fg: '#dd55ff', bg: '#0a0a1e' },
},
```

- [ ] **Step 4: Replace fixed MAP_WIDTH/HEIGHT with biome map size function**

Replace the fixed constants:

```typescript
// Remove:
// export const MAP_WIDTH = 80;
// export const MAP_HEIGHT = 28;

// Add:
export const DEFAULT_MAP_WIDTH = 80;
export const DEFAULT_MAP_HEIGHT = 28;

export function getMapSizeForBiome(biome: Biome): { width: number; height: number } {
  switch (biome) {
    case Biome.StoneDungeon: return { width: 70, height: 24 };
    case Biome.CrystalCavern: return { width: 80, height: 28 };
    case Biome.AncientCrypt: return { width: 70, height: 30 };
    case Biome.LavaCore: return { width: 90, height: 28 };
    case Biome.VoidAbyss: return { width: 100, height: 32 };
    default: return { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT };
  }
}
```

Also update `BIOME_CONFIG` to add new fields per biome:

```typescript
// Add to each biome config:
export const BIOME_CONFIG: Record<Biome, {
  // ...existing fields...
  mapWidth: number;
  mapHeight: number;
  itemsPerFloorBase: number;
  itemsPerFloorGrowth: number;
  foodDropMultiplier: number;     // 1.0 = normal, 0.7 = -30%, etc.
  scrollDropMultiplier: number;   // multiplier for specific scroll types
  potionDropMultiplier: number;   // multiplier for potion drops
}> = {
  [Biome.StoneDungeon]: {
    // ...existing fields...
    mapWidth: 70, mapHeight: 24,
    itemsPerFloorBase: 5, itemsPerFloorGrowth: 1.2,
    foodDropMultiplier: 1.0, scrollDropMultiplier: 1.3, potionDropMultiplier: 1.0,
  },
  [Biome.CrystalCavern]: {
    // ...existing fields...
    mapWidth: 80, mapHeight: 28,
    itemsPerFloorBase: 4, itemsPerFloorGrowth: 1.2,
    foodDropMultiplier: 1.0, scrollDropMultiplier: 1.5, potionDropMultiplier: 1.0,
  },
  [Biome.AncientCrypt]: {
    // ...existing fields...
    mapWidth: 70, mapHeight: 30,
    itemsPerFloorBase: 3, itemsPerFloorGrowth: 1.0,
    foodDropMultiplier: 0.7, scrollDropMultiplier: 2.0, potionDropMultiplier: 1.0,
  },
  [Biome.LavaCore]: {
    // ...existing fields...
    mapWidth: 90, mapHeight: 28,
    itemsPerFloorBase: 3, itemsPerFloorGrowth: 0.8,
    foodDropMultiplier: 0.8, scrollDropMultiplier: 1.0, potionDropMultiplier: 1.5,
  },
  [Biome.VoidAbyss]: {
    // ...existing fields...
    mapWidth: 100, mapHeight: 32,
    itemsPerFloorBase: 2, itemsPerFloorGrowth: 0.6,
    foodDropMultiplier: 0.5, scrollDropMultiplier: 1.0, potionDropMultiplier: 0.8,
  },
};
```

- [ ] **Step 5: Add new enemy definitions to ENEMY_DEFS**

Add these entries to the `ENEMY_DEFS` array in `src/constants/index.ts`:

```typescript
// Stone Dungeon new enemies (insert after goblin, before skeleton section)
{ id: 'caveScorpion', name: '洞穴蝎',   char: 'p', fg: '#88aa44', hp: 10, attack: 4,  defense: 1, exp: 6,  behavior: EnemyBehavior.Aggressive, element: Element.Poison, weakness: Element.Fire, resistance: Element.Poison, minFloor: 1, speed: 1, dropChance: 0.25, alertRadius: 5, specialAbility: 'poisonSting', goldDrop: 4 },
{ id: 'gargoyle',     name: '石像鬼',   char: 'G', fg: '#888888', hp: 16, attack: 3,  defense: 4, exp: 10, behavior: EnemyBehavior.Stationary, element: Element.None, weakness: Element.Fire, resistance: Element.None, minFloor: 2, speed: 0, dropChance: 0.35, alertRadius: 3, specialAbility: 'dormant', goldDrop: 8 },

// Crystal Cavern new enemies (insert after shadow, before darkKnight section)
{ id: 'crystalGuard', name: '水晶守卫', char: 'C', fg: '#88ccff', hp: 22, attack: 8,  defense: 5, exp: 16, behavior: EnemyBehavior.Aggressive, element: Element.None, weakness: Element.Lightning, resistance: Element.None, minFloor: 6, speed: 1, dropChance: 0.3, alertRadius: 6, specialAbility: 'reflect', goldDrop: 12 },
{ id: 'glowJelly',    name: '荧光水母', char: 'j', fg: '#aaffcc', hp: 10, attack: 6,  defense: 0, exp: 10, behavior: EnemyBehavior.Aggressive, element: Element.Poison, weakness: Element.Fire, resistance: Element.Poison, minFloor: 6, speed: 1, dropChance: 0.2, alertRadius: 4, specialAbility: 'glare', goldDrop: 5 },

// Crypt new enemies (insert after mimic, before demon section)
{ id: 'tombGuard',  name: '守墓人', char: 'T', fg: '#887766', hp: 40, attack: 10, defense: 10, exp: 35, behavior: EnemyBehavior.Patrolling, element: Element.None, weakness: Element.Fire, resistance: Element.None, minFloor: 11, speed: 1, dropChance: 0.3, alertRadius: 5, specialAbility: 'patrol', goldDrop: 15 },
{ id: 'soulEater',  name: '噬魂者', char: 'W', fg: '#aa66ff', hp: 18, attack: 15, defense: 1, exp: 30, behavior: EnemyBehavior.Aggressive, element: Element.Ice, weakness: Element.Fire, resistance: Element.Ice, minFloor: 11, speed: 3, dropChance: 0.25, alertRadius: 7, specialAbility: 'phaseThrough', goldDrop: 12 },

// Lava Core new enemies (insert after lich, before dragon section)
{ id: 'lavaWorm',      name: '熔岩虫',   char: 'w', fg: '#ff6622', hp: 35, attack: 12, defense: 4, exp: 40, behavior: EnemyBehavior.Aggressive, element: Element.Fire, weakness: Element.Ice, resistance: Element.Fire, minFloor: 16, speed: 2, dropChance: 0.3, alertRadius: 6, specialAbility: 'lavaSwim', goldDrop: 18 },
{ id: 'obsidianGolem', name: '黑曜石巨人', char: 'O', fg: '#443344', hp: 70, attack: 8,  defense: 15, exp: 55, behavior: EnemyBehavior.Stationary, element: Element.None, weakness: Element.None, resistance: Element.None, minFloor: 16, speed: 0, dropChance: 0.4, alertRadius: 3, specialAbility: 'blockade', goldDrop: 25 },

// Void Abyss new enemies (insert after ancientOne)
{ id: 'voidWeaver',  name: '虚空织者', char: 'V', fg: '#cc44ff', hp: 55, attack: 18, defense: 6, exp: 70, behavior: EnemyBehavior.Aggressive, element: Element.None, weakness: Element.Fire, resistance: Element.None, minFloor: 21, speed: 2, dropChance: 0.35, alertRadius: 8, specialAbility: 'blink', goldDrop: 22 },
{ id: 'mirrorImage', name: '镜像体',   char: '@', fg: '#ff44ff', hp: 1,  attack: 0,  defense: 0, exp: 5,  behavior: EnemyBehavior.Aggressive, element: Element.None, weakness: Element.None, resistance: Element.None, minFloor: 21, speed: 1, dropChance: 0, alertRadius: 10, specialAbility: 'mirrorExplode', goldDrop: 0 },
```

Also update `enemyIds` in each `BIOME_CONFIG`:

```typescript
[Biome.StoneDungeon]: { enemyIds: ['slime', 'rat', 'bat', 'goblin', 'caveScorpion', 'gargoyle'], ... },
[Biome.CrystalCavern]: { enemyIds: ['skeleton', 'spider', 'orc', 'shadow', 'crystalGuard', 'glowJelly'], ... },
[Biome.AncientCrypt]: { enemyIds: ['darkKnight', 'wraith', 'troll', 'mimic', 'tombGuard', 'soulEater'], ... },
[Biome.LavaCore]: { enemyIds: ['demon', 'gorgon', 'vampire', 'lich', 'lavaWorm', 'obsidianGolem'], ... },
[Biome.VoidAbyss]: { enemyIds: ['dragon', 'voidWalker', 'ancientOne', 'voidWeaver', 'mirrorImage'], ... },
```

- [ ] **Step 6: Add new item definitions**

Add to POTION_DEFS:

```typescript
{ name: '火抗药水', char: '!', fg: '#ff6622', effect: PotionEffect.FireResist, power: 5, rarity: Rarity.Rare },
```

Add to SCROLL_DEFS:

```typescript
{ name: '传送门卷轴', char: '?', fg: '#cc44ff', effect: ScrollEffect.CreatePortal, power: 1, rarity: Rarity.Epic },
```

- [ ] **Step 7: Add voidCorruption to GameState in `src/types/index.ts`**

Add new fields to the `GameState` interface:

```typescript
export interface GameState {
  // ...existing fields...
  voidCorruption: { str: number; dex: number; int: number; vit: number };
  currentFragmentTurns: number;
  lavaTideActive: boolean;
  lavaTideTurnsRemaining: number;
}
```

- [ ] **Step 8: Run type-check and build**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npx tsc --noEmit`

This will show errors everywhere the new GameState fields aren't initialized. That's expected — we'll fix them in later tasks. Fix only the compilation errors that block the build (initialize new fields with defaults in the store).

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/constants/index.ts
git commit -m "feat: add new TileTypes, enemy defs, items, and biome config for dungeon redesign

Foundation types and constants for biome-specific dungeon generation.
No behavioral changes yet — generators and mechanics come next."
```

---

## Task 2: Refactor DungeonGenerator into Router + Shared Utilities

**Files:**
- Modify: `src/generator/DungeonGenerator.ts`
- Create: `src/generator/StoneDungeonGenerator.ts`

This task extracts shared utilities from the current generator and creates the Stone Dungeon generator as the first biome-specific generator.

- [ ] **Step 1: Extract shared utilities from DungeonGenerator.ts**

Create shared helper functions. Move these out of the file and export them:

```typescript
// Shared types and utilities for all generators
export interface BSPNode {
  x: number; y: number; w: number; h: number;
  left?: BSPNode; right?: BSPNode; room?: Room;
}

export interface Room {
  x: number; y: number; w: number; h: number;
  centerX: number; centerY: number;
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
}
```

Export these shared functions from `DungeonGenerator.ts` (they're currently private):
- `createTile(type, biome): Tile`
- `createWallTile(biome): Tile`
- `fillMap(biome, width, height): Tile[][]`  — update to accept width/height params
- `carveRoom(map, room, biome): void`
- `carveCorridor(map, x1, y1, x2, y2, biome): void`
- `placeDoors(map, rooms, biome): void`
- `placeEnemies(rooms, floor, rng, enemyIds): ...`
- `placeItems(rooms, floor, rng): ...`

- [ ] **Step 2: Create StoneDungeonGenerator.ts**

```typescript
import { Tile, TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import {
  MAP_WIDTH, MAP_HEIGHT, MIN_ROOM_SIZE, MAX_ROOM_SIZE, ROOM_PADDING,
  MIN_BSP_SIZE, BSP_SPLIT_MIN, BSP_SPLIT_MAX,
  ENEMIES_PER_FLOOR_BASE, ENEMIES_PER_FLOOR_GROWTH,
  ITEMS_PER_FLOOR_BASE, ITEMS_PER_FLOOR_GROWTH,
  BOSS_DEFS, BIOME_CONFIG, getMapSizeForBiome,
} from '../constants';
import {
  DungeonData, Room, BSPNode,
  createTile, createWallTile, fillMap, carveRoom, carveCorridor,
  placeDoors, placeEnemies, placeItems,
} from './DungeonGenerator';

export function generateStoneDungeon(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.StoneDungeon;
  const config = BIOME_CONFIG[biome];
  const { width, height } = getMapSizeForBiome(biome);

  // BSP generation (same as current, but with custom width/height)
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

  // NEW: Add loop corridors for non-linear exploration
  addLoopCorridors(map, rooms, biome, rng);

  placeDoors(map, rooms, biome);

  // ... place water decorations, enemies, items, stairs, shop, event, boss
  // (same as current generateDungeon, but using biome-specific params)
}
```

The key new function `addLoopCorridors`:

```typescript
function addLoopCorridors(map: Tile[][], rooms: Room[], biome: Biome, rng: SeededRandom): void {
  const loopCount = Math.max(1, Math.floor(rooms.length * 0.3));
  const connected = new Set<string>();

  // Pick random pairs of rooms that aren't already directly connected
  for (let i = 0; i < loopCount; i++) {
    const a = rng.pick(rooms);
    const b = rng.pick(rooms);
    if (a === b) continue;
    const key = [a.centerX, a.centerY, b.centerX, b.centerY].join(',');
    if (connected.has(key)) continue;
    connected.add(key);

    // Only connect if distance > 10 to avoid short redundant corridors
    const dist = Math.abs(a.centerX - b.centerX) + Math.abs(a.centerY - b.centerY);
    if (dist > 10) {
      carveCorridor(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
    }
  }
}
```

- [ ] **Step 3: Make DungeonGenerator.ts a router**

Replace the body of `generateDungeon` with a biome-based dispatch:

```typescript
import { getBiomeForFloor } from '../constants';
import { generateStoneDungeon } from './StoneDungeonGenerator';

export function generateDungeon(floor: number, seed: number): DungeonData {
  const biome = getBiomeForFloor(floor);
  switch (biome) {
    case Biome.StoneDungeon:
      return generateStoneDungeon(floor, seed);
    // TODO: other biomes — will be added in later tasks
    default:
      return generateStoneDungeon(floor, seed);  // fallback
  }
}
```

- [ ] **Step 4: Run type-check and build**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npx tsc --noEmit && npm run build`

Fix any compilation errors. The game should behave identically to before for Stone Dungeon floors.

- [ ] **Step 5: Test in browser**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npm run dev`

Start a new game and play through floors 1-5. Verify:
- Map is 70×24 (should be visibly shorter than before)
- Corridors have loops (use minimap to check)
- New enemies (caveScorpion, gargoyle) spawn
- Echo mechanic: enemy indicators on minimap when enemies are nearby but out of FOV

- [ ] **Step 6: Commit**

```bash
git add src/generator/
git commit -m "feat: refactor DungeonGenerator into router, add StoneDungeon with loop corridors

- Extract shared utilities from DungeonGenerator
- Add addLoopCorridors for non-linear maps
- Map size 70×24 for Stone Dungeon
- Route generateDungeon by biome
- Other biomes still fallback to Stone generator"
```

---

## Task 3: Crystal Cavern Generator (Cellular Automata)

**Files:**
- Create: `src/generator/CrystalCaveGenerator.ts`
- Modify: `src/generator/DungeonGenerator.ts` (add routing)
- Modify: `src/engine/FOV.ts` (refraction)
- Modify: `src/components/MiniMap.tsx` (echo rendering for stone)

- [ ] **Step 1: Implement CrystalCaveGenerator.ts**

Core cellular automata algorithm:

```typescript
export function generateCrystalCave(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.CrystalCavern;
  const { width, height } = getMapSizeForBiome(biome);

  // 1. Fill map with walls
  const map = fillMap(biome, width, height);

  // 2. Random fill: 55% floor, 45% wall
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (rng.next() < 0.55) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
  }

  // 3. Smooth: 5 rounds of cellular automata
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
    // Copy newMap into map
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x] = newMap[y][x];
      }
    }
  }

  // 4. Flood fill to find largest connected region
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

  // Fill everything not in the largest region with walls
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map[y][x].type !== TileType.Wall && !bestRegion.has(`${x},${y}`)) {
        map[y][x] = createWallTile(biome);
      }
    }
  }

  // 5. Place crystal clusters (small open rooms within the cave)
  const crystalClusters: Room[] = [];
  for (let i = 0; i < rng.nextInt(3, 5); i++) {
    const cx = rng.nextInt(5, width - 8);
    const cy = rng.nextInt(5, height - 8);
    const cw = rng.nextInt(3, 5);
    const ch = rng.nextInt(3, 5);
    for (let y = cy; y < cy + ch; y++) {
      for (let x = cx; x < cx + cw; x++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          map[y][x] = createTile(TileType.Floor, biome);
        }
      }
    }
    crystalClusters.push({ x: cx, y: cy, w: cw, h: ch, centerX: cx + Math.floor(cw/2), centerY: cy + Math.floor(ch/2) });
  }

  // 6. Ensure connectivity with corridors between clusters
  for (let i = 1; i < crystalClusters.length; i++) {
    const a = crystalClusters[i - 1];
    const b = crystalClusters[i];
    carveCorridor(map, a.centerX, a.centerY, b.centerX, b.centerY, biome);
  }

  // 7. Add shallow water at edges (30% of floor tiles adjacent to walls)
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

  // ... place player start, stairs, enemies, items, shop, event, boss
  // (use crystalClusters as room equivalents for entity placement)
}
```

Flood fill helper:

```typescript
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
```

- [ ] **Step 2: Add Crystal Cavern routing in DungeonGenerator.ts**

```typescript
case Biome.CrystalCavern:
  return generateCrystalCave(floor, seed);
```

- [ ] **Step 3: Implement Refraction in FOV.ts**

After computing FOV, scan for crystal wall tiles adjacent to visible tiles and extend FOV:

```typescript
export function computeFOV(map: Tile[][], pos: Position, radius: number): Set<string> {
  const visible = recursiveShadowcasting(map, pos, radius);
  const biome = detectBiomeFromMap(map); // helper: check tile styles

  if (biome === Biome.CrystalCavern) {
    // Refraction: extend FOV through crystal walls
    const extensions = new Set<string>();
    for (const key of visible) {
      const [x, y] = key.split(',').map(Number);
      // Check adjacent tiles for crystal walls
      for (const dir of CARDINAL_DIRS) {
        const nx = x + dir.x;
        const ny = y + dir.y;
        if (nx < 0 || ny < 0 || ny >= map.length || nx >= map[0].length) continue;
        const tile = map[ny][nx];
        if (tile.type === TileType.Wall && isCrystalWall(tile)) {
          // Extend FOV 1-2 tiles past the crystal wall
          for (let dist = 1; dist <= 2; dist++) {
            const ex = nx + dir.x * dist;
            const ey = ny + dir.y * dist;
            if (ex >= 0 && ey >= 0 && ey < map.length && ex < map[0].length) {
              const extTile = map[ey][ex];
              if (extTile.type !== TileType.Wall && extTile.transparent) {
                extensions.add(`${ex},${ey}`);
              }
            }
          }
        }
      }
    }
    for (const key of extensions) visible.add(key);
  }

  return visible;
}
```

Note: `isCrystalWall` checks if the wall tile's fg color matches the crystal biome palette. This avoids adding a new field to Tile. Alternatively, mark crystal walls with a property during generation.

- [ ] **Step 4: Run type-check and build**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npx tsc --noEmit && npm run build`

- [ ] **Step 5: Test in browser**

Play through floors 6-10. Verify:
- Cave-like organic map shape
- Shallow water areas (walkable but slow)
- Crystal clusters with items
- Refraction: can sometimes see past crystal walls
- New enemies (crystalGuard, glowJelly) spawn

- [ ] **Step 6: Commit**

```bash
git add src/generator/CrystalCaveGenerator.ts src/generator/DungeonGenerator.ts src/engine/FOV.ts
git commit -m "feat: add Crystal Cavern generator with cellular automata caves

- Organic cave shapes via CA + flood fill
- Crystal clusters as item-rich areas
- Shallow water terrain (slows movement)
- FOV refraction through crystal walls"
```

---

## Task 4: Ancient Crypt Generator (Wide Corridor BSP)

**Files:**
- Create: `src/generator/CryptGenerator.ts`
- Modify: `src/generator/DungeonGenerator.ts`
- Modify: `src/store/gameStore.ts` (cursed ground mechanic, sarcophagus interaction)

- [ ] **Step 1: Implement CryptGenerator.ts**

Uses BSP but with:
- Wider corridors (2 tiles)
- Larger rooms (5-7)
- Extra loop corridors (15%)
- Cursed ground tiles (10% of floor)
- Torch decorations at corridor intersections
- Sarcophagus tiles in 2-3 rooms

The `carveCorridor` variant for 2-width:

```typescript
function carveWideCorridor(map: Tile[][], x1: number, y1: number, x2: number, y2: number, biome: Biome): void {
  let x = x1, y = y1;
  while (x !== x2) {
    if (x >= 0 && x < map[0].length - 1 && y >= 0 && y < map.length) {
      for (let dy = 0; dy < 2 && y + dy < map.length; dy++) {
        if (map[y + dy][x].type === TileType.Wall) {
          map[y + dy][x] = createTile(TileType.Corridor, biome);
        }
      }
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    if (x >= 0 && x < map[0].length && y >= 0 && y < map.length - 1) {
      for (let dx = 0; dx < 2 && x + dx < map[0].length; dx++) {
        if (map[y][x + dx].type === TileType.Wall) {
          map[y][x + dx] = createTile(TileType.Corridor, biome);
        }
      }
    }
    y += y < y2 ? 1 : -1;
  }
}
```

- [ ] **Step 2: Add Crypt routing in DungeonGenerator.ts**

- [ ] **Step 3: Implement Cursed Ground mechanic in gameStore.ts**

In `processTurn` or `movePlayer`, when player steps on `TileType.CursedGround`:

```typescript
if (state.map[player.pos.y][player.pos.x].type === TileType.CursedGround) {
  // Try to curse a random equipped item
  const slots = Object.keys(player.equipment) as EquipmentSlot[];
  const equipped = slots.filter(s => player.equipment[s] !== null);
  if (equipped.length > 0) {
    const slot = rng.pick(equipped);
    const item = player.equipment[slot]!;
    if (!item.cursed) {
      item.cursed = true;
      addMessage(state, `${item.name}被诅咒了！`, MessageCategory.Environment, '#aa44ff');
    }
  }
}
```

- [ ] **Step 4: Implement Sarcophagus interaction**

When player walks adjacent to a Sarcophagus tile and presses interact key:

```typescript
// In movePlayer or a new interact function
if (adjacentTile.type === TileType.Sarcophagus) {
  if (rng.chance(0.5)) {
    // Good outcome: create item at player position
    const item = createRandomItem(state.currentFloor, rng, false, 0);
    state.items.push({ item, pos: { x: adjacentX, y: adjacentY } });
    addMessage(state, '石棺中藏着宝物！', MessageCategory.Item, '#44cc44');
  } else {
    // Bad outcome: trigger trap
    const trapDamage = rng.nextInt(5, 15);
    state.player.hp -= trapDamage;
    addMessage(state, `石棺陷阱！受到${trapDamage}点伤害！`, MessageCategory.Combat, '#ff4444');
  }
  // Replace sarcophagus with floor
  state.map[adjacentY][adjacentX] = createTile(TileType.Floor, getBiomeForFloor(state.currentFloor));
}
```

- [ ] **Step 5: Run type-check, build, and test**

Test floors 11-15. Verify wide corridors, cursed ground, sarcophagi, torches.

- [ ] **Step 6: Commit**

```bash
git add src/generator/CryptGenerator.ts src/generator/DungeonGenerator.ts src/store/gameStore.ts
git commit -m "feat: add Ancient Crypt generator with wide corridors and cursed ground

- BSP with 2-width corridors and larger rooms
- Cursed ground curses equipped items on step
- Sarcophagus interactive tiles (50/50 reward/trap)
- Torch decorations at corridor intersections"
```

---

## Task 5: Lava Core Generator (Islands + Bridges)

**Files:**
- Create: `src/generator/LavaCoreGenerator.ts`
- Modify: `src/generator/DungeonGenerator.ts`
- Modify: `src/store/gameStore.ts` (lava tide, cooled lava damage)

- [ ] **Step 1: Implement LavaCoreGenerator.ts**

```typescript
export function generateLavaCore(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.LavaCore;
  const { width, height } = getMapSizeForBiome(biome);

  // 1. Fill entire map with lava
  const map: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      map[y][x] = createTile(TileType.Lava, biome);
    }
  }

  // 2. Place 8-12 islands
  const islandCount = rng.nextInt(8, 12);
  const islands: Room[] = [];
  for (let i = 0; i < islandCount; i++) {
    const iw = rng.nextInt(4, 9);
    const ih = rng.nextInt(4, 9);
    const ix = rng.nextInt(2, width - iw - 2);
    const iy = rng.nextInt(2, height - ih - 2);

    // Check no overlap with existing islands (with 2-tile margin)
    let overlaps = false;
    for (const existing of islands) {
      if (ix < existing.x + existing.w + 3 && ix + iw + 3 > existing.x &&
          iy < existing.y + existing.h + 3 && iy + ih + 3 > existing.y) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) { i--; continue; } // retry

    // Carve island
    for (let y = iy; y < iy + ih; y++) {
      for (let x = ix; x < ix + iw; x++) {
        map[y][x] = createTile(TileType.Floor, biome);
      }
    }
    islands.push({ x: ix, y: iy, w: iw, h: ih, centerX: ix + Math.floor(iw/2), centerY: iy + Math.floor(ih/2) });
  }

  // 3. Connect islands with bridges (minimum spanning tree)
  const connected = new Set<number>([0]);
  const bridges: { from: number; to: number }[] = [];

  while (connected.size < islands.length) {
    let bestDist = Infinity;
    let bestFrom = -1;
    let bestTo = -1;
    for (const ci of connected) {
      for (let j = 0; j < islands.length; j++) {
        if (connected.has(j)) continue;
        const dist = Math.abs(islands[ci].centerX - islands[j].centerX) +
                     Math.abs(islands[ci].centerY - islands[j].centerY);
        if (dist < bestDist) {
          bestDist = dist;
          bestFrom = ci;
          bestTo = j;
        }
      }
    }
    if (bestTo === -1) break;
    connected.add(bestTo);
    bridges.push({ from: bestFrom, to: bestTo });
    // Carve 2-width bridge between islands
    carveWideBridge(map, islands[bestFrom].centerX, islands[bestFrom].centerY,
                    islands[bestTo].centerX, islands[bestTo].centerY, biome, 2);
  }

  // 4. Add 2-3 shortcut bridges (1-width, connecting distant islands)
  for (let i = 0; i < rng.nextInt(2, 4); i++) {
    const a = rng.nextInt(0, islands.length - 1);
    const b = rng.nextInt(0, islands.length - 1);
    if (a === b) continue;
    carveWideBridge(map, islands[a].centerX, islands[a].centerY,
                    islands[b].centerX, islands[b].centerY, biome, 1);
  }

  // 5. Add cooled lava pools on island edges
  // ... (iterate island edges, 20% chance for adjacent lava → CooledLava)

  // 6. Place player start, stairs, enemies, items, shop, event, boss
  // ... (similar to other generators, using islands as rooms)
}
```

- [ ] **Step 2: Implement Lava Tide mechanic in gameStore.ts**

In `processTurn`:

```typescript
// Lava Tide check (every 50 turns on Lava Core floors)
if (getBiomeForFloor(state.currentFloor) === Biome.LavaCore) {
  if (state.turn % 50 === 0 && !state.lavaTideActive) {
    // Tide rises: convert all CooledLava to Lava
    state.lavaTideActive = true;
    state.lavaTideTurnsRemaining = 5;
    for (let y = 0; y < state.map.length; y++) {
      for (let x = 0; x < state.map[y].length; x++) {
        if (state.map[y][x].type === TileType.CooledLava) {
          state.map[y][x] = createTile(TileType.Lava, Biome.LavaCore);
        }
      }
    }
    addMessage(state, '熔岩涨潮了！冷却的熔岩重新涌动！', MessageCategory.Environment, '#ff4422');
  }
  if (state.lavaTideActive) {
    state.lavaTideTurnsRemaining--;
    if (state.lavaTideTurnsRemaining <= 0) {
      // Tide recedes: restore CooledLava from remembered positions
      state.lavaTideActive = false;
      // ... restore cooled lava tiles (stored during tide rise)
      addMessage(state, '熔岩退潮了。', MessageCategory.Environment, '#994433');
    }
  }
}
```

- [ ] **Step 3: Implement CooledLava damage**

In `movePlayer`, when player steps on CooledLava:

```typescript
if (state.map[ny][nx].type === TileType.CooledLava) {
  state.player.hp -= 5;
  addMessage(state, '灼热的熔岩灼伤了你！(-5HP)', MessageCategory.Environment, '#ff6622');
}
```

- [ ] **Step 4: Add routing, build, test, commit**

Test floors 16-20. Verify island layout, bridges, lava tide, cooled lava damage.

---

## Task 6: Void Abyss Generator (Fragments + Portals)

**Files:**
- Create: `src/generator/VoidAbyssGenerator.ts`
- Modify: `src/generator/DungeonGenerator.ts`
- Modify: `src/store/gameStore.ts` (void corruption, portal interaction, mirror image)

- [ ] **Step 1: Implement VoidAbyssGenerator.ts**

```typescript
export function generateVoidAbyss(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.VoidAbyss;
  const { width, height } = getMapSizeForBiome(biome);

  // 1. Fill with void walls
  const map = fillMap(biome, width, height);
  // Override all walls to VoidWall
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      map[y][x] = createTile(TileType.VoidWall, biome);
    }
  }

  // 2. Generate 4-6 fragments
  const fragmentCount = rng.nextInt(4, 7);
  const fragments: { x: number; y: number; w: number; h: number; tiles: Position[]; portals: Position[] }[] = [];

  for (let i = 0; i < fragmentCount; i++) {
    let fw, fh, fragmentTiles: Position[];

    if (i === fragmentCount - 1) {
      // Last fragment = Void Sanctum (7x7, central altar)
      fw = 7; fh = 7;
    } else if (i < 2) {
      // First 2 = BSP fragments
      fw = rng.nextInt(5, 9);
      fh = rng.nextInt(5, 9);
    } else {
      // Others = CA cave fragments
      fw = rng.nextInt(6, 11);
      fh = rng.nextInt(6, 9);
    }

    // Find valid position (no overlap with other fragments, with 4-tile margin)
    const pos = findFragmentPosition(map, fw, fh, width, height, rng);
    if (!pos) continue;

    // Generate fragment interior
    fragmentTiles = generateFragmentInterior(map, pos.x, pos.y, fw, fh, i, rng, biome);

    // Place 1-2 portals in this fragment
    const portalCount = rng.nextInt(1, 3);
    const portals: Position[] = [];
    for (let p = 0; p < portalCount && fragmentTiles.length > 0; p++) {
      const tile = rng.pick(fragmentTiles);
      map[tile.y][tile.x] = createTile(TileType.Portal, biome);
      portals.push(tile);
    }

    fragments.push({ x: pos.x, y: pos.y, w: fw, h: fh, tiles: fragmentTiles, portals });
  }

  // 3. Place player start in first fragment, stairs in last (sanctum)
  // 4. Place enemies, items
  // 5. Mark 5% of void wall tiles adjacent to fragment floors as "rifts"
  //    (visual appearance same as void wall, but walkable — secret passages)
}
```

- [ ] **Step 2: Implement Portal interaction in gameStore.ts**

When player steps on a Portal tile:

```typescript
if (state.map[ny][nx].type === TileType.Portal) {
  // Find all other portal positions on this floor
  const otherPortals: Position[] = [];
  for (let y = 0; y < state.map.length; y++) {
    for (let x = 0; x < state.map[y].length; x++) {
      if (state.map[y][x].type === TileType.Portal && (x !== nx || y !== ny)) {
        otherPortals.push({ x, y });
      }
    }
  }
  if (otherPortals.length > 0) {
    const dest = rng.pick(otherPortals);
    // Teleport player
    state.player.pos = { x: dest.x, y: dest.y };
    addMessage(state, '传送门将你送到了另一个碎片！', MessageCategory.Environment, '#cc44ff');
    updateFOV(state);
    state.currentFragmentTurns = 0;  // Reset corruption counter
  }
}
```

- [ ] **Step 3: Implement Void Corruption in gameStore.ts processTurn**

```typescript
if (getBiomeForFloor(state.currentFloor) === Biome.VoidAbyss) {
  state.currentFragmentTurns++;
  if (state.currentFragmentTurns > 0 && state.currentFragmentTurns % 20 === 0) {
    // Apply corruption
    const stats = ['str', 'dex', 'int', 'vit'] as const;
    const stat = stats[rng.nextInt(0, 3)];
    state.voidCorruption[stat]++;
    state.player.stats[stat]--;
    addMessage(state, `虚空侵蚀了你的${statNameZh(stat)}！(-1)`, MessageCategory.Environment, '#8844ff');
  }
}
```

Reset corruption on `enterFloor`:

```typescript
state.voidCorruption = { str: 0, dex: 0, int: 0, vit: 0 };
state.currentFragmentTurns = 0;
```

- [ ] **Step 4: Add routing, build, test, commit**

Test floors 21+. Verify fragments, portals, void corruption, mirror images.

---

## Task 7: Map Rendering Updates

**Files:**
- Modify: `src/components/MapView.tsx`
- Modify: `src/components/MiniMap.tsx`
- Modify: `src/store/gameStore.ts` (echo mechanic for Stone Dungeon)

- [ ] **Step 1: Update MapView.tsx for dynamic map sizes**

Replace hardcoded canvas dimensions with dynamic calculation:

```typescript
const mapWidth = map[0]?.length ?? DEFAULT_MAP_WIDTH;
const mapHeight = map.length ?? DEFAULT_MAP_HEIGHT;
const tileWidth = 16;
const tileHeight = 14;
canvas.width = mapWidth * tileWidth;
canvas.height = mapHeight * tileHeight;
```

- [ ] **Step 2: Add new TileType rendering cases in MapView.tsx**

Add rendering for:
- `ShallowWater` — same as Water but with blue tint and slightly different char
- `CursedGround` — floor with purple tint
- `CooledLava` — lava with darker red
- `VoidWall` — deep purple wall
- `Portal` — pulsating purple symbol
- `Torch` — warm orange glow
- `Sarcophagus` — stone rectangle

- [ ] **Step 3: Implement Echo mechanic in MiniMap.tsx**

For Stone Dungeon, render enemy indicators when enemies are nearby but out of FOV:

```typescript
// After rendering enemies in FOV, add echo indicators
if (getBiomeForFloor(currentFloor) === Biome.StoneDungeon) {
  for (const e of enemies) {
    if (e.hp > 0 && !visibleTiles.has(`${e.pos.x},${e.pos.y}`)) {
      const dist = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
      if (dist <= 5) {
        // Draw faint indicator at enemy position
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.fillRect(e.pos.x * scale, e.pos.y * scale, scale, scale);
      }
    }
  }
}
```

- [ ] **Step 4: Build, test, commit**

---

## Task 8: Enemy Special Abilities

**Files:**
- Modify: `src/store/gameStore.ts` (handle new special abilities in processTurn)
- Modify: `src/engine/Combat.ts` (reflect damage calculation)

- [ ] **Step 1: Add new special ability handlers**

In the `handleSpecialAbility` switch (or equivalent in gameStore.ts), add cases:

```typescript
case 'poisonSting':  // caveScorpion — 20% chance to poison
  if (rng.chance(0.2)) {
    applyStatusEffect(target, StatusEffectType.Poison, 3, 2);
  }
  break;

case 'dormant':  // gargoyle — activates when player in range
  // Handled in enemy AI: gargoyle doesn't act until activated
  break;

case 'reflect':  // crystalGuard — handled in Combat.ts
  break;

case 'glare':  // glowJelly — blind player for 1 turn
  applyStatusEffect(player, StatusEffectType.Freeze, 1, 0); // reuse freeze as "skip turn"
  break;

case 'blink':  // voidWeaver — teleport near player every 3 turns
  const newTile = findRandomWalkableTileNear(map, player.pos, 5, rng);
  if (newTile) enemy.pos = newTile;
  break;

case 'mirrorExplode':  // mirrorImage — explode on death for 15 AoE damage
  // Handled in enemy death processing
  break;

case 'lavaSwim':  // lavaWorm — can enter lava tiles
  // Movement AI: lava tiles are treated as walkable for this enemy
  break;

case 'blockade':  // obsidianGolem — stationary, blocks path
  // No action needed; speed:0 handles it
  break;
```

- [ ] **Step 2: Implement Reflect in Combat.ts**

After `calculateMeleeDamage`, check if defender has reflect ability:

```typescript
if (defender.specialAbility === 'reflect' && rng.chance(0.2)) {
  const reflectedDmg = Math.floor(damage * 0.5);
  // Apply reflected damage to attacker (player)
  // Return this info in CombatResult or handle in gameStore
}
```

- [ ] **Step 3: Handle mirrorImage explosion on death**

In enemy death processing:

```typescript
if (enemy.specialAbility === 'mirrorExplode') {
  // 15 damage to player if within 3 tiles
  const dist = Math.abs(enemy.pos.x - player.pos.x) + Math.abs(enemy.pos.y - player.pos.y);
  if (dist <= 3) {
    player.hp -= 15;
    addMessage(state, '镜像体爆炸！受到15点伤害！', MessageCategory.Combat, '#ff44ff');
  }
}
```

- [ ] **Step 4: Build, test, commit**

---

## Task 9: New Items & Supply Pacing

**Files:**
- Modify: `src/entities/Items.ts` (new item effects)
- Modify: `src/store/gameStore.ts` (FireResist potion, CreatePortal scroll, biome-specific supply pacing)

- [ ] **Step 1: Implement FireResist potion effect**

In `useItem` handler for potions:

```typescript
case PotionEffect.FireResist:
  // Apply fire resistance for 5 turns
  applyStatusEffect(player, StatusEffectType.FireResist, 5, 0);
  break;
```

Need to add `FireResist` to `StatusEffectType` enum in types.

- [ ] **Step 2: Implement CreatePortal scroll effect**

In `useItem` handler for scrolls:

```typescript
case ScrollEffect.CreatePortal:
  // Create a temporary portal at player's current position
  state.map[player.pos.y][player.pos.x] = createTile(TileType.Portal, getBiomeForFloor(state.currentFloor));
  addMessage(state, '脚下出现了传送门！', MessageCategory.Item, '#cc44ff');
  break;
```

- [ ] **Step 3: Implement biome-specific supply pacing**

In `placeItems` (or the per-generator item placement), use `BIOME_CONFIG` fields:

```typescript
const config = BIOME_CONFIG[biome];
const count = Math.floor(config.itemsPerFloorBase + config.itemsPerFloorGrowth * Math.sqrt(floor));
```

In `createRandomItem`, apply food/potion/scroll multipliers from biome config:

```typescript
// If the item would be food, apply foodDropMultiplier
if (itemType === ItemType.Food && rng.next() > config.foodDropMultiplier) {
  // Reroll as potion instead
}
```

- [ ] **Step 4: Build, test, commit**

---

## Task 10: Integration Testing & Polish

**Files:**
- Modify: various (fix issues found during testing)

- [ ] **Step 1: Full playthrough test**

Start a new game and play through all 25 floors (or use debug to jump between floors). For each biome verify:
- Map generates correctly with unique layout
- Map size is correct
- New enemies spawn and use special abilities
- New items drop
- Biome-specific mechanics work
- No crashes or visual glitches

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Run final build**

Run: `cd /Users/haibowang/Desktop/ASCI\&ASCII/abyss-echo && npx tsc --noEmit && npm run build`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete biome-specific dungeon generation system

All 5 biomes with unique generators, enemies, mechanics, and supply pacing."
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Stone Dungeon BSP + loops | Task 2 |
| Crystal Cavern CA caves | Task 3 |
| Ancient Crypt wide corridors | Task 4 |
| Lava Core islands + bridges | Task 5 |
| Void Abyss fragments + portals | Task 6 |
| Map sizes per biome | Task 1 (constants) + Tasks 2-6 |
| New TileTypes | Task 1 |
| 10 new enemies | Task 1 (defs) + Task 8 (abilities) |
| New items (fire resist, portal scroll) | Task 1 (defs) + Task 9 (effects) |
| Echo mechanic | Task 7 |
| Refraction FOV | Task 3 |
| Cursed ground | Task 4 |
| Lava tide | Task 5 |
| Void corruption | Task 6 |
| Biome supply pacing | Task 9 |
| MapView/MiniMap rendering | Task 7 |
