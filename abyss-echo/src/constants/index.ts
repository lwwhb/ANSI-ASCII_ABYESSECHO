import { TileType, Biome, CharacterClass, Rarity, Element, EnemyBehavior, EnemyDef, PotionEffect, ScrollEffect, SkillDef, TalentDef, AchievementDef, GameEventDef } from '../types';

// ============================================================
// Map Dimensions
// ============================================================
export const DEFAULT_MAP_WIDTH = 80;
export const DEFAULT_MAP_HEIGHT = 28;
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 28;
export const VIEWPORT_WIDTH = 80;
export const VIEWPORT_HEIGHT = 28;
export const FOV_RADIUS = 8;

// ============================================================
// Player Constants
// ============================================================
export const CLASS_DEFS: Record<CharacterClass, {
  name: string;
  nameZh: string;
  description: string;
  baseStats: { str: number; dex: number; int: number; vit: number };
  baseHp: number;
  baseMp: number;
  char: string;
  fg: string;
  hpPerLevel: number;
  mpPerLevel: number;
}> = {
  [CharacterClass.Warrior]: {
    name: 'Warrior',
    nameZh: '战士',
    description: '钢铁意志的近战专家。高生命值与攻击力，适合正面冲锋。',
    baseStats: { str: 14, dex: 8, int: 6, vit: 12 },
    baseHp: 30,
    baseMp: 5,
    char: '@',
    fg: '#ff6644',
    hpPerLevel: 5,
    mpPerLevel: 2,
  },
  [CharacterClass.Mage]: {
    name: 'Mage',
    nameZh: '法师',
    description: '精通奥术的施法者。高魔力与法术伤害，但身躯脆弱。',
    baseStats: { str: 6, dex: 8, int: 14, vit: 8 },
    baseHp: 15,
    baseMp: 25,
    char: '@',
    fg: '#66aaff',
    hpPerLevel: 3,
    mpPerLevel: 5,
  },
  [CharacterClass.Rogue]: {
    name: 'Rogue',
    nameZh: '游侠',
    description: '暗影中的致命猎手。高敏捷与暴击率，擅长远程与闪避。',
    baseStats: { str: 8, dex: 14, int: 8, vit: 8 },
    baseHp: 20,
    baseMp: 10,
    char: '@',
    fg: '#44ff66',
    hpPerLevel: 4,
    mpPerLevel: 3,
  },
};

export const HUNGER_MAX = 200;
export const HUNGER_RATE = 1;
export const HUNGER_STARVE_DAMAGE = 3;
export const EXP_BASE = 20;
export const EXP_GROWTH = 1.5;

// ============================================================
// Tile Definitions
// ============================================================
export const TILE_CHARS: Record<TileType, { char: string; fg: string; bg: string; walkable: boolean; transparent: boolean }> = {
  [TileType.Wall]:         { char: '█', fg: '#555566', bg: '#222233', walkable: false, transparent: false },
  [TileType.Floor]:        { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.Corridor]:     { char: '·', fg: '#555566', bg: '#0f0f1f', walkable: true,  transparent: true },
  [TileType.Door]:         { char: '▓', fg: '#aa8844', bg: '#111122', walkable: false, transparent: false },
  [TileType.DoorOpen]:     { char: '░', fg: '#887744', bg: '#111122', walkable: true,  transparent: true },
  [TileType.StairsDown]:   { char: '▼', fg: '#ffcc44', bg: '#111122', walkable: true,  transparent: true },
  [TileType.Water]:        { char: '≈', fg: '#4488cc', bg: '#112244', walkable: false, transparent: true },
  [TileType.Lava]:         { char: '≈', fg: '#ff4422', bg: '#441100', walkable: false, transparent: true },
  [TileType.PoisonGas]:    { char: '░', fg: '#44cc44', bg: '#113311', walkable: true,  transparent: true },
  [TileType.TrapSpike]:    { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.TrapFire]:     { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.TrapTeleport]: { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.TrapPoison]:   { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.Shop]:         { char: '$', fg: '#ffcc44', bg: '#111122', walkable: true,  transparent: true },
  [TileType.Event]:        { char: '♣', fg: '#aa44ff', bg: '#111122', walkable: true,  transparent: true },
  [TileType.ShallowWater]: { char: '≈', fg: '#5599dd', bg: '#112244', walkable: true,  transparent: true },
  [TileType.CursedGround]: { char: '·', fg: '#776699', bg: '#151020', walkable: true,  transparent: true },
  [TileType.CooledLava]:   { char: '≈', fg: '#994433', bg: '#221100', walkable: true,  transparent: true },
  [TileType.VoidWall]:     { char: '█', fg: '#442288', bg: '#0a0015', walkable: false, transparent: false },
  [TileType.Portal]:       { char: '⊙', fg: '#cc44ff', bg: '#0a0a1e', walkable: true,  transparent: true },
  [TileType.Torch]:        { char: '♫', fg: '#ffaa44', bg: '#1a221a', walkable: false, transparent: true },
  [TileType.Sarcophagus]:  { char: '■', fg: '#888877', bg: '#1a221a', walkable: false, transparent: false },
};

