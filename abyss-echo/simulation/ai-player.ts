// ============================================================
// AI Player — Comprehensive simulation of real player behavior
// v3.0: Equipment fix + Boss strategy + Kiting + Pre-combat prep
// v3.3: Boss seek-and-destroy + Stuck escape + Mage attack commitment + Rogue hunger
// ============================================================
import type { Player, Enemy, TileType, Item, EquipmentSlot, Stats, GamePhase } from '../src/types/index.js';
import { ItemType, StatusEffectType, BossBlessing, CharacterClass, EquipmentSlot, TileType as TT, Rarity } from '../src/types/index.js';
import { SeededRandom } from '../src/utils/random.js';

// ============================================================
// Position tracking for stuck detection (module-level ring buffer)
// ============================================================
const VISITED_BUFFER_SIZE = 30;
const visitedPositions: string[] = [];

function trackPosition(x: number, y: number, floor: number): void {
  const key = `${floor}:${x},${y}`;
  visitedPositions.push(key);
  if (visitedPositions.length > VISITED_BUFFER_SIZE) {
    visitedPositions.shift();
  }
}

function isStuckInLoop(): boolean {
  if (visitedPositions.length < 4) return false;
  const recent = visitedPositions.slice(-8);
  const counts = new Map<string, number>();
  for (const pos of recent) {
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }
  // If any position appears 2+ times in last 8 steps, we're looping
  for (const count of counts.values()) {
    if (count >= 2) return true;
  }
  return false;
}

function getLeastVisitedDirection(px: number, py: number, floor: number, isWalkable: (x: number, y: number) => boolean, w: number, h: number): { dx: number; dy: number } | null {
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let bestDir: { dx: number; dy: number; visitCount: number } | null = null;
  for (const [ddx, ddy] of dirs) {
    const nx = px + ddx, ny = py + ddy;
    if (ny < 0 || ny >= h || nx < 0 || nx >= w || !isWalkable(nx, ny)) continue;
    const key = `${floor}:${nx},${ny}`;
    const count = visitedPositions.filter(p => p === key).length;
    if (!bestDir || count < bestDir.visitCount) {
      bestDir = { dx: ddx, dy: ddy, visitCount: count };
    }
  }
  return bestDir ? { dx: bestDir.dx, dy: bestDir.dy } : null;
}

export function resetVisitedPositions(): void {
  visitedPositions.length = 0;
}

export interface AIAction {
  type: 'move' | 'wait' | 'pickup' | 'useItem' | 'descend' | 'useSkill' | 'equip' | 'drop' | 'sellItem' | 'allocateStat' | 'confirmLevelUp' | 'selectTalent' | 'buyShopItem' | 'closeShop' | 'chooseEventChoice' | 'closeEvent' | 'chooseBossBlessing' | 'enhanceEquipment' | 'openDoor' | 'confirmIdentify' | 'confirmSacrifice';
  dx?: number;
  dy?: number;
  itemIndex?: number;
  targetSlot?: EquipmentSlot;
  stat?: keyof Stats;
  talentId?: string;
  shopIndex?: number;
  eventChoice?: number;
  blessing?: BossBlessing;
  rng?: SeededRandom;
}

// ============================================================
// Equipment evaluation helpers
// ============================================================

interface EquipItem extends Item {
  damage?: number;
  defense?: number;
  magicAttack?: number;
  enhanceLevel?: number;
  bonusStat?: keyof Stats;
  evasion?: number;
  specialEffect?: string;
  element?: string;
}

function getEquipScore(item: EquipItem, playerClass: CharacterClass): number {
  let score = 0;
  if (item.type === ItemType.Weapon) {
    score += (item.damage ?? 0) * 4;
    if (item.magicAttack) score += item.magicAttack * 3;
  }
  if (item.type === ItemType.Armor) {
    score += (item.defense ?? 0) * 4;
    score += (item.evasion ?? 0) * 2;
  }
  if (item.type === ItemType.Ring || item.type === ItemType.Amulet) {
    score += (item.defense ?? 0) * 2;
    score += (item.damage ?? 0) * 2;
    if (item.magicAttack) score += item.magicAttack * 2;
  }
  score += (item.enhanceLevel ?? 0) * 5;
  const rarityBonus: Record<string, number> = { common: 0, good: 5, rare: 15, epic: 30, legendary: 60 };
  score += rarityBonus[item.rarity as string] ?? 0;
  if (item.bonusStat === 'str' && playerClass === CharacterClass.Warrior) score += 8;
  if (item.bonusStat === 'int' && playerClass === CharacterClass.Mage) score += 8;
  if (item.bonusStat === 'dex' && playerClass === CharacterClass.Rogue) score += 8;
  if (item.specialEffect) score += 10;
  if (item.cursed) score -= 50;
  return score;
}

function getCurrentEquipScore(player: Player, slot: EquipmentSlot): number {
  const item = player.equipment[slot];
  if (!item) return 0;
  return getEquipScore(item as EquipItem, player.class);
}

// ============================================================
// Item identification helpers
// ============================================================

function isIdentifiedHealingPotion(item: Item): boolean {
  return item.type === ItemType.Potion && item.identified &&
    (item.name?.includes('治疗') || item.name?.includes('回血') || item.name?.includes('完全治疗') || item.name?.includes('生命'));
}

function isIdentifiedManaPotion(item: Item): boolean {
  return item.type === ItemType.Potion && item.identified &&
    (item.name?.includes('魔力') || item.name?.includes('蓝'));
}

function isIdentifiedBuffPotion(item: Item): boolean {
  return item.type === ItemType.Potion && item.identified &&
    (item.name?.includes('力量') || item.name?.includes('灵巧') || item.name?.includes('智慧') || item.name?.includes('火抗'));
}

function isIdentifiedDangerousPotion(item: Item): boolean {
  return item.type === ItemType.Potion && item.identified &&
    (item.name?.includes('剧毒') || item.name?.includes('麻痹') || item.name?.includes('混乱'));
}

function isCombatScroll(item: Item): boolean {
  return item.type === ItemType.Scroll && item.identified &&
    (item.name?.includes('火球') || item.name?.includes('冰风暴') || item.name?.includes('闪电'));
}

function isUtilityScroll(item: Item): boolean {
  return item.type === ItemType.Scroll && item.identified &&
    (item.name?.includes('鉴定') || item.name?.includes('地图') || item.name?.includes('附魔') || item.name?.includes('解咒') || item.name?.includes('传送门') || item.name?.includes('感知'));
}

// ============================================================
// Talent selection — class-specific priorities
// ============================================================

const TALENT_PRIORITIES: Record<string, string[]> = {
  warrior: ['nightVision', 'thickSkin', 'ironStomach', 'regeneration', 'deadlyStrike', 'shieldWall', 'ironWill', 'bloodFury', 'fastLearner', 'lucky', 'tenacious', 'packMule', 'elementalAffinity', 'greedy', 'meditation'],
  mage: ['nightVision', 'meditation', 'spellPenetration', 'manaShield', 'arcaneResonance', 'fastLearner', 'ironStomach', 'lucky', 'elementalAffinity', 'thickSkin', 'regeneration', 'deadlyStrike', 'tenacious', 'packMule', 'greedy'],
  rogue: ['ironStomach', 'nightVision', 'trapSense', 'deadlyStrike', 'evasionMaster', 'lucky', 'toxicBlade', 'fastLearner', 'regeneration', 'thickSkin', 'tenacious', 'packMule', 'elementalAffinity', 'greedy', 'meditation'],
};

// ============================================================
// Boss blessing — contextual selection
// ============================================================

function chooseBossBlessing(player: Player, lastBossDefId: string | null): BossBlessing {
  const cls = player.class;
  if (lastBossDefId === 'goblinKing') return cls === CharacterClass.Mage ? BossBlessing.TribalHeart : BossBlessing.Headhunter;
  if (lastBossDefId === 'spiderQueen') return cls === CharacterClass.Warrior ? BossBlessing.VenomBlood : BossBlessing.WebWeaver;
  if (lastBossDefId === 'deathKnight') return cls === CharacterClass.Warrior ? BossBlessing.UndyingWill : BossBlessing.DeathPact;
  if (lastBossDefId === 'demonLord') return cls === CharacterClass.Mage ? BossBlessing.DemonPower : BossBlessing.InfernalSoul;
  if (lastBossDefId === 'abyssKing') return cls === CharacterClass.Rogue ? BossBlessing.AbyssEye : BossBlessing.VoidWalk;
  return BossBlessing.EchoBody;
}

// ============================================================
// BFS pathfinding
// ============================================================

// ============================================================
// Terrain cost helpers — weighted pathfinding
// ============================================================

const TILE_TYPE_STRINGS = {
  trapSpike: 'trapSpike', trapFire: 'trapFire', trapTeleport: 'trapTeleport', trapPoison: 'trapPoison',
  shallowWater: 'shallowWater', cooledLava: 'cooledLava', portal: 'portal', sarcophagus: 'sarcophagus',
  hiddenSarcophagus: 'hiddenSarcophagus', altar: 'altar', hiddenAltar: 'hiddenAltar',
  fountain: 'fountain', inscription: 'inscription',
} as const;

function getTileTypeStr(tile: { type: TileType; walkable: boolean }): string {
  return tile.type as string;
}

function isTrap(tile: { type: TileType }): boolean {
  const t = tile.type as string;
  return t === 'trapSpike' || t === 'trapFire' || t === 'trapTeleport' || t === 'trapPoison';
}

function isDangerousTerrain(tile: { type: TileType }): boolean {
  const t = tile.type as string;
  return t === 'cooledLava' || t === 'shallowWater' || isTrap(tile);
}

// Progressive terrain cost: terrainLevel is set before each decideAction call
let currentTerrainLevel = 1;

