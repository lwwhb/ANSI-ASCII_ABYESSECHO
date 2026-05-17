import {
  Item, WeaponItem, ArmorItem, RingItem, AmuletItem, PotionItem, ScrollItem, FoodItem,
  ItemType, Rarity,
} from '../types';
import {
  WEAPON_DEFS, ARMOR_DEFS, POTION_DEFS, SCROLL_DEFS, FOOD_DEFS,
} from '../constants';
import { genId } from './Player';
import { SeededRandom } from '../utils/random';

export function createWeapon(index: number, rarity?: Rarity): WeaponItem {
  const def = WEAPON_DEFS[index % WEAPON_DEFS.length];
  const r = rarity ?? def.rarity;
  const rarityMult = { common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }[r];

  return {
    id: genId(),
    name: def.name,
    type: ItemType.Weapon,
    char: def.char,
    fg: def.fg,
    rarity: r,
    identified: true,
    description: `伤害: ${Math.floor(def.damage * rarityMult)}`,
    value: Math.floor(def.damage * 10 * rarityMult),
    damage: Math.floor(def.damage * rarityMult),
    element: def.element,
    bonusStats: r !== Rarity.Common ? { str: Math.floor(rarityMult * 2) } : undefined,
    cursed: false,
  };
}

export function createArmor(index: number, rarity?: Rarity): ArmorItem {
  const def = ARMOR_DEFS[index % ARMOR_DEFS.length];
  const r = rarity ?? def.rarity;
  const rarityMult = { common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }[r];

  return {
    id: genId(),
    name: def.name,
    type: ItemType.Armor,
    char: def.char,
    fg: def.fg,
    rarity: r,
    identified: true,
    description: `防御: ${Math.floor(def.defense * rarityMult)}, 闪避: ${Math.floor(def.evasion * rarityMult)}`,
    value: Math.floor(def.defense * 8 * rarityMult),
    defense: Math.floor(def.defense * rarityMult),
    evasion: Math.floor(def.evasion * rarityMult),
    bonusStats: r !== Rarity.Common ? { vit: Math.floor(rarityMult * 2) } : undefined,
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

export function createRandomItem(floor: number, rng: SeededRandom, allowCursed: boolean = false, luckBonus: number = 0, foodMultiplier: number = 1.0): Item {
  const roll = rng.next();

  if (roll < 0.25) {
    const idx = rng.nextInt(0, WEAPON_DEFS.length - 1);
    const rarity = rollRarity(rng, floor, luckBonus);
    const weapon = createWeapon(idx, rarity);
    if (allowCursed && rng.chance(0.05)) {
      weapon.cursed = true;
      weapon.damage = Math.max(1, weapon.damage - 2);
      weapon.name = `诅咒${weapon.name}`;
    }
    return weapon;
  } else if (roll < 0.40) {
    const idx = rng.nextInt(0, ARMOR_DEFS.length - 1);
    const rarity = rollRarity(rng, floor, luckBonus);
    const armor = createArmor(idx, rarity);
    if (allowCursed && rng.chance(0.05)) {
      armor.cursed = true;
      armor.defense = Math.max(0, armor.defense - 2);
      armor.name = `诅咒${armor.name}`;
    }
    return armor;
  } else if (roll < 0.50) {
    const bonusStat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
    const bonusValue = rng.nextInt(1, 2 + Math.floor(floor / 10));
    const cursed = allowCursed && rng.chance(0.03);
    return {
      id: genId(),
      name: cursed ? `诅咒${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}之戒` : `${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}之戒`,
      type: ItemType.Ring,
      char: '=',
      fg: '#ccccaa',
      rarity: rollRarity(rng, floor, luckBonus),
      identified: true,
      description: cursed ? `${bonusStat}+0 (诅咒)` : `${bonusStat}+${bonusValue}`,
      value: cursed ? 10 : bonusValue * 50,
      bonusStats: cursed ? { [bonusStat]: 0 } : { [bonusStat]: bonusValue },
      cursed,
    } as RingItem;
  } else if (roll < 0.55) {
    const bonusStat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
    const bonusValue = rng.nextInt(2, 3 + Math.floor(floor / 8));
    const cursed = allowCursed && rng.chance(0.03);
    return {
      id: genId(),
      name: cursed ? `诅咒${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}护符` : `${bonusStat === 'str' ? '力量' : bonusStat === 'dex' ? '灵巧' : bonusStat === 'int' ? '智慧' : '活力'}护符`,
      type: ItemType.Amulet,
      char: '"',
      fg: '#ccaa44',
      rarity: rollRarity(rng, floor, luckBonus),
      identified: true,
      description: cursed ? `${bonusStat}+0 (诅咒)` : `${bonusStat}+${bonusValue}`,
      value: cursed ? 20 : bonusValue * 80,
      bonusStats: cursed ? { [bonusStat]: 0 } : { [bonusStat]: bonusValue },
      cursed,
    } as AmuletItem;
  } else if (roll < 0.80) {
    const idx = rng.nextInt(0, POTION_DEFS.length - 1);
    return createPotion(idx);
  } else if (roll < 0.92) {
    const idx = rng.nextInt(0, SCROLL_DEFS.length - 1);
    return createScroll(idx);
  } else {
    // Food: base 8% chance, scaled by foodMultiplier
    const foodChance = 0.92 + 0.08 * foodMultiplier;
    if (roll < foodChance) {
      const idx = rng.nextInt(0, FOOD_DEFS.length - 1);
      return createFood(idx);
    }
    // If food chance exceeded, default to a potion
    const idx = rng.nextInt(0, POTION_DEFS.length - 1);
    return createPotion(idx);
  }
}

function rollRarity(rng: SeededRandom, floor: number, luckBonus: number = 0): Rarity {
  const roll = rng.next();
  const floorBonus = Math.min(floor * 0.01, 0.15);
  const luck = luckBonus;

  if (roll < 0.01 + (floorBonus + luck) * 3) return Rarity.Legendary;
  if (roll < 0.05 + (floorBonus + luck) * 2) return Rarity.Epic;
  if (roll < 0.15 + floorBonus + luck) return Rarity.Rare;
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
