import {
  Item, WeaponItem, ArmorItem, RingItem, AmuletItem, PotionItem, ScrollItem, FoodItem,
  ItemType, Rarity, EquipmentEffect,
} from '../types';
import {
  WEAPON_DEFS, ARMOR_DEFS, POTION_DEFS, SCROLL_DEFS, FOOD_DEFS,
} from '../constants';
import { genId } from './Player';
import { SeededRandom } from '../utils/random';

export function createWeapon(index: number, rarity?: Rarity, rng?: SeededRandom): WeaponItem {
  const def = WEAPON_DEFS[index % WEAPON_DEFS.length];
  const r = rarity ?? def.rarity;
  const rarityMult = { common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }[r];
  // 固定特效优先，否则随机roll
  const specialEffect = def.guaranteedEffect ?? (rng ? rollSpecialEffect(r, rng, WEAPON_EFFECTS) : undefined);
  const effectDesc = specialEffect ? ` [${EFFECT_NAME_ZH[specialEffect]}]` : '';

  return {
    id: genId(),
    name: def.name,
    type: ItemType.Weapon,
    char: def.char,
    fg: def.fg,
    rarity: r,
    identified: true,
    description: `伤害: ${Math.floor(def.damage * rarityMult)}${effectDesc}`,
    value: Math.floor(def.damage * 10 * rarityMult),
    damage: Math.floor(def.damage * rarityMult),
    element: def.element,
    bonusStats: r !== Rarity.Common ? { [def.bonusStat]: Math.floor(rarityMult * 2) } : undefined,
    specialEffect,
    cursed: false,
  };
}

export function createArmor(index: number, rarity?: Rarity, rng?: SeededRandom): ArmorItem {
  const def = ARMOR_DEFS[index % ARMOR_DEFS.length];
  const r = rarity ?? def.rarity;
  const rarityMult = { common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }[r];
  // 固定特效优先，否则随机roll
  const specialEffect = def.guaranteedEffect ?? (rng ? rollSpecialEffect(r, rng, ARMOR_EFFECTS) : undefined);
  const effectDesc = specialEffect ? ` [${EFFECT_NAME_ZH[specialEffect]}]` : '';

  return {
    id: genId(),
    name: def.name,
    type: ItemType.Armor,
    char: def.char,
    fg: def.fg,
    rarity: r,
    identified: true,
    description: `防御: ${Math.floor(def.defense * rarityMult)}, 闪避: ${Math.floor(def.evasion * rarityMult)}${effectDesc}`,
    value: Math.floor(def.defense * 8 * rarityMult),
    defense: Math.floor(def.defense * rarityMult),
    evasion: Math.floor(def.evasion * rarityMult),
    bonusStats: r !== Rarity.Common ? { [def.bonusStat]: Math.floor(rarityMult * 2) } : undefined,
    specialEffect,
    cursed: false,
  };
}

export function createPotion(index: number): PotionItem {
  const def = POTION_DEFS[index % POTION_DEFS.length];
  return {
    id: genId(),
    name: def.name,
    type: ItemType.Potion,
    char: def.char,
    fg: def.fg,
    rarity: def.rarity,
    identified: false,
    unidentifiedName: def.unidentifiedName,
    description: `${def.unidentifiedName} - 效果未知`,
    value: Math.floor(def.power * 3),
    effect: def.effect,
    power: def.power,
    cursed: false,
  };
}

export function createScroll(index: number): ScrollItem {
  const def = SCROLL_DEFS[index % SCROLL_DEFS.length];
  return {
    id: genId(),
    name: def.name,
    type: ItemType.Scroll,
    char: def.char,
    fg: def.fg,
    rarity: def.rarity,
    identified: false,
    unidentifiedName: def.unidentifiedName,
    description: `${def.unidentifiedName} - 效果未知`,
    value: Math.floor(def.power * 5),
    effect: def.effect,
    power: def.power,
    cursed: false,
  };
}

export function createFood(index: number): FoodItem {
  const def = FOOD_DEFS[index % FOOD_DEFS.length];
  return {
    id: genId(),
    name: def.name,
    type: ItemType.Food,
    char: def.char,
    fg: def.fg,
    rarity: def.rarity,
    identified: true,
    description: `恢复 ${def.nutrition} 饱食度`,
    value: Math.floor(def.nutrition * 0.5),
    nutrition: def.nutrition,
    cursed: false,
  };
}