function terrainCost(tile: { type: TileType }): number {
  const t = tile.type as string;
  if (t === 'trapSpike' || t === 'trapFire' || t === 'trapTeleport' || t === 'trapPoison') {
    if (currentTerrainLevel >= 3) return 2;   // L3 desperation: nearly ignore traps
    if (currentTerrainLevel >= 2) return 8;    // L2: reduced penalty
    return 100;                                // L1: avoid traps
  }
  if (t === 'cooledLava') {
    if (currentTerrainLevel >= 2) return 2;
    return 6;
  }
  if (t === 'shallowWater') return 2;
  return 1;
}

function isInteractiveTerrain(tile: { type: TileType }): boolean {
  const t = tile.type as string;
  return t === 'sarcophagus' || t === 'hiddenSarcophagus' || t === 'altar' ||
         t === 'hiddenAltar' || t === 'fountain' || t === 'inscription' || t === 'portal' || t === 'eliteDoor';
}

// ============================================================
// Dijkstra-style BFS with terrain costs
// ============================================================

export function bfsToTarget(
  startX: number, startY: number,
  targetX: number, targetY: number,
  walkable: (x: number, y: number) => boolean,
  mapWidth: number, mapHeight: number,
  map?: { type: TileType; walkable: boolean }[][],
): { dx: number; dy: number } | null {
  if (startX === targetX && startY === targetY) return null;
  // Simple BFS when no map for terrain costs
  if (!map) {
    return bfsToTargetSimple(startX, startY, targetX, targetY, walkable, mapWidth, mapHeight);
  }
  // Dijkstra with terrain costs
  const dist = new Map<string, number>();
  const firstMove = new Map<string, { dx: number; dy: number }>();
  const queue: { x: number; y: number; cost: number }[] = [];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const startKey = `${startX},${startY}`;
  dist.set(startKey, 0);

  for (const [ddx, ddy] of dirs) {
    const nx = startX + ddx, ny = startY + ddy;
    if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
    if (!walkable(nx, ny)) continue;
    const tile = map[ny]?.[nx];
    const cost = tile ? terrainCost(tile) : 1;
    const key = `${nx},${ny}`;
    if (!dist.has(key) || cost < (dist.get(key) ?? Infinity)) {
      dist.set(key, cost);
      firstMove.set(key, { dx: ddx, dy: ddy });
      queue.push({ x: nx, y: ny, cost });
    }
  }

  // Simple priority queue via insertion sort (adequate for small maps)
  queue.sort((a, b) => a.cost - b.cost);
  let head = 0;
  while (head < queue.length) {
    const { x, y, cost } = queue[head++];
    const key = `${x},${y}`;
    if (cost > (dist.get(key) ?? Infinity)) continue; // Stale entry
    if (x === targetX && y === targetY) {
      const first = firstMove.get(key);
      return first ?? null;
    }
    for (const [ddx, ddy] of dirs) {
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
      if (!walkable(nx, ny)) continue;
      const tile = map[ny]?.[nx];
      const stepCost = tile ? terrainCost(tile) : 1;
      const newCost = cost + stepCost;
      const nKey = `${nx},${ny}`;
      const prevCost = dist.get(nKey) ?? Infinity;
      if (newCost < prevCost) {
        dist.set(nKey, newCost);
        firstMove.set(nKey, firstMove.get(key) ?? { dx: ddx, dy: ddy });
        // Insert sorted
        let inserted = false;
        for (let i = queue.length - 1; i >= head; i--) {
          if (queue[i].cost <= newCost) {
            queue.splice(i + 1, 0, { x: nx, y: ny, cost: newCost });
            inserted = true;
            break;
          }
        }
        if (!inserted) queue.push({ x: nx, y: ny, cost: newCost });
      }
    }
  }
  return null;
}

function bfsToTargetSimple(
  startX: number, startY: number,
  targetX: number, targetY: number,
  walkable: (x: number, y: number) => boolean,
  mapWidth: number, mapHeight: number,
): { dx: number; dy: number } | null {
  if (startX === targetX && startY === targetY) return null;
  const visited = new Set<string>();
  const queue: { x: number; y: number; firstDx: number; firstDy: number }[] = [];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (const [ddx, ddy] of dirs) {
    const nx = startX + ddx, ny = startY + ddy;
    if (nx === targetX && ny === targetY) return { dx: ddx, dy: ddy };
    if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight && walkable(nx, ny)) {
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny, firstDx: ddx, firstDy: ddy });
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const { x, y, firstDx, firstDy } = queue[head++];
    for (const [ddx, ddy] of dirs) {
      const nx = x + ddx, ny = y + ddy;
      if (nx === targetX && ny === targetY) return { dx: firstDx, dy: firstDy };
      if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
        const key = `${nx},${ny}`;
        if (!visited.has(key) && walkable(nx, ny)) {
          visited.add(key);
          queue.push({ x: nx, y: ny, firstDx, firstDy });
        }
      }
    }
  }
  return null;
}

export function findNearestTile(
  startX: number, startY: number,
  match: (x: number, y: number) => boolean,
  walkable: (x: number, y: number) => boolean,
  mapWidth: number, mapHeight: number,
  map?: { type: TileType; walkable: boolean }[][],
): { x: number; y: number; firstDx: number; firstDy: number } | null {
  if (match(startX, startY)) return { x: startX, y: startY, firstDx: 0, firstDy: 0 };
  // Dijkstra with terrain costs when map available
  if (!map) {
    return findNearestTileSimple(startX, startY, match, walkable, mapWidth, mapHeight);
  }
  const dist = new Map<string, number>();
  const firstMove = new Map<string, { dx: number; dy: number }>();
  const queue: { x: number; y: number; cost: number }[] = [];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const startKey = `${startX},${startY}`;
  dist.set(startKey, 0);

  for (const [ddx, ddy] of dirs) {
    const nx = startX + ddx, ny = startY + ddy;
    if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
    if (!walkable(nx, ny)) continue;
    const tile = map[ny]?.[nx];
    const cost = tile ? terrainCost(tile) : 1;
    const key = `${nx},${ny}`;
    if (!dist.has(key) || cost < (dist.get(key) ?? Infinity)) {
      dist.set(key, cost);
      firstMove.set(key, { dx: ddx, dy: ddy });
      queue.push({ x: nx, y: ny, cost });
    }
  }

  queue.sort((a, b) => a.cost - b.cost);
  let head = 0;
  while (head < queue.length) {
    const { x, y, cost } = queue[head++];
    const key = `${x},${y}`;
    if (cost > (dist.get(key) ?? Infinity)) continue;
    if (match(x, y)) {
      const first = firstMove.get(key);
      return { x, y, firstDx: first?.dx ?? 0, firstDy: first?.dy ?? 0 };
    }
    for (const [ddx, ddy] of dirs) {
      const nx = x + ddx, ny = y + ddy;
      if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
      if (!walkable(nx, ny)) continue;
      const tile = map[ny]?.[nx];
      const stepCost = tile ? terrainCost(tile) : 1;
      const newCost = cost + stepCost;
      const nKey = `${nx},${ny}`;
      const prevCost = dist.get(nKey) ?? Infinity;
      if (newCost < prevCost) {
        dist.set(nKey, newCost);
        firstMove.set(nKey, firstMove.get(key) ?? { dx: ddx, dy: ddy });
        let inserted = false;
        for (let i = queue.length - 1; i >= head; i--) {
          if (queue[i].cost <= newCost) {
            queue.splice(i + 1, 0, { x: nx, y: ny, cost: newCost });
            inserted = true;
            break;
          }
        }
        if (!inserted) queue.push({ x: nx, y: ny, cost: newCost });
      }
    }
  }
  return null;
}

function findNearestTileSimple(
  startX: number, startY: number,
  match: (x: number, y: number) => boolean,
  walkable: (x: number, y: number) => boolean,
  mapWidth: number, mapHeight: number,
): { x: number; y: number; firstDx: number; firstDy: number } | null {
  if (match(startX, startY)) return { x: startX, y: startY, firstDx: 0, firstDy: 0 };
  const visited = new Set<string>([`${startX},${startY}`]);
  const queue: { x: number; y: number; firstDx: number; firstDy: number }[] = [];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (const [ddx, ddy] of dirs) {
    const nx = startX + ddx, ny = startY + ddy;
    if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        if (match(nx, ny)) return { x: nx, y: ny, firstDx: ddx, firstDy: ddy };
        if (walkable(nx, ny)) {
          queue.push({ x: nx, y: ny, firstDx: ddx, firstDy: ddy });
        }
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const { x, y, firstDx, firstDy } = queue[head++];
    for (const [ddx, ddy] of dirs) {
      const nx = x + ddx, ny = y + ddy;
      if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
        const key = `${nx},${ny}`;
        if (!visited.has(key)) {
          visited.add(key);
          if (match(nx, ny)) return { x: nx, y: ny, firstDx, firstDy };
          if (walkable(nx, ny)) {
            queue.push({ x: nx, y: ny, firstDx, firstDy });
          }
        }
      }
    }
  }
  return null;
}

// ============================================================
// Enemy/target helpers
// ============================================================

function isEnemyVisible(enemy: Enemy, visibleTiles: Set<string>): boolean {
  return visibleTiles.has(`${enemy.pos.x},${enemy.pos.y}`);
}

function findNearestVisibleEnemy(player: Player, enemies: Enemy[], visibleTiles: Set<string>, maxRange: number): Enemy | null {
  let nearest: Enemy | null = null;
  let minDist = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (!isEnemyVisible(e, visibleTiles)) continue;
    const dist = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
    if (dist <= maxRange && dist < minDist) { minDist = dist; nearest = e; }
  }
  return nearest;
}

function getAdjacentEnemy(player: Player, enemies: Enemy[]): Enemy | null {
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y) === 1) return e;
  }
  return null;
}

