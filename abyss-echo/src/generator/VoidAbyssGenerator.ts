import { Tile, TileType, Biome, Position } from '../types';
import { SeededRandom } from '../utils/random';
import { BIOME_CONFIG } from '../constants';
import {
  DungeonData, Room,
  createTile, fillMap,
  placeEnemies, placeItems, placeBoss, markBossRoom,
  pickStartAndStairs, placeArenaObjects, placeEliteAndSpecialRooms,
} from './DungeonGenerator';

interface Fragment {
  x: number; y: number; w: number; h: number;
  centerX: number; centerY: number;
  floorTiles: Position[];
  portals: Position[];
}

function generateFragmentInterior(map: Tile[][], fx: number, fy: number, fw: number, fh: number, rng: SeededRandom, biome: Biome): Position[] {
  const tiles: Position[] = [];
  // Carve the fragment as a simple room with some random internal structure
  for (let y = fy; y < fy + fh; y++) {
    for (let x = fx; x < fx + fw; x++) {
      // Keep border as void wall, interior as floor
      if (y > fy && y < fy + fh - 1 && x > fx && x < fx + fw - 1) {
        if (rng.chance(0.85)) { // 85% chance for floor, creates organic shape
          map[y][x] = createTile(TileType.Floor, biome);
          tiles.push({ x, y });
        }
      }
    }
  }
  return tiles;
}

export function generateVoidAbyss(floor: number, seed: number): DungeonData {
  const rng = new SeededRandom(seed + floor * 7919);
  const biome = Biome.VoidAbyss;
  const config = BIOME_CONFIG[biome];
  const width = config.mapWidth;
  const height = config.mapHeight;

  // 1. Fill with void walls
  const map = fillMap(biome, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      map[y][x] = createTile(TileType.VoidWall, biome);
    }
  }

  // 2. Generate 4-6 fragments
  const fragmentCount = rng.nextInt(4, 7);
  const fragments: Fragment[] = [];

  for (let i = 0; i < fragmentCount; i++) {
    let fw, fh;
    if (i === fragmentCount - 1) {
      // Last fragment = Void Sanctum (7×7)
      fw = 7; fh = 7;
    } else {
      fw = rng.nextInt(5, 10);
      fh = rng.nextInt(5, 9);
    }

    // Find valid position (no overlap, 6-tile margin between fragments)
    let placed = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const fx = rng.nextInt(3, width - fw - 3);
      const fy = rng.nextInt(3, height - fh - 3);

      let overlaps = false;
      for (const f of fragments) {
        if (fx < f.x + f.w + 6 && fx + fw + 6 > f.x && fy < f.y + f.h + 6 && fy + fh + 6 > f.y) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        const floorTiles = generateFragmentInterior(map, fx, fy, fw, fh, rng, biome);

        // Place 1-2 portals in this fragment
        const portalCount = floorTiles.length > 3 ? rng.nextInt(1, 3) : 1;
        const portals: Position[] = [];
        const shuffled = [...floorTiles].sort(() => rng.next() - 0.5);
        for (let p = 0; p < portalCount && p < shuffled.length; p++) {
          const pt = shuffled[p];
          map[pt.y][pt.x] = createTile(TileType.Portal, biome);
          portals.push(pt);
        }

        fragments.push({ x: fx, y: fy, w: fw, h: fh, centerX: fx + Math.floor(fw / 2), centerY: fy + Math.floor(fh / 2), floorTiles, portals });
        placed = true;
        break;
      }
    }
    if (!placed) continue; // Skip if can't place
  }

  if (fragments.length === 0) {
    // Fallback: create a single fragment
    const fallbackTiles = generateFragmentInterior(map, 5, 5, 10, 8, rng, biome);
    fragments.push({ x: 5, y: 5, w: 10, h: 8, centerX: 10, centerY: 9, floorTiles: fallbackTiles, portals: [] });
  }

  // 3. Secret rifts: 5% of void walls adjacent to fragment floors become walkable (but look the same)
  for (const frag of fragments) {
    for (const tile of frag.floorTiles) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = tile.x + dx, ny = tile.y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && map[ny][nx].type === TileType.VoidWall && rng.chance(0.05)) {
            // Make it walkable but keep void wall appearance (secret passage)
            map[ny][nx] = { ...map[ny][nx], walkable: true, transparent: true };
          }
        }
      }
    }
  }

  // 4. Player start and stairs: randomly pick far-apart fragments
  const { startRoom: startFrag, stairsRoom: stairsFrag } = pickStartAndStairs(fragments, rng, width, height);
  const playerStart = { x: startFrag.centerX, y: startFrag.centerY };
  // Ensure player start is on a floor tile
  if (map[playerStart.y][playerStart.x].type !== TileType.Floor) {
    const startFragData = fragments.find(f => f.centerX === startFrag.centerX && f.centerY === startFrag.centerY);
    const floorTile = startFragData?.floorTiles[0];
    if (floorTile) { playerStart.x = floorTile.x; playerStart.y = floorTile.y; }
  }

  const stairsDown = { x: stairsFrag.centerX, y: stairsFrag.centerY };
  if (map[stairsDown.y][stairsDown.x].type === TileType.Floor) {
    map[stairsDown.y][stairsDown.x] = createTile(TileType.StairsDown, biome);
  } else {
    // Find any floor tile in the stairs fragment
    const stairsFragData = fragments.find(f => f.centerX === stairsFrag.centerX && f.centerY === stairsFrag.centerY);
    if (stairsFragData) {
      for (const t of stairsFragData.floorTiles) {
        if (map[t.y][t.x].type === TileType.Floor) {
          map[t.y][t.x] = createTile(TileType.StairsDown, biome);
          stairsDown.x = t.x;
          stairsDown.y = t.y;
          break;
        }
      }
    }
  }

  // Create Room-like objects from fragments for entity placement
  const rooms: Room[] = fragments.map(f => ({ x: f.x, y: f.y, w: f.w, h: f.h, centerX: f.centerX, centerY: f.centerY }));

  const enemies = placeEnemies(rooms, floor, rng, config.enemyIds);
  const items = placeItems(rooms, floor, rng, config.itemsPerFloorBase, config.itemsPerFloorGrowth);

  let shopPos: Position | undefined;
  let eventPos: Position | undefined;
  const specialFrags = rooms.length > 2 ? rooms.slice(1, -1) : rooms.slice(1);
  if (specialFrags.length > 0) {
    if (rng.chance(config.shopChance)) {
      const shopFrag = rng.pick(specialFrags);
      const frag = fragments[specialFrags.indexOf(shopFrag) + 1] || fragments[0];
      const ft = frag.floorTiles.find(t => map[t.y][t.x].type === TileType.Floor);
      if (ft) {
        shopPos = { x: ft.x, y: ft.y };
        map[ft.y][ft.x] = createTile(TileType.Shop, biome);
      }
    }
    if (rng.chance(config.eventChance)) {
      const eventFrag = rng.pick(specialFrags);
      const fragIdx = specialFrags.indexOf(eventFrag) + 1;
      const frag = fragIdx < fragments.length ? fragments[fragIdx] : fragments[0];
      const ft = frag.floorTiles.find(t => map[t.y][t.x].type === TileType.Floor && (!shopPos || t.x !== shopPos.x || t.y !== shopPos.y));
      if (ft) {
        eventPos = { x: ft.x, y: ft.y };
        map[ft.y][ft.x] = createTile(TileType.Event, biome);
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
  };
}
