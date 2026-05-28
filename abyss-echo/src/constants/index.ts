import { TileType, Biome, CharacterClass, Rarity, Element, EnemyBehavior, EnemyDef, PotionEffect, ScrollEffect, SkillDef, TalentDef, AchievementDef, GameEventDef, EquipmentEffect, EliteAffix, BossBlessing, HiddenRoomType } from '../types';

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
    baseHp: 35,
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
    baseHp: 30,
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
    baseHp: 25,
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
export const DESCEND_HUNGER_RESTORE = 40;
export const EXP_BASE = 20;
export const EXP_GROWTH = 1.5;

// ============================================================
// Tile Definitions
// ============================================================
export const TILE_CHARS: Record<TileType, { char: string; fg: string; bg: string; walkable: boolean; transparent: boolean }> = {
  [TileType.Wall]:         { char: '█', fg: '#555566', bg: '#555566', walkable: false, transparent: false },
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
  [TileType.TrapParalysis]:{ char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.TrapConfusion]:{ char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.TrapBlind]:    { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.TrapAlarm]:    { char: '·', fg: '#666677', bg: '#111122', walkable: true,  transparent: true },
  [TileType.Shop]:         { char: '$', fg: '#ffcc44', bg: '#111122', walkable: true,  transparent: true },
  [TileType.Event]:        { char: '♣', fg: '#aa44ff', bg: '#111122', walkable: true,  transparent: true },
  [TileType.ShallowWater]: { char: '≈', fg: '#5599dd', bg: '#112244', walkable: true,  transparent: true },
  [TileType.CursedGround]: { char: '·', fg: '#776699', bg: '#151020', walkable: true,  transparent: true },
  [TileType.CooledLava]:   { char: '≈', fg: '#994433', bg: '#221100', walkable: true,  transparent: true },
  [TileType.VoidWall]:     { char: '█', fg: '#442288', bg: '#0a0015', walkable: false, transparent: false },
  [TileType.Portal]:       { char: '⊙', fg: '#cc44ff', bg: '#0a0a1e', walkable: true,  transparent: true },
  [TileType.Torch]:        { char: '♫', fg: '#ffaa44', bg: '#1a221a', walkable: false, transparent: true },
  [TileType.Sarcophagus]:  { char: '■', fg: '#888877', bg: '#1a221a', walkable: false, transparent: false },
  [TileType.Throne]:       { char: '♔', fg: '#ffd700', bg: '#1a0808', walkable: false, transparent: false },
  [TileType.Barricade]:    { char: '▦', fg: '#8b4513', bg: '#1a0808', walkable: false, transparent: true },
  [TileType.WebFloor]:     { char: '≈', fg: '#aaaaaa', bg: '#0a0a1a', walkable: true,  transparent: true },
  [TileType.SpiderEgg]:    { char: '◉', fg: '#cccccc', bg: '#0a0a1a', walkable: true,  transparent: true },
  [TileType.Altar]:        { char: '⛩', fg: '#aaaaff', bg: '#140a14', walkable: true,  transparent: true },
  [TileType.LavaPool]:     { char: '≈', fg: '#ff4400', bg: '#1a0a04', walkable: false, transparent: true },
  [TileType.VoidRift]:     { char: '◎', fg: '#ff44ff', bg: '#100818', walkable: true,  transparent: true },
  [TileType.VoidPillar]:   { char: '█', fg: '#8800aa', bg: '#100818', walkable: false, transparent: false },
  [TileType.CorruptionPool]: { char: '◎', fg: '#aa00aa', bg: '#100818', walkable: true,  transparent: true },
  [TileType.HealCrystal]:  { char: '◆', fg: '#00ffaa', bg: '#100818', walkable: true,  transparent: true },
  [TileType.EliteDoor]:    { char: '▦', fg: '#ffd700', bg: 'transparent', walkable: false, transparent: true },
  [TileType.Fountain]:     { char: '⌠', fg: '#44aaff', bg: 'transparent', walkable: true,  transparent: true },
  [TileType.Inscription]:  { char: '▐', fg: '#ddddaa', bg: 'transparent', walkable: true,  transparent: true },
  [TileType.SecretWall]:   { char: '█', fg: '#555566', bg: '#555566', walkable: true,  transparent: false },
  [TileType.HiddenFloor]:  { char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true,  transparent: false },
  [TileType.Monument]:     { char: '☥', fg: '#ffd700', bg: 'transparent', walkable: true,  transparent: true },
  [TileType.SpikeTrap]:    { char: '▲', fg: '#8888ff', bg: '#222244', walkable: true,  transparent: true },
  [TileType.GoldPile]:           { char: '¤', fg: '#ffcc44', bg: '#1a0a2a', walkable: true,  transparent: true },
  [TileType.MagicSpring]:        { char: '∉', fg: '#44ccff', bg: '#0a1a2a', walkable: true,  transparent: true },
  [TileType.HiddenAltar]:        { char: '☂', fg: '#cc88ff', bg: '#1a0a2a', walkable: true,  transparent: true },
  [TileType.LibraryShelf]:       { char: '≡', fg: '#ccaa66', bg: '#1a0a2a', walkable: true,  transparent: true },
  [TileType.VoidRiftRoom]:       { char: '⊙', fg: '#cc44ff', bg: '#0a0015', walkable: true,  transparent: true },
  [TileType.FungiPatch]:         { char: '♣', fg: '#44cc44', bg: '#0a1a0a', walkable: true,  transparent: true },
  [TileType.HiddenSarcophagus]:  { char: '▶', fg: '#aa8866', bg: '#1a0a2a', walkable: false, transparent: false },
  [TileType.WeaponRack]:   { char: '⋔', fg: '#aaaaaa', bg: '#443322', walkable: false, transparent: false },
  [TileType.Forge]:        { char: '⚒', fg: '#ff8800', bg: '#442200', walkable: false, transparent: false },
  [TileType.SteamVent]:    { char: '≋', fg: '#cccccc', bg: '#445566', walkable: true,  transparent: true },
};