function getAdjacentEnemiesCount(player: Player, enemies: Enemy[]): number {
  let count = 0;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y) <= 1.5) count++;
  }
  return count;
}

function getVisibleEnemiesInRange(player: Player, enemies: Enemy[], visibleTiles: Set<string>, range: number): Enemy[] {
  return enemies.filter(e => e.hp > 0 && isEnemyVisible(e, visibleTiles) &&
    Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y) <= range);
}

// Check if any visible enemy is a boss
function isBossVisible(player: Player, enemies: Enemy[], visibleTiles: Set<string>): boolean {
  return enemies.some(e => e.hp > 0 && e.isBoss && isEnemyVisible(e, visibleTiles));
}

// Find nearest visible boss
function findNearestVisibleBoss(player: Player, enemies: Enemy[], visibleTiles: Set<string>): Enemy | null {
  let nearest: Enemy | null = null;
  let minDist = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0 || !e.isBoss) continue;
    if (!isEnemyVisible(e, visibleTiles)) continue;
    const dist = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.y - player.pos.y);
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  return nearest;
}

// Check if approaching a boss floor (next floor is boss)
function isApproachingBossFloor(currentFloor: number): boolean {
  return [4, 9, 14, 19, 24, 29].includes(currentFloor);
}

function isBossFloor(floor: number): boolean {
  return [5, 10, 15, 20, 25, 30].includes(floor);
}

// ============================================================
// Inventory helpers
// ============================================================

function findFoodItem(player: Player): number {
  let bestIdx = -1;
  let bestNutrition = Infinity;
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (item.type === ItemType.Food) {
      const nutrition = (item as any).nutrition ?? 50;
      if (nutrition < bestNutrition) {
        bestNutrition = nutrition;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

function findHealingPotion(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (isIdentifiedHealingPotion(player.inventory[i])) return i;
  }
  return -1;
}

function findManaPotion(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (isIdentifiedManaPotion(player.inventory[i])) return i;
  }
  return -1;
}

function findCombatScroll(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (isCombatScroll(player.inventory[i])) return i;
  }
  return -1;
}

function findIdentifyScroll(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Scroll && player.inventory[i].identified &&
      player.inventory[i].name?.includes('鉴定')) return i;
  }
  return -1;
}

function findEnchantScroll(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Scroll && player.inventory[i].identified &&
      player.inventory[i].name?.includes('附魔')) return i;
  }
  return -1;
}

function findRemoveCurseScroll(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Scroll && player.inventory[i].identified &&
      player.inventory[i].name?.includes('解咒')) return i;
  }
  return -1;
}

function findMappingScroll(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Scroll && player.inventory[i].identified &&
      player.inventory[i].name?.includes('地图')) return i;
  }
  return -1;
}

function findCreatePortalScroll(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Scroll && player.inventory[i].identified &&
      player.inventory[i].name?.includes('传送门')) return i;
  }
  return -1;
}

function isOnStairsDown(px: number, py: number, map: { type: TileType }[][]): boolean {
  return map[py]?.[px]?.type === ('stairsDown' as TileType);
}

function hasCursedEquipment(player: Player): boolean {
  for (const slot of Object.values(player.equipment)) {
    if (slot && (slot as any).cursed) return true;
  }
  return false;
}

function findUnidentifiedItem(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    if (!player.inventory[i].identified &&
      (player.inventory[i].type === ItemType.Potion || player.inventory[i].type === ItemType.Scroll)) {
      return i;
    }
  }
  return -1;
}

function findSacrificeItem(player: Player): number {
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (item.type === ItemType.Food && (item as any).nutrition <= 70) return i;
  }
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (item.type === ItemType.Potion && !isIdentifiedHealingPotion(item) && !isIdentifiedManaPotion(item)) return i;
  }
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Food) return i;
  }
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i].type === ItemType.Potion) return i;
  }
  return -1;
}

function findWorstItem(player: Player): number {
  let worstIdx = -1;
  let worstScore = Infinity;
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    let score = (item as any).value ?? 0;
    if (item.type === ItemType.Food) score += 100;
    if (isIdentifiedHealingPotion(item)) score += 150;
    if (isIdentifiedManaPotion(item)) score += 100;
    if (isCombatScroll(item)) score += 80;
    if (!item.identified) score += 30;
    if (score < worstScore) {
      worstScore = score;
      worstIdx = i;
    }
  }
  return worstIdx;
}

function countHealingPotions(player: Player): number {
  return player.inventory.filter(i => isIdentifiedHealingPotion(i)).length;
}

// ============================================================
// Equipment auto-management (FIXED: no spinning)
// ============================================================

const EQUIP_MIN_SCORE_GAIN = 3; // Only swap if new item is meaningfully better

function shouldEquipItem(item: Item, player: Player): EquipmentSlot | null {
  if (item.type === ItemType.Weapon) {
    const currentScore = getCurrentEquipScore(player, EquipmentSlot.Weapon);
    const newScore = getEquipScore(item as EquipItem, player.class);
    if (newScore > currentScore + EQUIP_MIN_SCORE_GAIN) return EquipmentSlot.Weapon;
  }
  if (item.type === ItemType.Armor) {
    const currentScore = getCurrentEquipScore(player, EquipmentSlot.Armor);
    const newScore = getEquipScore(item as EquipItem, player.class);
    if (newScore > currentScore + EQUIP_MIN_SCORE_GAIN) return EquipmentSlot.Armor;
  }
  if (item.type === ItemType.Ring) {
    const score1 = getCurrentEquipScore(player, EquipmentSlot.Ring1);
    const score2 = getCurrentEquipScore(player, EquipmentSlot.Ring2);
    const newScore = getEquipScore(item as EquipItem, player.class);
    if (!player.equipment[EquipmentSlot.Ring1]) return EquipmentSlot.Ring1;
    if (!player.equipment[EquipmentSlot.Ring2]) return EquipmentSlot.Ring2;
    const worse = score1 <= score2 ? EquipmentSlot.Ring1 : EquipmentSlot.Ring2;
    const worseScore = Math.min(score1, score2);
    if (newScore > worseScore + EQUIP_MIN_SCORE_GAIN) return worse;
  }
  if (item.type === ItemType.Amulet) {
    const currentScore = getCurrentEquipScore(player, EquipmentSlot.Amulet);
    const newScore = getEquipScore(item as EquipItem, player.class);
    if (newScore > currentScore + EQUIP_MIN_SCORE_GAIN) return EquipmentSlot.Amulet;
  }
  return null;
}

function findBestEquipUpgrade(player: Player): { itemIndex: number; slot: EquipmentSlot } | null {
  let bestUpgrade: { itemIndex: number; slot: EquipmentSlot; scoreGain: number } | null = null;

  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (item.cursed) continue;
    const slot = shouldEquipItem(item, player);
    if (!slot) continue;

    const currentScore = getCurrentEquipScore(player, slot);
    const newScore = getEquipScore(item as EquipItem, player.class);
    const gain = newScore - currentScore;

    if (!bestUpgrade || gain > bestUpgrade.scoreGain) {
      bestUpgrade = { itemIndex: i, slot, scoreGain: gain };
    }
  }
  return bestUpgrade ? { itemIndex: bestUpgrade.itemIndex, slot: bestUpgrade.slot } : null;
}

function findBestEnhanceTarget(player: Player, currentFloor: number): EquipmentSlot | null {
  const slots: EquipmentSlot[] = [EquipmentSlot.Weapon, EquipmentSlot.Armor, EquipmentSlot.Amulet, EquipmentSlot.Ring1, EquipmentSlot.Ring2];

  for (const slot of slots) {
    const item = player.equipment[slot];
    if (!item || !('enhanceLevel' in item)) continue;
    const enhanceLevel = (item as any).enhanceLevel ?? 0;
    if (enhanceLevel >= 3) continue;
    const costs = [100, 250, 500];
    if (player.gold >= costs[enhanceLevel]) {
      if (enhanceLevel >= 1 && player.gold < costs[enhanceLevel] + 100) continue;
      return slot;
    }
  }
  return null;
}

// ============================================================
// The main AI decision function
// ============================================================