// Biome-specific tile overrides
export const BIOME_TILES: Record<Biome, Partial<Record<TileType, { char?: string; fg?: string; bg?: string }>>> = {
  [Biome.StoneDungeon]: {
    [TileType.Wall]:  { fg: '#555566', bg: '#222233' },
    [TileType.Floor]: { fg: '#666677', bg: '#111122' },
  },
  [Biome.CrystalCavern]: {
    [TileType.Wall]:         { char: '▓', fg: '#7766bb', bg: '#221144' },
    [TileType.Floor]:        { char: '·', fg: '#9988cc', bg: '#1a0a2e' },
    [TileType.Water]:        { char: '≈', fg: '#88aaff', bg: '#1a1a4e' },
    [TileType.ShallowWater]: { char: '≈', fg: '#88aaff', bg: '#1a1a4e' },
  },
  [Biome.AncientCrypt]: {
    [TileType.Wall]:         { char: '█', fg: '#667766', bg: '#1a221a' },
    [TileType.Floor]:        { char: '·', fg: '#778877', bg: '#0f1a0f' },
    [TileType.Door]:         { char: '▓', fg: '#889966', bg: '#1a221a' },
    [TileType.CursedGround]: { char: '·', fg: '#8877aa', bg: '#151020' },
    [TileType.Torch]:        { char: '♫', fg: '#ffaa44', bg: '#1a221a' },
    [TileType.Sarcophagus]:  { char: '■', fg: '#999988', bg: '#1a221a' },
  },
  [Biome.LavaCore]: {
    [TileType.Wall]:       { char: '▓', fg: '#994422', bg: '#331100' },
    [TileType.Floor]:      { char: '·', fg: '#886644', bg: '#1a0f0a' },
    [TileType.Lava]:       { char: '≈', fg: '#ff6622', bg: '#551100' },
    [TileType.CooledLava]: { char: '≈', fg: '#aa5533', bg: '#221100' },
  },
  [Biome.VoidAbyss]: {
    [TileType.Wall]:  { char: '█', fg: '#6644aa', bg: '#110022' },
    [TileType.Floor]: { char: '·', fg: '#8866cc', bg: '#0a0a1e' },
    [TileType.VoidWall]: { char: '█', fg: '#5533aa', bg: '#0a0015' },
    [TileType.Portal]:   { char: '⊙', fg: '#dd55ff', bg: '#0a0a1e' },
  },
};

// ============================================================
// Color Map
// ============================================================
export const COLORS = {
  black: '#000000',
  darkGray: '#333344',
  gray: '#666677',
  lightGray: '#999999',
  white: '#dddddd',
  red: '#ff4444',
  darkRed: '#aa2222',
  green: '#44cc44',
  darkGreen: '#228822',
  blue: '#4488ff',
  darkBlue: '#2244aa',
  yellow: '#ffcc44',
  orange: '#ff8844',
  purple: '#aa44ff',
  cyan: '#44cccc',
  pink: '#ff44aa',
  brown: '#aa8844',
};

// ============================================================
// Rarity Colors
// ============================================================
export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: '#aaaaaa',
  [Rarity.Good]: '#44cc44',
  [Rarity.Rare]: '#4488ff',
  [Rarity.Epic]: '#aa44ff',
  [Rarity.Legendary]: '#ff8844',
};

