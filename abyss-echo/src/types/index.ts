// ============================================================
// 深渊回响 (Abyss Echo) - Core Type Definitions
// ============================================================

// --- Position & Geometry ---
export interface Position {
  x: number;
  y: number;
}

// --- Tiles & Map ---
export enum TileType {
  Wall = 'wall',
  Floor = 'floor',
  Corridor = 'corridor',
  Door = 'door',
  DoorOpen = 'doorOpen',
  StairsDown = 'stairsDown',
  Water = 'water',
  Lava = 'lava',
  PoisonGas = 'poisonGas',
  TrapSpike = 'trapSpike',
  TrapFire = 'trapFire',
  TrapTeleport = 'trapTeleport',
  TrapPoison = 'trapPoison',
  Shop = 'shop',
  Event = 'event',
  ShallowWater = 'shallowWater',
  CursedGround = 'cursedGround',
  CooledLava = 'cooledLava',
  VoidWall = 'voidWall',
  Portal = 'portal',
  Torch = 'torch',
  Sarcophagus = 'sarcophagus',
}

export interface Tile {
  type: TileType;
  char: string;
  fg: string;
  bg: string;
  walkable: boolean;
  transparent: boolean;
  visible: boolean;
  remembered: boolean;
  rememberedChar?: string;
  rememberedFg?: string;
  rememberedBg?: string;
}

// --- Biomes ---
export enum Biome {
  StoneDungeon = 'stoneDungeon',
  CrystalCavern = 'crystalCavern',
  AncientCrypt = 'ancientCrypt',
  LavaCore = 'lavaCore',
  VoidAbyss = 'voidAbyss',
}

// --- Character Classes ---
export enum CharacterClass {
  Warrior = 'warrior',
  Mage = 'mage',
  Rogue = 'rogue',
}

// --- Stats ---
export interface Stats {
  str: number;
  dex: number;
  int: number;
  vit: number;
}