export function decideAction(
  player: Player,
  enemies: Enemy[],
  map: { type: TileType; walkable: boolean; visible: boolean; char?: string; remembered?: boolean }[][],
  visibleTiles: Set<string>,
  items: { pos: { x: number; y: number } }[],
  currentFloor: number,
  phase: GamePhase,
  shopItems: Item[] | null,
  statPoints: number,
  talents: string[],
  skillCooldowns: number[],
  maxFloor: number,
  turnOnFloor: number,
  pendingIdentify: boolean,
  pendingSacrifice: boolean,
  pendingForge: boolean,
  lastBossDefId: string | null,
  bossBlessingPending: boolean,
  rng: SeededRandom,
  lastActionType?: string,
): AIAction {
  const px = player.pos.x, py = player.pos.y;
  const w = map[0]?.length ?? 1, h = map.length;

  // Track position for stuck detection
  trackPosition(px, py, currentFloor);
  const stuckInLoop = isStuckInLoop();

  // Progressive terrain cost reduction based on time spent on floor
  const terrainLevel = turnOnFloor >= 150 ? 3 : turnOnFloor >= 60 ? 2 : 1;
  currentTerrainLevel = terrainLevel;

  const isWalkable = (x: number, y: number) => {
    if (y < 0 || y >= h || x < 0 || x >= w) return false;
    const tile = map[y]?.[x];
    if (!tile) return false;
    return tile.walkable || tile.type === ('door' as TileType) || tile.type === ('eliteDoor' as TileType) || isInteractiveTerrain(tile);
  };

  const isWalkableForBFS = (x: number, y: number) => {
    if (y < 0 || y >= h || x < 0 || x >= w) return false;
    const tile = map[y]?.[x];
    if (!tile) return false;
    return tile.walkable || tile.type === ('door' as TileType) || tile.type === ('eliteDoor' as TileType) || isInteractiveTerrain(tile);
  };

  // ================================================================
  // Phase handlers
  // ================================================================

  if (pendingIdentify) {
    const idx = findUnidentifiedItem(player);
    if (idx >= 0) return { type: 'confirmIdentify', itemIndex: idx };
    return { type: 'confirmIdentify', itemIndex: 0 };
  }

  if (pendingSacrifice) {
    const idx = findSacrificeItem(player);
    if (idx >= 0) return { type: 'confirmSacrifice', itemIndex: idx };
    for (let i = 0; i < player.inventory.length; i++) {
      const item = player.inventory[i];
      if (item.type === ItemType.Potion || item.type === ItemType.Food) return { type: 'confirmSacrifice', itemIndex: i };
    }
    return { type: 'wait' };
  }

  if (pendingForge) {
    const slot = findBestEnhanceTarget(player, currentFloor);
    if (slot) return { type: 'enhanceEquipment', targetSlot: slot };
    return { type: 'wait' };
  }

  // --- Level Up phase ---
  if (phase === 'levelUp') {
    if (statPoints > 0) {
      // Round-robin allocation: cycle through priorities based on how many points already allocated
      const statPriority: Record<string, (keyof Stats)[]> = {
        [CharacterClass.Warrior]: ['str', 'vit', 'dex', 'int'],
        [CharacterClass.Mage]: ['int', 'vit', 'dex', 'str'],
        [CharacterClass.Rogue]: ['dex', 'str', 'vit', 'int'],
      };
      const priority = statPriority[player.class] ?? ['str', 'vit', 'dex', 'int'];
      // Calculate total allocated stat points beyond base
      const totalAllocated = (player.bonusStats?.str ?? 0) + (player.bonusStats?.dex ?? 0) +
                             (player.bonusStats?.int ?? 0) + (player.bonusStats?.vit ?? 0);
      const idx = totalAllocated % priority.length;
      return { type: 'allocateStat', stat: priority[idx] };
    }
    return { type: 'confirmLevelUp' };
  }

  // --- Talent Selection phase ---
  if (phase === 'talentSelection') {
    const priorities = TALENT_PRIORITIES[player.class] ?? TALENT_PRIORITIES.warrior;
    for (const t of priorities) {
      if (!talents.includes(t)) return { type: 'selectTalent', talentId: t };
    }
    const allTalents = ['nightVision', 'thickSkin', 'ironStomach', 'fastLearner', 'lucky', 'regeneration', 'greedy', 'tenacious', 'deadlyStrike', 'elementalAffinity', 'packMule', 'meditation', 'shieldWall', 'bloodFury', 'ironWill', 'spellPenetration', 'arcaneResonance', 'manaShield', 'evasionMaster', 'toxicBlade', 'trapSense'];
    for (const t of allTalents) {
      if (!talents.includes(t)) return { type: 'selectTalent', talentId: t };
    }
    return { type: 'selectTalent', talentId: allTalents[0] };
  }

  if (bossBlessingPending) {
    const blessing = chooseBossBlessing(player, lastBossDefId);
    return { type: 'chooseBossBlessing', blessing };
  }

  if (phase === 'shop') {
    return handleShopPhase(player, shopItems, currentFloor);
  }

  if (phase === 'event') {
    // Event choice heuristic based on player state:
    // Choice 0: usually "invest resources for reward" (gold/HP/MP sacrifice)
    // Choice 1: usually "moderate risk for moderate reward"
    // Choice 2: usually "safe/avoid"
    let choice = 1; // Default: moderate option
    if (player.hp < player.maxHp * 0.4 || player.hunger < player.maxHunger * 0.3) {
      choice = 2; // When weak, choose the safe option
    } else if (player.gold >= 30 && player.hp > player.maxHp * 0.6) {
      choice = 0; // When wealthy and healthy, invest
    } else if (player.hp > player.maxHp * 0.7 && player.mp > player.maxMp * 0.5) {
      choice = 0; // Can afford to sacrifice HP/MP
    }
    return { type: 'chooseEventChoice', eventChoice: choice };
  }

  if (phase === 'identify' as GamePhase) {
    const idx = findUnidentifiedItem(player);
    if (idx >= 0) return { type: 'useItem', itemIndex: idx };
    return { type: 'wait' };
  }

  if (phase !== 'playing') return { type: 'wait' };

  // ================================================================
  // Core gameplay AI — priority ordered
  // ================================================================

  const adjEnemy = getAdjacentEnemy(player, enemies);
  const adjEnemyCount = getAdjacentEnemiesCount(player, enemies);
  const visibleEnemies5 = getVisibleEnemiesInRange(player, enemies, visibleTiles, 5);
  const visibleEnemies8 = getVisibleEnemiesInRange(player, enemies, visibleTiles, 8);
  const bossVisible = isBossVisible(player, enemies, visibleTiles);
  const nearestBoss = bossVisible ? findNearestVisibleBoss(player, enemies, visibleTiles) : null;

  // ---- 1. CRITICAL SURVIVAL ----

  // 1a. Auto-equip upgrades (free action)
  const equipUpgrade = findBestEquipUpgrade(player);
  if (equipUpgrade) {
    return { type: 'equip', itemIndex: equipUpgrade.itemIndex, targetSlot: equipUpgrade.slot };
  }

  // 1b. Remove curse if needed
  if (hasCursedEquipment(player)) {
    const removeCurseIdx = findRemoveCurseScroll(player);
    if (removeCurseIdx >= 0) return { type: 'useItem', itemIndex: removeCurseIdx };
  }

  // 1c. Eat food if starving
  if (player.hunger <= 0) {
    const foodIdx = findFoodItem(player);
    if (foodIdx >= 0) return { type: 'useItem', itemIndex: foodIdx };
  }

  // 1d. CRITICAL healing (< 30% HP) — use potions immediately
  if (player.hp <= Math.floor(player.maxHp * 0.3)) {
    const potionIdx = findHealingPotion(player);
    if (potionIdx >= 0) return { type: 'useItem', itemIndex: potionIdx };
    // Desperate: escape with CreatePortal scroll
    const portalIdx = findCreatePortalScroll(player);
    if (portalIdx >= 0 && !isOnStairsDown(px, py, map)) return { type: 'useItem', itemIndex: portalIdx };
    // Desperate: use unidentified potion at < 15% HP
    if (player.hp <= Math.floor(player.maxHp * 0.15)) {
      for (let i = 0; i < player.inventory.length; i++) {
        const item = player.inventory[i];
        if (item.type === ItemType.Potion && !isIdentifiedDangerousPotion(item)) {
          return { type: 'useItem', itemIndex: i };
        }
      }
    }
  }

  // ---- 1e. SPECIAL TERRAIN INTERACTION (adjacent or underfoot) ----
  // Sarcophagus: 50% item, 50% trap — worth it when healthy and no enemies
  const adjDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [ddx, ddy] of adjDirs) {
    const nx = px + ddx, ny = py + ddy;
    if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
    const tile = map[ny]?.[nx];
    if (!tile) continue;
    const t = tile.type as string;
    // Sarcophagus: open when healthy and few enemies nearby
    if ((t === 'sarcophagus' || t === 'hiddenSarcophagus') && player.hp > Math.floor(player.maxHp * 0.6) && visibleEnemies8.length <= 1) {
      return { type: 'move', dx: ddx, dy: ddy };
    }
    // Altar: always beneficial (+3 DEF for 3 turns)
    if (t === 'altar' || t === 'hiddenAltar') {
      return { type: 'move', dx: ddx, dy: ddy };
    }
    // Fountain: heal 50% HP + 20 MP (one-time) — go when hurt
    if (t === 'fountain' && player.hp < player.maxHp * 0.9) {
      return { type: 'move', dx: ddx, dy: ddy };
    }
    // Inscription: permanent stat bonus — always go
    if (t === 'inscription') {
      return { type: 'move', dx: ddx, dy: ddy };
    }
  }
  // Portal underfoot or adjacent: use when surrounded or as shortcut
  if (map[py]?.[px]?.type as string === 'portal' && adjEnemyCount >= 2) {
    return { type: 'wait' }; // Stepping on portal triggers teleport
  }
  for (const [ddx, ddy] of adjDirs) {
    const nx = px + ddx, ny = py + ddy;
    if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
    if ((map[ny]?.[nx]?.type as string) === 'portal' && adjEnemyCount >= 2) {
      return { type: 'move', dx: ddx, dy: ddy };
    }
  }

  // ---- 2. BOSS FLOOR PREPARATION & BOSS SEEK-AND-DESTROY ----

  const onBossFloor = isBossFloor(currentFloor);
  const approachingBossFloor = isApproachingBossFloor(currentFloor);

  // 2a. Pre-boss floor preparation (on F4/F9/F14 etc.)
  if (approachingBossFloor) {
    if (player.hp < Math.floor(player.maxHp * 0.7)) {
      const potionIdx = findHealingPotion(player);
      if (potionIdx >= 0) return { type: 'useItem', itemIndex: potionIdx };
    }
    if (player.hunger < player.maxHunger * 0.6) {
      const foodIdx = findFoodItem(player);
      if (foodIdx >= 0) return { type: 'useItem', itemIndex: foodIdx };
    }
    if (player.class === CharacterClass.Mage && player.mp < Math.floor(player.maxMp * 0.5)) {
      const manaIdx = findManaPotion(player);
      if (manaIdx >= 0) return { type: 'useItem', itemIndex: manaIdx };
    }
    if (player.class === CharacterClass.Warrior && skillCooldowns[1] <= 0 && player.mp >= 8) {
      const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
      if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
    }
    if (player.class === CharacterClass.Mage && skillCooldowns[1] <= 0 && player.mp >= 6) {
      const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
      if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
    }
    if (player.class === CharacterClass.Rogue && skillCooldowns[1] <= 0 && player.mp >= 4) {
      const hasPoisonBlade = player.statusEffects.some(e => e.type === StatusEffectType.PoisonBlade);
      if (!hasPoisonBlade) return { type: 'useSkill', itemIndex: 1 };
    }
  }

  // 2b. ON BOSS FLOOR: seek and destroy — don't leave without killing the boss
  //    Only descend if critically low on resources (HP<30% starving) or boss is already dead
  if (onBossFloor && bossVisible) {
    // Boss-specific combat: prioritize boss over regular enemies
    if (nearestBoss) {
      const bossDist = Math.abs(nearestBoss.pos.x - px) + Math.abs(nearestBoss.pos.y - py);

      // Adjacent to boss — full combat rotation
      if (bossDist <= 1) {
        // Warrior: WarCry if not active, then melee
        if (player.class === CharacterClass.Warrior) {
          if (skillCooldowns[1] <= 0 && player.mp >= 8) {
            const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
            if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
          }
          // Whirlwind if available and boss has minions nearby
          if (adjEnemyCount >= 2 && skillCooldowns[2] <= 0 && player.mp >= 10) {
            return { type: 'useSkill', itemIndex: 2 };
          }
          // Heal if HP < 40% during boss fight
          if (player.hp < Math.floor(player.maxHp * 0.4)) {
            const potionIdx = findHealingPotion(player);
            if (potionIdx >= 0) return { type: 'useItem', itemIndex: potionIdx };
          }
          return { type: 'move', dx: nearestBoss.pos.x - px, dy: nearestBoss.pos.y - py };
        }
        // Mage: IceShield if not active, then melee (boss is adjacent — can't kite)
        if (player.class === CharacterClass.Mage) {
          if (skillCooldowns[1] <= 0 && player.mp >= 6) {
            const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
            if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
          }
          if (player.hp < Math.floor(player.maxHp * 0.4)) {
            const potionIdx = findHealingPotion(player);
            if (potionIdx >= 0) return { type: 'useItem', itemIndex: potionIdx };
          }
          return { type: 'move', dx: nearestBoss.pos.x - px, dy: nearestBoss.pos.y - py };
        }
        // Rogue: PoisonBlade if not active, then melee
        if (player.class === CharacterClass.Rogue) {
          if (skillCooldowns[1] <= 0 && player.mp >= 4) {
            const hasPoisonBlade = player.statusEffects.some(e => e.type === StatusEffectType.PoisonBlade);
            if (!hasPoisonBlade) return { type: 'useSkill', itemIndex: 1 };
          }
          if (player.hp < Math.floor(player.maxHp * 0.4)) {
            const potionIdx = findHealingPotion(player);
            if (potionIdx >= 0) return { type: 'useItem', itemIndex: potionIdx };
          }
          return { type: 'move', dx: nearestBoss.pos.x - px, dy: nearestBoss.pos.y - py };
        }
      }

      // Boss at range — move toward it (Mage: cast at range first)
      if (player.class === CharacterClass.Mage && bossDist <= 5 && skillCooldowns[0] <= 0 && player.mp >= 7) {
        return { type: 'useSkill', itemIndex: 0 }; // Fireball on boss
      }
      if (player.class === CharacterClass.Mage && bossDist <= 6 && skillCooldowns[2] <= 0 && player.mp >= 10) {
        return { type: 'useSkill', itemIndex: 2 }; // ChainLightning on boss
      }

      // Move toward boss
      const path = bfsToTarget(px, py, nearestBoss.pos.x, nearestBoss.pos.y, isWalkableForBFS, w, h, map);
      if (path) return { type: 'move', dx: path.dx, dy: path.dy };
    }
  }

  // On boss floor but boss not visible — prioritize exploration over descent
  // Don't skip boss unless critically endangered
  if (onBossFloor && !bossVisible) {
    // Allow descent only if critically low on resources
    const criticallyEndangered = player.hp < Math.floor(player.maxHp * 0.3) ||
      (player.hunger <= 0 && !player.inventory.some(i => i.type === ItemType.Food));
    if (!criticallyEndangered) {
      // Boss floor exploration: actively seek unexplored rooms by finding doors/elite doors
      const doorTarget = findNearestTile(
        px, py,
        (x, y) => map[y]?.[x]?.type === ('door' as TileType) || map[y]?.[x]?.type === ('eliteDoor' as TileType),
        isWalkableForBFS, w, h, map
      );
      if (doorTarget && (doorTarget.x !== px || doorTarget.y !== py)) {
        const path = bfsToTarget(px, py, doorTarget.x, doorTarget.y, isWalkableForBFS, w, h, map);
        if (path) return { type: 'move', dx: path.dx, dy: path.dy };
      }
      // Fall through to normal exploration
    }
  }

  // ---- 3. COMBAT WITH VISIBLE ENEMIES ----

  if (visibleEnemies8.length > 0) {

    // ---- 3a. SIEGE ESCAPE (3+ adjacent enemies) — use CreatePortal or desperate measures ----
    if (adjEnemyCount >= 3) {
      const portalIdx = findCreatePortalScroll(player);
      if (portalIdx >= 0 && !isOnStairsDown(px, py, map)) {
        return { type: 'useItem', itemIndex: portalIdx };
      }
    }

    // ---- 3b. MID-COMBAT HEALING (< 50% HP with enemies nearby) ----
    // Conserve potions before boss: only use if we have 2+ or fighting a boss or HP critically low
    if (player.hp < Math.floor(player.maxHp * 0.5)) {
      const potionIdx = findHealingPotion(player);
      const healPotionCount = countHealingPotions(player);
      const isBossFight = bossVisible;
      if (potionIdx >= 0 && (healPotionCount >= 2 || isBossFight || player.hp < Math.floor(player.maxHp * 0.3))) {
        return { type: 'useItem', itemIndex: potionIdx };
      }
    }

    // ---- 3b. PRE-COMBAT BUFFS (enemies visible but not adjacent yet) ----
    if (!adjEnemy) {
      // Warrior: WarCry before engaging (if no DefenseUp active)
      if (player.class === CharacterClass.Warrior && skillCooldowns[1] <= 0 && player.mp >= 8) {
        const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
        if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
      }
      // Mage: IceShield before engaging (if no DefenseUp active) — only if enemies are close enough to threaten
      if (player.class === CharacterClass.Mage && skillCooldowns[1] <= 0 && player.mp >= 6) {
        const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
        if (!hasDefUp && visibleEnemies5.length > 0) return { type: 'useSkill', itemIndex: 1 };
      }
      // Rogue: PoisonBlade before engaging
      if (player.class === CharacterClass.Rogue && skillCooldowns[1] <= 0 && player.mp >= 4) {
        const hasPoisonBlade = player.statusEffects.some(e => e.type === StatusEffectType.PoisonBlade);
        if (!hasPoisonBlade) return { type: 'useSkill', itemIndex: 1 };
      }
      // Use buff potions before engaging
      if (player.hp > Math.floor(player.maxHp * 0.7)) {
        for (let i = 0; i < player.inventory.length; i++) {
          if (isIdentifiedBuffPotion(player.inventory[i])) {
            return { type: 'useItem', itemIndex: i };
          }
        }
      }
    }

    // ---- 3c. COMBAT SCROLLS on groups ----
    // Save combat scrolls for boss fights if approaching/approaching boss floor
    const shouldSaveScrolls = (onBossFloor || approachingBossFloor) && !bossVisible;
    if (visibleEnemies5.length >= 2 && !shouldSaveScrolls) {
      const scrollIdx = findCombatScroll(player);
      if (scrollIdx >= 0) return { type: 'useItem', itemIndex: scrollIdx };
    }
    // Use combat scrolls on bosses or when not saving
    if (bossVisible) {
      const scrollIdx = findCombatScroll(player);
      if (scrollIdx >= 0) return { type: 'useItem', itemIndex: scrollIdx };
    }

    // ---- 3d. MAGE: Attack commitment + kill harvesting ----
    if (player.class === CharacterClass.Mage) {
      const hasFastEnemy = enemies.some(e => e.hp > 0 && isEnemyVisible(e, visibleTiles) && (e as any).speed >= 2);
      const canKite = !hasFastEnemy;
      const mpRatio = player.mp / Math.max(1, player.maxMp);
      const hpRatio = player.hp / Math.max(1, player.maxHp);
      const meleeDamage = Math.floor((player.stats?.str ?? 3) * 0.5) + ((player.equipment[EquipmentSlot.Weapon] as any)?.damage ?? 0);
      const noSkillsAvailable = (skillCooldowns[0] > 0 || player.mp < 7) && (skillCooldowns[1] > 0 || player.mp < 6) && (skillCooldowns[2] > 0 || player.mp < 10);

      // Adjacent enemy: decide between kiting, fighting, or fleeing
      if (adjEnemy) {
        // Damage harvesting: enemy HP < 30% → stop kiting, stand and finish
        if (adjEnemy.hp < Math.floor((adjEnemy as any).maxHp * 0.3) || adjEnemy.hp <= meleeDamage) {
          if (skillCooldowns[1] <= 0 && player.mp >= 6) {
            const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
            if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
          }
          return { type: 'move', dx: adjEnemy.pos.x - px, dy: adjEnemy.pos.y - py };
        }

        // Low HP: prioritize defense over kiting
        if (hpRatio < 0.3) {
          if (skillCooldowns[1] <= 0 && player.mp >= 6) {
            const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
            if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
          }
          const healIdx = findHealingPotion(player);
          if (healIdx >= 0) return { type: 'useItem', itemIndex: healIdx };
          const scrollIdx = findCombatScroll(player);
          if (scrollIdx >= 0) return { type: 'useItem', itemIndex: scrollIdx };
          return { type: 'move', dx: adjEnemy.pos.x - px, dy: adjEnemy.pos.y - py };
        }

        // Low MP or no skills: commit to melee instead of kiting forever
        if (mpRatio < 0.3 || noSkillsAvailable) {
          const healIdx = findHealingPotion(player);
          if (healIdx >= 0 && hpRatio < 0.5) return { type: 'useItem', itemIndex: healIdx };
          return { type: 'move', dx: adjEnemy.pos.x - px, dy: adjEnemy.pos.y - py };
        }

        // Kite when possible and HP moderate — but NOT if stuck in a ping-pong loop
        if (canKite && hpRatio > 0.5 && !stuckInLoop) {
          const retreatDir = getRetreatDirection(player, enemies, isWalkable, w, h);
          if (retreatDir) return retreatDir;
        }

        // Can't kite or can't retreat — defensive chain
        if (skillCooldowns[1] <= 0 && player.mp >= 6) {
          const hasDefUp = player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp);
          if (!hasDefUp) return { type: 'useSkill', itemIndex: 1 };
        }
        if (hpRatio < 0.5) {
          const healIdx = findHealingPotion(player);
          if (healIdx >= 0) return { type: 'useItem', itemIndex: healIdx };
        }
        const scrollIdx = findCombatScroll(player);
        if (scrollIdx >= 0) return { type: 'useItem', itemIndex: scrollIdx };
        // Melee as last resort
      }

      // Ranged skills — prioritize based on situation
      const enemiesInRange6 = getVisibleEnemiesInRange(player, enemies, visibleTiles, 6);
      const enemiesInRange5 = getVisibleEnemiesInRange(player, enemies, visibleTiles, 5);

      // ChainLightning: priority for boss/elite (high single-target + splash)
      if (enemiesInRange6.length >= 1 && skillCooldowns[2] <= 0 && player.mp >= 10) {
        const bossInRange = enemiesInRange6.some(e => e.isBoss);
        if (bossInRange || enemiesInRange6.length >= 2) {
          return { type: 'useSkill', itemIndex: 2 };
        }
      }

      // Fireball: groups or tough enemies
      if (enemiesInRange5.length >= 1 && skillCooldowns[0] <= 0 && player.mp >= 7) {
        const weakestInRange = enemiesInRange5.reduce((a, b) => a.hp <= b.hp ? a : b);
        if (weakestInRange.hp > meleeDamage * 2 || enemiesInRange5.length >= 2) {
          return { type: 'useSkill', itemIndex: 0 };
        }
        // Aggressive: use Fireball even on weak enemies if MP is plentiful
        if (mpRatio > 0.6) {
          return { type: 'useSkill', itemIndex: 0 };
        }
      }

      // Combat scroll at range
      if (visibleEnemies5.length >= 1 && hpRatio > 0.5) {
        const scrollIdx = findCombatScroll(player);
        if (scrollIdx >= 0) return { type: 'useItem', itemIndex: scrollIdx };
      }

      // Mana potion in combat if MP low
      if (mpRatio <= 0.2) {
        const manaIdx = findManaPotion(player);
        if (manaIdx >= 0) return { type: 'useItem', itemIndex: manaIdx };
      }

      // No ranged skills available and no adjacent enemy: move toward nearest enemy for melee
      if (noSkillsAvailable && visibleEnemies5.length > 0) {
        const target = findNearestVisibleEnemy(player, enemies, visibleTiles, 8);
        if (target) {
          const path = bfsToTarget(px, py, target.pos.x, target.pos.y, isWalkableForBFS, w, h, map);
          if (path) return { type: 'move', dx: path.dx, dy: path.dy };
        }
      }
    }

    // ---- 3e. ROGUE: ShadowStep for gap-closing ----
    if (player.class === CharacterClass.Rogue) {
      // ShadowStep: guaranteed crit gap-closer, use when healthy or on bosses
      if (visibleEnemies8.length >= 1 && skillCooldowns[0] <= 0 && player.mp >= 6 && !adjEnemy) {
        const bossVisible8 = visibleEnemies8.some(e => e.isBoss);
        const healthyEnough = player.hp > player.maxHp * 0.6;
        // Only ShadowStep if enemies are close enough (within 4 tiles) — don't waste on distant enemies
        const closeEnemy = visibleEnemies8.find(e => {
          const d = Math.abs(e.pos.x - px) + Math.abs(e.pos.y - py);
          return d <= 4;
        });
        if ((bossVisible8 || healthyEnough) && closeEnemy) {
          return { type: 'useSkill', itemIndex: 0 };
        }
      }
    }

    // ---- 3f. ADJACENT ENEMY: Skill usage ----
    if (adjEnemy) {
      const skillAction = chooseSkill(player, enemies, visibleTiles, skillCooldowns);
      if (skillAction) return skillAction;

      // Melee attack
      return { type: 'move', dx: adjEnemy.pos.x - px, dy: adjEnemy.pos.y - py };
    }

    // ---- 3g. MOVE TOWARD VISIBLE ENEMY (if healthy and not outmatched) ----
    if (player.hp > Math.floor(player.maxHp * 0.4) && player.hunger > 30) {
      const target = findNearestVisibleEnemy(player, enemies, visibleTiles, 12);
      if (target) {
        const dist = Math.abs(target.pos.x - px) + Math.abs(target.pos.y - py);
        // Avoid elite enemies when HP is below 60% (they hit much harder)
        const isElite = (target as any).isElite;
        if (isElite && player.hp < Math.floor(player.maxHp * 0.6)) {
          // Don't engage elite when hurt — retreat or heal instead
          const healIdx = findHealingPotion(player);
          if (healIdx >= 0) return { type: 'useItem', itemIndex: healIdx };
          // Skip this target, look for non-elite
          const nonElite = findNearestVisibleEnemy(player, enemies.filter(e => !(e as any).isElite), visibleTiles, 12);
          if (nonElite) {
            const nePath = bfsToTarget(px, py, nonElite.pos.x, nonElite.pos.y, isWalkableForBFS, w, h, map);
            if (nePath) return { type: 'move', dx: nePath.dx, dy: nePath.dy };
          }
          // No non-elite visible — don't chase, fall through to navigation
        } else {
          // Mage: don't chase enemies beyond fireball range + 1 (avoid kiting stalemate)
          const maxChaseRange = player.class === CharacterClass.Mage ? 6 : 12;
          if (dist <= maxChaseRange) {
            const path = bfsToTarget(px, py, target.pos.x, target.pos.y, isWalkableForBFS, w, h, map);
            if (path) return { type: 'move', dx: path.dx, dy: path.dy };
          }
        }
      }
    }
  }

  // ---- 4. PICK UP ITEM AT FEET ----
  const itemHere = items.find(it => it.pos.x === px && it.pos.y === py);
  if (itemHere && player.inventory.length < 20) {
    return { type: 'pickup' };
  }
  if (itemHere && player.inventory.length >= 20) {
    const worstIdx = findWorstItem(player);
    if (worstIdx >= 0) return { type: 'drop', itemIndex: worstIdx };
  }

  // ---- 5. IDLE PREPARATION (no enemies visible) ----

  // 5a. Eat if moderately hungry (Rogue eats earlier to avoid starvation)
  const eatThreshold = player.class === CharacterClass.Rogue ? 0.6 : 0.55;
  if (player.hunger < player.maxHunger * eatThreshold) {
    const foodIdx = findFoodItem(player);
    if (foodIdx >= 0) return { type: 'useItem', itemIndex: foodIdx };
  }

  // 5b. Heal if hurt and safe
  if (player.hp < Math.floor(player.maxHp * 0.7)) {
    const potionIdx = findHealingPotion(player);
    // Only use potion if we have 2+ or HP < 50%
    if (potionIdx >= 0 && (countHealingPotions(player) >= 2 || player.hp < Math.floor(player.maxHp * 0.5))) {
      return { type: 'useItem', itemIndex: potionIdx };
    }
  }

  // 5c. Restore MP if low and safe
  if (player.mp < Math.floor(player.maxMp * 0.3) && player.class === CharacterClass.Mage) {
    const manaIdx = findManaPotion(player);
    if (manaIdx >= 0) return { type: 'useItem', itemIndex: manaIdx };
  }

  // 5d. Use Enchant scroll on best unenchanted equipment
  const enchantIdx = findEnchantScroll(player);
  if (enchantIdx >= 0) {
    const weapon = player.equipment[EquipmentSlot.Weapon];
    const armor = player.equipment[EquipmentSlot.Armor];
    // Prioritize weapon (offense > defense), then armor
    if (weapon && (weapon as any).enhanceLevel < 1) {
      return { type: 'useItem', itemIndex: enchantIdx };
    }
    if (armor && (armor as any).enhanceLevel < 1) {
      return { type: 'useItem', itemIndex: enchantIdx };
    }
    // Also use on +1 items to get them to +2
    if (weapon && (weapon as any).enhanceLevel < 2 && currentFloor >= 8) {
      return { type: 'useItem', itemIndex: enchantIdx };
    }
  }

  // 5e. Use Identify scroll on unidentified items
  const hasUnid = player.inventory.some(i => !i.identified && (i.type === ItemType.Potion || i.type === ItemType.Scroll));
  if (hasUnid) {
    const identifyIdx = findIdentifyScroll(player);
    if (identifyIdx >= 0) return { type: 'useItem', itemIndex: identifyIdx };
  }

  // 5f. Use Mapping scroll if explored > 30 turns
  if (turnOnFloor > 30) {
    const mapIdx = findMappingScroll(player);
    if (mapIdx >= 0) return { type: 'useItem', itemIndex: mapIdx };
  }

  // 5g. Use Detection scroll early on floor (reveals all traps)
  if (turnOnFloor < 15) {
    const detectIdx = player.inventory.findIndex(i => i.type === ItemType.Scroll && i.identified && i.name?.includes('感知'));
    if (detectIdx >= 0) return { type: 'useItem', itemIndex: detectIdx };
  }

  // ---- 6. NAVIGATION ----

  // 6a. Open adjacent doors (always, even during exploration/combat)
  // But don't spam openDoor if we're stuck in a loop (door might be blocked)
  const doorDir = findAdjacentDoor(px, py, map, w, h);
  if (doorDir && !stuckInLoop) return { type: 'openDoor', dx: doorDir.dx, dy: doorDir.dy };

  // 6b. Descend stairs if on them
  const currentTile = map[py]?.[px];
  const hasFood = player.inventory.some(i => i.type === ItemType.Food);
  const hungerThreshold = player.class === CharacterClass.Rogue ? 0.4 : 0.3;
  const lowHungerNoFood = player.hunger < player.maxHunger * hungerThreshold && !hasFood;

  if (currentTile?.type === ('stairsDown' as TileType)) {
    const aliveNearby = enemies.filter(e => e.hp > 0 && isEnemyVisible(e, visibleTiles) && Math.abs(e.pos.x - px) + Math.abs(e.pos.y - py) < 6);
    // On boss floor: only descend if boss is dead (no boss visible) AND critically endangered or spent enough time
    if (onBossFloor) {
      const bossStillAlive = enemies.some(e => e.hp > 0 && e.isBoss);
      const criticallyEndangered = player.hp < Math.floor(player.maxHp * 0.3) ||
        (player.hunger <= 0 && !player.inventory.some(i => i.type === ItemType.Food));
      if (bossStillAlive && !criticallyEndangered) {
        // Don't descend — go back and find the boss
        // (fall through to exploration logic)
      } else {
        // Boss dead or critically endangered — descend
        return { type: 'descend' };
      }
    } else {
      // Normal floor: descend if safe or been here long enough
      if (lowHungerNoFood || aliveNearby.length === 0 || turnOnFloor > 60 || currentFloor >= maxFloor) {
        return { type: 'descend' };
      }
    }
  }

  // 6c. Move toward stairs if appropriate
  // On boss floors, skip stairs-seeking until turnOnFloor > 120 (explore for boss first)
  const stairsSeekThreshold = onBossFloor ? 120 : 30;
  if (turnOnFloor > 5 && (turnOnFloor > stairsSeekThreshold || lowHungerNoFood)) {
    const stairsPath = findNearestTile(
      px, py,
      (x, y) => map[y]?.[x]?.type === ('stairsDown' as TileType),
      isWalkableForBFS, w, h, map
    );
    if (stairsPath && (stairsPath.x !== px || stairsPath.y !== py)) {
      const path = bfsToTarget(px, py, stairsPath.x, stairsPath.y, isWalkableForBFS, w, h, map);
      if (path) return { type: 'move', dx: path.dx, dy: path.dy };
    }
  }

  // 6d. Move toward visible items (food gets priority when hungry)
  const visibleItemList = items.filter(it => visibleTiles.has(`${it.pos.x},${it.pos.y}`));
  if (visibleItemList.length > 0) {
    // Prioritize food when hungry (especially Rogue)
    const hungerItemThreshold = player.class === CharacterClass.Rogue ? 0.6 : 0.4;
    const needsFood = player.hunger < player.maxHunger * hungerItemThreshold;
    let targetItem = visibleItemList[0];
    if (needsFood) {
      const foodItem = visibleItemList.find(it => (it as any).type === ItemType.Food);
      if (foodItem) targetItem = foodItem;
    }
    const path = bfsToTarget(px, py, targetItem.pos.x, targetItem.pos.y, isWalkableForBFS, w, h, map);
    if (path) return { type: 'move', dx: path.dx, dy: path.dy };
  }

  // 6e. Explore: move toward edge of visible area (including doors leading to unknown)
  const exploreTarget = findNearestTile(
    px, py,
    (x, y) => {
      if (!visibleTiles.has(`${x},${y}`)) return false;
      const tile = map[y]?.[x];
      if (!tile) return false;
      // Door tiles are always exploration targets (they lead to new rooms)
      if (tile.type === ('door' as TileType) || tile.type === ('eliteDoor' as TileType)) return true;
      // Walkable tiles adjacent to unknown are exploration targets
      if (!isWalkable(x, y)) return false;
      const adj = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [ddx, ddy] of adj) {
        const nx = x + ddx, ny = y + ddy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (!map[ny]?.[nx]) continue;
        if (!visibleTiles.has(`${nx},${ny}`) && !map[ny][nx].remembered) return true;
      }
      return false;
    },
    isWalkableForBFS, w, h, map
  );
  if (exploreTarget && (exploreTarget.x !== px || exploreTarget.y !== py)) {
    const path = bfsToTarget(px, py, exploreTarget.x, exploreTarget.y, isWalkableForBFS, w, h, map);
    if (path) return { type: 'move', dx: path.dx, dy: path.dy };
  }

  // 6f. Move toward remembered tile bordering unknown (including remembered doors)
  const rememberedTarget = findNearestTile(
    px, py,
    (x, y) => {
      const tile = map[y]?.[x];
      if (!tile) return false;
      // Remembered doors are always worth revisiting
      if ((tile.type === ('door' as TileType) || tile.type === ('eliteDoor' as TileType)) && tile.remembered) return true;
      if (!isWalkable(x, y)) return false;
      if (!visibleTiles.has(`${x},${y}`) && !tile.remembered) return false;
      const adj = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [ddx, ddy] of adj) {
        const nx = x + ddx, ny = y + ddy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (!map[ny]?.[nx]) continue;
        if (!map[ny][nx].visible && !map[ny][nx].remembered) return true;
      }
      return false;
    },
    isWalkableForBFS, w, h, map
  );
  if (rememberedTarget && (rememberedTarget.x !== px || rememberedTarget.y !== py)) {
    const path = bfsToTarget(px, py, rememberedTarget.x, rememberedTarget.y, isWalkableForBFS, w, h, map);
    if (path) return { type: 'move', dx: path.dx, dy: path.dy };
  }

  // 6g. STUCK ESCAPE: if detected in loop, force least-visited direction
  if (stuckInLoop) {
    const escapeDir = getLeastVisitedDirection(px, py, currentFloor, isWalkable, w, h);
    if (escapeDir) return { type: 'move', dx: escapeDir.dx, dy: escapeDir.dy };
  }

  // 6h. L3 Desperation (turn >= 200): BFS directly to stairs ignoring terrain costs
  if (terrainLevel >= 3) {
    // Find stairs even through dangerous terrain
    const stairsTarget = findNearestTile(
      px, py,
      (x, y) => map[y]?.[x]?.type === ('stairsDown' as TileType),
      isWalkableForBFS, w, h, map
    );
    if (stairsTarget) {
      const path = bfsToTarget(px, py, stairsTarget.x, stairsTarget.y, isWalkableForBFS, w, h, map);
      if (path) return { type: 'move', dx: path.dx, dy: path.dy };
    }
  }

  // 6i. Fallback: BFS to least-visited walkable tile (not random walk)
  // This prevents the AI from aimlessly wandering in already-explored areas
  const fallbackDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  {
    // Find the nearest walkable tile that has been visited the fewest times
    let bestTarget: { x: number; y: number; visits: number } | null = null;
    const bfsVisited = new Set<string>();
    const bfsQueue: { x: number; y: number }[] = [{ x: px, y: py }];
    bfsVisited.add(`${px},${py}`);
    let bfsDepth = 0;
    while (bfsQueue.length > 0 && bfsDepth < 200) {
      const cur = bfsQueue.shift()!;
      const key = `${currentFloor}:${cur.x},${cur.y}`;
      const visitCount = visitedPositions.filter(p => p === key).length;
      if (visitCount <= 1 && (cur.x !== px || cur.y !== py)) {
        bestTarget = { x: cur.x, y: cur.y, visits: visitCount };
        break;
      }
      if (!bestTarget || visitCount < bestTarget.visits) {
        if (cur.x !== px || cur.y !== py) {
          bestTarget = { x: cur.x, y: cur.y, visits: visitCount };
        }
      }
      for (const [ddx, ddy] of fallbackDirs) {
        const nx = cur.x + ddx, ny = cur.y + ddy;
        const nKey = `${nx},${ny}`;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !bfsVisited.has(nKey) && isWalkable(nx, ny)) {
          bfsVisited.add(nKey);
          bfsQueue.push({ x: nx, y: ny });
        }
      }
      bfsDepth++;
    }
    if (bestTarget) {
      const path = bfsToTarget(px, py, bestTarget.x, bestTarget.y, isWalkableForBFS, w, h, map);
      if (path) return { type: 'move', dx: path.dx, dy: path.dy };
    }
  }

  // 6j. Ultimate fallback: non-repeating random walk
  const shuffled = [...fallbackDirs].sort(() => rng.next() - 0.5);
  for (const [ddx, ddy] of shuffled) {
    const nx = px + ddx, ny = py + ddy;
    if (ny >= 0 && ny < h && nx >= 0 && nx < w && isWalkable(nx, ny)) {
      return { type: 'move', dx: ddx, dy: ddy };
    }
  }

  return { type: 'wait' };
}