// ============================================================
// Enemy Definitions (BUG FIX: unique chars for all enemies)
// ============================================================
export const ENEMY_DEFS: EnemyDef[] = [
  // Floor 1-5
  { id: 'slime',     name: '史莱姆',   char: 's', fg: '#44cc44', hp: 8,  attack: 3,  defense: 0,  exp: 5,  behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 1,  speed: 1, dropChance: 0.2, alertRadius: 5, goldDrop: 3 },
  { id: 'rat',       name: '巨鼠',     char: 'r', fg: '#aa8844', hp: 6,  attack: 4,  defense: 0,  exp: 4,  behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 1,  speed: 2, dropChance: 0.1, alertRadius: 6, goldDrop: 2 },
  { id: 'bat',       name: '蝙蝠',     char: 'b', fg: '#887799', hp: 5,  attack: 3,  defense: 1,  exp: 4,  behavior: EnemyBehavior.Cowardly,    element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 1,  speed: 2, dropChance: 0.1, alertRadius: 7, goldDrop: 2 },
  { id: 'goblin',    name: '哥布林',   char: 'g', fg: '#44aa44', hp: 12, attack: 5,  defense: 1,  exp: 8,  behavior: EnemyBehavior.Patrolling,   element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 2,  speed: 1, dropChance: 0.3, alertRadius: 6, goldDrop: 5 },
  { id: 'caveScorpion', name: '洞穴蝎', char: 'p', fg: '#88aa44', hp: 10, attack: 4,  defense: 1,  exp: 6,  behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 1,  speed: 1, dropChance: 0.25, alertRadius: 5, specialAbility: 'poisonSting', goldDrop: 4 },
  { id: 'gargoyle',     name: '石像鬼', char: 'G', fg: '#888888', hp: 16, attack: 3,  defense: 4,  exp: 10, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 2,  speed: 1, dropChance: 0.35, alertRadius: 3, specialAbility: 'dormant', goldDrop: 8 },
  // Floor 6-10
  { id: 'skeleton',  name: '骷髅',     char: 'S', fg: '#ccccaa', hp: 18, attack: 7,  defense: 3,  exp: 15, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 5,  speed: 1, dropChance: 0.3, alertRadius: 6, goldDrop: 8 },
  { id: 'spider',    name: '巨蛛',     char: 'x', fg: '#664422', hp: 15, attack: 8,  defense: 2,  exp: 12, behavior: EnemyBehavior.Stationary,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 5,  speed: 1, dropChance: 0.25, alertRadius: 4, specialAbility: 'web', goldDrop: 6 },
  { id: 'orc',       name: '兽人',     char: 'O', fg: '#66aa44', hp: 25, attack: 10, defense: 4,  exp: 20, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 6,  speed: 1, dropChance: 0.35, alertRadius: 5, goldDrop: 12 },
  { id: 'shadow',    name: '暗影',     char: 'w', fg: '#4444aa', hp: 14, attack: 9,  defense: 2,  exp: 18, behavior: EnemyBehavior.Aggressive,  element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 7, speed: 2, dropChance: 0.2, alertRadius: 8, goldDrop: 10 },
  { id: 'crystalGuard', name: '水晶守卫', char: 'C', fg: '#88ccff', hp: 22, attack: 8,  defense: 5,  exp: 16, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 6, speed: 1, dropChance: 0.3, alertRadius: 6, specialAbility: 'reflect', goldDrop: 12 },
  { id: 'glowJelly',    name: '荧光水母', char: 'j', fg: '#aaffcc', hp: 10, attack: 6,  defense: 0,  exp: 10, behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 6, speed: 1, dropChance: 0.2, alertRadius: 4, specialAbility: 'glare', goldDrop: 5 },
  // Floor 11-15
  { id: 'darkKnight',name: '暗黑骑士', char: 'K', fg: '#4400aa', hp: 35, attack: 14, defense: 8,  exp: 35, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 10, speed: 1, dropChance: 0.4, alertRadius: 6, goldDrop: 20 },
  { id: 'wraith',    name: '怨灵',     char: 'R', fg: '#8844cc', hp: 22, attack: 12, defense: 3,  exp: 28, behavior: EnemyBehavior.Aggressive,  element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 10, speed: 1, dropChance: 0.3, alertRadius: 8, specialAbility: 'drain', goldDrop: 15 },
  { id: 'troll',     name: '巨魔',     char: 'T', fg: '#448844', hp: 45, attack: 11, defense: 6,  exp: 30, behavior: EnemyBehavior.Patrolling,   element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 11, speed: 1, dropChance: 0.4, alertRadius: 5, specialAbility: 'regenerate', goldDrop: 18 },
  { id: 'mimic',     name: '宝箱怪',   char: 'M', fg: '#ccaa44', hp: 30, attack: 13, defense: 5,  exp: 32, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 11, speed: 1, dropChance: 0.5, alertRadius: 2, specialAbility: 'surprise', goldDrop: 25 },
  { id: 'tombGuard', name: '守墓人', char: 'Š', fg: '#887766', hp: 40, attack: 10, defense: 10, exp: 35, behavior: EnemyBehavior.Patrolling,   element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 11, speed: 1, dropChance: 0.3, alertRadius: 5, specialAbility: 'patrol', goldDrop: 15 },
  { id: 'soulEater', name: '噬魂者', char: 'W', fg: '#aa66ff', hp: 18, attack: 15, defense: 1,  exp: 30, behavior: EnemyBehavior.Aggressive,  element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 11, speed: 3, dropChance: 0.25, alertRadius: 7, specialAbility: 'phaseThrough', goldDrop: 12 },
  // Floor 16-20
  { id: 'demon',     name: '恶魔',     char: 'd', fg: '#cc2222', hp: 50, attack: 16, defense: 8,  exp: 50, behavior: EnemyBehavior.Aggressive,  element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 15, speed: 1, dropChance: 0.45, alertRadius: 7, specialAbility: 'fireball', goldDrop: 30 },
  { id: 'gorgon',    name: '蛇发女妖', char: 'G', fg: '#88aa44', hp: 55, attack: 14, defense: 10, exp: 55, behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 16, speed: 1, dropChance: 0.4, alertRadius: 6, specialAbility: 'petrify', goldDrop: 35 },
  { id: 'vampire',   name: '吸血鬼',   char: 'V', fg: '#aa2222', hp: 40, attack: 15, defense: 6,  exp: 48, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 16, speed: 2, dropChance: 0.45, alertRadius: 7, specialAbility: 'drain', goldDrop: 30 },
  { id: 'lich',      name: '巫妖',     char: 'L', fg: '#6644cc', hp: 45, attack: 18, defense: 5,  exp: 60, behavior: EnemyBehavior.Aggressive,  element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 18, speed: 1, dropChance: 0.5, alertRadius: 8, specialAbility: 'summon', goldDrop: 40 },
  { id: 'lavaWorm',     name: '熔岩虫', char: 'w', fg: '#ff6622', hp: 35, attack: 12, defense: 4,  exp: 40, behavior: EnemyBehavior.Aggressive,  element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 16, speed: 2, dropChance: 0.3, alertRadius: 6, specialAbility: 'lavaSwim', goldDrop: 18 },
  { id: 'obsidianGolem', name: '黑曜石巨人', char: 'O', fg: '#443344', hp: 70, attack: 8,  defense: 15, exp: 55, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 16, speed: 0, dropChance: 0.4, alertRadius: 3, specialAbility: 'blockade', goldDrop: 25 },
  // Floor 21+
  { id: 'dragon',    name: '巨龙',     char: 'W', fg: '#ff4422', hp: 80, attack: 22, defense: 12, exp: 100,behavior: EnemyBehavior.Aggressive,  element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 20, speed: 1, dropChance: 0.6, alertRadius: 9, specialAbility: 'breath', goldDrop: 60 },
  { id: 'voidWalker',name: '虚空行者', char: 'Ø', fg: '#8844ff', hp: 60, attack: 20, defense: 8,  exp: 80, behavior: EnemyBehavior.Aggressive,  element: Element.Lightning,  weakness: Element.None,       resistance: Element.Lightning,   minFloor: 22, speed: 2, dropChance: 0.5, alertRadius: 10, specialAbility: 'teleport', goldDrop: 50 },
  { id: 'ancientOne', name: '远古存在', char: 'A', fg: '#cc44ff', hp: 100,attack: 25, defense: 15, exp: 150,behavior: EnemyBehavior.Boss,       element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 25, speed: 1, dropChance: 1.0, alertRadius: 12, specialAbility: 'eldritch', goldDrop: 100 },
  { id: 'voidWeaver',   name: '虚空织者', char: 'V', fg: '#cc44ff', hp: 55, attack: 18, defense: 6,  exp: 70, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 21, speed: 2, dropChance: 0.35, alertRadius: 8, specialAbility: 'blink', goldDrop: 22 },
  { id: 'mirrorImage',  name: '镜像体', char: '©', fg: '#ff44ff', hp: 1,  attack: 0,  defense: 0,  exp: 5,  behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 21, speed: 1, dropChance: 0,    alertRadius: 10, specialAbility: 'mirrorExplode', goldDrop: 0 },
];

