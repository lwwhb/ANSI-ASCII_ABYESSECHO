import { Element, Stats, StatusEffect, StatusEffectType, Enemy, Player, Position, Tile } from '../types';
import { getElementalModifier, TRAP_DAMAGE, CLASS_DEFS } from '../constants';
import { SeededRandom } from '../utils/random';

// ============================================================
// Combat Calculations
// ============================================================

export interface CombatResult {
  damage: number;
  physicalDamage: number;
  elementalDamage: number;
  critical: boolean;
  element: Element;
  killed: boolean;
  statusApplied?: StatusEffect;
}

export function calculateMeleeDamage(
  attackerStats: Stats,
  weaponDamage: number,
  defender: { defense: number; weakness: Element; resistance: Element },
  element: Element,
  rng: SeededRandom
): CombatResult {
  const baseDamage = Math.floor(attackerStats.str * 0.5) + weaponDamage;
  const variance = rng.nextInt(-2, 2);
  const rawDamage = baseDamage + variance;
  const elementalMult = getElementalModifier(element, defender.weakness, defender.resistance);
  const preDefDamage = Math.max(1, Math.floor(rawDamage * elementalMult));

  // Multiplicative defense: higher defense always reduces damage meaningfully
  let damage = Math.max(1, Math.floor(preDefDamage * 20 / (20 + defender.defense)));

  // Compute physical portion (damage without elemental modifier)
  const physicalDamage = Math.max(1, Math.floor(Math.max(1, rawDamage) * 20 / (20 + defender.defense)));
  const elementalDamage = Math.max(0, damage - physicalDamage);

  // Critical hit: 5% + DEX/200
  const critChance = Math.min(1.0, 0.05 + attackerStats.dex / 200);
  const critical = rng.chance(critChance);
  if (critical) {
    damage = Math.floor(damage * 1.5);
  }

  return {
    damage,
    physicalDamage: critical ? Math.floor(physicalDamage * 1.5) : physicalDamage,
    elementalDamage: critical ? Math.floor(elementalDamage * 1.5) : elementalDamage,
    critical,
    element,
    killed: false,
  };
}

export function calculateMagicDamage(
  casterStats: Stats,
  spellPower: number,
  defender: { defense: number; weakness: Element; resistance: Element },
  element: Element,
  hasSpellPenetration: boolean = false,
  _rng: SeededRandom
): CombatResult {
  const effectiveDefense = hasSpellPenetration ? Math.floor(defender.defense * 0.5) : defender.defense;
  const baseDamage = Math.floor(casterStats.int * 1.5 + spellPower) - Math.floor(effectiveDefense / 2);
  const elementalMult = getElementalModifier(element, defender.weakness, defender.resistance);
  const damage = Math.max(1, Math.floor(baseDamage * elementalMult));

  return {
    damage,
    physicalDamage: 0,
    elementalDamage: damage,
    critical: false,
    element,
    killed: false,
  };
}

// ============================================================
// Status Effects
// ============================================================

export function applyStatusEffect(
  target: { statusEffects: StatusEffect[] },
  effect: StatusEffect
): void {
  // Guard: default duration to 1 if undefined
  if (effect.duration === undefined) {
    effect.duration = 1;
  }
  const existing = target.statusEffects.find(e => e.type === effect.type);
  if (existing) {
    existing.duration = Math.max(existing.duration ?? 0, effect.duration ?? 0);
  } else {
    target.statusEffects.push({ ...effect });
  }
}