// ============================================================
// Retreat direction — move away from nearest enemy (kiting)
// v2: open-space awareness + corridor chokepoint preference
// ============================================================

function getRetreatDirection(
  player: Player,
  enemies: Enemy[],
  isWalkable: (x: number, y: number) => boolean,
  mapW: number,
  mapH: number,
): AIAction | null {
  const px = player.pos.x, py = player.pos.y;
  // Find nearest enemy
  let nearest: Enemy | null = null;
  let minDist = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dist = Math.abs(e.pos.x - px) + Math.abs(e.pos.y - py);
    if (dist < minDist) { minDist = dist; nearest = e; }
  }
  if (!nearest) return null;

  // Count open tiles behind a direction (BFS up to depth 4)
  // This checks if retreating actually gives room to maneuver
  const countOpenSpace = (startX: number, startY: number, awayDx: number, awayDy: number): number => {
    const visited = new Set<string>();
    const queue: [number, number, number][] = [[startX, startY, 0]];
    visited.add(`${startX},${startY}`);
    let count = 0;
    while (queue.length > 0) {
      const [cx, cy, depth] = queue.shift()!;
      if (depth >= 4) continue;
      count++;
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [ddx, ddy] of dirs) {
        const nx = cx + ddx, ny = cy + ddy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (ny < 0 || ny >= mapH || nx < 0 || nx >= mapW) continue;
        if (!isWalkable(nx, ny)) continue;
        visited.add(key);
        // Slight preference for tiles in the retreat direction
        queue.push([nx, ny, depth + 1]);
      }
    }
    return count;
  };

  // Check if a direction leads to a corridor chokepoint (1-wide passage)
  // A chokepoint is: the tile itself is walkable, but only 1 of the 2 perpendicular sides is walkable
  const isChokepoint = (x: number, y: number, moveDx: number, moveDy: number): boolean => {
    // Check perpendicular directions
    let perpOpen = 0;
    if (moveDx !== 0) {
      // Moving horizontally; check vertical openings
      if (y > 0 && isWalkable(x, y - 1)) perpOpen++;
      if (y < mapH - 1 && isWalkable(x, y + 1)) perpOpen++;
    } else {
      // Moving vertically; check horizontal openings
      if (x > 0 && isWalkable(x - 1, y)) perpOpen++;
      if (x < mapW - 1 && isWalkable(x + 1, y)) perpOpen++;
    }
    return perpOpen <= 1; // Corridor: at most 1 side open (the wall side or dead end)
  };

  // Evaluate all 4 directions
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let bestDir: { dx: number; dy: number; dist: number; openSpace: number; isChoke: boolean } | null = null;

  for (const [ddx, ddy] of dirs) {
    const nx = px + ddx, ny = py + ddy;
    if (ny < 0 || ny >= mapH || nx < 0 || nx >= mapW) continue;
    if (!isWalkable(nx, ny)) continue;
    const newDist = Math.abs(nearest.pos.x - nx) + Math.abs(nearest.pos.y - ny);
    // Must increase distance from enemy
    if (newDist <= minDist) continue;

    const openSpace = countOpenSpace(nx, ny, ddx, ddy);
    const choke = isChokepoint(nx, ny, ddx, ddy);

    if (!bestDir) {
      bestDir = { dx: ddx, dy: ddy, dist: newDist, openSpace, isChoke: choke };
    } else {
      // Prefer: 1) open space (≥3 tiles of room), 2) corridor chokepoint, 3) max distance
      const curScore = scoreRetreat(bestDir);
      const newScore = scoreRetreat({ dx: ddx, dy: ddy, dist: newDist, openSpace, isChoke: choke });
      if (newScore > curScore) {
        bestDir = { dx: ddx, dy: ddy, dist: newDist, openSpace, isChoke: choke };
      }
    }
  }

  if (bestDir && bestDir.openSpace >= 3) {
    // Good open space — kiting is sustainable
    return { type: 'move', dx: bestDir.dx, dy: bestDir.dy };
  }
  if (bestDir && bestDir.isChoke && bestDir.openSpace >= 2) {
    // Corridor chokepoint — can kite in a 1-wide passage (retreat + cast alternately)
    return { type: 'move', dx: bestDir.dx, dy: bestDir.dy };
  }
  if (bestDir && bestDir.openSpace >= 2) {
    // Marginal space — still try kiting
    return { type: 'move', dx: bestDir.dx, dy: bestDir.dy };
  }
  // No viable retreat (dead end or only 1 tile) — don't kite, let caller handle
  return null;
}