// Biome-specific tile overrides
export const BIOME_TILES: Record<Biome, Partial<Record<TileType, { char?: string; fg?: string; bg?: string }>>> = {
  [Biome.StoneDungeon]: {
    [TileType.Wall]:  { fg: '#555566', bg: '#555566' },
    [TileType.Floor]: { fg: '#666677', bg: '#111122' },
    [TileType.SecretWall]: { char: '█', fg: '#555566', bg: '#555566' },
    [TileType.GoldPile]: { char: '¤', fg: '#ffcc44' },
    [TileType.MagicSpring]: { char: '∉', fg: '#44ccff' },
    [TileType.HiddenAltar]: { char: '☂', fg: '#cc88ff' },
    [TileType.LibraryShelf]: { char: '≡', fg: '#ccaa66' },
    [TileType.VoidRiftRoom]: { char: '⊙', fg: '#cc44ff' },
    [TileType.FungiPatch]: { char: '♣', fg: '#44cc44' },
    [TileType.HiddenSarcophagus]: { char: '▶', fg: '#aa8866' },
  },
  [Biome.CrystalCavern]: {
    [TileType.Wall]:         { char: '▓', fg: '#7766bb', bg: '#7766bb' },
    [TileType.Floor]:        { char: '·', fg: '#9988cc', bg: '#1a0a2e' },
    [TileType.Water]:        { char: '≈', fg: '#88aaff', bg: '#1a1a4e' },
    [TileType.ShallowWater]: { char: '≈', fg: '#88aaff', bg: '#1a1a4e' },
    [TileType.SecretWall]:   { char: '▓', fg: '#7766bb', bg: '#7766bb' },
    [TileType.GoldPile]: { char: '¤', fg: '#ffcc44' },
    [TileType.MagicSpring]: { char: '∉', fg: '#44ccff' },
    [TileType.HiddenAltar]: { char: '☂', fg: '#cc88ff' },
    [TileType.LibraryShelf]: { char: '≡', fg: '#ccaa66' },
    [TileType.VoidRiftRoom]: { char: '⊙', fg: '#cc44ff' },
    [TileType.FungiPatch]: { char: '♣', fg: '#44cc44' },
    [TileType.HiddenSarcophagus]: { char: '▶', fg: '#aa8866' },
  },
  [Biome.AncientCrypt]: {
    [TileType.Wall]:         { char: '█', fg: '#667766', bg: '#667766' },
    [TileType.Floor]:        { char: '·', fg: '#778877', bg: '#0f1a0f' },
    [TileType.Door]:         { char: '▓', fg: '#889966', bg: '#1a221a' },
    [TileType.CursedGround]: { char: '·', fg: '#8877aa', bg: '#151020' },
    [TileType.Torch]:        { char: '♫', fg: '#ffaa44', bg: '#1a221a' },
    [TileType.Sarcophagus]:  { char: '■', fg: '#999988', bg: '#1a221a' },
    [TileType.SecretWall]:   { char: '█', fg: '#667766', bg: '#667766' },
    [TileType.GoldPile]: { char: '¤', fg: '#ffcc44' },
    [TileType.MagicSpring]: { char: '∉', fg: '#44ccff' },
    [TileType.HiddenAltar]: { char: '☂', fg: '#cc88ff' },
    [TileType.LibraryShelf]: { char: '≡', fg: '#ccaa66' },
    [TileType.VoidRiftRoom]: { char: '⊙', fg: '#cc44ff' },
    [TileType.FungiPatch]: { char: '♣', fg: '#44cc44' },
    [TileType.HiddenSarcophagus]: { char: '▶', fg: '#aa8866' },
  },
  [Biome.LavaCore]: {
    [TileType.Wall]:       { char: '▓', fg: '#994422', bg: '#994422' },
    [TileType.Floor]:      { char: '·', fg: '#886644', bg: '#1a0f0a' },
    [TileType.Lava]:       { char: '≈', fg: '#ff6622', bg: '#551100' },
    [TileType.CooledLava]: { char: '≈', fg: '#aa5533', bg: '#221100' },
    [TileType.SecretWall]: { char: '▓', fg: '#994422', bg: '#994422' },
    [TileType.GoldPile]: { char: '¤', fg: '#ffcc44' },
    [TileType.MagicSpring]: { char: '∉', fg: '#44ccff' },
    [TileType.HiddenAltar]: { char: '☂', fg: '#cc88ff' },
    [TileType.LibraryShelf]: { char: '≡', fg: '#ccaa66' },
    [TileType.VoidRiftRoom]: { char: '⊙', fg: '#cc44ff' },
    [TileType.FungiPatch]: { char: '♣', fg: '#44cc44' },
    [TileType.HiddenSarcophagus]: { char: '▶', fg: '#aa8866' },
  },
  [Biome.VoidAbyss]: {
    [TileType.Wall]:  { char: '█', fg: '#6644aa', bg: '#6644aa' },
    [TileType.Floor]: { char: '·', fg: '#8866cc', bg: '#0a0a1e' },
    [TileType.VoidWall]: { char: '█', fg: '#5533aa', bg: '#5533aa' },
    [TileType.Portal]:   { char: '⊙', fg: '#dd55ff', bg: '#0a0a1e' },
    [TileType.SecretWall]: { char: '█', fg: '#6644aa', bg: '#6644aa' },
    [TileType.GoldPile]: { char: '¤', fg: '#ffcc44' },
    [TileType.MagicSpring]: { char: '∉', fg: '#44ccff' },
    [TileType.HiddenAltar]: { char: '☂', fg: '#cc88ff' },
    [TileType.LibraryShelf]: { char: '≡', fg: '#ccaa66' },
    [TileType.VoidRiftRoom]: { char: '⊙', fg: '#cc44ff' },
    [TileType.FungiPatch]: { char: '♣', fg: '#44cc44' },
    [TileType.HiddenSarcophagus]: { char: '▶', fg: '#aa8866' },
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
  { id: 'slime',     name: '史莱姆',   char: '§', fg: '#44cc44', hp: 10, attack: 3,  defense: 0,  exp: 5,  behavior: EnemyBehavior.Swarm,      element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 1,  speed: 1, dropChance: 0.2, alertRadius: 5, goldDrop: 3 },
  { id: 'rat',       name: '巨鼠',     char: 'Я', fg: '#cc9944', hp: 8,  attack: 4,  defense: 0,  exp: 4,  behavior: EnemyBehavior.Swarm,      element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 1,  speed: 2, dropChance: 0.1, alertRadius: 6, goldDrop: 2 },
  { id: 'bat',       name: '蝙蝠',     char: 'ψ', fg: '#aa88cc', hp: 7,  attack: 3,  defense: 1,  exp: 4,  behavior: EnemyBehavior.Cowardly,    element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 1,  speed: 2, dropChance: 0.1, alertRadius: 7, goldDrop: 2 },
  { id: 'goblin',    name: '哥布林',   char: 'ǥ', fg: '#44aa44', hp: 15, attack: 5,  defense: 2,  exp: 8,  behavior: EnemyBehavior.CallAlly,    element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 2,  speed: 1, dropChance: 0.3, alertRadius: 6, goldDrop: 5 },
  { id: 'caveScorpion', name: '洞穴蝎', char: 'π', fg: '#88aa44', hp: 12, attack: 4,  defense: 2,  exp: 6,  behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 1,  speed: 1, dropChance: 0.25, alertRadius: 5, specialAbility: 'poisonSting', goldDrop: 4 },
  { id: 'gargoyle',     name: '石像鬼', char: 'Γ', fg: '#888888', hp: 20, attack: 3,  defense: 5,  exp: 10, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 2,  speed: 1, dropChance: 0.35, alertRadius: 5, specialAbility: 'dormant', attackRange: 3, goldDrop: 8 },
  // Floor 6-10
  { id: 'skeleton',  name: '骷髅',     char: 'S', fg: '#ccccaa', hp: 28, attack: 7,  defense: 5,  exp: 15, behavior: EnemyBehavior.Revive,      element: Element.None,       weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 5,  speed: 1, dropChance: 0.3, alertRadius: 6, goldDrop: 8 },
  { id: 'spider',    name: '巨蛛',     char: '╳', fg: '#664422', hp: 22, attack: 8,  defense: 4,  exp: 12, behavior: EnemyBehavior.Stationary,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 5,  speed: 1, dropChance: 0.25, alertRadius: 5, specialAbility: 'web', attackRange: 3, goldDrop: 6 },
  { id: 'orc',       name: '兽人',     char: 'Ω', fg: '#66aa44', hp: 35, attack: 10, defense: 6,  exp: 20, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 6,  speed: 1, dropChance: 0.35, alertRadius: 5, goldDrop: 12 },
  { id: 'shadow',    name: '暗影',     char: 'ω', fg: '#4444aa', hp: 22, attack: 9,  defense: 4,  exp: 18, behavior: EnemyBehavior.Ambush,      element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 7, speed: 2, dropChance: 0.2, alertRadius: 8, goldDrop: 10 },
  { id: 'crystalGuard', name: '水晶守卫', char: 'C', fg: '#88ccff', hp: 32, attack: 8,  defense: 7,  exp: 16, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 6, speed: 1, dropChance: 0.3, alertRadius: 6, specialAbility: 'reflect', goldDrop: 12 },
  { id: 'glowJelly',    name: '荧光水母', char: 'µ', fg: '#aaffcc', hp: 16, attack: 6,  defense: 2,  exp: 10, behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 6, speed: 1, dropChance: 0.2, alertRadius: 4, specialAbility: 'glare', goldDrop: 5 },
  // Floor 11-15
  { id: 'darkKnight',name: '暗黑骑士', char: 'Ķ', fg: '#4400aa', hp: 50, attack: 14, defense: 10, exp: 35, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 10, speed: 1, dropChance: 0.4, alertRadius: 6, goldDrop: 20 },
  { id: 'wraith',    name: '怨灵',     char: 'R', fg: '#8844cc', hp: 32, attack: 12, defense: 5,  exp: 28, behavior: EnemyBehavior.Revive,      element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 10, speed: 1, dropChance: 0.3, alertRadius: 8, specialAbility: 'drain', goldDrop: 15 },
  { id: 'troll',     name: '巨魔',     char: 'T', fg: '#448844', hp: 60, attack: 11, defense: 9,  exp: 30, behavior: EnemyBehavior.Ambush,      element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 11, speed: 1, dropChance: 0.4, alertRadius: 5, specialAbility: 'regenerate', goldDrop: 18 },
  { id: 'mimic',     name: '宝箱怪',   char: 'M', fg: '#ccaa44', hp: 42, attack: 13, defense: 7,  exp: 32, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 1, speed: 1, dropChance: 0.8, alertRadius: 2, specialAbility: 'surprise', goldDrop: 40 },
  { id: 'graveHound', name: '守墓犬',   char: 'Ð', fg: '#887744', hp: 38, attack: 14, defense: 5,  exp: 28, behavior: EnemyBehavior.CallAlly,     element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 11, speed: 2, dropChance: 0.35, alertRadius: 7, specialAbility: 'howl', goldDrop: 18 },
  { id: 'tombGuard', name: '守墓人', char: 'Š', fg: '#887766', hp: 55, attack: 10, defense: 13, exp: 35, behavior: EnemyBehavior.Revive,      element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 11, speed: 1, dropChance: 0.3, alertRadius: 5, specialAbility: 'patrol', goldDrop: 15 },
  { id: 'soulEater', name: '噬魂者', char: 'Ψ', fg: '#aa66ff', hp: 30, attack: 15, defense: 4,  exp: 30, behavior: EnemyBehavior.Aggressive,  element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 11, speed: 3, dropChance: 0.25, alertRadius: 7, specialAbility: 'phaseThrough', goldDrop: 12 },
  // Floor 16-20
  { id: 'demon',     name: '恶魔',     char: 'Δ', fg: '#cc2222', hp: 65, attack: 16, defense: 11, exp: 50, behavior: EnemyBehavior.Berserk,     element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 15, speed: 1, dropChance: 0.45, alertRadius: 7, specialAbility: 'fireball', goldDrop: 30 },
  { id: 'gorgon',    name: '蛇发女妖', char: 'Φ', fg: '#88aa44', hp: 70, attack: 14, defense: 13, exp: 55, behavior: EnemyBehavior.Aggressive,  element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 16, speed: 1, dropChance: 0.4, alertRadius: 6, specialAbility: 'petrify', goldDrop: 35 },
  { id: 'vampire',   name: '吸血鬼',   char: '√', fg: '#aa2222', hp: 55, attack: 15, defense: 9,  exp: 48, behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 16, speed: 2, dropChance: 0.45, alertRadius: 7, specialAbility: 'drain', goldDrop: 30 },
  { id: 'lich',      name: '巫妖',     char: 'L', fg: '#6644cc', hp: 60, attack: 18, defense: 8,  exp: 60, behavior: EnemyBehavior.CallAlly,     element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 18, speed: 1, dropChance: 0.5, alertRadius: 8, specialAbility: 'summon', goldDrop: 40 },
  { id: 'lavaWorm',     name: '熔岩虫', char: '₩', fg: '#ff6622', hp: 48, attack: 12, defense: 6,  exp: 40, behavior: EnemyBehavior.Berserk,     element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 16, speed: 2, dropChance: 0.3, alertRadius: 6, specialAbility: 'lavaSwim', goldDrop: 18 },
  { id: 'obsidianGolem', name: '黑曜石巨人', char: 'Θ', fg: '#443344', hp: 80, attack: 12, defense: 16, exp: 55, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 16, speed: 0, dropChance: 0.4, alertRadius: 3, specialAbility: 'blockade', goldDrop: 25 },
  // Floor 21+
  { id: 'dragon',    name: '巨龙',     char: 'Ð', fg: '#ff4422', hp: 100,attack: 22, defense: 15, exp: 100,behavior: EnemyBehavior.Aggressive,  element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 20, speed: 1, dropChance: 0.6, alertRadius: 9, specialAbility: 'breath', goldDrop: 60 },
  { id: 'voidWalker',name: '虚空行者', char: 'Ø', fg: '#8844ff', hp: 80, attack: 20, defense: 11, exp: 80, behavior: EnemyBehavior.Aggressive,  element: Element.Lightning,  weakness: Element.None,       resistance: Element.Lightning,   minFloor: 22, speed: 2, dropChance: 0.5, alertRadius: 10, specialAbility: 'teleport', goldDrop: 50 },
  { id: 'ancientOne', name: '远古存在', char: 'A', fg: '#cc44ff', hp: 130,attack: 25, defense: 18, exp: 150,behavior: EnemyBehavior.Boss,       element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 25, speed: 1, dropChance: 1.0, alertRadius: 12, specialAbility: 'eldritch', goldDrop: 100 },
  { id: 'voidWeaver',   name: '虚空织者', char: 'Λ', fg: '#cc44ff', hp: 72, attack: 18, defense: 9,  exp: 70, behavior: EnemyBehavior.Split,       element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 21, speed: 2, dropChance: 0.35, alertRadius: 8, specialAbility: 'blink', goldDrop: 22 },
  { id: 'mirrorImage',  name: '镜像体', char: '©', fg: '#ff44ff', hp: 1,  attack: 0,  defense: 0,  exp: 5,  behavior: EnemyBehavior.Aggressive,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 21, speed: 1, dropChance: 0,    alertRadius: 10, specialAbility: 'mirrorExplode', goldDrop: 0 },
];

// Boss definitions (every 5 floors) - BUG FIX: defId now matches lookup
export const BOSS_DEFS: (EnemyDef & { isBoss: true })[] = [
  { id: 'goblinKing',   name: '哥布林王',   char: '₲', fg: '#ffcc44', hp: 50,  attack: 12, defense: 7,  exp: 50,  behavior: EnemyBehavior.Boss, element: Element.None,       weakness: Element.Fire,       resistance: Element.None,       minFloor: 5,  speed: 1, dropChance: 1.0, alertRadius: 8, isBoss: true, specialAbility: 'summon', goldDrop: 50 },
  { id: 'spiderQueen',  name: '蜘蛛女王',   char: 'Q', fg: '#884422', hp: 95,  attack: 16, defense: 9,  exp: 80,  behavior: EnemyBehavior.Boss, element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 10, speed: 1, dropChance: 1.0, alertRadius: 8, isBoss: true, specialAbility: 'web', goldDrop: 80 },
  { id: 'deathKnight',  name: '死亡骑士',   char: 'Ҝ', fg: '#cc44aa', hp: 150, attack: 24, defense: 15, exp: 150, behavior: EnemyBehavior.Boss, element: Element.Ice,        weakness: Element.Fire,       resistance: Element.Ice,        minFloor: 15, speed: 1, dropChance: 1.0, alertRadius: 8, isBoss: true, specialAbility: 'drain', goldDrop: 120 },
  { id: 'demonLord',    name: '恶魔领主',   char: '&', fg: '#ff2222', hp: 190, attack: 30, defense: 17, exp: 250, behavior: EnemyBehavior.Boss, element: Element.Fire,       weakness: Element.Ice,        resistance: Element.Fire,       minFloor: 20, speed: 1, dropChance: 1.0, alertRadius: 10, isBoss: true, specialAbility: 'fireball', goldDrop: 200 },
  { id: 'abyssKing',    name: '深渊之王',   char: 'Å', fg: '#ff44ff', hp: 280, attack: 38, defense: 20, exp: 500, behavior: EnemyBehavior.Boss, element: Element.Poison,     weakness: Element.Fire,       resistance: Element.Poison,     minFloor: 25, speed: 1, dropChance: 1.0, alertRadius: 12, isBoss: true, specialAbility: 'eldritch', goldDrop: 500 },
  { id: 'abyssHeart', name: '深渊之心', char: 'Ω', fg: '#ffffff', hp: 400, attack: 32, defense: 20, exp: 800, behavior: EnemyBehavior.Boss, element: Element.Poison, weakness: Element.Fire, resistance: Element.Poison, minFloor: 30, speed: 1, dropChance: 1.0, alertRadius: 12, isBoss: true, specialAbility: 'voidRay', goldDrop: 600 },
];

export interface BossPhaseConfig {
  nameZh: string;
  hpThreshold: number;
  atkBonus: number;
  defBonus: number;
  speedOverride?: number;
  defOverride?: number;
  newAbilities: string[];
  summonOnTransition?: { defId: string; count: number };
  messageZh: string;
}

export const BOSS_PHASES: Record<string, BossPhaseConfig[]> = {
  goblinKing: [
    { nameZh: '军令', hpThreshold: 0.5, atkBonus: 3, defBonus: 0, speedOverride: 2, newAbilities: ['warCry', 'throwNet'], messageZh: '哥布林王进入了【军令】阶段！' },
    { nameZh: '疯狂冲锋', hpThreshold: 0.25, atkBonus: 4, defBonus: -3, newAbilities: [], summonOnTransition: { defId: 'goblin', count: 2 }, messageZh: '哥布林王进入了【疯狂冲锋】阶段！' },
  ],
  spiderQueen: [
    { nameZh: '毒雾', hpThreshold: 0.5, atkBonus: 3, defBonus: 0, newAbilities: ['poisonMist'], messageZh: '蜘蛛女王进入了【毒雾】阶段！' },
    { nameZh: '蛛后之怒', hpThreshold: 0.25, atkBonus: 4, defBonus: 0, speedOverride: 2, newAbilities: ['cocoon'], messageZh: '蜘蛛女王进入了【蛛后之怒】阶段！' },
  ],
  deathKnight: [
    { nameZh: '亡者苏醒', hpThreshold: 0.5, atkBonus: 3, defBonus: -2, newAbilities: ['raiseDead'], messageZh: '死亡骑士进入了【亡者苏醒】阶段！' },
    { nameZh: '灵魂收割', hpThreshold: 0.25, atkBonus: 6, defBonus: -4, newAbilities: [], messageZh: '死亡骑士进入了【灵魂收割】阶段！' },
  ],
  demonLord: [
    { nameZh: '炼狱', hpThreshold: 0.5, atkBonus: 0, defBonus: 0, speedOverride: 2, newAbilities: ['infernalFire', 'summonLavaWorm'], messageZh: '恶魔领主进入了【炼狱】阶段！' },
    { nameZh: '末日', hpThreshold: 0.25, atkBonus: 6, defBonus: -4, newAbilities: ['infernalCharge'], summonOnTransition: { defId: 'lavaWorm', count: 2 }, messageZh: '恶魔领主进入了【末日】阶段！' },
  ],
  abyssKing: [
    { nameZh: '维度裂隙', hpThreshold: 0.5, atkBonus: 0, defBonus: 0, speedOverride: 2, newAbilities: ['dimensionTear', 'summonVoidWeaver'], messageZh: '深渊之王进入了【维度裂隙】阶段！' },
    { nameZh: '湮灭', hpThreshold: 0.25, atkBonus: 5, defBonus: -5, newAbilities: ['annihilate'], messageZh: '深渊之王进入了【湮灭】阶段！' },
  ],
  abyssHeart: [
    { nameZh: '吞噬', hpThreshold: 0.5, atkBonus: 0, defBonus: 5, speedOverride: 2, newAbilities: ['devourMinion', 'voidPulse', 'summonVoidWeaver2'], messageZh: '深渊之心进入了【吞噬】阶段！' },
    { nameZh: '终焉', hpThreshold: 0.25, atkBonus: 10, defBonus: 0, defOverride: 5, speedOverride: 3, newAbilities: ['corrodeAll'], messageZh: '深渊之心进入了【终焉】阶段！' },
  ],
};

export const BOSS_PASSIVES: Record<string, { id: string; nameZh: string; description: string; effect: string }[]> = {
  goblinKing: [
    { id: 'packLeader', nameZh: '群首', description: '同房间小怪存活时ATK+3', effect: 'minionAtkBonus' },
  ],
};

export const ELITE_AFFIX_DEFS: Record<EliteAffix, { nameZh: string; description: string }> = {
  [EliteAffix.Armored]: { nameZh: '铁甲', description: '受到物理伤害-30%' },
  [EliteAffix.Frenzy]: { nameZh: '狂乱', description: '每回合ATK+0.5' },
  [EliteAffix.Regen]: { nameZh: '再生', description: '每回合恢复5%最大HP' },
  [EliteAffix.Vampiric]: { nameZh: '吸血', description: '攻击回复30%伤害HP' },
  [EliteAffix.Explosive]: { nameZh: '爆裂', description: '死亡时对周围2格造成ATK×1.5伤害' },
  [EliteAffix.Phantom]: { nameZh: '幽影', description: '30%闪避攻击' },
};

export const ELITE_CHANCE_PER_FLOOR = 0.3;
export const ENEMY_SPECIAL_CHANCE = 0.3;
export const ELITE_REGEN_RATE = 0.05;
export const ELITE_HP_MULT = 2.0;
export const ELITE_ATK_MULT = 1.5;
export const ELITE_DEF_BONUS_SCALE = [3, 5, 8, 10, 12]; // per biome tier: Stone, Crystal, Crypt, Lava, Void
export const ELITE_EXP_MULT = 2.5;
export const ELITE_GOLD_MULT = 3.0;

export function getEliteDefBonus(floor: number): number {
  const biomeIdx = floor < 6 ? 0 : floor < 11 ? 1 : floor < 16 ? 2 : floor < 21 ? 3 : 4;
  return ELITE_DEF_BONUS_SCALE[biomeIdx];
}

export const FLOOR_DESCRIPTIONS: Record<number, string> = {
  1: '潮湿的石壁上渗出冰冷的水珠，火把的光芒在黑暗中摇曳。你的冒险从这里开始。',
  2: '走廊深处传来老鼠的吱吱声，空气中弥漫着陈旧的霉味。',
  3: '墙壁上的抓痕越来越深，似乎有什么东西在黑暗中窥视着你。',
  4: '远处传来金属碰撞的声响，和低沉的、不似人类的笑声。',
  5: '王座大厅的大门就在前方。门后传来号令声和战鼓的节奏——哥布林王在等待。',
  6: '水晶从四面八方生长，折射出诡异的蓝光。地面覆盖着薄薄的冰霜，每一步都发出清脆的碎裂声。',
  7: '洞壁上的水晶脉动如心脏般律动，幽蓝的光芒忽明忽暗。',
  8: '空气中飘浮着微小的冰晶，呼吸间能感到肺部一阵刺痛。',
  9: '细密的蛛网从穹顶垂落，在蓝光中泛着银色的微光。有些丝线上还挂着…不，你不想知道那是什么。',
  10: '一片巨大的蛛网覆盖了整个穹顶，中央的阴影中有什么在缓缓蠕动。蛛丝振动着，像是在迎接猎物。',
  11: '石棺整齐地排列在两侧，空气中弥漫着防腐香料的气味。这里安静得令人不安。',
  12: '墓壁上的浮雕描绘着一场古老的战争，战士们的表情永远定格在恐惧之中。',
  13: '地面散落着破碎的骨骸和锈蚀的武器。某些骨骸…似乎在微微移动。',
  14: '黑暗中传来锁链拖地的声音，和低沉的、不似活物的叹息。',
  15: '陵墓最深处，一座巨大的石棺散发着死亡的寒气。棺盖上的骑士浮雕缓缓睁开了眼睛。',
  16: '空气灼热得令人窒息，地面裂缝中涌出赤红的岩浆。你感到自己的盔甲在发烫。',
  17: '岩浆河流从墙缝中渗出，空气中弥漫着硫磺的气味。远处传来恶魔的嚎叫。',
  18: '一阵灼热的风暴席卷而过，灰烬落在你的肩头。地面在你的脚下颤抖。',
  19: '恶魔的低语在耳边回响，试图侵蚀你的意志。你的影子似乎不再听从你的动作。',
  20: '炼狱深处，巨大的恶魔端坐在熔岩王座上，双瞳如两团烈焰。"又一个灵魂…来为我燃烧。"',
  21: '现实开始扭曲。墙壁在呼吸，地面在脉动，你的手穿过了一张桌子。',
  22: '时间在这里失去了意义。你看到自己的影子在不同方向行走，它们似乎有自己的意志。',
  23: '虚空在吞噬一切——光、声音、记忆。你开始忘记来时的路，但脚步无法停下。',
  24: '维度的裂隙撕裂了空间，你看到另一个自己在裂隙对面，面容扭曲，嘴角上扬。',
  25: '深渊的尽头，一个不属于这个维度的存在注视着你。"你终于来了，回响者。"',
  30: '一切归于寂静。没有光，没有暗，没有声音。只有一种不可名状的存在感，像宇宙的心跳。深渊之心在这里等待了亿万年——不是为了毁灭，而是为了被理解。但理解它的代价，是失去自己。',
};

export const INSCRIPTION_TEXTS: Record<string, string> = {
  stoneDungeon: '这里曾是王国的地牢，关押着最危险的犯人。直到那个夜晚，地底传来了回响…从此再无人离开。',
  crystalCavern: '水晶并非天然形成。古帝国的法师们将魔法封印其中，以抵御来自更深处的侵蚀。但水晶在碎裂…',
  ancientCrypt: '亡者不愿安息。他们被某种力量唤醒，在永恒的黑暗中游荡。击碎他们的不是死亡，而是希望。',
  lavaCore: '炼狱之火并非惩罚，而是选择。只有最强大的灵魂才能在烈焰中重塑。其他的，只会化为灰烬。',
  voidAbyss: '深渊不是尽头。深渊是开始。一切从虚空中诞生，一切终将回归。你是回响，还是回响的回响？',
};

export interface BossBlessingDef {
  id: BossBlessing;
  nameZh: string;
  description: string;
  icon: string;
}

export const BOSS_BLESSING_OPTIONS: Record<string, [BossBlessingDef, BossBlessingDef]> = {
  goblinKing: [
    { id: BossBlessing.Headhunter, nameZh: '猎首者', description: '对精英/小怪伤害+15%', icon: '🗡️' },
    { id: BossBlessing.TribalHeart, nameZh: '部落之心', description: '有小怪在场时DEF+3', icon: '🛡️' },
  ],
  spiderQueen: [
    { id: BossBlessing.WebWeaver, nameZh: '织网者', description: '攻击15%冰冻敌人1回合', icon: '🕷️' },
    { id: BossBlessing.VenomBlood, nameZh: '毒液之血', description: '受到近战伤害时30%反毒', icon: '☠️' },
  ],
  deathKnight: [
    { id: BossBlessing.UndyingWill, nameZh: '不灭意志', description: 'HP<25%时ATK+30%', icon: '⚔️' },
    { id: BossBlessing.DeathPact, nameZh: '死亡契约', description: '击杀回复5%最大HP', icon: '💀' },
  ],
  demonLord: [
    { id: BossBlessing.InfernalSoul, nameZh: '炼狱之魂', description: '火伤减免50%，近战15%燃烧', icon: '🔥' },
    { id: BossBlessing.DemonPower, nameZh: '恶魔之力', description: '技能伤害+20%', icon: '💪' },
  ],
  abyssKing: [
    { id: BossBlessing.VoidWalk, nameZh: '虚空行走', description: '每层开始获得3回合随机buff', icon: '🌀' },
    { id: BossBlessing.AbyssEye, nameZh: '深渊之眼', description: '视野范围+2', icon: '👁️' },
  ],
  abyssHeart: [
    { id: BossBlessing.EchoBody, nameZh: '回响之体', description: '全属性+3', icon: '💎' },
    { id: BossBlessing.FinalPact, nameZh: '终焉之约', description: '每层首次致命伤害保留1HP(每层1次)', icon: '🌟' },
  ],
};

// ============================================================
// Item Definitions
// ============================================================
export const WEAPON_DEFS = [
  // ---- Common (1-2层) ----
  { name: '匕首',       char: '/', fg: '#aaaaaa', damage: 3,  element: Element.None,      rarity: Rarity.Common,    bonusStat: 'dex' as const },
  { name: '短剑',       char: '/', fg: '#aaaaaa', damage: 5,  element: Element.None,      rarity: Rarity.Common,    bonusStat: 'str' as const },
  { name: '木棒',       char: '/', fg: '#886644', damage: 4,  element: Element.None,      rarity: Rarity.Common,    bonusStat: 'str' as const },
  { name: '学徒法杖',   char: '/', fg: '#886644', damage: 2,  element: Element.None,      rarity: Rarity.Common,    bonusStat: 'int' as const },
  { name: '猎人匕首',   char: '/', fg: '#88aa88', damage: 4,  element: Element.None,      rarity: Rarity.Common,    bonusStat: 'dex' as const },
  // ---- Good (3-7层) ----
  { name: '长剑',       char: '/', fg: '#cccccc', damage: 8,  element: Element.None,      rarity: Rarity.Good,      bonusStat: 'str' as const },
  { name: '战斧',       char: '/', fg: '#ccaa44', damage: 10, element: Element.None,      rarity: Rarity.Good,      bonusStat: 'str' as const },
  { name: '铁矛',       char: '/', fg: '#aaaaaa', damage: 7,  element: Element.None,      rarity: Rarity.Good,      bonusStat: 'str' as const },
  { name: '秘银法杖',   char: '/', fg: '#88aacc', damage: 3,  element: Element.None,      rarity: Rarity.Good,      bonusStat: 'int' as const },
  { name: '刺客短刃',   char: '/', fg: '#88aa88', damage: 6,  element: Element.None,      rarity: Rarity.Good,      bonusStat: 'dex' as const },
  // ---- Rare (8-14层) ----
  { name: '火焰之剑',   char: '/', fg: '#ff6644', damage: 9,  element: Element.Fire,      rarity: Rarity.Rare,      bonusStat: 'str' as const },
  { name: '寒冰之刃',   char: '/', fg: '#44aaff', damage: 9,  element: Element.Ice,       rarity: Rarity.Rare,      bonusStat: 'dex' as const },
  { name: '雷霆之锤',   char: '/', fg: '#cccc44', damage: 11, element: Element.Lightning, rarity: Rarity.Rare,      bonusStat: 'str' as const },
  { name: '毒蛇之牙',   char: '/', fg: '#44cc44', damage: 7,  element: Element.Poison,    rarity: Rarity.Rare,      bonusStat: 'dex' as const, guaranteedEffect: EquipmentEffect.StatusProc as const },
  { name: '符文长剑',   char: '/', fg: '#88aaff', damage: 8,  element: Element.None,      rarity: Rarity.Rare,      bonusStat: 'int' as const },
  { name: '烈焰法杖',   char: '/', fg: '#ff6644', damage: 5,  element: Element.Fire,      rarity: Rarity.Rare,      bonusStat: 'int' as const },
  { name: '寒冰法杖',   char: '/', fg: '#44aaff', damage: 5,  element: Element.Ice,       rarity: Rarity.Rare,      bonusStat: 'int' as const },
  { name: '雷霆法杖',   char: '/', fg: '#cccc44', damage: 5,  element: Element.Lightning,  rarity: Rarity.Rare,      bonusStat: 'int' as const },
  { name: '暗杀匕首',   char: '/', fg: '#884488', damage: 8,  element: Element.None,      rarity: Rarity.Rare,      bonusStat: 'dex' as const, guaranteedEffect: EquipmentEffect.CritBonus as const },
  { name: '火焰战斧',   char: '/', fg: '#ff8844', damage: 12, element: Element.Fire,      rarity: Rarity.Rare,      bonusStat: 'str' as const },
  // ---- Epic (15-19层) ----
  { name: '暗影匕首',   char: '/', fg: '#8844cc', damage: 12, element: Element.Poison,    rarity: Rarity.Epic,      bonusStat: 'dex' as const },
  { name: '毁灭之斧',   char: '/', fg: '#ff4444', damage: 16, element: Element.Fire,      rarity: Rarity.Epic,      bonusStat: 'str' as const },
  { name: '暗影法杖',   char: '/', fg: '#8844cc', damage: 7,  element: Element.Poison,    rarity: Rarity.Epic,      bonusStat: 'int' as const },
  { name: '吸血鬼之牙', char: '/', fg: '#cc4444', damage: 10, element: Element.None,      rarity: Rarity.Epic,      bonusStat: 'dex' as const, guaranteedEffect: EquipmentEffect.LifeSteal as const },
  { name: '魔导书',     char: '/', fg: '#4488ff', damage: 6,  element: Element.Lightning,  rarity: Rarity.Epic,      bonusStat: 'int' as const, guaranteedEffect: EquipmentEffect.ManaSteal as const },
  { name: '雷霆战锤',   char: '/', fg: '#cccc44', damage: 14, element: Element.Lightning, rarity: Rarity.Epic,      bonusStat: 'str' as const },
  { name: '寒冰长矛',   char: '/', fg: '#44aaff', damage: 13, element: Element.Ice,       rarity: Rarity.Epic,      bonusStat: 'dex' as const },
  { name: '处刑之斧',   char: '/', fg: '#ff4444', damage: 15, element: Element.None,      rarity: Rarity.Epic,      bonusStat: 'str' as const, guaranteedEffect: EquipmentEffect.KillReset as const },
  // ---- Legendary (20+层) ----
  { name: '深渊之刃',   char: '/', fg: '#ff44ff', damage: 20, element: Element.Poison,    rarity: Rarity.Legendary, bonusStat: 'str' as const },
  { name: '虚空法杖',   char: '/', fg: '#ff44ff', damage: 10, element: Element.None,      rarity: Rarity.Legendary, bonusStat: 'int' as const },
  { name: '永冻之枪',   char: '/', fg: '#44ccff', damage: 18, element: Element.Ice,       rarity: Rarity.Legendary, bonusStat: 'dex' as const },
  { name: '灭世战锤',   char: '/', fg: '#ff4444', damage: 22, element: Element.Fire,      rarity: Rarity.Legendary, bonusStat: 'str' as const },
  { name: '命运匕首',   char: '/', fg: '#ffcc44', damage: 14, element: Element.None,      rarity: Rarity.Legendary, bonusStat: 'dex' as const, guaranteedEffect: EquipmentEffect.CritBonus as const },
  { name: '创世之杖',   char: '/', fg: '#ffcc44', damage: 9,  element: Element.Lightning,  rarity: Rarity.Legendary, bonusStat: 'int' as const, guaranteedEffect: EquipmentEffect.ManaSteal as const },
];

export const ARMOR_DEFS = [
  // ---- Common (1-2层) ----
  { name: '布甲',       char: '[', fg: '#aaaaaa', defense: 2,  evasion: 0,  rarity: Rarity.Common,    bonusStat: 'int' as const },
  { name: '皮甲',       char: '[', fg: '#aa8844', defense: 4,  evasion: 2,  rarity: Rarity.Common,    bonusStat: 'dex' as const },
  { name: '锁子甲',     char: '[', fg: '#cccccc', defense: 6,  evasion: -1, rarity: Rarity.Common,    bonusStat: 'vit' as const },
  { name: '学者长袍',   char: '[', fg: '#88aacc', defense: 3,  evasion: 1,  rarity: Rarity.Common,    bonusStat: 'int' as const },
  // ---- Good (3-7层) ----
  { name: '板甲',       char: '[', fg: '#888899', defense: 9,  evasion: -3, rarity: Rarity.Good,      bonusStat: 'vit' as const },
  { name: '猎手皮甲',   char: '[', fg: '#88aa44', defense: 5,  evasion: 4,  rarity: Rarity.Good,      bonusStat: 'dex' as const },
  { name: '符文布甲',   char: '[', fg: '#8866aa', defense: 4,  evasion: 2,  rarity: Rarity.Good,      bonusStat: 'int' as const },
  // ---- Rare (8-14层) ----
  { name: '暗影长袍',   char: '[', fg: '#4444aa', defense: 5,  evasion: 5,  rarity: Rarity.Rare,      bonusStat: 'int' as const },
  { name: '精灵皮甲',   char: '[', fg: '#44aa44', defense: 6,  evasion: 6,  rarity: Rarity.Rare,      bonusStat: 'dex' as const },
  { name: '精钢铠甲',   char: '[', fg: '#aaaacc', defense: 10, evasion: -2, rarity: Rarity.Rare,      bonusStat: 'vit' as const },
  { name: '火焰护甲',   char: '[', fg: '#ff6644', defense: 8,  evasion: 0,  rarity: Rarity.Rare,      bonusStat: 'vit' as const, guaranteedEffect: EquipmentEffect.ElementResist as const },
  { name: '反刺皮甲',   char: '[', fg: '#aa4444', defense: 6,  evasion: 3,  rarity: Rarity.Rare,      bonusStat: 'dex' as const, guaranteedEffect: EquipmentEffect.Thorns as const },
  // ---- Epic (15-19层) ----
  { name: '龙鳞甲',     char: '[', fg: '#ff4422', defense: 12, evasion: -2, rarity: Rarity.Epic,      bonusStat: 'vit' as const },
  { name: '暗夜之袍',   char: '[', fg: '#6644aa', defense: 7,  evasion: 7,  rarity: Rarity.Epic,      bonusStat: 'int' as const, guaranteedEffect: EquipmentEffect.DodgeMana as const },
  { name: '不朽铠甲',   char: '[', fg: '#ccaa44', defense: 14, evasion: -3, rarity: Rarity.Epic,      bonusStat: 'vit' as const, guaranteedEffect: EquipmentEffect.DamageShield as const },
  { name: '幻影皮甲',   char: '[', fg: '#88ccaa', defense: 8,  evasion: 8,  rarity: Rarity.Epic,      bonusStat: 'dex' as const },
  // ---- Legendary (20+层) ----
  { name: '虚空之铠',   char: '[', fg: '#ff44ff', defense: 15, evasion: 0,  rarity: Rarity.Legendary, bonusStat: 'vit' as const },
  { name: '星辰法袍',   char: '[', fg: '#ffcc44', defense: 10, evasion: 8,  rarity: Rarity.Legendary, bonusStat: 'int' as const, guaranteedEffect: EquipmentEffect.CooldownReduce as const },
  { name: '影舞者之衣', char: '[', fg: '#44ffaa', defense: 9,  evasion: 12, rarity: Rarity.Legendary, bonusStat: 'dex' as const, guaranteedEffect: EquipmentEffect.DodgeMana as const },
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
  { name: '感知卷轴',   unidentifiedName: '带有警告符号的纸卷', char: '?', fg: '#88ff88', effect: ScrollEffect.Detection,   power: 1,  rarity: Rarity.Common },
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
    { id: 'shieldBash', name: 'Shield Bash', nameZh: '盾击', description: '击退并眩晕相邻敌人，造成少量伤害', mpCost: 5, maxCooldown: 3, element: Element.None, range: 1, radius: 0, power: 3, key: 'z', icon: '🛡' },
    { id: 'warCry', name: 'War Cry', nameZh: '战吼', description: '提升5点防御，持续5回合', mpCost: 8, maxCooldown: 6, element: Element.None, range: 0, radius: 0, power: 5, key: 'x', icon: '📢' },
    { id: 'whirlwind', name: 'Whirlwind', nameZh: '旋风斩', description: '攻击周围所有敌人，造成2倍武器伤害', mpCost: 10, maxCooldown: 6, element: Element.None, range: 0, radius: 1, power: 2, key: 'c', icon: '🌀' },
  ],
  [CharacterClass.Mage]: [
    { id: 'fireball', name: 'Fireball', nameZh: '火球术', description: '对视野内敌人发射火球，造成范围伤害', mpCost: 7, maxCooldown: 5, element: Element.Fire, range: 4, radius: 1, power: 10, key: 'z', icon: '🔥' },
    { id: 'iceShield', name: 'Ice Shield', nameZh: '冰盾', description: '获得5点防御和冰冻免疫，持续5回合', mpCost: 6, maxCooldown: 6, element: Element.Ice, range: 0, radius: 0, power: 5, key: 'x', icon: '🧊' },
    { id: 'chainLightning', name: 'Chain Lightning', nameZh: '闪电链', description: '对最近3个敌人释放闪电', mpCost: 10, maxCooldown: 6, element: Element.Lightning, range: 6, radius: 0, power: 9, key: 'c', icon: '⚡' },
  ],
  [CharacterClass.Rogue]: [
    { id: 'shadowStep', name: 'Shadow Step', nameZh: '暗影步', description: '瞬移到最近敌人身边并造成2倍暴击', mpCost: 6, maxCooldown: 3, element: Element.None, range: 6, radius: 0, power: 2, key: 'z', icon: '👤' },
    { id: 'poisonBlade', name: 'Poison Blade', nameZh: '毒刃', description: '下一次攻击附带剧毒(5伤害/4回合)', mpCost: 4, maxCooldown: 3, element: Element.Poison, range: 0, radius: 0, power: 5, key: 'x', icon: '🗡' },
    { id: 'fanOfKnives', name: 'Fan of Knives', nameZh: '扇刃', description: '对2格内所有敌人造成伤害', mpCost: 8, maxCooldown: 5, element: Element.None, range: 0, radius: 2, power: 14, key: 'c', icon: '🔪' },
  ],
};

