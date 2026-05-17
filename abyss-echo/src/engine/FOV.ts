import { Position, Tile, Biome, TileType } from '../types';
import { SeededRandom } from '../utils/random';

// Recursive shadowcasting FOV algorithm
// Based on http://www.roguebasin.com/index.php?title=FOV_using_recursive_shadowcasting

const MULT = [
  [1, 0, 0, -1, -1, 0, 0, 1],
  [0, 1, -1, 0, 0, -1, 1, 0],
  [0, 1, 1, 0, 0, -1, -1, 0],
  [1, 0, 0, 1, -1, 0, 0, -1],
];

export function computeFOV(map: Tile[][], pos: Position, radius: number, biome?: Biome, seed?: number): Set<string> {
  const mapWidth = map[0]?.length ?? 0;
  const mapHeight = map.length;
  const visible = new Set<string>();
  visible.add(`${pos.x},${pos.y}`);

  // Ensure cardinal-direction adjacent tiles are always visible
  // (shadowcasting slope calculations produce degenerate values when dy=0,
  //  causing these tiles to be missed at the octant boundary)
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = pos.x + dx;
    const ny = pos.y + dy;
    if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
      visible.add(`${nx},${ny}`);
    }
  }

  for (let octant = 0; octant < 8; octant++) {
    castLight(map, visible, pos.x, pos.y, radius, 1, 1.0, 0.0, octant, mapWidth, mapHeight);
  }

  // Crystal Cavern refraction effect: extend FOV through crystal walls
  if (biome === Biome.CrystalCavern && seed !== undefined) {
    const rng = new SeededRandom(seed + pos.x * 31 + pos.y * 17);
    const extended = new Set<string>();

    for (const key of visible) {
      const [x, y] = key.split(',').map(Number);
      if (map[y][x].type === TileType.Floor || map[y][x].type === TileType.ShallowWater) {
        // Check if this floor tile has an adjacent wall
        let hasAdjacentWall = false;
        for (const dir of [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
          { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
        ]) {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
            if (map[ny][nx].type === TileType.Wall) {
              hasAdjacentWall = true;
              break;
            }
          }
        }

        if (hasAdjacentWall && rng.chance(0.3)) {
          // Extend FOV 2 tiles past this tile in a random direction
          const directions = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
          ];
          const dir = directions[rng.nextInt(0, directions.length - 1)];

          for (let dist = 1; dist <= 2; dist++) {
            const ex = x + dir.dx * dist;
            const ey = y + dir.dy * dist;
            if (ex >= 0 && ex < mapWidth && ey >= 0 && ey < mapHeight) {
              extended.add(`${ex},${ey}`);
              // Stop if we hit an opaque tile
              if (!map[ey][ex].transparent) break;
            } else {
              break;
            }
          }
        }
      }
    }

    // Add extended tiles to visible set
    for (const key of extended) {
      visible.add(key);
    }
  }

  return visible;
}

function castLight(
  map: Tile[][],
  visible: Set<string>,
  cx: number,
  cy: number,
  radius: number,
  row: number,
  startSlope: number,
  endSlope: number,
  octant: number,
  mapWidth: number,
  mapHeight: number
): void {
  if (startSlope < endSlope) return;

  const xx = MULT[0][octant];
  const xy = MULT[1][octant];
  const yx = MULT[2][octant];
  const yy = MULT[3][octant];

  let newStartSlope = startSlope;

  for (let j = row; j <= radius; j++) {
    let blocked = false;

    for (let dx = -j; dx <= 0; dx++) {
      const dy = -j - dx;

      const mapX = cx + dx * xx + dy * xy;
      const mapY = cy + dx * yx + dy * yy;

      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rSlope) continue;
      if (endSlope > lSlope) break;

      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius && mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight) {
        visible.add(`${mapX},${mapY}`);
      }

      if (mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight) {
        const isBlocking = !map[mapY][mapX].transparent;

        if (blocked) {
          if (isBlocking) {
            newStartSlope = rSlope;
          } else {
            blocked = false;
            startSlope = newStartSlope;
          }
        } else if (isBlocking && j < radius) {
          blocked = true;
          castLight(map, visible, cx, cy, radius, j + 1, startSlope, lSlope, octant, mapWidth, mapHeight);
          newStartSlope = rSlope;
        }
      }
    }

    if (blocked) break;
  }
}

// Check line of sight between two points (for ranged combat)
export function hasLineOfSight(map: Tile[][], from: Position, to: Position): boolean {
  const mapWidth = map[0]?.length ?? 0;
  const mapHeight = map.length;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  let x = from.x;
  let y = from.y;

  while (x !== to.x || y !== to.y) {
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
      if (!map[y][x].transparent && (x !== from.x || y !== from.y)) {
        return false;
      }
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  // Check destination tile transparency
  if (to.x >= 0 && to.x < mapWidth && to.y >= 0 && to.y < mapHeight) {
    return map[to.y][to.x].transparent;
  }

  return false;
}

// Distance between two positions
export function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Manhattan distance
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