function scoreRetreat(dir: { dist: number; openSpace: number; isChoke: boolean }): number {
  let score = 0;
  // Open space is most important for sustained kiting
  score += Math.min(dir.openSpace, 12) * 10; // Cap at 12 tiles to avoid overvaluing huge rooms
  // Corridor chokepoint bonus — good for mage kiting (enemies line up)
  if (dir.isChoke) score += 15;
  // Distance bonus (minor)
  score += dir.dist;
  return score;
}

// ============================================================
// Skill selection (melee range)
// ============================================================

function chooseSkill(
  player: Player,
  enemies: Enemy[],
  _visibleTiles: Set<string>,
  skillCooldowns: number[],
): AIAction | null {
  // Warrior: ShieldBash adjacent, WarCry if multiple enemies, Whirlwind if surrounded
  if (player.class === CharacterClass.Warrior) {
    if (skillCooldowns[2] <= 0 && player.mp >= 10 && getAdjacentEnemiesCount(player, enemies) >= 2) {
      return { type: 'useSkill', itemIndex: 2 };
    }
    if (skillCooldowns[0] <= 0 && player.mp >= 5 && getAdjacentEnemy(player, enemies)) {
      return { type: 'useSkill', itemIndex: 0 };
    }
    if (skillCooldowns[1] <= 0 && player.mp >= 8 && player.hp < player.maxHp * 0.7 && getAdjacentEnemy(player, enemies)) {
      return { type: 'useSkill', itemIndex: 1 };
    }
  }

  // Mage: Ice Shield if low HP (defensive), FanOfKnives on group
  if (player.class === CharacterClass.Mage) {
    if (skillCooldowns[1] <= 0 && player.mp >= 6 && player.hp < player.maxHp * 0.5) {
      return { type: 'useSkill', itemIndex: 1 };
    }
  }

  // Rogue: PoisonBlade on tough enemies only, FanOfKnives on group
  if (player.class === CharacterClass.Rogue) {
    const adjEnem = getAdjacentEnemy(player, enemies);
    // PoisonBlade: only on bosses or enemies with HP > 15 (save MP on weak enemies)
    if (skillCooldowns[1] <= 0 && player.mp >= 4 && !player.statusEffects.some(e => e.type === StatusEffectType.PoisonBlade)) {
      if (adjEnem && (adjEnem.isBoss || adjEnem.hp > 15)) {
        return { type: 'useSkill', itemIndex: 1 };
      }
    }
    if (skillCooldowns[2] <= 0 && player.mp >= 8 && getAdjacentEnemiesCount(player, enemies) >= 2) {
      return { type: 'useSkill', itemIndex: 2 };
    }
    // Don't use ShadowStep in melee — it's a gap-closer, not a melee skill
  }

  return null;
}