// Boss definitions (every 5 floors) - BUG FIX: defId now matches lookup
export const BOSS_DEFS: (EnemyDef & { isBoss: true })[] = [
  { id: 'goblinKing',   name: '哥布林王',   char: 'G', fg: '#ffcc44', hp: 50,  attack: 10, defense: 5,  exp: 50,  behavior: EnemyBehavior.Boss, element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 5,  speed: 1, dropChance: 1.0, alertRadius: 8, isBoss: true, specialAbility: 'summon', goldDrop: 50 },
  { id: 'spiderQueen',  name: '蜘蛛女王',   char: 'Q', fg: '#884422', hp: 80,  attack: 14, defense: 6,  exp: 80,  behavior: EnemyBehavior.Boss, element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 10, speed: 1, dropChance: 1.0, alertRadius: 8, isBoss: true, specialAbility: 'web', goldDrop: 80 },
  { id: 'deathKnight',  name: '死亡骑士',   char: 'K', fg: '#cc44aa', hp: 120, attack: 20, defense: 12, exp: 150, behavior: EnemyBehavior.Boss, element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 15, speed: 1, dropChance: 1.0, alertRadius: 8, isBoss: true, specialAbility: 'drain', goldDrop: 120 },
  { id: 'demonLord',    name: '恶魔领主',   char: '&', fg: '#ff2222', hp: 160, attack: 25, defense: 14, exp: 250, behavior: EnemyBehavior.Boss, element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 20, speed: 1, dropChance: 1.0, alertRadius: 10, isBoss: true, specialAbility: 'fireball', goldDrop: 200 },
  { id: 'abyssKing',    name: '深渊之王',   char: 'Å', fg: '#ff44ff', hp: 250, attack: 30, defense: 18, exp: 500, behavior: EnemyBehavior.Boss, element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 25, speed: 1, dropChance: 1.0, alertRadius: 12, isBoss: true, specialAbility: 'eldritch', goldDrop: 500 },
];

// ============================================================
// Item Definitions
// ============================================================
export const WEAPON_DEFS = [
  { name: '匕首',     char: '/', fg: '#aaaaaa', damage: 3,  element: Element.None,       rarity: Rarity.Common },
  { name: '短剑',     char: '/', fg: '#aaaaaa', damage: 5,  element: Element.None,       rarity: Rarity.Common },
  { name: '长剑',     char: '/', fg: '#cccccc', damage: 8,  element: Element.None,       rarity: Rarity.Common },
  { name: '战斧',     char: '/', fg: '#ccaa44', damage: 10, element: Element.None,       rarity: Rarity.Good },
  { name: '火焰之剑', char: '/', fg: '#ff6644', damage: 9,  element: Element.Fire,       rarity: Rarity.Rare },
  { name: '寒冰之刃', char: '/', fg: '#44aaff', damage: 9,  element: Element.Ice,        rarity: Rarity.Rare },
  { name: '雷霆之锤', char: '/', fg: '#cccc44', damage: 11, element: Element.Lightning,  rarity: Rarity.Rare },
  { name: '暗影匕首', char: '/', fg: '#8844cc', damage: 12, element: Element.Poison,     rarity: Rarity.Epic },
  { name: '毁灭之斧', char: '/', fg: '#ff4444', damage: 16, element: Element.Fire,       rarity: Rarity.Epic },
  { name: '深渊之刃', char: '/', fg: '#ff44ff', damage: 20, element: Element.Poison,     rarity: Rarity.Legendary },
];

export const ARMOR_DEFS = [
  { name: '布甲',     char: '[', fg: '#aaaaaa', defense: 2,  evasion: 0,  rarity: Rarity.Common },
  { name: '皮甲',     char: '[', fg: '#aa8844', defense: 4,  evasion: 2,  rarity: Rarity.Common },
  { name: '锁子甲',   char: '[', fg: '#cccccc', defense: 6,  evasion: -1, rarity: Rarity.Common },
  { name: '板甲',     char: '[', fg: '#888899', defense: 9,  evasion: -3, rarity: Rarity.Good },
  { name: '暗影长袍', char: '[', fg: '#4444aa', defense: 5,  evasion: 5,  rarity: Rarity.Rare },
  { name: '龙鳞甲',   char: '[', fg: '#ff4422', defense: 12, evasion: -2, rarity: Rarity.Epic },
  { name: '虚空之铠', char: '[', fg: '#ff44ff', defense: 15, evasion: 0,  rarity: Rarity.Legendary },
];

