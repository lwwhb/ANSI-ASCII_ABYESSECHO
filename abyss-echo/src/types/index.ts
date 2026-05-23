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
  Throne = 'throne',
  Barricade = 'barricade',
  WebFloor = 'webFloor',
  SpiderEgg = 'spiderEgg',
  Altar = 'altar',
  LavaPool = 'lavaPool',
  VoidRift = 'voidRift',
  VoidPillar = 'voidPillar',
  CorruptionPool = 'corruptionPool',
  HealCrystal = 'healCrystal',
  EliteDoor = 'eliteDoor',
  Fountain = 'fountain',
  Inscription = 'inscription',
  SecretWall = 'secretWall',
  Monument = 'monument',
  SpikeTrap = 'spikeTrap',       // 晶刺：站上去8伤害，对敌人也有效
  WeaponRack = 'weaponRack',     // 武器架：3选1免费武器
  Forge = 'forge',               // 锻造台：花金币强化装备
  SteamVent = 'steamVent',       // 蒸汽口：每3回合喷发遮挡视野
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

// --- Equipment Special Effects ---
export enum EquipmentEffect {
  // Weapon effects
  LifeSteal = 'lifeSteal',         // 吸血：近战回复伤害的20%HP
  ManaSteal = 'manaSteal',         // 吸魔：近战回复伤害的15%MP
  CritBonus = 'critBonus',         // 暴击率+10%
  KillReset = 'killReset',         // 击杀重置技能CD
  StatusProc = 'statusProc',       // 概率触发元素异常
  // Armor effects
  Thorns = 'thorns',               // 反伤：反弹10%近战伤害
  DodgeMana = 'dodgeMana',         // 闪避回MP：闪避时回复3MP
  DamageShield = 'damageShield',   // 受伤10%概率获得5防御5回合
  // Ring/Amulet effects
  CooldownReduce = 'cooldownReduce', // 技能CD-1（最低1）
  ElementResist = 'elementResist',   // 元素抗性：元素伤害-30%
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
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
}

export interface ArmorItem extends ItemBase {
  type: ItemType.Armor;
  defense: number;
  evasion: number;
  bonusStats?: Partial<Stats>;
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
}

export interface RingItem extends ItemBase {
  type: ItemType.Ring;
  bonusStats: Partial<Stats>;
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
}

export interface AmuletItem extends ItemBase {
  type: ItemType.Amulet;
  bonusStats: Partial<Stats>;
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
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
  Swarm = 'swarm',
  CallAlly = 'callAlly',
  Revive = 'revive',
  Berserk = 'berserk',
  Split = 'split',
  Ambush = 'ambush',
}

export enum EliteAffix {
  Armored = 'armored',
  Frenzy = 'frenzy',
  Regen = 'regen',
  Vampiric = 'vampiric',
  Explosive = 'explosive',
  Phantom = 'phantom',
}

export enum BossBlessing {
  Headhunter = 'headhunter',
  TribalHeart = 'tribalHeart',
  WebWeaver = 'webWeaver',
  VenomBlood = 'venomBlood',
  UndyingWill = 'undyingWill',
  DeathPact = 'deathPact',
  InfernalSoul = 'infernalSoul',
  DemonPower = 'demonPower',
  VoidWalk = 'voidWalk',
  AbyssEye = 'abyssEye',
  EchoBody = 'echoBody',
  FinalPact = 'finalPact',
}

export enum RelicRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
}

export enum RelicId {
  HungerRing = 'hungerRing',
  MirrorShield = 'mirrorShield',
  GreedCrown = 'greedCrown',
  SixthSense = 'sixthSense',
  LuckyCoin = 'luckyCoin',
  SilentStep = 'silentStep',
  PoisonGland = 'poisonGland',
  FlameHeart = 'flameHeart',
  FrostTouch = 'frostTouch',
  ThunderMark = 'thunderMark',
  LifeSeed = 'lifeSeed',
  OldMap = 'oldMap',
  ComboRing = 'comboRing',
  SacrificialDagger = 'sacrificialDagger',
  ElementResonance = 'elementResonance',
  EchoShard = 'echoShard',
  CurseVessel = 'curseVessel',
  BlacksmithHammer = 'blacksmithHammer',
  ExplorerDiary = 'explorerDiary',
  TimeHourglass = 'timeHourglass',
  VoidHeart = 'voidHeart',
  ChaosCore = 'chaosCore',
  EternalFlame = 'eternalFlame',
  FateWeaver = 'fateWeaver',
}