// ============================================================
// Shop strategy
// ============================================================

function handleShopPhase(player: Player, shopItems: Item[] | null, currentFloor: number): AIAction {
  if (!shopItems || shopItems.length === 0) return { type: 'closeShop' };

  const inventorySize = player.inventory.length;
  const hasFood = player.inventory.some(i => i.type === ItemType.Food);

  // Priority 1: Buy food if hungry and no food
  if (!hasFood || player.hunger < player.maxHunger * 0.3) {
    for (let i = 0; i < shopItems.length; i++) {
      const item = shopItems[i];
      if (item.type === ItemType.Food && player.gold >= item.value && inventorySize < 20) {
        return { type: 'buyShopItem', shopIndex: i };
      }
    }
  }

  // Priority 2: Buy healing potions if < 2
  const healingCount = player.inventory.filter(i => isIdentifiedHealingPotion(i)).length;
  if (healingCount < 2) {
    for (let i = 0; i < shopItems.length; i++) {
      const item = shopItems[i];
      if (item.type === ItemType.Potion && item.identified &&
        (item.name?.includes('治疗') || item.name?.includes('完全治疗')) &&
        player.gold >= item.value && inventorySize < 20) {
        return { type: 'buyShopItem', shopIndex: i };
      }
    }
  }

  // Priority 3: Buy equipment upgrades
  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    if ((item.type === ItemType.Weapon || item.type === ItemType.Armor) &&
      !item.cursed && player.gold >= item.value && inventorySize < 20) {
      const slot = shouldEquipItem(item, player);
      if (slot) return { type: 'buyShopItem', shopIndex: i };
    }
  }

  // Priority 4: Buy identified scrolls
  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    if (item.type === ItemType.Scroll && item.identified &&
      player.gold >= item.value && inventorySize < 18) {
      return { type: 'buyShopItem', shopIndex: i };
    }
  }

  // Priority 5: Buy rings/amulets
  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    if ((item.type === ItemType.Ring || item.type === ItemType.Amulet) &&
      !item.cursed && player.gold >= item.value && inventorySize < 18) {
      return { type: 'buyShopItem', shopIndex: i };
    }
  }

  // Sell low-value items if inventory crowded
  if (inventorySize > 16) {
    const worstIdx = findWorstItem(player);
    if (worstIdx >= 0) return { type: 'sellItem', itemIndex: worstIdx };
  }

  return { type: 'closeShop' };
}

// ============================================================
// Door detection
// ============================================================

function findAdjacentDoor(
  px: number, py: number,
  map: { type: TileType; walkable: boolean; visible: boolean; char?: string }[][],
  w: number, h: number,
): { dx: number; dy: number } | null {
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (const [ddx, ddy] of dirs) {
    const nx = px + ddx, ny = py + ddy;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      if (map[ny]?.[nx]?.type === ('door' as TileType) || map[ny]?.[nx]?.type === ('eliteDoor' as TileType)) {
        return { dx: ddx, dy: ddy };
      }
    }
  }
  return null;
}