// 装备特效概率：Good 20%, Rare 50%, Epic 80%, Legendary 100%
const EFFECT_CHANCE: Record<Rarity, number> = {
  [Rarity.Common]: 0,
  [Rarity.Good]: 0.2,
  [Rarity.Rare]: 0.5,
  [Rarity.Epic]: 0.8,
  [Rarity.Legendary]: 1.0,
};

const EFFECT_NAME_ZH: Record<EquipmentEffect, string> = {
  [EquipmentEffect.LifeSteal]: '吸血',
  [EquipmentEffect.ManaSteal]: '吸魔',
  [EquipmentEffect.CritBonus]: '暴击强化',
  [EquipmentEffect.KillReset]: '击杀重置',
  [EquipmentEffect.StatusProc]: '元素触发',
  [EquipmentEffect.Thorns]: '反伤',
  [EquipmentEffect.DodgeMana]: '闪避回蓝',
  [EquipmentEffect.DamageShield]: '受伤护盾',
  [EquipmentEffect.CooldownReduce]: '冷却缩减',
  [EquipmentEffect.ElementResist]: '元素抗性',
};

const WEAPON_EFFECTS = [
  EquipmentEffect.LifeSteal,
  EquipmentEffect.ManaSteal,
  EquipmentEffect.CritBonus,
  EquipmentEffect.KillReset,
  EquipmentEffect.StatusProc,
];

const ARMOR_EFFECTS = [
  EquipmentEffect.Thorns,
  EquipmentEffect.DodgeMana,
  EquipmentEffect.DamageShield,
];

const ACCESSORY_EFFECTS = [
  EquipmentEffect.CooldownReduce,
  EquipmentEffect.ElementResist,
];

function rollSpecialEffect(rarity: Rarity, rng: SeededRandom, pool: EquipmentEffect[]): EquipmentEffect | undefined {
  if (rarity === Rarity.Common) return undefined;
  if (!rng.chance(EFFECT_CHANCE[rarity])) return undefined;
  return rng.pick(pool);
}

// 按层数过滤可用武器/护甲：前期不出高级装备
function getAvailableWeaponIndices(floor: number): number[] {
  return WEAPON_DEFS
    .map((def, i) => ({ def, i }))
    .filter(({ def }) => {
      if (def.rarity === Rarity.Legendary) return floor >= 15;
      if (def.rarity === Rarity.Epic) return floor >= 8;
      if (def.rarity === Rarity.Rare) return floor >= 3;
      return true; // Common + Good always available
    })
    .map(({ i }) => i);
}

function getAvailableArmorIndices(floor: number): number[] {
  return ARMOR_DEFS
    .map((def, i) => ({ def, i }))
    .filter(({ def }) => {
      if (def.rarity === Rarity.Legendary) return floor >= 15;
      if (def.rarity === Rarity.Epic) return floor >= 8;
      if (def.rarity === Rarity.Rare) return floor >= 3;
      return true;
    })
    .map(({ i }) => i);
}