export const POTION_DEFS = [
  { name: '治疗药水',     unidentifiedName: '红色药水',     char: '!', fg: '#ff4444', effect: PotionEffect.Healing,       power: 15, rarity: Rarity.Common },
  { name: '魔力药水',     unidentifiedName: '蓝色药水',     char: '!', fg: '#4488ff', effect: PotionEffect.ManaRestore,   power: 12, rarity: Rarity.Common },
  { name: '力量药水',     unidentifiedName: '橙色药水',     char: '!', fg: '#ff8844', effect: PotionEffect.Strength,      power: 2,  rarity: Rarity.Rare },
  { name: '灵巧药水',     unidentifiedName: '绿色药水',     char: '!', fg: '#44cc44', effect: PotionEffect.Dexterity,    power: 2,  rarity: Rarity.Rare },
  { name: '智慧药水',     unidentifiedName: '紫色药水',     char: '!', fg: '#aa44ff', effect: PotionEffect.Intelligence,  power: 2,  rarity: Rarity.Rare },
  { name: '剧毒药水',     unidentifiedName: '浑浊药水',     char: '!', fg: '#44aa44', effect: PotionEffect.Poison,        power: 8,  rarity: Rarity.Common },
  { name: '麻痹药水',     unidentifiedName: '黄色药水',     char: '!', fg: '#cccc44', effect: PotionEffect.Paralysis,     power: 3,  rarity: Rarity.Rare },
  { name: '混乱药水',     unidentifiedName: '粉色药水',     char: '!', fg: '#ff44aa', effect: PotionEffect.Confusion,     power: 4,  rarity: Rarity.Rare },
  { name: '完全治疗药水', unidentifiedName: '白色药水',     char: '!', fg: '#ffffff', effect: PotionEffect.FullHeal,      power: 999,rarity: Rarity.Legendary },
  { name: '火抗药水',     unidentifiedName: '深红色药水',   char: '!', fg: '#ff6622', effect: PotionEffect.FireResist,    power: 5,  rarity: Rarity.Rare },
];

export const SCROLL_DEFS = [
  { name: '鉴定卷轴',   unidentifiedName: '刻有古文的纸卷', char: '?', fg: '#ccccaa', effect: ScrollEffect.Identify,    power: 1,  rarity: Rarity.Common },
  { name: '地图卷轴',   unidentifiedName: '绘有图案的纸卷', char: '?', fg: '#aacc88', effect: ScrollEffect.Mapping,    power: 1,  rarity: Rarity.Common },
  { name: '传送卷轴',   unidentifiedName: '模糊不清的纸卷', char: '?', fg: '#aa88cc', effect: ScrollEffect.Teleport,   power: 1,  rarity: Rarity.Rare },
  { name: '火球卷轴',   unidentifiedName: '灼热的纸卷',     char: '?', fg: '#ff6644', effect: ScrollEffect.Fireball,   power: 20, rarity: Rarity.Rare },
  { name: '冰风暴卷轴', unidentifiedName: '冰冷的纸卷',     char: '?', fg: '#44aaff', effect: ScrollEffect.IceStorm,  power: 18, rarity: Rarity.Rare },
  { name: '闪电卷轴',   unidentifiedName: '闪烁的纸卷',     char: '?', fg: '#cccc44', effect: ScrollEffect.Lightning,  power: 22, rarity: Rarity.Rare },
  { name: '附魔卷轴',   unidentifiedName: '发光的纸卷',     char: '?', fg: '#ff88ff', effect: ScrollEffect.Enchant,    power: 1,  rarity: Rarity.Epic },
  { name: '解咒卷轴',   unidentifiedName: '陈旧的纸卷',     char: '?', fg: '#888844', effect: ScrollEffect.RemoveCurse, power: 1,  rarity: Rarity.Rare },
  { name: '传送门卷轴', unidentifiedName: '神秘符文纸卷',   char: '?', fg: '#cc44ff', effect: ScrollEffect.CreatePortal, power: 1,  rarity: Rarity.Epic },
];

export const FOOD_DEFS = [
  { name: '面包',     char: '%', fg: '#ccaa66', nutrition: 50,  rarity: Rarity.Common },
  { name: '干粮',     char: '%', fg: '#b8924a', nutrition: 70,  rarity: Rarity.Common },
  { name: '肉干',     char: '%', fg: '#aa6644', nutrition: 90,  rarity: Rarity.Common },
  { name: '魔法果实', char: '%', fg: '#44cc44', nutrition: 120, rarity: Rarity.Rare },
  { name: '仙馔',     char: '%', fg: '#ffcc44', nutrition: 300, rarity: Rarity.Epic },
];