// ============================================================
// Talent Definitions
// ============================================================
export const TALENT_DEFS: TalentDef[] = [
  // Generic talents
  { id: 'ironStomach', name: 'Iron Stomach', nameZh: '铁胃', description: '饥饿伤害减半（3→1/回合）', icon: '🍖' },
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
  { id: 'ironWill', name: 'Iron Will', nameZh: '铁壁意志', description: '免疫混乱与麻痹效果', icon: '🧠', classRequired: CharacterClass.Warrior },
  // Mage-specific
  { id: 'spellPenetration', name: 'Spell Penetration', nameZh: '法术穿透', description: '魔法无视50%防御', icon: '🔮', classRequired: CharacterClass.Mage },
  { id: 'arcaneResonance', name: 'Arcane Resonance', nameZh: '奥术共鸣', description: '卷轴效果+30%', icon: '📖', classRequired: CharacterClass.Mage },
  { id: 'manaShield', name: 'Mana Shield', nameZh: '法力护盾', description: '受到伤害时30%由MP承担', icon: '🔷', classRequired: CharacterClass.Mage },
  // Rogue-specific
  { id: 'evasionMaster', name: 'Evasion Master', nameZh: '闪避大师', description: '闪避率额外+10%', icon: '💨', classRequired: CharacterClass.Rogue },
  { id: 'toxicBlade', name: 'Toxic Blade', nameZh: '淬毒', description: '攻击20%概率附加中毒', icon: '☠', classRequired: CharacterClass.Rogue },
  { id: 'trapSense', name: 'Trap Sense', nameZh: '陷阱感知', description: '视野内陷阱自动显形', icon: '👁', classRequired: CharacterClass.Rogue },
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
  { id: 'floor30', name: 'Abyss Conqueror', nameZh: '深渊征服者', description: '到达第30层', icon: '💠' },
  { id: 'bossSlayer', name: 'Boss Slayer', nameZh: 'Boss杀手', description: '击败一个Boss', icon: '👑' },
  { id: 'bossMaster', name: 'Boss Master', nameZh: 'Boss征服者', description: '击败3个Boss', icon: '🏆' },
  { id: 'rich', name: 'Gold Hoarder', nameZh: '守财奴', description: '累计拥有100金币', icon: '💰' },
  { id: 'legendary', name: 'Legendary Find', nameZh: '传说发现', description: '获得一件传说级物品', icon: '✨' },
  { id: 'pacifist10', name: 'Pacifist', nameZh: '和平主义者', description: '不杀敌通过10层', icon: '🕊' },
  { id: 'glutton', name: 'Well Fed', nameZh: '丰衣足食', description: '饱食度始终高于150到达5层', icon: '🍖' },
  { id: 'skillMaster', name: 'Skill Master', nameZh: '技能大师', description: '使用技能50次', icon: '⚡' },
  { id: 'shopper', name: 'Shopper', nameZh: '精明买家', description: '在商店购买5件物品', icon: '🛒' },
  { id: 'talent3', name: 'Gifted', nameZh: '天赋异禀', description: '获得3个天赋', icon: '🌟' },
  { id: 'mimicSlayer', name: 'Mimic Slayer', nameZh: '虚假宝藏', description: '击败一只宝箱怪', icon: '🎭' },
  { id: 'mimicHunter', name: 'Mimic Hunter', nameZh: '诱饵猎人', description: '击败10只宝箱怪', icon: '🗡' },
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
    mapWidth: 80, mapHeight: 28, itemsPerFloorBase: 7, itemsPerFloorGrowth: 1.5,
    foodDropMultiplier: 1.2, scrollDropMultiplier: 1.3, potionDropMultiplier: 1.0,
  },
  [Biome.CrystalCavern]: {
    name: 'Crystal Cavern', nameZh: '水晶溶洞', minFloor: 6,
    enemyIds: ['skeleton', 'spider', 'orc', 'shadow', 'crystalGuard', 'glowJelly', 'darkKnight', 'wraith'],
    hasWater: true, hasLava: false, hasGas: false, trapChance: 0.04,
    shopChance: 0.2, eventChance: 0.15,
    mapWidth: 90, mapHeight: 32, itemsPerFloorBase: 4, itemsPerFloorGrowth: 1.2,
    foodDropMultiplier: 1.1, scrollDropMultiplier: 1.5, potionDropMultiplier: 1.0,
  },
  [Biome.AncientCrypt]: {
    name: 'Ancient Crypt', nameZh: '远古陵墓', minFloor: 11,
    enemyIds: ['darkKnight', 'wraith', 'troll', 'graveHound', 'tombGuard', 'soulEater', 'demon', 'gorgon'],
    hasWater: false, hasLava: false, hasGas: true, trapChance: 0.06,
    shopChance: 0.15, eventChance: 0.2,
    mapWidth: 80, mapHeight: 34, itemsPerFloorBase: 3, itemsPerFloorGrowth: 1.0,
    foodDropMultiplier: 1.2, scrollDropMultiplier: 2.0, potionDropMultiplier: 1.0,
  },
  [Biome.LavaCore]: {
    name: 'Lava Core', nameZh: '熔岩核心', minFloor: 16,
    enemyIds: ['demon', 'gorgon', 'vampire', 'lich', 'lavaWorm', 'obsidianGolem', 'dragon', 'voidWalker'],
    hasWater: false, hasLava: true, hasGas: false, trapChance: 0.05,
    shopChance: 0.1, eventChance: 0.15,
    mapWidth: 100, mapHeight: 32, itemsPerFloorBase: 3, itemsPerFloorGrowth: 0.8,
    foodDropMultiplier: 1.3, scrollDropMultiplier: 1.0, potionDropMultiplier: 1.5,
  },
  [Biome.VoidAbyss]: {
    name: 'Void Abyss', nameZh: '虚空深渊', minFloor: 21,
    enemyIds: ['dragon', 'voidWalker', 'ancientOne', 'voidWeaver', 'mirrorImage'],
    hasWater: false, hasLava: true, hasGas: true, trapChance: 0.07,
    shopChance: 0.08, eventChance: 0.1,
    mapWidth: 110, mapHeight: 36, itemsPerFloorBase: 2, itemsPerFloorGrowth: 0.6,
    foodDropMultiplier: 1.4, scrollDropMultiplier: 1.0, potionDropMultiplier: 0.8,
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

export const SPECIAL_ROOM_CHANCES = {
  eliteRoom: 0.4,
  treasureRoom: 0.15,
  fountainRoom: 0.1,
  altarRoom: 0.1,
  inscriptionRoom: 0.2,
  trapRoom: 0.15,
  challengeRoom: 0.08,
};

// Hidden room type weights (out of 100 total)
export const HIDDEN_ROOM_WEIGHTS: Record<HiddenRoomType, number> = {
  [HiddenRoomType.Slaughterhouse]: 15,
  [HiddenRoomType.Treasury]:       15,
  [HiddenRoomType.Armory]:         10,
  [HiddenRoomType.AlchemyLab]:     10,
  [HiddenRoomType.MonsterNest]:    10,
  [HiddenRoomType.AncientTomb]:     8,
  [HiddenRoomType.MagicSpring]:     8,
  [HiddenRoomType.HiddenAltar]:     8,
  [HiddenRoomType.Library]:         6,
  [HiddenRoomType.VoidRift]:        5,
  [HiddenRoomType.FungiPatch]:      3,
  [HiddenRoomType.Empty]:           2,
};

export interface ArenaObjectDef {
  type: TileType;
  relX: number;
  relY: number;
}

export const BOSS_ARENA_OBJECTS: Record<string, ArenaObjectDef[]> = {
  goblinKing: [
    { type: TileType.Throne, relX: 0, relY: 0 },
    { type: TileType.Barricade, relX: 0, relY: 4 },
  ],
  spiderQueen: [
    { type: TileType.SpiderEgg, relX: -3, relY: -3 },
    { type: TileType.SpiderEgg, relX: 3, relY: -3 },
    { type: TileType.SpiderEgg, relX: -3, relY: 3 },
    { type: TileType.SpiderEgg, relX: 3, relY: 3 },
  ],
  deathKnight: [
    { type: TileType.Sarcophagus, relX: -4, relY: -2 },
    { type: TileType.Sarcophagus, relX: -4, relY: 2 },
    { type: TileType.Sarcophagus, relX: 4, relY: -2 },
    { type: TileType.Sarcophagus, relX: 4, relY: 2 },
    { type: TileType.Altar, relX: 0, relY: 0 },
  ],
  demonLord: [
    { type: TileType.LavaPool, relX: -4, relY: -4 },
    { type: TileType.LavaPool, relX: 4, relY: -4 },
    { type: TileType.LavaPool, relX: -4, relY: 4 },
    { type: TileType.LavaPool, relX: 4, relY: 4 },
  ],
  abyssKing: [
    { type: TileType.VoidRift, relX: -3, relY: 0 },
    { type: TileType.VoidRift, relX: 3, relY: 0 },
    { type: TileType.VoidRift, relX: 0, relY: 3 },
    { type: TileType.VoidPillar, relX: -5, relY: -5 },
    { type: TileType.VoidPillar, relX: 5, relY: -5 },
    { type: TileType.VoidPillar, relX: -5, relY: 5 },
    { type: TileType.VoidPillar, relX: 5, relY: 5 },
  ],
  abyssHeart: [
    { type: TileType.VoidPillar, relX: -5, relY: -5 },
    { type: TileType.VoidPillar, relX: 5, relY: -5 },
    { type: TileType.VoidPillar, relX: -5, relY: 5 },
    { type: TileType.VoidPillar, relX: 5, relY: 5 },
    { type: TileType.VoidPillar, relX: 0, relY: -6 },
    { type: TileType.CorruptionPool, relX: 0, relY: 0 },
    { type: TileType.HealCrystal, relX: -6, relY: 0 },
    { type: TileType.HealCrystal, relX: 6, relY: 0 },
  ],
};

// ============================================================
// Dungeon Generation Constants
// ============================================================
export const MIN_ROOM_SIZE = 5;
export const MAX_ROOM_SIZE = 12;
export const ROOM_PADDING = 2;
export const MIN_BSP_SIZE = 8;
export const BSP_SPLIT_MIN = 0.35;
export const BSP_SPLIT_MAX = 0.65;
export const ENEMIES_PER_FLOOR_BASE = 6;
export const ENEMIES_PER_FLOOR_GROWTH = 2;
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
// Equipment Enhancement
// ============================================================
// +1: 100g / 100% → ATK/DEF ×1.15
// +2: 250g / 85% → ATK/DEF ×1.30
// +3: 500g / 60% → ATK/DEF ×1.50
// Multiplicative: +1×1.15=1.15, +2×1.30=1.495, +3×1.50=2.24 (cumulative is intended)
export const ENHANCE_COSTS = [100, 250, 500];
export const ENHANCE_SUCCESS_RATES = [1.0, 0.85, 0.60];
export const ENHANCE_ATK_MULT = [1.15, 1.30, 1.50];
export const ENHANCE_DEF_MULT = [1.15, 1.30, 1.50];

// ============================================================
// Daily Challenge Seed
// ============================================================
export function getDailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}
