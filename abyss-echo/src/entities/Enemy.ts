import { Enemy, Position, EliteAffix } from '../types';
import { ENEMY_DEFS, BOSS_DEFS, ELITE_HP_MULT, ELITE_ATK_MULT, ELITE_DEF_BONUS, ELITE_EXP_MULT, ELITE_GOLD_MULT } from '../constants';
import { genId } from './Player';

export function createEnemy(defId: string, pos: Position, isBoss: boolean, floor: number): Enemy | null {
  if (isBoss) {
    // BUG FIX: Look up boss by correct ID from BOSS_DEFS
    const bossDef = BOSS_DEFS.find(b => b.id === defId);
    if (!bossDef) return null;

    const scale = 1 + Math.max(0, floor - bossDef.minFloor) * 0.15;
    return {
      id: genId(),
      defId: bossDef.id,
      name: bossDef.name,
      pos: { ...pos },
      char: bossDef.char,
      fg: bossDef.fg,
      bg: 'transparent',
      hp: Math.floor(bossDef.hp * scale),
      maxHp: Math.floor(bossDef.hp * scale),
      attack: Math.floor(bossDef.attack * scale),
      defense: Math.floor(bossDef.defense * scale),
      exp: Math.floor(bossDef.exp * scale),
      behavior: bossDef.behavior,
      element: bossDef.element,
      weakness: bossDef.weakness,
      resistance: bossDef.resistance,
      speed: bossDef.speed,
      statusEffects: [],
      dropChance: bossDef.dropChance,
      specialAbility: bossDef.specialAbility,
      alertRadius: bossDef.alertRadius,
      isBoss: true,
      goldDrop: Math.floor((bossDef.goldDrop ?? 50) * scale),
      bossPhase: 1,
      isElite: false,
      eliteAffix: undefined,
      frenzyBonus: 0,
      _skipAttack: false,
    };
  }

  const def = ENEMY_DEFS.find(d => d.id === defId);
  if (!def) return null;

  const scale = 1 + Math.max(0, floor - def.minFloor) * 0.12;
  return {
    id: genId(),
    defId: def.id,
    name: def.name,
    pos: { ...pos },
    char: def.char,
    fg: def.fg,
    bg: 'transparent',
    hp: Math.floor(def.hp * scale),
    maxHp: Math.floor(def.hp * scale),
    attack: Math.floor(def.attack * scale),
    defense: Math.floor(def.defense * scale),
    exp: Math.floor(def.exp * scale),
    behavior: def.behavior,
    element: def.element,
    weakness: def.weakness,
    resistance: def.resistance,
    speed: def.speed,
    statusEffects: [],
    dropChance: def.dropChance,
    specialAbility: def.specialAbility,
    alertRadius: def.alertRadius,
    isBoss: false,
    goldDrop: Math.floor((def.goldDrop ?? 5) * scale),
    hidden: def.behavior === 'ambush',
    bossPhase: 1,
    isElite: false,
    eliteAffix: undefined,
    frenzyBonus: 0,
    _skipAttack: false,
  };
}

export function createEliteEnemy(defId: string, pos: Position, floor: number, affix: EliteAffix): Enemy | null {
  const def = ENEMY_DEFS.find(d => d.id === defId);
  if (!def) return null;

  const baseEnemy = createEnemy(defId, pos, false, floor);
  if (!baseEnemy) return null;

  return {
    ...baseEnemy,
    name: `精英${baseEnemy.name}`,
    fg: '#ffd700',
    hp: Math.floor(baseEnemy.maxHp * ELITE_HP_MULT),
    maxHp: Math.floor(baseEnemy.maxHp * ELITE_HP_MULT),
    attack: Math.floor(baseEnemy.attack * ELITE_ATK_MULT),
    defense: baseEnemy.defense + ELITE_DEF_BONUS,
    exp: Math.floor(baseEnemy.exp * ELITE_EXP_MULT),
    goldDrop: Math.floor(baseEnemy.goldDrop * ELITE_GOLD_MULT),
    isElite: true,
    eliteAffix: affix,
    frenzyBonus: 0,
  };
}

export function getEnemiesForFloor(floor: number): string[] {
  return ENEMY_DEFS
    .filter(d => d.minFloor <= floor)
    .map(d => d.id);
}

export function createFloorEnemies(floor: number, positions: Position[], rng: { pick: <T>(arr: T[]) => T }): Enemy[] {
  const availableIds = getEnemiesForFloor(floor);
  const enemies: Enemy[] = [];

  for (const pos of positions) {
    const defId = rng.pick(availableIds);
    const enemy = createEnemy(defId, pos, false, floor);
    if (enemy) enemies.push(enemy);
  }

  return enemies;
}