// ============================================================
// Skill Definitions
// ============================================================
export const SKILL_DEFS: Record<CharacterClass, SkillDef[]> = {
  [CharacterClass.Warrior]: [
    { id: 'shieldBash', name: 'Shield Bash', nameZh: '盾击', description: '击退并眩晕相邻敌人2回合', mpCost: 8, maxCooldown: 3, element: Element.None, range: 1, radius: 0, power: 0, key: 'z', icon: '🛡' },
    { id: 'warCry', name: 'War Cry', nameZh: '战吼', description: '提升5点防御，持续5回合', mpCost: 12, maxCooldown: 8, element: Element.None, range: 0, radius: 0, power: 5, key: 'x', icon: '📢' },
    { id: 'whirlwind', name: 'Whirlwind', nameZh: '旋风斩', description: '攻击周围所有敌人，造成1.5倍武器伤害', mpCost: 15, maxCooldown: 6, element: Element.None, range: 0, radius: 1, power: 1, key: 'c', icon: '🌀' },
  ],
  [CharacterClass.Mage]: [
    { id: 'fireball', name: 'Fireball', nameZh: '火球术', description: '对视野内敌人发射火球，造成范围伤害', mpCost: 10, maxCooldown: 4, element: Element.Fire, range: 5, radius: 1, power: 20, key: 'z', icon: '🔥' },
    { id: 'iceShield', name: 'Ice Shield', nameZh: '冰盾', description: '获得5点防御和冰冻免疫，持续5回合', mpCost: 8, maxCooldown: 6, element: Element.Ice, range: 0, radius: 0, power: 5, key: 'x', icon: '🧊' },
    { id: 'chainLightning', name: 'Chain Lightning', nameZh: '闪电链', description: '对最近3个敌人释放闪电', mpCost: 15, maxCooldown: 5, element: Element.Lightning, range: 6, radius: 0, power: 18, key: 'c', icon: '⚡' },
  ],
  [CharacterClass.Rogue]: [
    { id: 'shadowStep', name: 'Shadow Step', nameZh: '暗影步', description: '瞬移到最近敌人身边并造成2倍暴击', mpCost: 8, maxCooldown: 4, element: Element.None, range: 6, radius: 0, power: 2, key: 'z', icon: '👤' },
    { id: 'poisonBlade', name: 'Poison Blade', nameZh: '毒刃', description: '下一次攻击附带剧毒(5伤害/4回合)', mpCost: 6, maxCooldown: 3, element: Element.Poison, range: 0, radius: 0, power: 5, key: 'x', icon: '🗡' },
    { id: 'fanOfKnives', name: 'Fan of Knives', nameZh: '扇刃', description: '对2格内所有敌人造成伤害', mpCost: 12, maxCooldown: 5, element: Element.None, range: 0, radius: 2, power: 10, key: 'c', icon: '🔪' },
  ],
};

// ============================================================
// Talent Definitions
// ============================================================
export const TALENT_DEFS: TalentDef[] = [
  // Generic talents
  { id: 'ironStomach', name: 'Iron Stomach', nameZh: '铁胃', description: '饥饿速度降低50%', icon: '🍖' },
  { id: 'thickSkin', name: 'Thick Skin', nameZh: '厚皮', description: '受到物理伤害减少2', icon: '🛡' },
  { id: 'fastLearner', name: 'Fast Learner', nameZh: '快速学习', description: '经验获取+20%', icon: '📚' },
  { id: 'lucky', name: 'Lucky', nameZh: '幸运', description: '物品掉落率+15%', icon: '🍀' },
  { id: 'nightVision', name: 'Night Vision', nameZh: '夜视', description: '视野+2', icon: '👁' },
  { id: 'regeneration', name: 'Regeneration', nameZh: '急速恢复', description: '每回合自然回复1HP(战斗中)', icon: '💚' },
  { id: 'greedy', name: 'Greedy', nameZh: '贪婪', description: '金币掉落+50%', icon: '💰' },
  { id: 'tenacious', name: 'Tenacious', nameZh: '顽强', description: 'HP低于20%时防御+5', icon: '💪' },
  { id: 'deadlyStrike', name: 'Deadly Strike', nameZh: '致命一击', description: '暴击伤害+50%', icon: '💥' },
  { id: 'elementalAffinity', name: 'Elemental Affinity', nameZh: '元素亲和', description: '元素伤害+20%', icon: '✨' },
  { id: 'packMule', name: 'Pack Mule', nameZh: '背包专家', description: '背包容量+10', icon: '🎒' },
  { id: 'meditation', name: 'Meditation', nameZh: '冥想', description: '每回合自然回复1MP', icon: '🧘' },
  // Warrior-specific
  { id: 'shieldWall', name: 'Shield Wall', nameZh: '盾墙', description: '装备护甲时额外+3防御', icon: '🏰', classRequired: CharacterClass.Warrior },
  { id: 'bloodFury', name: 'Blood Fury', nameZh: '血之狂暴', description: 'HP越低攻击越高(最多+30%)', icon: '🩸', classRequired: CharacterClass.Warrior },
  // Mage-specific
  { id: 'spellPenetration', name: 'Spell Penetration', nameZh: '法术穿透', description: '魔法无视50%防御', icon: '🔮', classRequired: CharacterClass.Mage },
  { id: 'arcaneResonance', name: 'Arcane Resonance', nameZh: '奥术共鸣', description: '卷轴效果+30%', icon: '📖', classRequired: CharacterClass.Mage },
  // Rogue-specific
  { id: 'evasionMaster', name: 'Evasion Master', nameZh: '闪避大师', description: '闪避率额外+10%', icon: '💨', classRequired: CharacterClass.Rogue },
  { id: 'toxicBlade', name: 'Toxic Blade', nameZh: '淬毒', description: '攻击20%概率附加中毒', icon: '☠', classRequired: CharacterClass.Rogue },
];