export function createRandomItem(floor: number, rng: SeededRandom, allowCursed: boolean = false, luckBonus: number = 0, foodMultiplier: number = 1.0): Item {
  const roll = rng.next();

  if (roll < 0.25) {
    const available = getAvailableWeaponIndices(floor);
    const idx = available[rng.nextInt(0, available.length - 1)];
    const rarity = rollRarity(rng, floor, luckBonus);
    const weapon = createWeapon(idx, rarity, rng);
    if (allowCursed && rng.chance(0.05)) {
      weapon.cursed = true;
      weapon.damage = Math.max(1, weapon.damage - 2);
      weapon.name = `诅咒${weapon.name}`;
    }
    return weapon;
  } else if (roll < 0.40) {
    const available = getAvailableArmorIndices(floor);
    const idx = available[rng.nextInt(0, available.length - 1)];
    const rarity = rollRarity(rng, floor, luckBonus);
    const armor = createArmor(idx, rarity, rng);
    if (allowCursed && rng.chance(0.05)) {
      armor.cursed = true;
      armor.defense = Math.max(0, armor.defense - 2);
      armor.name = `诅咒${armor.name}`;
    }
    return armor;
  } else if (roll < 0.50) {
    const bonusStat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
    const rarity = rollRarity(rng, floor, luckBonus);
    const rarityMult = { common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }[rarity];
    const baseBonusValue = rng.nextInt(1, 2 + Math.floor(floor / 10));
    const bonusValue = Math.max(1, Math.round(baseBonusValue * rarityMult));
    const cursed = allowCursed && rng.chance(0.03);
    const ringEffect = rollSpecialEffect(rarity, rng, ACCESSORY_EFFECTS);
    return {
      id: genId(),
      name: cursed ? `诅咒${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}之戒` : `${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}之戒`,
      type: ItemType.Ring,
      char: '=',
      fg: '#ccccaa',
      rarity,
      identified: true,
      description: cursed ? `${bonusStat}+0 (诅咒)` : `${bonusStat}+${bonusValue}${ringEffect ? ` [${EFFECT_NAME_ZH[ringEffect]}]` : ''}`,
      value: cursed ? 10 : bonusValue * 50 + (ringEffect ? 100 : 0),
      bonusStats: cursed ? { [bonusStat]: 0 } : { [bonusStat]: bonusValue },
      specialEffect: ringEffect,
      cursed,
    } as RingItem;
  } else if (roll < 0.55) {
    const bonusStat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
    const rarity = rollRarity(rng, floor, luckBonus);
    const rarityMult = { common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }[rarity];
    const baseBonusValue = rng.nextInt(2, 3 + Math.floor(floor / 8));
    const bonusValue = Math.max(1, Math.round(baseBonusValue * rarityMult));
    const cursed = allowCursed && rng.chance(0.03);
    const amuletEffect = rollSpecialEffect(rarity, rng, ACCESSORY_EFFECTS);
    return {
      id: genId(),
      name: cursed ? `诅咒${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}护符` : `${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}护符`,
      type: ItemType.Amulet,
      char: '"',
      fg: '#ccaa44',
      rarity,
      identified: true,
      description: cursed ? `${bonusStat}+0 (诅咒)` : `${bonusStat}+${bonusValue}${amuletEffect ? ` [${EFFECT_NAME_ZH[amuletEffect]}]` : ''}`,
      value: cursed ? 20 : bonusValue * 80 + (amuletEffect ? 150 : 0),
      bonusStats: cursed ? { [bonusStat]: 0 } : { [bonusStat]: bonusValue },
      specialEffect: amuletEffect,
      cursed,
    } as AmuletItem;
  } else if (roll < 0.75) {
    const idx = rng.nextInt(0, POTION_DEFS.length - 1);
    return createPotion(idx);
  } else if (roll < 0.80) {
    const idx = rng.nextInt(0, SCROLL_DEFS.length - 1);
    return createScroll(idx);
  } else {
    // Food: scaled by foodMultiplier
    const effectiveFoodPct = 0.15 * Math.min(foodMultiplier, 1.0);
    if (roll < 0.80 + effectiveFoodPct) {
      const idx = rng.nextInt(0, FOOD_DEFS.length - 1);
      return createFood(idx);
    }
    // Fallback to potion when food multiplier reduces the food range
    const idx = rng.nextInt(0, POTION_DEFS.length - 1);
    return createPotion(idx);
  }
}

function rollRarity(rng: SeededRandom, floor: number, luckBonus: number = 0): Rarity {
  const roll = rng.next();
  const floorBonus = Math.min(floor * 0.01, 0.15);
  const luck = luckBonus;

  if (floor >= 15 && roll < 0.01 + (floorBonus + luck) * 3) return Rarity.Legendary;
  if (floor >= 8 && roll < 0.05 + (floorBonus + luck) * 2) return Rarity.Epic;
  if (floor >= 3 && roll < 0.15 + floorBonus + luck) return Rarity.Rare;
  if (roll < 0.35) return Rarity.Good;
  return Rarity.Common;
}

export function getItemChar(item: Item): string {
  return item.char;
}

export function getItemName(item: Item): string {
  if (!item.identified && 'unidentifiedName' in item && item.unidentifiedName) {
    return item.unidentifiedName;
  }
  let name = item.name;
  if (item.cursed && item.identified) name += ' [诅咒]';
  return name;
}

export function identifyItem(item: Item): Item {
  if (item.identified) return item;
  return { ...item, identified: true };
}

export function createShopItems(floor: number, rng: SeededRandom, count: number, luckBonus: number = 0): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    items.push(createRandomItem(floor, rng, false, luckBonus));
  }
  return items;
}
