import {
  Player, CharacterClass, Stats, EquipmentSlot, Item,
  WeaponItem, ArmorItem,
  ItemType, Element,
} from '../types';
import { CLASS_DEFS, HUNGER_MAX } from '../constants';
import { expForLevel } from '../engine/Combat';

let nextId = 1;
export function genId(): string {
  return `e${nextId++}`;
}

export function resetIdCounter(): void {
  nextId = 1;
}

export function createPlayer(name: string, charClass: CharacterClass): Player {
  const def = CLASS_DEFS[charClass];
  const stats: Stats = { ...def.baseStats };

  const maxHp = def.baseHp + stats.vit * 3;
  const maxMp = def.baseMp + stats.int * 2;

  return {
    id: genId(),
    name,
    class: charClass,
    pos: { x: 0, y: 0 },
    char: def.char,
    fg: def.fg,
    bg: 'transparent',
    level: 1,
    exp: 0,
    expToNext: expForLevel(2),
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    stats,
    baseStats: { ...stats },
    bonusStats: { str: 0, dex: 0, int: 0, vit: 0 },
    hunger: HUNGER_MAX,
    maxHunger: HUNGER_MAX,
    inventory: [],
    equipment: {
      [EquipmentSlot.Weapon]: null,
      [EquipmentSlot.Armor]: null,
      [EquipmentSlot.Ring1]: null,
      [EquipmentSlot.Ring2]: null,
      [EquipmentSlot.Amulet]: null,
    },
    statusEffects: [],
    statPoints: 0,
    killCount: 0,
    bossKillCount: 0,
    visionRadius: 8,
    skillCooldowns: [0, 0, 0],
    talents: [],
    gold: 0,
  };
}

export function getEffectiveStats(player: Player): Stats {
  const stats = { ...player.stats };
  for (const slot of Object.values(EquipmentSlot)) {
    const item = player.equipment[slot];
    if (item && 'bonusStats' in item && item.bonusStats) {
      const bonus = item.bonusStats as Partial<Stats>;
      if (bonus.str) stats.str += bonus.str;
      if (bonus.dex) stats.dex += bonus.dex;
      if (bonus.int) stats.int += bonus.int;
      if (bonus.vit) stats.vit += bonus.vit;
    }
  }
  stats.str += player.bonusStats.str;
  stats.dex += player.bonusStats.dex;
  stats.int += player.bonusStats.int;
  stats.vit += player.bonusStats.vit;
  return stats;
}

export function getPlayerAttack(player: Player): number {
  const stats = getEffectiveStats(player);
  const weapon = player.equipment[EquipmentSlot.Weapon] as WeaponItem | null;
  return stats.str + (weapon?.damage ?? 1);
}

export function getPlayerDefense(player: Player): number {
  const stats = getEffectiveStats(player);
  const armor = player.equipment[EquipmentSlot.Armor] as ArmorItem | null;
  return Math.floor(stats.dex / 3) + (armor?.defense ?? 0);
}

export function getPlayerWeaponDamage(player: Player): number {
  const weapon = player.equipment[EquipmentSlot.Weapon] as WeaponItem | null;
  return weapon?.damage ?? 1;
}

export function getPlayerWeaponElement(player: Player): Element {
  const weapon = player.equipment[EquipmentSlot.Weapon] as WeaponItem | null;
  return weapon?.element ?? Element.None;
}

export function getMaxInventorySize(player: Player): number {
  const base = 20;
  if (player.talents.includes('packMule')) return base + 10;
  return base;
}

export function canEquipItem(player: Player, item: Item): EquipmentSlot | null {
  switch (item.type) {
    case ItemType.Weapon:
      return EquipmentSlot.Weapon;
    case ItemType.Armor:
      return EquipmentSlot.Armor;
    case ItemType.Ring:
      if (!player.equipment[EquipmentSlot.Ring1]) return EquipmentSlot.Ring1;
      if (!player.equipment[EquipmentSlot.Ring2]) return EquipmentSlot.Ring2;
      return EquipmentSlot.Ring1;
    case ItemType.Amulet:
      return EquipmentSlot.Amulet;
    default:
      return null;
  }
}

export function equipItem(player: Player, item: Item): Player {
  const newPlayer = { ...player };
  const slot = canEquipItem(player, item);
  if (!slot) return player;

  // BUG FIX: Can't equip cursed items in a different slot if already cursed-equipped
  // Actually, cursed items can be equipped (just not unequipped). Let's allow equipping over a cursed item though.
  const current = newPlayer.equipment[slot];
  if (current) {
    if (current.cursed) {
      // Can't replace cursed equipment
      return player;
    }
    newPlayer.inventory.push(current);
  }

  newPlayer.equipment = { ...newPlayer.equipment, [slot]: item };
  newPlayer.inventory = newPlayer.inventory.filter(i => i.id !== item.id);

  const stats = getEffectiveStats(newPlayer);
  const classDef = CLASS_DEFS[newPlayer.class];
  newPlayer.maxHp = classDef.baseHp + stats.vit * 3 + (newPlayer.level - 1) * classDef.hpPerLevel;
  newPlayer.maxMp = classDef.baseMp + stats.int * 2 + (newPlayer.level - 1) * classDef.mpPerLevel;

  return newPlayer;
}

export function unequipItem(player: Player, slot: EquipmentSlot): Player {
  const newPlayer = { ...player };
  const item = newPlayer.equipment[slot];
  if (!item) return player;

  // Can't unequip cursed items
  if (item.cursed) {
    return player;
  }

  // Can't unequip if inventory is full — item would be lost
  if (newPlayer.inventory.length >= getMaxInventorySize(newPlayer)) {
    return player;
  }

  newPlayer.inventory = [...newPlayer.inventory, item];
  newPlayer.equipment = { ...newPlayer.equipment, [slot]: null };

  return newPlayer;
}