export function processStatusEffects(
  entity: { hp: number; statusEffects: StatusEffect[] },
  isPlayer: boolean
): { damage: number; messages: string[]; skipped: boolean; newStatusEffects: StatusEffect[] } {
  let totalDamage = 0;
  const messages: string[] = [];
  let skipped = false;
  const updatedEffects: StatusEffect[] = [];

  for (let i = 0; i < entity.statusEffects.length; i++) {
    const effect = entity.statusEffects[i];
    const newDuration = effect.duration - 1;

    switch (effect.type) {
      case StatusEffectType.Poison:
        totalDamage += effect.damage;
        messages.push(isPlayer ? '毒素侵蚀着你的身体...' : '毒素在生效...');
        break;
      case StatusEffectType.Burn:
        totalDamage += effect.damage;
        messages.push(isPlayer ? '火焰灼烧着你！' : '目标在燃烧！');
        break;
      case StatusEffectType.Bleed:
        totalDamage += effect.damage;
        messages.push(isPlayer ? '伤口在流血...' : '目标在流血...');
        break;
      case StatusEffectType.Freeze:
        messages.push(isPlayer ? '你被冰冻了，无法行动！' : '目标被冰冻了！');
        skipped = true;
        break;
      case StatusEffectType.Confusion:
        messages.push(isPlayer ? '你头晕目眩，方向混乱！' : '目标陷入混乱！');
        skipped = true;
        break;
      case StatusEffectType.DefenseUp:
        messages.push(isPlayer ? '防御增强中...' : '');
        break;
      case StatusEffectType.PoisonBlade:
        // Buff marker, no per-turn effect
        break;
    }

    if (newDuration > 0) {
      updatedEffects.push({ ...effect, duration: newDuration });
    }
  }

  return { damage: totalDamage, messages, skipped, newStatusEffects: updatedEffects };
}

export function isFrozen(entity: { statusEffects: StatusEffect[] }): boolean {
  return entity.statusEffects.some(e => e.type === StatusEffectType.Freeze);
}

export function isConfused(entity: { statusEffects: StatusEffect[] }): boolean {
  return entity.statusEffects.some(e => e.type === StatusEffectType.Confusion);
}

// BUG FIX: Apply confusion to movement direction
export function applyConfusion(dx: number, dy: number, rng: SeededRandom): { dx: number; dy: number } {
  if (rng.chance(0.5)) {
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    ];
    return rng.pick(dirs);
  }
  return { dx, dy };
}

// ============================================================
// Enemy AI with BFS Pathfinding
// ============================================================

export function getEnemyAction(
  enemy: Enemy,
  playerPos: Position,
  map: Tile[][],
  visibleTiles: Set<string>,
  enemies: Enemy[],
  rng: SeededRandom
): { dx: number; dy: number } | 'attack' | 'wait' | 'special' {
  const dist = Math.abs(enemy.pos.x - playerPos.x) + Math.abs(enemy.pos.y - playerPos.y);
  const isVisible = visibleTiles.has(`${enemy.pos.x},${enemy.pos.y}`);

  // Confused enemies move in random directions
  if (isConfused(enemy)) {
    if (dist === 1 && rng.chance(0.5)) {
      return 'attack'; // May accidentally attack player
    }
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    ];
    return rng.pick(dirs);
  }

  // Adjacent to player → attack
  if (dist === 1) {
    if (enemy.specialAbility && isVisible && rng.chance(0.3)) {
      return 'special';
    }
    return 'attack';
  }

  // Stationary enemies never move, only attack when adjacent
  if (enemy.behavior === 'stationary') {
    // Dormant enemies activate when player is within alert radius
    if (enemy.specialAbility === 'dormant' && isVisible && dist <= enemy.alertRadius) {
      return 'special';
    }
    if (dist === 1) {
      if (enemy.specialAbility && isVisible && rng.chance(0.3)) {
        return 'special';
      }
      return 'attack';
    }
    return 'wait';
  }

  if (!isVisible || dist > enemy.alertRadius) {
    if (rng.chance(0.3)) {
      const dirs = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
      ];
      const dir = rng.pick(dirs);
      return dir;
    }
    return 'wait';
  }

  // Cowardly → flee when low HP
  if (enemy.behavior === 'cowardly' && enemy.hp < enemy.maxHp * 0.3) {
    const dx = enemy.pos.x > playerPos.x ? 1 : enemy.pos.x < playerPos.x ? -1 : 0;
    const dy = enemy.pos.y > playerPos.y ? 1 : enemy.pos.y < playerPos.y ? -1 : 0;
    return { dx, dy };
  }

  // Ambush → 等玩家靠近才攻击，否则等待
  if (enemy.behavior === 'ambush' && enemy.hidden) {
    if (dist <= 1) {
      return 'attack'; // 玩家踏入范围，解除伏击
    }
    return 'wait';
  }

  // OPTIMIZATION: Use BFS pathfinding instead of simple sign-based movement
  const nextStep = bfsNextStep(enemy.pos, playerPos, map, enemies);
  if (nextStep) {
    return { dx: nextStep.x - enemy.pos.x, dy: nextStep.y - enemy.pos.y };
  }

  return 'wait';
}