export enum RoomTheme {
  StorageRoom = 'storageRoom',
  DarkShrine = 'darkShrine',
  TrainingGround = 'trainingGround',
  InscriptionCorridor = 'inscriptionCorridor',
  RefractionHall = 'refractionHall',
  UndergroundRiver = 'undergroundRiver',
  AstrologyChamber = 'astrologyChamber',
  CrystalArena = 'crystalArena',
  TombChamber = 'tombChamber',
  CursedCorridor = 'cursedCorridor',
  HeroHall = 'heroHall',
  WhisperHall = 'whisperHall',
  LavaForge = 'lavaForge',
  SacrificeAltar = 'sacrificeAltar',
  SteamGeyser = 'steamGeyser',
  DragonNest = 'dragonNest',
  VoidRift = 'voidRiftRoom',
  CorruptedSanctum = 'corruptedSanctum',
  ObserverEye = 'observerEye',
  VoidAltar = 'voidAltarRoom',
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
  hidden?: boolean;
  hasCalledAlly?: boolean;
  reviveTimer?: number;
  bossPhase: 1 | 2 | 3;
  isElite: boolean;
  eliteAffix?: EliteAffix;
  frenzyBonus?: number;
  _skipAttack?: boolean;
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
  bossBlessings: BossBlessing[];
  finalPactUsed: boolean;
  inscriptionCount: number;
  relics: RelicId[];
  comboAttackCount: number;
  voidHeartUsed: boolean;
  extraTurnAccumulator: number;
  // Temporary tracking fields (optional)
  _mirrorShieldUsed?: boolean;
  _lifeSeedUsedThisFloor?: boolean;
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
  currentEvent: GameEventDef | ExtendedGameEventDef | null;
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
  bossBlessingPending: boolean;
  lastBossDefId: string | null;
  secretWalls: Position[];
  floorDescriptionShown: boolean;
  pendingForge: boolean;
  themedRooms: { room: { x: number; y: number; w: number; h: number; centerX: number; centerY: number; theme?: RoomTheme }; theme: RoomTheme }[];
  steamVentTurns: { x: number; y: number; spawnTurn: number }[];
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

export interface BossArenaData {
  bossDefId: string;
  objects: { type: TileType; x: number; y: number }[];
}

export interface RelicDef {
  id: RelicId;
  name: string;
  icon: string;
  rarity: RelicRarity;
  description: string;
  elementAffinity?: Element;
}

export interface ThemedRoomConfig {
  theme: RoomTheme;
  nameZh: string;
  narrativeText: string;
  biome: Biome;
  terrainTemplate: { type: TileType; offsetX: number; offsetY: number }[];
  specialMechanic: string;
  elementAffinity?: Element;
  relicRarityWeights: { common: number; rare: number; epic: number };
}

export interface ChainReactionDef {
  id: string;
  nameZh: string;
  elements: [Element, Element];
  requiresTerrain?: TileType[];
  damageMultiplier: number;
  range: number;
  additionalEffect: string;
  messageTemplate: string;
}

export interface EventOptionDef {
  id: string;
  textZh: string;
  effectId: string;
  condition?: EventCondition;
  isRare?: boolean;
}

export type EventCondition =
  | { type: 'stat'; stat: 'int' | 'dex' | 'str'; min: number }
  | { type: 'resource'; resource: 'gold' | 'hp' | 'mp'; minPercent: number }
  | { type: 'relicCount'; min: number }
  | { type: 'bossKillCount'; min: number }
  | { type: 'inscriptionCount'; min: number };

export interface ExtendedGameEventDef {
  id: string;
  nameZh: string;
  description: string;
  biomeAffinity: Biome[];
  options: EventOptionDef[];
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