// --- Rarity ---
export enum Rarity {
  Common = 'common',
  Good = 'good',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

// --- Elemental Types ---
export enum Element {
  None = 'none',
  Fire = 'fire',
  Ice = 'ice',
  Lightning = 'lightning',
  Poison = 'poison',
}

// --- Status Effects ---
export enum StatusEffectType {
  Poison = 'poison',
  Burn = 'burn',
  Freeze = 'freeze',
  Bleed = 'bleed',
  Confusion = 'confusion',
  DefenseUp = 'defenseUp',
  PoisonBlade = 'poisonBlade',
  FireResist = 'fireResist',
}

export interface StatusEffect {
  type: StatusEffectType;
  duration: number;
  damage: number;
}

// --- Equipment Slots ---
export enum EquipmentSlot {
  Weapon = 'weapon',
  Armor = 'armor',
  Ring1 = 'ring1',
  Ring2 = 'ring2',
  Amulet = 'amulet',
}

// --- Item Types ---
export enum ItemType {
  Weapon = 'weapon',
  Armor = 'armor',
  Ring = 'ring',
  Amulet = 'amulet',
  Potion = 'potion',
  Scroll = 'scroll',
  Food = 'food',
  Gold = 'gold',
}

export interface ItemBase {
  id: string;
  name: string;
  type: ItemType;
  char: string;
  fg: string;
  rarity: Rarity;
  identified: boolean;
  unidentifiedName?: string;
  description: string;
  value: number;
  cursed: boolean;
}

export interface WeaponItem extends ItemBase {
  type: ItemType.Weapon;
  damage: number;
  element: Element;
  bonusStats?: Partial<Stats>;
}

export interface ArmorItem extends ItemBase {
  type: ItemType.Armor;
  defense: number;
  evasion: number;
  bonusStats?: Partial<Stats>;
}

export interface RingItem extends ItemBase {
  type: ItemType.Ring;
  bonusStats: Partial<Stats>;
  specialEffect?: string;
}

export interface AmuletItem extends ItemBase {
  type: ItemType.Amulet;
  bonusStats: Partial<Stats>;
  specialEffect?: string;
}

export interface PotionItem extends ItemBase {
  type: ItemType.Potion;
  effect: PotionEffect;
  power: number;
}

export interface ScrollItem extends ItemBase {
  type: ItemType.Scroll;
  effect: ScrollEffect;
  power: number;
}

export interface FoodItem extends ItemBase {
  type: ItemType.Food;
  nutrition: number;
}

export type Item = WeaponItem | ArmorItem | RingItem | AmuletItem | PotionItem | ScrollItem | FoodItem;

export enum PotionEffect {
  Healing = 'healing',
  ManaRestore = 'manaRestore',
  Strength = 'strength',
  Dexterity = 'dexterity',
  Intelligence = 'intelligence',
  Poison = 'poisonEffect',
  Paralysis = 'paralysis',
  Confusion = 'confusion',
  FullHeal = 'fullHeal',
  FireResist = 'fireResist',
}

export enum ScrollEffect {
  Identify = 'identify',
  Mapping = 'mapping',
  Teleport = 'teleport',
  Fireball = 'fireball',
  IceStorm = 'iceStorm',
  Lightning = 'lightning',
  Enchant = 'enchant',
  RemoveCurse = 'removeCurse',
  CreatePortal = 'createPortal',
}

// --- Skill System ---
export interface SkillDef {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  mpCost: number;
  maxCooldown: number;
  element: Element;
  range: number;
  radius: number;
  power: number;
  key: string;
  icon: string;
}

// --- Talent System ---
export interface TalentDef {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  icon: string;
  classRequired?: CharacterClass;
}

// --- Achievement System ---
export interface AchievementDef {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  icon: string;
}

// --- Event System ---
export interface EventChoice {
  textZh: string;
  effectId: string;
}

export interface GameEventDef {
  id: string;
  nameZh: string;
  description: string;
  choices: EventChoice[];
}

// --- Entities ---
export interface EntityBase {
  id: string;
  name: string;
  pos: Position;
  char: string;
  fg: string;
  bg: string;
}

// --- Enemy ---
export enum EnemyBehavior {
  Aggressive = 'aggressive',
  Cowardly = 'cowardly',
  Patrolling = 'patrolling',
  Stationary = 'stationary',
  Boss = 'boss',
}

export interface EnemyDef {
  id: string;
  name: string;
  char: string;
  fg: string;
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  behavior: EnemyBehavior;
  element: Element;
  weakness: Element;
  resistance: Element;
  minFloor: number;
  speed: number;
  dropChance: number;
  specialAbility?: string;
  alertRadius: number;
  goldDrop: number;
}

export interface Enemy extends EntityBase {
  defId: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  exp: number;
  behavior: EnemyBehavior;
  element: Element;
  weakness: Element;
  resistance: Element;
  speed: number;
  statusEffects: StatusEffect[];
  dropChance: number;
  specialAbility?: string;
  alertRadius: number;
  isBoss: boolean;
  goldDrop: number;
}

// --- Player ---
export interface Player extends EntityBase {
  class: CharacterClass;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: Stats;
  baseStats: Stats;
  bonusStats: Stats;
  hunger: number;
  maxHunger: number;
  inventory: Item[];
  equipment: Record<EquipmentSlot, Item | null>;
  statusEffects: StatusEffect[];
  statPoints: number;
  killCount: number;
  bossKillCount: number;
  visionRadius: number;
  // New fields
  skillCooldowns: number[];
  talents: string[];
  gold: number;
}

// --- Messages ---
export enum MessageCategory {
  Combat = 'combat',
  Item = 'item',
  Environment = 'environment',
  System = 'system',
  Story = 'story',
}

export interface Message {
  id: string;
  text: string;
  category: MessageCategory;
  fg: string;
  turn: number;
}

// --- Game Phases ---
export enum GamePhase {
  Title = 'title',
  CharacterCreation = 'characterCreation',
  Playing = 'playing',
  Inventory = 'inventory',
  LevelUp = 'levelUp',
  TalentSelection = 'talentSelection',
  Shop = 'shop',
  Event = 'event',
  GameOver = 'gameOver',
}

// --- Floor Item (item on the ground) ---
export interface FloorItem {
  item: Item;
  pos: Position;
}

// --- Game State ---
export interface GameState {
  phase: GamePhase;
  player: Player | null;
  currentFloor: number;
  map: Tile[][];
  width: number;
  height: number;
  enemies: Enemy[];
  items: FloorItem[];
  messages: Message[];
  turn: number;
  seed: number;
  highScores: HighScore[];
  // New fields
  achievements: string[];
  legacyItem: Item | null;
  isDailyChallenge: boolean;
  shopItems: Item[];
  currentEvent: GameEventDef | null;
  screenFlash: string | null;
  skillUseCount: number;
  shopBuyCount: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  voidCorruption: { str: number; dex: number; int: number; vit: number };
  currentFragmentTurns: number;
  lavaTideActive: boolean;
  lavaTideTurnsRemaining: number;
  lavaTideTiles: { x: number; y: number }[];
  extraTurnCost: number;
  deathCause: string;
  warningPulse: 'none' | 'lowHp' | 'hunger' | 'both';
  pendingIdentify: boolean;
  pendingSacrifice: boolean;
  pendingAllocations: Partial<Stats>;
}

export interface HighScore {
  name: string;
  class: CharacterClass;
  floor: number;
  level: number;
  kills: number;
  turns: number;
  date: string;
  isDaily?: boolean;
}

// --- Direction ---
export const DIRS: Position[] = [
  { x: 0, y: -1 }, // N
  { x: 1, y: -1 },  // NE
  { x: 1, y: 0 },   // E
  { x: 1, y: 1 },   // SE
  { x: 0, y: 1 },   // S
  { x: -1, y: 1 },  // SW
  { x: -1, y: 0 },  // W
  { x: -1, y: -1 }, // NW
];

export const CARDINAL_DIRS: Position[] = [
  { x: 0, y: -1 }, // N
  { x: 1, y: 0 },  // E
  { x: 0, y: 1 },  // S
  { x: -1, y: 0 }, // W
];