function bfsNextStep(
  from: Position,
  to: Position,
  map: Tile[][],
  enemies: Enemy[]
): Position | null {
  const mapWidth = map[0]?.length ?? 0;
  const mapHeight = map.length;
  const maxDepth = 20;
  const visited = new Set<string>();
  const queue: { pos: Position; firstStep: Position | null }[] = [{ pos: from, firstStep: null }];
  visited.add(`${from.x},${from.y}`);

  const occupiedSet = new Set<string>();
  for (const e of enemies) {
    if (e.hp > 0) occupiedSet.add(`${e.pos.x},${e.pos.y}`);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.pos.x === to.x && current.pos.y === to.y) {
      return current.firstStep;
    }

    if (visited.size > maxDepth * 4) break; // Limit search

    const dirs = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    ];

    for (const dir of dirs) {
      const nx = current.pos.x + dir.x;
      const ny = current.pos.y + dir.y;
      const key = `${nx},${ny}`;

      if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
      if (visited.has(key)) continue;
      if (!map[ny][nx].walkable) continue;
      if (occupiedSet.has(key) && !(nx === to.x && ny === to.y)) continue;

      visited.add(key);
      const step = current.firstStep ?? { x: nx, y: ny };
      queue.push({ pos: { x: nx, y: ny }, firstStep: step });
    }
  }

  return null;
}

// ============================================================
// Trap Activation
// ============================================================

export function getTrapEffect(trapType: string): { damage: number; statusEffect?: StatusEffect; message: string } {
  switch (trapType) {
    case 'spike':
      return { damage: TRAP_DAMAGE.spike, message: '尖刺陷阱刺穿了你的脚！' };
    case 'fire':
      return {
        damage: TRAP_DAMAGE.fire,
        statusEffect: { type: StatusEffectType.Burn, duration: 3, damage: 4 },
        message: '火焰陷阱灼烧着你！',
      };
    case 'poison':
      return {
        damage: TRAP_DAMAGE.poison,
        statusEffect: { type: StatusEffectType.Poison, duration: 5, damage: 3 },
        message: '毒气陷阱释放出有毒气体！',
      };
    case 'teleport':
      return { damage: 0, message: '传送陷阱将你传送到了别处！' };
    default:
      return { damage: 0, message: '你触发了陷阱！' };
  }
}

// ============================================================
// Experience & Leveling
// ============================================================

export function expForLevel(level: number): number {
  return Math.floor(20 * Math.pow(1.5, level - 1));
}

export function checkLevelUp(player: Player): boolean {
  return player.exp >= player.expToNext;
}

export function applyLevelUp(player: Player): Player {
  const newPlayer = { ...player };
  newPlayer.level++;
  newPlayer.exp -= newPlayer.expToNext;
  newPlayer.expToNext = expForLevel(newPlayer.level + 1);
  newPlayer.statPoints += 3;

  const classDef = CLASS_DEFS[newPlayer.class];
  newPlayer.maxHp = newPlayer.maxHp + classDef.hpPerLevel;
  newPlayer.maxMp = newPlayer.maxMp + classDef.mpPerLevel;
  newPlayer.hp = newPlayer.maxHp;
  newPlayer.mp = newPlayer.maxMp;

  return newPlayer;
}

export function isTalentLevel(level: number): boolean {
  return level > 1 && level % 3 === 0;
}