// ============================================================
// Achievement Definitions
// ============================================================
export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'firstBlood', name: 'First Blood', nameZh: '初次杀戮', description: '击败第一个敌人', icon: '⚔' },
  { id: 'floor5', name: 'Deep Explorer', nameZh: '深入探索', description: '到达第5层', icon: '🪜' },
  { id: 'floor10', name: 'Crystal Delver', nameZh: '水晶探矿者', description: '到达第10层', icon: '💎' },
  { id: 'floor15', name: 'Crypt Walker', nameZh: '陵墓行者', description: '到达第15层', icon: '⚰' },
  { id: 'floor20', name: 'Lava Survivor', nameZh: '熔岩幸存者', description: '到达第20层', icon: '🌋' },
  { id: 'floor25', name: 'Void Touched', nameZh: '虚空触碰者', description: '到达第25层', icon: '🌀' },
  { id: 'bossSlayer', name: 'Boss Slayer', nameZh: 'Boss杀手', description: '击败一个Boss', icon: '👑' },
  { id: 'bossMaster', name: 'Boss Master', nameZh: 'Boss征服者', description: '击败3个Boss', icon: '🏆' },
  { id: 'rich', name: 'Gold Hoarder', nameZh: '守财奴', description: '累计拥有100金币', icon: '💰' },
  { id: 'legendary', name: 'Legendary Find', nameZh: '传说发现', description: '获得一件传说级物品', icon: '✨' },
  { id: 'pacifist10', name: 'Pacifist', nameZh: '和平主义者', description: '不杀敌通过10层', icon: '🕊' },
  { id: 'glutton', name: 'Well Fed', nameZh: '丰衣足食', description: '饱食度始终高于150到达5层', icon: '🍖' },
  { id: 'skillMaster', name: 'Skill Master', nameZh: '技能大师', description: '使用技能50次', icon: '⚡' },
  { id: 'shopper', name: 'Shopper', nameZh: '精明买家', description: '在商店购买5件物品', icon: '🛒' },
  { id: 'talent3', name: 'Gifted', nameZh: '天赋异禀', description: '获得3个天赋', icon: '🌟' },
];

// ============================================================
// Event Definitions
// ============================================================
export const GAME_EVENTS: GameEventDef[] = [
  {
    id: 'wishingWell',
    nameZh: '许愿池',
    description: '你发现了一口古老的许愿池，水面泛着神秘的光芒...',
    choices: [
      { textZh: '投入10金币许愿', effectId: 'wish_gold' },
      { textZh: '伸手触碰水面', effectId: 'wish_touch' },
      { textZh: '无视它继续前进', effectId: 'wish_ignore' },
    ],
  },
  {
    id: 'ancientAltar',
    nameZh: '古老祭坛',
    description: '一座石制祭坛矗立在此，上面刻满了古老的符文...',
    choices: [
      { textZh: '献祭10点HP', effectId: 'altar_hp' },
      { textZh: '献祭10点MP', effectId: 'altar_mp' },
      { textZh: '献祭一件物品', effectId: 'altar_item' },
    ],
  },
  {
    id: 'gambler',
    nameZh: '流浪赌徒',
    description: '一个神秘的赌徒向你招手："来试试运气吧！"',
    choices: [
      { textZh: '赌20金币(赢得稀有物品)', effectId: 'gamble_big' },
      { textZh: '赌5金币(赢得普通物品)', effectId: 'gamble_small' },
      { textZh: '拒绝赌博', effectId: 'gamble_refuse' },
    ],
  },
  {
    id: 'woundedTraveler',
    nameZh: '受伤的旅人',
    description: '一个受伤的旅人倒在地上，向你求助...',
    choices: [
      { textZh: '给予食物和药水', effectId: 'traveler_help' },
      { textZh: '搜刮他的财物', effectId: 'traveler_rob' },
      { textZh: '默默离开', effectId: 'traveler_leave' },
    ],
  },
  {
    id: 'mysteryRune',
    nameZh: '神秘符文',
    description: '地上有一个闪烁的符文，似乎蕴含着未知的力量...',
    choices: [
      { textZh: '触摸符文', effectId: 'rune_touch' },
      { textZh: '仔细研究符文', effectId: 'rune_study' },
      { textZh: '绕道而行', effectId: 'rune_avoid' },
    ],
  },
  {
    id: 'treasureChest',
    nameZh: '宝箱',
    description: '你发现了一个精致的宝箱，但似乎有些不对劲...',
    choices: [
      { textZh: '直接打开', effectId: 'chest_open' },
      { textZh: '小心检查后打开', effectId: 'chest_careful' },
      { textZh: '不要冒险', effectId: 'chest_skip' },
    ],
  },
];

// ============================================================
// Biome Configurations
// ============================================================
export const BIOME_CONFIG: Record<Biome, {
  name: string;
  nameZh: string;
  minFloor: number;
  enemyIds: string[];
  hasWater: boolean;
  hasLava: boolean;
  hasGas: boolean;
  trapChance: number;
  shopChance: number;
  eventChance: number;
  mapWidth: number;
  mapHeight: number;
  itemsPerFloorBase: number;
  itemsPerFloorGrowth: number;
  foodDropMultiplier: number;
  scrollDropMultiplier: number;
  potionDropMultiplier: number;
}> = {
  [Biome.StoneDungeon]: {
    name: 'Stone Dungeon', nameZh: '石质地牢', minFloor: 1,
    enemyIds: ['slime', 'rat', 'bat', 'goblin', 'caveScorpion', 'gargoyle', 'skeleton'],
    hasWater: false, hasLava: false, hasGas: false, trapChance: 0.03,
    shopChance: 0.15, eventChance: 0.1,
    mapWidth: 70, mapHeight: 24, itemsPerFloorBase: 5, itemsPerFloorGrowth: 1.2,
    foodDropMultiplier: 1.5, scrollDropMultiplier: 1.3, potionDropMultiplier: 1.0,
  },
  [Biome.CrystalCavern]: {
    name: 'Crystal Cavern', nameZh: '水晶溶洞', minFloor: 6,
    enemyIds: ['skeleton', 'spider', 'orc', 'shadow', 'crystalGuard', 'glowJelly', 'darkKnight', 'wraith'],
    hasWater: true, hasLava: false, hasGas: false, trapChance: 0.04,
    shopChance: 0.2, eventChance: 0.15,
    mapWidth: 80, mapHeight: 28, itemsPerFloorBase: 4, itemsPerFloorGrowth: 1.2,
    foodDropMultiplier: 1.2, scrollDropMultiplier: 1.5, potionDropMultiplier: 1.0,
  },
  [Biome.AncientCrypt]: {
    name: 'Ancient Crypt', nameZh: '远古陵墓', minFloor: 11,
    enemyIds: ['darkKnight', 'wraith', 'troll', 'mimic', 'tombGuard', 'soulEater', 'demon', 'gorgon'],
    hasWater: false, hasLava: false, hasGas: true, trapChance: 0.06,
    shopChance: 0.15, eventChance: 0.2,
    mapWidth: 70, mapHeight: 30, itemsPerFloorBase: 3, itemsPerFloorGrowth: 1.0,
    foodDropMultiplier: 1.0, scrollDropMultiplier: 2.0, potionDropMultiplier: 1.0,
  },
  [Biome.LavaCore]: {
    name: 'Lava Core', nameZh: '熔岩核心', minFloor: 16,
    enemyIds: ['demon', 'gorgon', 'vampire', 'lich', 'lavaWorm', 'obsidianGolem', 'dragon', 'voidWalker'],
    hasWater: false, hasLava: true, hasGas: false, trapChance: 0.05,
    shopChance: 0.1, eventChance: 0.15,
    mapWidth: 90, mapHeight: 28, itemsPerFloorBase: 3, itemsPerFloorGrowth: 0.8,
    foodDropMultiplier: 1.0, scrollDropMultiplier: 1.0, potionDropMultiplier: 1.5,
  },
  [Biome.VoidAbyss]: {
    name: 'Void Abyss', nameZh: '虚空深渊', minFloor: 21,
    enemyIds: ['dragon', 'voidWalker', 'ancientOne', 'voidWeaver', 'mirrorImage'],
    hasWater: false, hasLava: true, hasGas: true, trapChance: 0.07,
    shopChance: 0.08, eventChance: 0.1,
    mapWidth: 100, mapHeight: 32, itemsPerFloorBase: 2, itemsPerFloorGrowth: 0.6,
    foodDropMultiplier: 0.85, scrollDropMultiplier: 1.0, potionDropMultiplier: 0.8,
  },
};

export function getBiomeForFloor(floor: number): Biome {
  if (floor < 6) return Biome.StoneDungeon;
  if (floor < 11) return Biome.CrystalCavern;
  if (floor < 16) return Biome.AncientCrypt;
  if (floor < 21) return Biome.LavaCore;
  return Biome.VoidAbyss;
}

export function getMapSizeForBiome(biome: Biome): { width: number; height: number } {
  const config = BIOME_CONFIG[biome];
  return { width: config.mapWidth, height: config.mapHeight };
}

// ============================================================
// Dungeon Generation Constants
// ============================================================
export const MIN_ROOM_SIZE = 5;
export const MAX_ROOM_SIZE = 12;
export const ROOM_PADDING = 2;
export const MIN_BSP_SIZE = 8;
export const BSP_SPLIT_MIN = 0.35;
export const BSP_SPLIT_MAX = 0.65;
export const ENEMIES_PER_FLOOR_BASE = 4;
export const ENEMIES_PER_FLOOR_GROWTH = 1.5;
export const ITEMS_PER_FLOOR_BASE = 3;
export const ITEMS_PER_FLOOR_GROWTH = 1.2;

// ============================================================
// Inventory
// ============================================================
export const MAX_INVENTORY_SIZE = 20;

// ============================================================
// Trap damage
// ============================================================
export const TRAP_DAMAGE: Record<string, number> = {
  spike: 8,
  fire: 12,
  poison: 6,
  teleport: 0,
};

// ============================================================
// Elemental modifiers
// ============================================================
export const ELEMENTAL_MODIFIER = {
  strong: 1.5,
  weak: 0.5,
  normal: 1.0,
};

export function getElementalModifier(attackElement: Element, defenderWeakness: Element, defenderResistance: Element): number {
  if (attackElement !== Element.None) {
    if (defenderWeakness === attackElement) return ELEMENTAL_MODIFIER.strong;
    if (defenderResistance === attackElement) return ELEMENTAL_MODIFIER.weak;
  }
  return ELEMENTAL_MODIFIER.normal;
}

// ============================================================
// Daily Challenge Seed
// ============================================================
export function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}
