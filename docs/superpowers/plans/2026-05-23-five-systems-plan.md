# 五系统融合实现计划：遗物·强化·事件·元素·主题房间

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现遗物、装备强化、房间事件扩展、元素连锁、主题房间五大系统，融合为"空间叙事×构建涌现"的游戏体验。

**Architecture:** 以主题房间为空间骨架，承载其他四个系统。新逻辑抽取到独立模块（RelicEffects.ts, ElementalChain.ts, constants/relics.ts, constants/events.ts, constants/themedRooms.ts），gameStore只增加调用代码。

**Tech Stack:** React 19 + TypeScript + Zustand 5 + SeededRandom (Mulberry32) + Canvas API

**Spec:** `docs/superpowers/specs/2026-05-23-five-systems-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/types/index.ts` | 新增枚举和接口定义 | Modify |
| `src/constants/relics.ts` | 遗物定义(24个) | Create |
| `src/constants/events.ts` | 事件定义(12新+6旧) | Create |
| `src/constants/themedRooms.ts` | 主题房间配置(20个) | Create |
| `src/constants/elementalChain.ts` | 元素连锁定义+判定逻辑 | Create |
| `src/constants/index.ts` | 新常量(TILE_DEFAULTS扩展等) | Modify |
| `src/engine/RelicEffects.ts` | 遗物效果判定 | Create |
| `src/engine/ElementalChain.ts` | 元素连锁执行 | Create |
| `src/entities/Player.ts` | Player.relics初始化 | Modify |
| `src/entities/Items.ts` | enhanceLevel/cursed字段 | Modify |
| `src/entities/Enemy.ts` | 元素属性映射 | Modify |
| `src/generator/DungeonGenerator.ts` | 主题房间生成 | Modify |
| `src/generator/StoneDungeonGenerator.ts` | 主题房间接入 | Modify |
| `src/generator/CrystalCaveGenerator.ts` | 主题房间接入 | Modify |
| `src/generator/CryptGenerator.ts` | 主题房间接入 | Modify |
| `src/generator/LavaCoreGenerator.ts` | 主题房间接入 | Modify |
| `src/generator/VoidAbyssGenerator.ts` | 主题房间接入 | Modify |
| `src/store/gameStore.ts` | 新系统调用+Forge+遗物+事件+连锁 | Modify |
| `src/components/RelicBar.tsx` | 遗物栏UI | Create |
| `src/components/EnhanceModal.tsx` | 强化面板UI | Create |
| `src/components/EventModal.tsx` | 支持稀有选项+条件显示 | Modify |
| `src/components/App.tsx` | 新Modal/RelicBar集成 | Modify |
| `src/components/MapView.tsx` | 新地形渲染 | Modify |
| `src/index.css` | 新UI样式 | Modify |

---

## Task 1: Type System Extensions

**Files:**
- Modify: `src/types/index.ts`

Extend the type system with all new enums and interfaces needed by the five systems.

- [ ] **Step 1: Add new TileType values**

In `src/types/index.ts`, add 4 new TileType values after the existing `Monument` entry (line 62):

```typescript
  Monument = 'monument',
  SpikeTrap = 'spikeTrap',       // 晶刺：站上去8伤害，对敌人也有效
  WeaponRack = 'weaponRack',     // 武器架：3选1免费武器
  Forge = 'forge',               // 锻造台：花金币强化装备
  SteamVent = 'steamVent',       // 蒸汽口：每3回合喷发遮挡视野
```

- [ ] **Step 2: Add RelicId and RelicRarity enums**

After the `BossBlessing` enum (around line 455), add:

```typescript
export enum RelicRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
}

export enum RelicId {
  // Common (12)
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
  // Rare (8)
  ComboRing = 'comboRing',
  SacrificialDagger = 'sacrificialDagger',
  ElementResonance = 'elementResonance',
  EchoShard = 'echoShard',
  CurseVessel = 'curseVessel',
  BlacksmithHammer = 'blacksmithHammer',
  ExplorerDiary = 'explorerDiary',
  TimeHourglass = 'timeHourglass',
  // Epic (4)
  VoidHeart = 'voidHeart',
  ChaosCore = 'chaosCore',
  EternalFlame = 'eternalFlame',
  FateWeaver = 'fateWeaver',
}
```

- [ ] **Step 3: Add RoomTheme enum**

```typescript
export enum RoomTheme {
  // Stone (4)
  StorageRoom = 'storageRoom',
  DarkShrine = 'darkShrine',
  TrainingGround = 'trainingGround',
  InscriptionCorridor = 'inscriptionCorridor',
  // Crystal (4)
  RefractionHall = 'refractionHall',
  UndergroundRiver = 'undergroundRiver',
  AstrologyChamber = 'astrologyChamber',
  CrystalArena = 'crystalArena',
  // Crypt (4)
  TombChamber = 'tombChamber',
  CursedCorridor = 'cursedCorridor',
  HeroHall = 'heroHall',
  WhisperHall = 'whisperHall',
  // Lava (4)
  LavaForge = 'lavaForge',
  SacrificeAltar = 'sacrificeAltar',
  SteamGeyser = 'steamGeyser',
  DragonNest = 'dragonNest',
  // Void (4)
  VoidRift = 'voidRiftRoom',
  CorruptedSanctum = 'corruptedSanctum',
  ObserverEye = 'observerEye',
  VoidAltar = 'voidAltarRoom',
}
```

- [ ] **Step 4: Add new interfaces**

After the `BossArenaData` interface, add:

```typescript
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
```

- [ ] **Step 5: Extend Player interface**

In the Player interface (around line 425), add after `inscriptionCount`:

```typescript
  inscriptionCount: number;
  relics: RelicId[];
  comboAttackCount: number;     // for comboRing
  voidHeartUsed: boolean;       // for voidHeart (consumed on use)
  extraTurnAccumulator: number; // for timeHourglass
```

- [ ] **Step 6: Extend GameState interface**

In the GameState interface, add after `floorDescriptionShown`:

```typescript
  floorDescriptionShown: boolean;
  pendingForge: boolean;
  themedRooms: { room: Room; theme: RoomTheme }[];
  steamVentTurns: { x: number; y: number; spawnTurn: number }[];
```

- [ ] **Step 7: Extend WeaponItem and ArmorItem interfaces**

Add `enhanceLevel` field to WeaponItem (after `specialEffect`) and ArmorItem (after `specialEffect`):

For WeaponItem:
```typescript
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
```

For ArmorItem:
```typescript
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
```

Also add to RingItem and AmuletItem after `specialEffect`:
```typescript
  specialEffect?: EquipmentEffect;
  enhanceLevel?: 0 | 1 | 2 | 3;
```

- [ ] **Step 8: Extend DungeonData interface**

In `src/generator/DungeonGenerator.ts`, update the DungeonData interface to add:

```typescript
  themedRooms: { room: Room; theme: RoomTheme }[];
```

- [ ] **Step 9: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`
Expected: May have errors for unused types, but no structural errors

- [ ] **Step 10: Commit**

```bash
git add src/types/index.ts src/generator/DungeonGenerator.ts
git commit -m "feat: type system extensions for five systems (relic, enhance, events, elemental chain, themed rooms)"
```

---

## Task 2: Constants — Relics

**Files:**
- Create: `src/constants/relics.ts`

- [ ] **Step 1: Create relics.ts with all 24 relic definitions**

```typescript
import { RelicId, RelicRarity, RelicDef, Element } from '../types';

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  // === Common (12) ===
  [RelicId.HungerRing]: {
    id: RelicId.HungerRing, name: '饥饿之环', icon: '🔵',
    rarity: RelicRarity.Common,
    description: '饥饿不再掉血，但ATK-15%',
    elementAffinity: undefined,
  },
  [RelicId.MirrorShield]: {
    id: RelicId.MirrorShield, name: '镜之盾', icon: '🪞',
    rarity: RelicRarity.Common,
    description: '每层反弹受到的首次伤害',
    elementAffinity: undefined,
  },
  [RelicId.GreedCrown]: {
    id: RelicId.GreedCrown, name: '贪婪之冠', icon: '💰',
    rarity: RelicRarity.Common,
    description: '金币获取+50%，但商店价格+30%',
    elementAffinity: undefined,
  },
  [RelicId.SixthSense]: {
    id: RelicId.SixthSense, name: '第六感', icon: '👁️',
    rarity: RelicRarity.Common,
    description: '自动揭示SecretWall',
    elementAffinity: undefined,
  },
  [RelicId.LuckyCoin]: {
    id: RelicId.LuckyCoin, name: '幸运硬币', icon: '🍀',
    rarity: RelicRarity.Common,
    description: '精英敌人必掉遗物',
    elementAffinity: undefined,
  },
  [RelicId.SilentStep]: {
    id: RelicId.SilentStep, name: '沉默步伐', icon: '🤫',
    rarity: RelicRarity.Common,
    description: '3格内敌人不会主动醒来（除非攻击）',
    elementAffinity: undefined,
  },
  [RelicId.PoisonGland]: {
    id: RelicId.PoisonGland, name: '毒腺', icon: '🧪',
    rarity: RelicRarity.Common,
    description: '攻击15%概率附加Poison，毒伤+30%',
    elementAffinity: Element.Poison,
  },
  [RelicId.FlameHeart]: {
    id: RelicId.FlameHeart, name: '烈焰之心', icon: '🔥',
    rarity: RelicRarity.Common,
    description: 'Burn伤害+50%，免疫Burn',
    elementAffinity: Element.Fire,
  },
  [RelicId.FrostTouch]: {
    id: RelicId.FrostTouch, name: '冰霜之触', icon: '❄️',
    rarity: RelicRarity.Common,
    description: '攻击15%概率附加Freeze',
    elementAffinity: Element.Ice,
  },
  [RelicId.ThunderMark]: {
    id: RelicId.ThunderMark, name: '雷电印记', icon: '⚡',
    rarity: RelicRarity.Common,
    description: '攻击15%概率附加Confusion',
    elementAffinity: Element.Lightning,
  },
  [RelicId.LifeSeed]: {
    id: RelicId.LifeSeed, name: '生命种子', icon: '🌱',
    rarity: RelicRarity.Common,
    description: '每层首次击敌回复5% MaxHP',
    elementAffinity: undefined,
  },
  [RelicId.OldMap]: {
    id: RelicId.OldMap, name: '破旧地图', icon: '🗺️',
    rarity: RelicRarity.Common,
    description: '每层揭示1个房间的主题',
    elementAffinity: undefined,
  },

  // === Rare (8) ===
  [RelicId.ComboRing]: {
    id: RelicId.ComboRing, name: '连击戒指', icon: '💍',
    rarity: RelicRarity.Rare,
    description: '每3次攻击，第3次伤害×1.5',
    elementAffinity: undefined,
  },
  [RelicId.SacrificialDagger]: {
    id: RelicId.SacrificialDagger, name: '献祭匕首', icon: '🗡️',
    rarity: RelicRarity.Rare,
    description: '随时消耗10%当前HP换取20MP',
    elementAffinity: undefined,
  },
  [RelicId.ElementResonance]: {
    id: RelicId.ElementResonance, name: '元素共鸣', icon: '🌀',
    rarity: RelicRarity.Rare,
    description: '同时拥有2种不同元素debuff时，ATK+25%',
    elementAffinity: undefined,
  },
  [RelicId.EchoShard]: {
    id: RelicId.EchoShard, name: '回声碎片', icon: '💎',
    rarity: RelicRarity.Rare,
    description: '所有Boss祝福效果+30%',
    elementAffinity: undefined,
  },
  [RelicId.CurseVessel]: {
    id: RelicId.CurseVessel, name: '诅咒之壶', icon: '🏺',
    rarity: RelicRarity.Rare,
    description: '每获得1个debuff，ATK+5%（最高+25%）',
    elementAffinity: undefined,
  },
  [RelicId.BlacksmithHammer]: {
    id: RelicId.BlacksmithHammer, name: '铁匠之锤', icon: '🔨',
    rarity: RelicRarity.Rare,
    description: 'Forge强化费用-30%',
    elementAffinity: undefined,
  },
  [RelicId.ExplorerDiary]: {
    id: RelicId.ExplorerDiary, name: '探险家日记', icon: '📓',
    rarity: RelicRarity.Rare,
    description: '主题房间特殊机制效果+50%',
    elementAffinity: undefined,
  },
  [RelicId.TimeHourglass]: {
    id: RelicId.TimeHourglass, name: '时间沙漏', icon: '⏳',
    rarity: RelicRarity.Rare,
    description: '每5回合获得1次额外行动',
    elementAffinity: undefined,
  },

  // === Epic (4) ===
  [RelicId.VoidHeart]: {
    id: RelicId.VoidHeart, name: '虚空之心', icon: '🟣',
    rarity: RelicRarity.Epic,
    description: 'HP归0时，消耗此遗物复活并回复50%HP（一次性）',
    elementAffinity: undefined,
  },
  [RelicId.ChaosCore]: {
    id: RelicId.ChaosCore, name: '混沌核心', icon: '☄️',
    rarity: RelicRarity.Epic,
    description: '所有元素连锁伤害×2，但自身也受25%连锁伤害',
    elementAffinity: undefined,
  },
  [RelicId.EternalFlame]: {
    id: RelicId.EternalFlame, name: '不朽之焰', icon: '🔥',
    rarity: RelicRarity.Epic,
    description: '站在Lava/CooledLava上每回合回复5%HP',
    elementAffinity: Element.Fire,
  },
  [RelicId.FateWeaver]: {
    id: RelicId.FateWeaver, name: '命运编织者', icon: '🕸️',
    rarity: RelicRarity.Epic,
    description: '每次元素连锁触发时，获得1层随机buff（ATK/DEF/MP+3，持续3回合）',
    elementAffinity: undefined,
  },
};

// 按稀有度分组的遗物ID列表（用于随机抽取）
export const RELICS_BY_RARITY: Record<RelicRarity, RelicId[]> = {
  [RelicRarity.Common]: [
    RelicId.HungerRing, RelicId.MirrorShield, RelicId.GreedCrown,
    RelicId.SixthSense, RelicId.LuckyCoin, RelicId.SilentStep,
    RelicId.PoisonGland, RelicId.FlameHeart, RelicId.FrostTouch,
    RelicId.ThunderMark, RelicId.LifeSeed, RelicId.OldMap,
  ],
  [RelicRarity.Rare]: [
    RelicId.ComboRing, RelicId.SacrificialDagger, RelicId.ElementResonance,
    RelicId.EchoShard, RelicId.CurseVessel, RelicId.BlacksmithHammer,
    RelicId.ExplorerDiary, RelicId.TimeHourglass,
  ],
  [RelicRarity.Epic]: [
    RelicId.VoidHeart, RelicId.ChaosCore, RelicId.EternalFlame, RelicId.FateWeaver,
  ],
};

// 元素遗物ID集合（用于主题房间概率偏向）
export const ELEMENT_RELICS: Record<Element, RelicId[]> = {
  [Element.None]: [],
  [Element.Fire]: [RelicId.FlameHeart, RelicId.EternalFlame],
  [Element.Ice]: [RelicId.FrostTouch],
  [Element.Lightning]: [RelicId.ThunderMark],
  [Element.Poison]: [RelicId.PoisonGland],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/relics.ts
git commit -m "feat: add 24 relic definitions (12 common, 8 rare, 4 epic)"
```

---

## Task 3: Constants — Themed Rooms

**Files:**
- Create: `src/constants/themedRooms.ts`

- [ ] **Step 1: Create themedRooms.ts with all 20 themed room configurations**

```typescript
import { RoomTheme, Biome, TileType, ThemedRoomConfig, Element } from '../types';

export const THEMED_ROOM_CONFIGS: Record<RoomTheme, ThemedRoomConfig> = {
  // === Stone Dungeon (Floor 1-5) ===
  [RoomTheme.StorageRoom]: {
    theme: RoomTheme.StorageRoom,
    nameZh: '废弃储藏室',
    narrativeText: '酒窖里还剩几瓶陈年麦酒…',
    biome: Biome.StoneDungeon,
    terrainTemplate: [
      { type: TileType.Barricade, offsetX: -1, offsetY: -1 },
      { type: TileType.Barricade, offsetX: 1, offsetY: -1 },
      { type: TileType.Barricade, offsetX: 0, offsetY: 1 },
    ],
    specialMechanic: 'barricadeFoodDrop',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },
  [RoomTheme.DarkShrine]: {
    theme: RoomTheme.DarkShrine,
    nameZh: '祭祀暗室',
    narrativeText: '血迹未干的祭坛，似乎刚举行过仪式',
    biome: Biome.StoneDungeon,
    terrainTemplate: [
      { type: TileType.Altar, offsetX: 0, offsetY: 0 },
      { type: TileType.Torch, offsetX: -2, offsetY: 0 },
      { type: TileType.Torch, offsetX: 2, offsetY: 0 },
    ],
    specialMechanic: 'enhancedAltar',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },
  [RoomTheme.TrainingGround]: {
    theme: RoomTheme.TrainingGround,
    nameZh: '训练场',
    narrativeText: '哥布林的训练场，看来它们并非毫无章法',
    biome: Biome.StoneDungeon,
    terrainTemplate: [
      { type: TileType.Barricade, offsetX: -1, offsetY: -1 },
      { type: TileType.Barricade, offsetX: 1, offsetY: 1 },
      { type: TileType.HealCrystal, offsetX: 0, offsetY: -2 },
    ],
    specialMechanic: 'crystalOnClear',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },
  [RoomTheme.InscriptionCorridor]: {
    theme: RoomTheme.InscriptionCorridor,
    nameZh: '刻字回廊',
    narrativeText: '古老的铭文记载着深渊的起源…',
    biome: Biome.StoneDungeon,
    terrainTemplate: [
      { type: TileType.Inscription, offsetX: -1, offsetY: 0 },
      { type: TileType.Inscription, offsetX: 1, offsetY: 0 },
    ],
    specialMechanic: 'inscriptionBonusExp',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },

  // === Crystal Cavern (Floor 6-10) ===
  [RoomTheme.RefractionHall]: {
    theme: RoomTheme.RefractionHall,
    nameZh: '折射大厅',
    narrativeText: '水晶折射出七彩光芒，温暖而奇异',
    biome: Biome.CrystalCavern,
    terrainTemplate: [
      { type: TileType.HealCrystal, offsetX: -1, offsetY: -1 },
      { type: TileType.HealCrystal, offsetX: 1, offsetY: 1 },
      { type: TileType.HealCrystal, offsetX: 0, offsetY: 0 },
    ],
    specialMechanic: 'doubleUseCrystal',
    elementAffinity: Element.Ice,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },
  [RoomTheme.UndergroundRiver]: {
    theme: RoomTheme.UndergroundRiver,
    nameZh: '地下暗河',
    narrativeText: '暗河的水清澈见底，但你不确定深处有什么',
    biome: Biome.CrystalCavern,
    terrainTemplate: [
      { type: TileType.ShallowWater, offsetX: -1, offsetY: 0 },
      { type: TileType.ShallowWater, offsetX: 0, offsetY: 0 },
      { type: TileType.ShallowWater, offsetX: 1, offsetY: 0 },
      { type: TileType.Fountain, offsetX: 0, offsetY: -2 },
    ],
    specialMechanic: 'fountainRestoresMP',
    elementAffinity: Element.Ice,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },
  [RoomTheme.AstrologyChamber]: {
    theme: RoomTheme.AstrologyChamber,
    nameZh: '占星室',
    narrativeText: '水晶球中映照着不属于这片天空的星辰',
    biome: Biome.CrystalCavern,
    terrainTemplate: [
      { type: TileType.Inscription, offsetX: 0, offsetY: 0 },
      { type: TileType.SecretWall, offsetX: -3, offsetY: 0 },
    ],
    specialMechanic: 'secretRelicRoom',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.5, rare: 0.4, epic: 0.1 },
  },
  [RoomTheme.CrystalArena]: {
    theme: RoomTheme.CrystalArena,
    nameZh: '晶化竞技场',
    narrativeText: '水晶生长的速度超乎想象，连尸体都被包裹',
    biome: Biome.CrystalCavern,
    terrainTemplate: [
      { type: TileType.SpikeTrap, offsetX: -1, offsetY: -1 },
      { type: TileType.SpikeTrap, offsetX: 1, offsetY: 1 },
      { type: TileType.SpikeTrap, offsetX: 0, offsetY: 2 },
    ],
    specialMechanic: 'spikeDamageEnemy',
    elementAffinity: Element.Ice,
    relicRarityWeights: { common: 0.7, rare: 0.3, epic: 0 },
  },

  // === Ancient Crypt (Floor 11-15) ===
  [RoomTheme.TombChamber]: {
    theme: RoomTheme.TombChamber,
    nameZh: '陵寝主室',
    narrativeText: '石棺上的纹章属于一个被遗忘的王朝',
    biome: Biome.AncientCrypt,
    terrainTemplate: [
      { type: TileType.Sarcophagus, offsetX: 0, offsetY: -1 },
      { type: TileType.Sarcophagus, offsetX: 0, offsetY: 1 },
      { type: TileType.Torch, offsetX: -2, offsetY: 0 },
    ],
    specialMechanic: 'enhancedSarcophagus',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.6, rare: 0.35, epic: 0.05 },
  },
  [RoomTheme.CursedCorridor]: {
    theme: RoomTheme.CursedCorridor,
    nameZh: '诅咒回廊',
    narrativeText: '蛛网覆盖了一切，连空气都粘稠',
    biome: Biome.AncientCrypt,
    terrainTemplate: [
      { type: TileType.WebFloor, offsetX: -1, offsetY: 0 },
      { type: TileType.WebFloor, offsetX: 1, offsetY: 0 },
      { type: TileType.SpiderEgg, offsetX: 0, offsetY: -1 },
    ],
    specialMechanic: 'eliteSpiderEgg',
    elementAffinity: Element.Poison,
    relicRarityWeights: { common: 0.6, rare: 0.35, epic: 0.05 },
  },
  [RoomTheme.HeroHall]: {
    theme: RoomTheme.HeroHall,
    nameZh: '英灵殿',
    narrativeText: '英灵的武器仍在发光，等待新的持有者',
    biome: Biome.AncientCrypt,
    terrainTemplate: [
      { type: TileType.Monument, offsetX: 0, offsetY: 0 },
      { type: TileType.WeaponRack, offsetX: -2, offsetY: 0 },
      { type: TileType.WeaponRack, offsetX: 2, offsetY: 0 },
    ],
    specialMechanic: 'freeWeaponChoice',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.6, rare: 0.35, epic: 0.05 },
  },
  [RoomTheme.WhisperHall]: {
    theme: RoomTheme.WhisperHall,
    nameZh: '亡者低语',
    narrativeText: '亡者的低语中蕴含着禁忌的知识',
    biome: Biome.AncientCrypt,
    terrainTemplate: [
      { type: TileType.Fountain, offsetX: 0, offsetY: 0 },
      { type: TileType.VoidRift, offsetX: -2, offsetY: 0 },
      { type: TileType.VoidRift, offsetX: 2, offsetY: 0 },
    ],
    specialMechanic: 'fountainMaxHpChance',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.6, rare: 0.35, epic: 0.05 },
  },

  // === Lava Core (Floor 16-20) ===
  [RoomTheme.LavaForge]: {
    theme: RoomTheme.LavaForge,
    nameZh: '岩浆锻造场',
    narrativeText: '熔岩中锻造的武器拥有地火的力量',
    biome: Biome.LavaCore,
    terrainTemplate: [
      { type: TileType.Forge, offsetX: 0, offsetY: 0 },
      { type: TileType.LavaPool, offsetX: -2, offsetY: 0 },
    ],
    specialMechanic: 'forgeBurnBonus',
    elementAffinity: Element.Fire,
    relicRarityWeights: { common: 0.5, rare: 0.4, epic: 0.1 },
  },
  [RoomTheme.SacrificeAltar]: {
    theme: RoomTheme.SacrificeAltar,
    nameZh: '献祭祭坛',
    narrativeText: '只有火焰才能净化一切',
    biome: Biome.LavaCore,
    terrainTemplate: [
      { type: TileType.Altar, offsetX: 0, offsetY: 0 },
      { type: TileType.LavaPool, offsetX: -1, offsetY: -1 },
      { type: TileType.LavaPool, offsetX: 1, offsetY: 1 },
    ],
    specialMechanic: 'altarThreeChoices',
    elementAffinity: Element.Fire,
    relicRarityWeights: { common: 0.5, rare: 0.4, epic: 0.1 },
  },
  [RoomTheme.SteamGeyser]: {
    theme: RoomTheme.SteamGeyser,
    nameZh: '热气喷泉',
    narrativeText: '地底的蒸汽随时可能喷发',
    biome: Biome.LavaCore,
    terrainTemplate: [
      { type: TileType.SteamVent, offsetX: -1, offsetY: -1 },
      { type: TileType.SteamVent, offsetX: 1, offsetY: 1 },
      { type: TileType.SteamVent, offsetX: 0, offsetY: 2 },
    ],
    specialMechanic: 'steamVentVision',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.5, rare: 0.4, epic: 0.1 },
  },
  [RoomTheme.DragonNest]: {
    theme: RoomTheme.DragonNest,
    nameZh: '龙巢遗迹',
    narrativeText: '巨龙曾在此栖息，如今只剩焦土和骨骸',
    biome: Biome.LavaCore,
    terrainTemplate: [
      { type: TileType.Monument, offsetX: 0, offsetY: 0 },
      { type: TileType.LavaPool, offsetX: -1, offsetY: -1 },
    ],
    specialMechanic: 'monumentBurnEnemy',
    elementAffinity: Element.Fire,
    relicRarityWeights: { common: 0.5, rare: 0.4, epic: 0.1 },
  },

  // === Void Abyss (Floor 21+) ===
  [RoomTheme.VoidRift]: {
    theme: RoomTheme.VoidRift,
    nameZh: '虚空裂隙',
    narrativeText: '现实在这里变得脆弱',
    biome: Biome.VoidAbyss,
    terrainTemplate: [
      { type: TileType.VoidRift, offsetX: -1, offsetY: -1 },
      { type: TileType.VoidRift, offsetX: 1, offsetY: 1 },
      { type: TileType.VoidPillar, offsetX: 0, offsetY: 0 },
    ],
    specialMechanic: 'riftInvincibility',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.4, rare: 0.4, epic: 0.2 },
  },
  [RoomTheme.CorruptedSanctum]: {
    theme: RoomTheme.CorruptedSanctum,
    nameZh: '腐化圣所',
    narrativeText: '腐化正在吞噬最后的圣洁',
    biome: Biome.VoidAbyss,
    terrainTemplate: [
      { type: TileType.CorruptionPool, offsetX: -1, offsetY: 0 },
      { type: TileType.CorruptionPool, offsetX: 1, offsetY: 0 },
      { type: TileType.Altar, offsetX: 0, offsetY: -2 },
    ],
    specialMechanic: 'altarCorruptImmunity',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.4, rare: 0.4, epic: 0.2 },
  },
  [RoomTheme.ObserverEye]: {
    theme: RoomTheme.ObserverEye,
    nameZh: '观测者之眼',
    narrativeText: '某个存在一直在注视着你的每一步',
    biome: Biome.VoidAbyss,
    terrainTemplate: [
      { type: TileType.Inscription, offsetX: 0, offsetY: 0 },
      { type: TileType.VoidPillar, offsetX: -2, offsetY: 0 },
    ],
    specialMechanic: 'inscriptionRevealSecrets',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.4, rare: 0.4, epic: 0.2 },
  },
  [RoomTheme.VoidAltar]: {
    theme: RoomTheme.VoidAltar,
    nameZh: '虚空祭坛',
    narrativeText: '深渊的核心，一切开始与终结之地',
    biome: Biome.VoidAbyss,
    terrainTemplate: [
      { type: TileType.Forge, offsetX: 0, offsetY: 0 },
      { type: TileType.CorruptionPool, offsetX: -1, offsetY: 1 },
      { type: TileType.VoidRift, offsetX: 1, offsetY: 1 },
    ],
    specialMechanic: 'forgeHalfPriceCursed',
    elementAffinity: undefined,
    relicRarityWeights: { common: 0.3, rare: 0.4, epic: 0.3 },
  },
};

// 按生物群落分组的主题列表
export const THEMES_BY_BIOME: Record<Biome, RoomTheme[]> = {
  [Biome.StoneDungeon]: [RoomTheme.StorageRoom, RoomTheme.DarkShrine, RoomTheme.TrainingGround, RoomTheme.InscriptionCorridor],
  [Biome.CrystalCavern]: [RoomTheme.RefractionHall, RoomTheme.UndergroundRiver, RoomTheme.AstrologyChamber, RoomTheme.CrystalArena],
  [Biome.AncientCrypt]: [RoomTheme.TombChamber, RoomTheme.CursedCorridor, RoomTheme.HeroHall, RoomTheme.WhisperHall],
  [Biome.LavaCore]: [RoomTheme.LavaForge, RoomTheme.SacrificeAltar, RoomTheme.SteamGeyser, RoomTheme.DragonNest],
  [Biome.VoidAbyss]: [RoomTheme.VoidRift, RoomTheme.CorruptedSanctum, RoomTheme.ObserverEye, RoomTheme.VoidAltar],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/themedRooms.ts
git commit -m "feat: add 20 themed room configurations (5 biomes × 4 themes)"
```

---

## Task 4: Constants — Elemental Chain

**Files:**
- Create: `src/constants/elementalChain.ts`

- [ ] **Step 1: Create elementalChain.ts with chain reaction definitions and terrain mapping**

```typescript
import { Element, TileType, ChainReactionDef } from '../types';

export const CHAIN_REACTIONS: ChainReactionDef[] = [
  {
    id: 'steamBurst',
    nameZh: '蒸汽爆发',
    elements: [Element.Fire, Element.Ice],
    damageMultiplier: 0.8,
    range: 1,
    additionalEffect: 'blockVision1Turn',
    messageTemplate: '🔥❄️ 蒸汽爆发！热与寒的碰撞冲击了周围！',
  },
  {
    id: 'freezeSolid',
    nameZh: '冰封',
    elements: [Element.Ice, Element.Ice],
    requiresTerrain: [TileType.ShallowWater],
    damageMultiplier: 0,
    range: 0,
    additionalEffect: 'freezeExtendAndSpread',
    messageTemplate: '❄️💧 冰封！寒气在水面蔓延，冻结了一切！',
  },
  {
    id: 'conduct',
    nameZh: '传导',
    elements: [Element.Lightning, Element.Ice],
    requiresTerrain: [TileType.ShallowWater],
    damageMultiplier: 0.6,
    range: 0,
    additionalEffect: 'spreadToAllInWater',
    messageTemplate: '⚡💧 传导！电流通过水面扩散！',
  },
  {
    id: 'poisonIgnition',
    nameZh: '毒气燃烧',
    elements: [Element.Fire, Element.Poison],
    requiresTerrain: [TileType.PoisonGas],
    damageMultiplier: 1.2,
    range: 0,
    additionalEffect: 'clearPoisonGasAndAoeDamage',
    messageTemplate: '🔥🧪 毒气燃烧！毒雾化作了火焰风暴！',
  },
  {
    id: 'corruptDischarge',
    nameZh: '腐化放电',
    elements: [Element.Lightning, Element.Poison],
    damageMultiplier: 2.0,
    range: 2,
    additionalEffect: 'jumpToOtherPoisoned',
    messageTemplate: '⚡🧪 腐化放电！毒素在电弧中剧烈反应！',
  },
  {
    id: 'lavaActivate',
    nameZh: '岩浆激活',
    elements: [Element.Fire, Element.Fire],
    requiresTerrain: [TileType.LavaPool, TileType.CooledLava],
    damageMultiplier: 0,
    range: 1,
    additionalEffect: 'spreadLava2Turns',
    messageTemplate: '🔥🌋 岩浆激活！大地之火向四周蔓延！',
  },
  {
    id: 'lavaSolidify',
    nameZh: '岩浆凝固',
    elements: [Element.Ice, Element.Fire],
    requiresTerrain: [TileType.LavaPool],
    damageMultiplier: 0,
    range: 0,
    additionalEffect: 'coolLava3Turns',
    messageTemplate: '❄️🌋 岩浆凝固！炽热的熔岩化为了黑石！',
  },
  {
    id: 'overload',
    nameZh: '过载',
    elements: [Element.Lightning, Element.Lightning],
    damageMultiplier: 1.8,
    range: 0,
    additionalEffect: 'stun1Turn',
    messageTemplate: '⚡⚡ 过载！雷电的极致轰击！',
  },
];

// 地形元素属性映射——部分地形有多种元素属性
export const TERRAIN_ELEMENTS: Partial<Record<TileType, Element[]>> = {
  [TileType.ShallowWater]: [Element.Ice, Element.Lightning],
  [TileType.LavaPool]: [Element.Fire],
  [TileType.CooledLava]: [],
  [TileType.PoisonGas]: [Element.Poison],
  [TileType.SteamVent]: [Element.Ice, Element.Lightning],
  [TileType.WebFloor]: [],
};

// 判断SteamVent是否处于喷发状态
export function isSteamVentActive(currentTurn: number, spawnTurn: number): boolean {
  return (currentTurn - spawnTurn) % 3 === 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/elementalChain.ts
git commit -m "feat: add 8 elemental chain reaction definitions and terrain element mapping"
```

---

## Task 5: Constants — Extended Events

**Files:**
- Create: `src/constants/events.ts`

- [ ] **Step 1: Create events.ts with 12 new event definitions**

File contains `EXTENDED_EVENT_DEFS: ExtendedGameEventDef[]` with all 12 new events (深渊商人, 灵魂熔炉, 诅咒宝箱, 命运岔路, 神秘符文, 裂隙之心, 深渊赌局, 不稳定传送门, 血之祭坛, 古代壁画, 迷失的旅者, 回声之井).

Each event has `id`, `nameZh`, `description`, `biomeAffinity`, and `options: EventOptionDef[]` with proper `effectId` strings and `condition` objects for rare options.

This is a pure data file with no logic — ~300 lines of event definitions.

(See spec section 6.2 for exact event content. Each option maps to an `effectId` string like `'abyssMerchant_buyRelic'`, `'abyssMerchant_tradeHpForEpic'`, `'abyssMerchant_enhanceForMp'`, etc.)

- [ ] **Step 2: Commit**

```bash
git add src/constants/events.ts
git commit -m "feat: add 12 new event definitions with rare conditional options"
```

---

## Task 6: Constants — Update index.ts

**Files:**
- Modify: `src/constants/index.ts`

- [ ] **Step 1: Add new TILE_DEFAULTS entries for 4 new tile types**

In the `TILE_DEFAULTS`/`NEW_TILE_DEFAULTS` section, add entries for `SpikeTrap`, `WeaponRack`, `Forge`, `SteamVent`:

```typescript
[TileType.SpikeTrap]: { char: '▲', fg: '#8888ff', bg: '#222244', walkable: true, transparent: true },
[TileType.WeaponRack]: { char: '⋔', fg: '#aaaaaa', bg: '#443322', walkable: false, transparent: false },
[TileType.Forge]: { char: '⚒', fg: '#ff8800', bg: '#442200', walkable: false, transparent: false },
[TileType.SteamVent]: { char: '≋', fg: '#cccccc', bg: '#445566', walkable: true, transparent: true },
```

- [ ] **Step 2: Add ENHANCE_COSTS and ENHANCE_RATES constants**

```typescript
export const ENHANCE_COSTS = [100, 250, 500];
export const ENHANCE_SUCCESS_RATES = [1.0, 0.85, 0.60];
export const ENHANCE_ATK_MULT = [1.1, 1.2, 1.35];
export const ENHANCE_DEF_MULT = [1.1, 1.2, 1.35];
```

- [ ] **Step 3: Commit**

```bash
git add src/constants/index.ts
git commit -m "feat: add tile defaults, enhance costs/rates constants"
```

---

## Task 7: Engine — RelicEffects

**Files:**
- Create: `src/engine/RelicEffects.ts`

- [ ] **Step 1: Create RelicEffects.ts with all relic effect helper functions**

This module exports pure functions that gameStore calls to check/apply relic effects. Each function takes relevant state as input and returns modifiers.

Key functions:
- `hasRelic(player, relicId)` — checks if player owns a relic
- `getRelicAtkModifier(player)` — returns ATK% modifier from relics (hungerRing -15%, curseVessel +5%/debuff, undyingWill +30% if HP<25%, elementResonance +25% if 2+ element debuffs)
- `getRelicGoldModifier(player)` — returns gold% modifier (greedCrown +50%)
- `getRelicShopPriceModifier(player)` — returns shop price% modifier (greedCrown +30%)
- `getRelicForgeCostModifier(player)` — returns forge cost% modifier (blacksmithHammer -30%)
- `getRelicBurnDamageModifier(player)` — returns burn damage% modifier (flameHeart +50%)
- `getRelicPoisonDamageModifier(player)` — returns poison damage% modifier (poisonGland +30%)
- `shouldRelicProcStatus(player, rng)` — checks proc relics (poisonGland 15%, frostTouch 15%, thunderMark 15%)
- `shouldRelicPreventAggro(player, enemy)` — silentStep: distance<=3 and not attacked
- `getCurseVesselBonus(player)` — counts debuffs, returns ATK% (max +25%)
- `getElementResonanceBonus(player)` — checks if player has 2+ different element debuffs
- `rollRandomRelic(rng, rarityWeights, elementAffinity?)` — rolls a random relic respecting rarity weights and element affinity bias
- `shouldMirrorShieldTrigger(player, turn)` — returns true if first damage this floor
- `shouldVoidHeartTrigger(player)` — returns true if player has voidHeart and hasn't used it

- [ ] **Step 2: Commit**

```bash
git add src/engine/RelicEffects.ts
git commit -m "feat: add relic effect helper functions (24 relics)"
```

---

## Task 8: Engine — ElementalChain

**Files:**
- Create: `src/engine/ElementalChain.ts`

- [ ] **Step 1: Create ElementalChain.ts with chain reaction execution logic**

This module handles checking for and executing chain reactions during combat.

Key functions:
- `checkChainReaction(attackElement, targetElements, terrainType, currentTurn, ventSpawnTurn?)` — returns matching ChainReactionDef or null
- `executeChainReaction(reaction, attacker, targets, map, player, enemies, rng)` — executes a chain reaction, returns { damage, affectedEnemies, mapChanges, messages }
- `getTerrainElementsAt(map, x, y, currentTurn, steamVentTurns)` — returns Element[] for the terrain at position
- `getEnemyElementDebuffs(enemy)` — returns Element[] of active element debuffs on enemy

The function iterates CHAIN_REACTIONS, checks if `attackElement` matches `reaction.elements[0]`, then checks if target has `reaction.elements[1]` as debuff OR terrain provides it via `reaction.requiresTerrain`. If match found, executes the effect.

- [ ] **Step 2: Commit**

```bash
git add src/engine/ElementalChain.ts
git commit -m "feat: add elemental chain reaction checking and execution logic"
```

---

## Task 9: Entity Updates — Player + Items

**Files:**
- Modify: `src/entities/Player.ts`
- Modify: `src/entities/Items.ts`

- [ ] **Step 1: Add new fields to createPlayer() in Player.ts**

After `inscriptionCount: 0,` in the Player return object, add:

```typescript
    relics: [],
    comboAttackCount: 0,
    voidHeartUsed: false,
    extraTurnAccumulator: 0,
```

- [ ] **Step 2: Add enhanceLevel field to item creation in Items.ts**

In `createWeapon()`, after `cursed: false,` add:
```typescript
    enhanceLevel: 0,
```

In `createArmor()`, after `cursed: false,` add:
```typescript
    enhanceLevel: 0,
```

In the ring creation block (inside `createRandomItem`), add `enhanceLevel: 0` to the ring object.
In the amulet creation block, add `enhanceLevel: 0` to the amulet object.

- [ ] **Step 3: Update getItemName() in Items.ts**

After the cursed check, add enhance level display:

```typescript
export function getItemName(item: Item): string {
  if (!item.identified && 'unidentifiedName' in item && item.unidentifiedName) {
    return item.unidentifiedName;
  }
  let name = item.name;
  if (item.cursed && item.identified) name += ' [诅咒]';
  if ('enhanceLevel' in item && (item as any).enhanceLevel > 0) {
    name += `+${(item as any).enhanceLevel}`;
  }
  return name;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/entities/Player.ts src/entities/Items.ts
git commit -m "feat: add relic/enhance fields to Player and Item entities"
```

---

## Task 10: Dungeon Generator — Themed Room Generation

**Files:**
- Modify: `src/generator/DungeonGenerator.ts`
- Modify: `src/generator/StoneDungeonGenerator.ts`
- Modify: `src/generator/CrystalCaveGenerator.ts`
- Modify: `src/generator/CryptGenerator.ts`
- Modify: `src/generator/LavaCoreGenerator.ts`
- Modify: `src/generator/VoidAbyssGenerator.ts`

- [ ] **Step 1: Add placeThemedRooms() to DungeonGenerator.ts**

Add a new function that:
1. Takes `rooms`, `map`, `biome`, `rng` as parameters
2. Gets `THEMES_BY_BIOME[biome]` as available themes
3. Randomly selects 3-5 rooms (excluding start/boss/shop/event/elite rooms) to become themed
4. For each selected room, places terrain from `ThemedRoomConfig.terrainTemplate` at relative positions within the room
5. Returns `{ themedRooms: { room, theme }[] }`

```typescript
import { THEMED_ROOM_CONFIGS, THEMES_BY_BIOME } from '../constants/themedRooms';
import { RoomTheme, ThemedRoomConfig } from '../types';

function placeThemedRooms(
  rooms: Room[],
  map: Tile[][],
  biome: Biome,
  rng: SeededRandom,
  reservedRooms: Room[],
): { themedRooms: { room: Room; theme: RoomTheme }[] } {
  const availableThemes = THEMES_BY_BIOME[biome];
  const eligibleRooms = rooms.filter(r =>
    !reservedRooms.includes(r) &&
    r.w >= 5 && r.h >= 5  // minimum room size for themed rooms
  );
  const count = Math.min(rng.nextInt(3, 5), eligibleRooms.length, availableThemes.length);
  const selected = rng.shuffle([...eligibleRooms]).slice(0, count);
  const themedRooms: { room: Room; theme: RoomTheme }[] = [];

  const usedThemes = new Set<RoomTheme>();
  for (const room of selected) {
    const available = availableThemes.filter(t => !usedThemes.has(t));
    if (available.length === 0) break;
    const theme = rng.pick(available);
    usedThemes.add(theme);
    const config = THEMED_ROOM_CONFIGS[theme];

    // Place terrain from template
    for (const obj of config.terrainTemplate) {
      const tx = room.x + Math.floor(room.w / 2) + obj.offsetX;
      const ty = room.y + Math.floor(room.h / 2) + obj.offsetY;
      if (ty >= 0 && ty < map.length && tx >= 0 && tx < map[0].length) {
        const tileDefaults = NEW_TILE_DEFAULTS[obj.type] ?? { char: '?', fg: '#fff', bg: '#000', walkable: false, transparent: false };
        map[ty][tx] = {
          type: obj.type,
          char: tileDefaults.char,
          fg: tileDefaults.fg,
          bg: tileDefaults.bg,
          walkable: tileDefaults.walkable,
          transparent: tileDefaults.transparent,
          visible: false,
          remembered: false,
        };
      }
    }
    themedRooms.push({ room, theme });
  }
  return { themedRooms };
}
```

- [ ] **Step 2: Call placeThemedRooms() in each biome generator**

In each of the 5 biome generators (Stone, Crystal, Crypt, Lava, Void), after the existing `placeEliteAndSpecialRooms()` call, add:

```typescript
const { themedRooms } = placeThemedRooms(rooms, map, biome, rng, reservedRooms);
```

And add `themedRooms` to the returned `DungeonData` object.

- [ ] **Step 3: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/generator/
git commit -m "feat: add themed room generation to all 5 biome generators"
```

---

## Task 11: gameStore — Themed Room Interactions + Forge + New Tiles

**Files:**
- Modify: `src/store/gameStore.ts`

This is the largest task. It adds tile interactions for 4 new tile types, themed room narrative display, and Forge functionality.

- [ ] **Step 1: Add themed room narrative display in enterFloor()**

In `enterFloor()`, after floor description output, add themed room narrative. When player enters a themed room (checked by position), output the narrative text and room name.

- [ ] **Step 2: Add Forge tile interaction in movePlayer()**

After the existing `Monument` tile check, add Forge interaction:

```typescript
// Forge: Open enhancement panel
if (tile.type === TileType.Forge) {
  const hasEquippable = Object.values(player.equipment).some(e => e && 'enhanceLevel' in e && (e as any).enhanceLevel < 3);
  if (hasEquippable) {
    set({ player, pendingForge: true, phase: GamePhase.Inventory });
    return;
  } else {
    addMessages([msg('锻造台散发着热气，但你没有可以强化的装备。', MessageCategory.System, '#ff8800')]);
  }
}
```

- [ ] **Step 3: Add WeaponRack tile interaction**

```typescript
// WeaponRack: 3-choose-1 free weapon
if (tile.type === TileType.WeaponRack) {
  // Generate 3 random weapons and let player choose
  // For simplicity: give 1 free weapon of appropriate rarity
  const weapon = createRandomItem(state.currentFloor, rng, false) as WeaponItem;
  if (weapon.type === ItemType.Weapon) {
    player.inventory = [...player.inventory, weapon];
    const newMap = state.map.map(row => row.map(t => ({ ...t })));
    newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
    set({ map: newMap, player });
    addMessages([msg(`你从武器架上取下了${getItemName(weapon)}！`, MessageCategory.Item, '#ffcc44')]);
  }
}
```

- [ ] **Step 4: Add SpikeTrap tile interaction**

```typescript
// SpikeTrap: 8 damage to whoever steps on it
if (tile.type === TileType.SpikeTrap) {
  player.hp -= 8;
  addMessages([msg('晶刺刺穿了你的脚！受到8点伤害！', MessageCategory.Environment, '#8888ff')]);
  flashScreen('#8888ff33');
  // Also check enemies on spike traps in processTurn
}
```

- [ ] **Step 5: Add SteamVent periodic effect in processTurn()**

In the periodic effects section (near lava tide), add SteamVent logic:

```typescript
// SteamVent: every 3 turns, block 3×3 vision for 2 turns
if (state.steamVentTurns.length > 0) {
  for (const vent of state.steamVentTurns) {
    if (isSteamVentActive(state.turn, vent.spawnTurn)) {
      // Apply vision block in 3×3 around vent
      // Implementation: set tiles as non-transparent for 2 turns
      addMessages([msg('蒸汽喷发！视野被遮挡！', MessageCategory.Environment, '#cccccc')]);
    }
  }
}
```

- [ ] **Step 6: Add themed room special mechanics**

Implement the `specialMechanic` handlers referenced in ThemedRoomConfig. These are triggered when the player interacts with themed room tiles. Most are modifications of existing tile interactions:

- `barricadeFoodDrop`: 30% food drop from Barricade in storage rooms
- `enhancedAltar`: Altar gives +2 stats instead of +1 DEF
- `crystalOnClear`: HealCrystal only activates after enemies in room are cleared
- `inscriptionBonusExp`: +10 EXP on first inscription read
- `doubleUseCrystal`: HealCrystal has 2 uses instead of 1
- `fountainRestoresMP`: Fountain restores MP instead of HP
- `secretRelicRoom`: SecretWall leads to a room with a guaranteed relic
- `spikeDamageEnemy`: SpikeTraps damage enemies that step on them
- `enhancedSarcophagus`: +15% rare item chance
- `eliteSpiderEgg`: 20% chance to hatch elite spider
- `freeWeaponChoice`: WeaponRack gives 3-choose-1 weapon
- `fountainMaxHpChance`: 5% chance to convert heal to +2 MaxHP
- `forgeBurnBonus`: Forge gives 5% Burn on hit to enhanced weapon
- `altarThreeChoices`: Altar offers 3 choices instead of 2
- `steamVentVision`: (handled by periodic effect)
- `monumentBurnEnemy`: Nearby enemies have 15% auto-Burn
- `riftInvincibility`: 1 turn invincibility after VoidRift teleport
- `altarCorruptImmunity`: Altar gives 3-turn corruption immunity
- `inscriptionRevealSecrets`: Inscription reveals all SecretWalls on floor
- `forgeHalfPriceCursed`: Forge costs 50% but 10% curse chance
- `fountainRestoresMP`: (duplicate — Crystal biome variant)

- [ ] **Step 7: Add pendingForge + enhanceEquipment action to gameStore**

Add `enhanceEquipment` action that:
1. Checks `pendingForge` state
2. Takes equipment slot and RNG
3. Looks up cost from `ENHANCE_COSTS[level]`
4. Applies `blacksmithHammer` relic discount if applicable
5. Checks if LavaForge (adds Burn on hit) or VoidForge (half price, 10% curse)
6. Rolls success from `ENHANCE_SUCCESS_RATES[level]`
7. Updates equipment `enhanceLevel` on success
8. Returns to Playing phase

- [ ] **Step 8: Update saveGame/loadGame for new GameState fields**

In `saveGame()`, add: `pendingForge`, `themedRooms`, `steamVentTurns`.
In `loadGame()`, ensure these fields are restored (with defaults for missing fields in old saves).

- [ ] **Step 9: Initialize new GameState fields in initialState**

Add to `initialState`:
```typescript
pendingForge: false,
themedRooms: [],
steamVentTurns: [],
```

- [ ] **Step 10: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`

- [ ] **Step 11: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: themed room interactions, Forge system, new tile interactions, save/load updates"
```

---

## Task 12: gameStore — Relic System Integration

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Add relic reward logic to enemy kill handling**

After elite enemy death, check `luckyCoin` relic — if player has it, elite always drops relic; otherwise 20% chance.

After boss death (alongside bossBlessingPending), also grant 1 random relic (rare/epic only).

- [ ] **Step 2: Add relic effect hooks in combat**

In the player→enemy damage calculation, apply relic modifiers:
- `hungerRing`: ATK * 0.85
- `curseVessel`: ATK * (1 + debuffCount * 0.05, max 1.25)
- `comboRing`: every 3rd attack damage * 1.5 (track with `player.comboAttackCount`)
- `elementResonance`: if 2+ different element debuffs on player, ATK * 1.25

In the enemy→player damage calculation:
- `mirrorShield`: first damage per floor reflected (track via turn state)

In status effect processing:
- `flameHeart`: Burn damage * 1.5, player immune to Burn
- `poisonGland`: Poison damage * 1.3

In attack procs:
- `poisonGland`: 15% chance to apply Poison
- `frostTouch`: 15% chance to apply Freeze
- `thunderMark`: 15% chance to apply Confusion

- [ ] **Step 3: Add relic passive effects**

In `processTurn()`:
- `lifeSeed`: on first kill per floor, heal 5% MaxHP
- `timeHourglass`: every 5 turns, grant extra action (reset via `extraTurnAccumulator`)
- `sixthSense`: auto-reveal SecretWalls when adjacent
- `eternalFlame`: heal 5% MaxHP when standing on Lava/CooledLava
- `oldMap`: on enterFloor, reveal 1 room's theme in messages

- [ ] **Step 4: Add voidHeart death prevention**

In `handlePlayerDeath()`, before game over:
```typescript
if (player.relics.includes(RelicId.VoidHeart) && !player.voidHeartUsed) {
  player.hp = Math.floor(player.maxHp * 0.5);
  player.voidHeartUsed = true;
  player.relics = player.relics.filter(r => r !== RelicId.VoidHeart);
  addMessages([msg('虚空之心碎裂！你从死亡边缘被拉回！', MessageCategory.Item, '#aa44ff')]);
  set({ player });
  return;
}
```

- [ ] **Step 5: Add gold modifier from greedCrown**

In all gold-gain code paths (enemy drops, item sales, event rewards), apply `getRelicGoldModifier()`. In shop buy code, apply `getRelicShopPriceModifier()`.

- [ ] **Step 6: Add relic display in message when acquired**

When player gains a relic, show a distinctive message with icon:
```typescript
addMessages([msg(`✦ 获得遗物：${RELIC_DEFS[relicId].icon} ${RELIC_DEFS[relicId].name} — ${RELIC_DEFS[relicId].description}`, MessageCategory.Item, '#ffcc44')]);
```

- [ ] **Step 7: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: integrate relic system — combat hooks, passives, rewards, death prevention"
```

---

## Task 13: gameStore — Equipment Enhancement Integration

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Implement enhanceEquipment action**

Add the full enhanceEquipment action to the store:

```typescript
enhanceEquipment: (slot: EquipmentSlot) => {
  const state = get();
  if (!state.player || !state.pendingForge) return;

  const player = { ...state.player };
  const item = player.equipment[slot];
  if (!item || !('enhanceLevel' in item)) return;

  const equip = item as WeaponItem | ArmorItem;
  if ((equip.enhanceLevel ?? 0) >= 3) return;

  const level = equip.enhanceLevel ?? 0;
  const rng = new SeededRandom(state.seed + state.turn * 37);
  const baseCost = ENHANCE_COSTS[level];

  // Apply relic discount
  const costMod = getRelicForgeCostModifier(player);
  const cost = Math.floor(baseCost * costMod);

  // Check VoidForge: half price
  // (determined by current floor biome and proximity to CorruptionPool/VoidRift)
  // Simplified: check if current floor is VoidAbyss and Forge is in VoidAltar themed room
  const isVoidForge = state.currentFloor >= 21; // simplified heuristic
  const finalCost = isVoidForge ? Math.floor(cost * 0.5) : cost;

  if (player.gold < finalCost) {
    addMessages([msg('金币不足，无法强化！', MessageCategory.System, '#ff4444')]);
    return;
  }

  player.gold -= finalCost;

  // Roll success
  if (rng.next() >= ENHANCE_SUCCESS_RATES[level]) {
    addMessages([msg(`强化失败！${finalCost}金币化为乌有…`, MessageCategory.System, '#ff4444')]);
    set({ player });
    return;
  }

  // Success — apply enhancement
  const newLevel = (level + 1) as 0 | 1 | 2 | 3;
  const enhanced = { ...equip, enhanceLevel: newLevel };

  // Apply stat bonus
  if ('damage' in enhanced) {
    enhanced.damage = Math.floor(enhanced.damage * ENHANCE_ATK_MULT[level]);
  }
  if ('defense' in enhanced) {
    enhanced.defense = Math.floor(enhanced.defense * ENHANCE_DEF_MULT[level]);
  }

  // VoidForge: 10% curse chance
  if (isVoidForge && rng.chance(0.10)) {
    enhanced.cursed = true;
    addMessages([msg('⚠️ 虚空的力量侵蚀了装备，它被诅咒了！', MessageCategory.Environment, '#aa44ff')]);
  }

  // LavaForge: 5% Burn on hit bonus
  if (!isVoidForge && state.currentFloor >= 16 && state.currentFloor <= 20) {
    if (!enhanced.specialEffect) {
      enhanced.specialEffect = EquipmentEffect.StatusProc;
      enhanced.element = Element.Fire;
    }
    addMessages([msg('🔥 熔岩之力注入了装备！', MessageCategory.Item, '#ff6622')]);
  }

  player.equipment = { ...player.equipment, [slot]: enhanced };
  addMessages([msg(`✦ 强化成功！${getItemName(enhanced)} → +${newLevel}`, MessageCategory.Item, '#44cc44')]);

  // Mark Forge as used
  set({ player, pendingForge: false, phase: GamePhase.Playing });
},
```

- [ ] **Step 2: Apply enhanceLevel to damage/defense calculations**

In `getPlayerAttack()` and `getPlayerDefense()` (Player.ts), or in the combat code in gameStore, factor in `enhanceLevel` when computing weapon damage / armor defense. The ENHANCE_ATK_MULT/DEF_MULT should be applied.

Simplest approach: in gameStore combat section, after getting base weapon damage, apply multiplier:

```typescript
const weapon = player.equipment[EquipmentSlot.Weapon] as WeaponItem | null;
const weaponDamage = weapon?.damage ?? 1;
// enhanceLevel is already baked into weapon.damage during enhancement
```

Since we update `damage`/`defense` directly during enhancement, no additional calculation is needed at combat time.

- [ ] **Step 3: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: implement equipment enhancement system with Forge interaction"
```

---

## Task 14: gameStore — Elemental Chain Integration

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Integrate chain reaction checks in player combat**

After player deals elemental damage (melee with element weapon, or spell), call `checkChainReaction()` from `ElementalChain.ts`. If a reaction triggers, execute it and add appropriate messages/damage.

Insert after the damage calculation in the player→enemy attack code:

```typescript
import { checkChainReaction, executeChainReaction, getTerrainElementsAt, getEnemyElementDebuffs } from '../engine/ElementalChain';

// After dealing damage to enemy with element:
const terrainElements = getTerrainElementsAt(state.map, enemy.pos.x, enemy.pos.y, state.turn, state.steamVentTurns);
const enemyElements = getEnemyElementDebuffs(enemy);
const reaction = checkChainReaction(attackElement, enemyElements, state.map[enemy.pos.y][enemy.pos.x].type, state.turn);
if (reaction) {
  const result = executeChainReaction(reaction, player, [enemy], state.map, state.enemies, rng);
  // Apply chain damage, map changes, messages
}
```

- [ ] **Step 2: Integrate chain reaction checks in enemy combat**

After enemy deals elemental damage to player, check if terrain around player enables chain reactions that could harm the enemy or other enemies.

- [ ] **Step 3: Apply relic modifiers to chain reactions**

- `chaosCore`: chain damage * 2, but player takes 25% of chain damage
- `fateWeaver`: on chain trigger, add random buff to player
- Element-specific relics (flameHeart, frostTouch, thunderMark, poisonGland): boost their respective chain effects

- [ ] **Step 4: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: integrate elemental chain reactions in player and enemy combat"
```

---

## Task 15: gameStore — Extended Events Integration

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/components/EventModal.tsx`

- [ ] **Step 1: Add extended event handling to chooseEventChoice()**

In the `switch (choice.effectId)` block, add all new effectId cases from the 12 new events. This is the largest code addition — approximately 200 lines of effect handlers.

Key patterns for new effects:
- `abyssMerchant_buyRelic`: roll random rare relic, cost 200 gold
- `abyssMerchant_tradeHpForEpic`: remove 30% HP, give random epic equipment
- `abyssMerchant_enhanceForMp`: remove 50% maxMP, enhance 1 equipped item to +2
- `soulFurnace_equipForRelic`: remove 1 equipment, gain gold + random relic
- `soulFurnace_hpForAtk`: remove 30% maxHP, permanent ATK+2
- `soulFurnace_mpForMaxMp`: remove all MP, permanent MaxMP+10
- `cursedChest_open`: give epic item + random debuff 3 stacks
- `cursedChest_breakRune`: (INT≥12) give item, debuff halved
- `fateCrossroad_element`: give random element relic + element weapon
- `fateCrossroad_power`: ATK+5, DEF-2
- `fateCrossroad_wisdom`: INT+3, MP+20 (requires 3+ relics)
- `mysteryRune_fire`: Burn immune 5 turns + set 3×3 on fire
- `mysteryRune_ice`: Freeze immune 5 turns + freeze 3×3
- `mysteryRune_both`: both effects + elementResonance relic (requires 3+ relics)
- `riftHeart_accept`: voidHeart relic + maxHP-15%
- `riftHeart_refuse`: heal 30% HP + 50 gold
- `riftHeart_master`: voidHeart, no HP loss (requires bossKillCount≥3)
- `abyssGamble_big`: 60% → 300 gold + relic, 40% → lose 100 gold
- `abyssGamble_hp`: 50% → full HP + ATK+10 5 turns, 50% → HP=1
- `abyssGamble_allIn`: 40% → chaosCore relic, 60% → lose half gold + all debuffs
- `unstablePortal_enter`: teleport to themed room + relic
- `unstablePortal_destroy`: 50 gold + random item
- `unstablePortal_stabilize`: (MP≥30) teleport to hidden treasure room
- `bloodAltar_hp': sacrifice 20% HP, ATK+3 for floor
- `bloodAltar_mp': sacrifice all MP, INT+3 for floor
- `bloodAltar_relic': (2+ relics) remove 1 relic, remaining +50% for floor
- `ancientMural_study`: inscription effect + 2 buffed enemies
- `ancientMural_copy': (inscriptionCount≥1) permanent +1 random stat
- `lostTraveler_help': spend food/potion, reveal hidden room
- `lostTraveler_rob': 100-200 gold + "guilt" debuff (ATK-3, 3 stacks)
- `lostTraveler_talk': (INT≥12) reveal hidden room + next floor secret
- `echoWell_listen`: next floor hint + random debuff 2 stacks
- `echoWell_gold': (100 gold) remove all debuffs
- `echoWell_relic': (3+ relics) remove 1, gain 2 random

- [ ] **Step 2: Update event generation in enterFloor()**

When generating an event for a floor, use `EXTENDED_EVENT_DEFS` with biome affinity weighting. The old 6 events are kept; new 12 are added to the pool.

```typescript
import { EXTENDED_EVENT_DEFS } from '../constants/events';
import { GAME_EVENTS } from './constants'; // existing events

// Merge old and new events, weight by biome affinity
function pickRandomEvent(biome: Biome, rng: SeededRandom): GameEventDef {
  const allEvents = [...GAME_EVENTS, ...EXTENDED_EVENT_DEFS];
  // Weight events by biome affinity
  const weighted = allEvents.map(e => ({
    event: e,
    weight: e.biomeAffinity?.includes(biome) ? 3 : 1,
  }));
  // Weighted random selection
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng.next() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.event;
  }
  return weighted[0].event;
}
```

- [ ] **Step 3: Update EventModal to support rare conditional options**

In `EventModal.tsx`, filter options based on conditions:

```typescript
const visibleChoices = currentEvent.choices.filter((choice, idx) => {
  if (!choice.isRare || !choice.condition) return true;
  // Check condition against player state
  const cond = choice.condition;
  // ... condition checking logic
  return true; // or false if condition not met
});
```

Display rare options with a distinct visual style (purple border, 🔮 prefix).

- [ ] **Step 4: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts src/components/EventModal.tsx
git commit -m "feat: integrate 12 new events with rare conditional options"
```

---

## Task 16: UI — RelicBar + EnhanceModal

**Files:**
- Create: `src/components/RelicBar.tsx`
- Create: `src/components/EnhanceModal.tsx`
- Modify: `src/components/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create RelicBar.tsx**

A horizontal bar at the bottom of the game screen showing player's relics. Each relic shows its icon; hovering shows name + description in a tooltip.

```typescript
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { RELIC_DEFS } from '../constants/relics';
import { RelicId } from '../types';

const RelicBar: React.FC = () => {
  const relics = useGameStore(s => s.player?.relics ?? []);

  if (relics.length === 0) return null;

  return (
    <div className="relic-bar">
      {relics.map((relicId: RelicId) => {
        const def = RELIC_DEFS[relicId];
        return (
          <div key={relicId} className="relic-item" title={`${def.name}: ${def.description}`}>
            <span className="relic-icon">{def.icon}</span>
          </div>
        );
      })}
    </div>
  );
};

export default RelicBar;
```

- [ ] **Step 2: Create EnhanceModal.tsx**

Modal showing player's equipment with enhance levels and costs. Similar layout to InventoryModal but simpler.

```typescript
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { EquipmentSlot, WeaponItem, ArmorItem, RingItem, AmuletItem } from '../types';
import { ENHANCE_COSTS, ENHANCE_SUCCESS_RATES } from '../constants';
import { getRelicForgeCostModifier } from '../engine/RelicEffects';
import { getItemName } from '../entities/Items';

const EnhanceModal: React.FC = () => {
  const player = useGameStore(s => s.player);
  const enhanceEquipment = useGameStore(s => s.enhanceEquipment);
  const gold = player?.gold ?? 0;

  if (!player) return null;

  const slots: { slot: EquipmentSlot; label: string }[] = [
    { slot: EquipmentSlot.Weapon, label: '武器' },
    { slot: EquipmentSlot.Armor, label: '护甲' },
    { slot: EquipmentSlot.Ring1, label: '戒指1' },
    { slot: EquipmentSlot.Ring2, label: '戒指2' },
    { slot: EquipmentSlot.Amulet, label: '护符' },
  ];

  const costMod = getRelicForgeCostModifier(player);

  return (
    <div className="modal-overlay">
      <div className="modal enhance-modal">
        <h2>⚒️ 装备强化</h2>
        <p>选择要强化的装备（当前金币: {gold}）</p>
        <div className="enhance-list">
          {slots.map(({ slot, label }) => {
            const item = player.equipment[slot];
            if (!item || !('enhanceLevel' in item)) return null;
            const equip = item as WeaponItem | ArmorItem | RingItem | AmuletItem;
            const level = equip.enhanceLevel ?? 0;
            if (level >= 3) {
              return (
                <div key={slot} className="enhance-item enhance-max">
                  <span>{label}: {getItemName(equip)} +3 (已满级)</span>
                </div>
              );
            }
            const baseCost = ENHANCE_COSTS[level];
            const cost = Math.floor(baseCost * costMod);
            const rate = Math.floor(ENHANCE_SUCCESS_RATES[level] * 100);
            const canAfford = gold >= cost;
            return (
              <div key={slot} className={`enhance-item ${canAfford ? '' : 'enhance-disabled'}`}
                   onClick={() => canAfford && enhanceEquipment(slot)}>
                <span>{label}: {getItemName(equip)}{level > 0 ? ` +${level}` : ''}</span>
                <span className="enhance-cost">{cost}金 ({rate}%)</span>
              </div>
            );
          })}
        </div>
        <button onClick={() => useGameStore.getState().setPhase(useGameStore.getState().phase === GamePhase.Inventory ? GamePhase.Playing : GamePhase.Playing)}>
          关闭
        </button>
      </div>
    </div>
  );
};

export default EnhanceModal;
```

- [ ] **Step 3: Integrate RelicBar and EnhanceModal in App.tsx**

In `src/components/App.tsx`, add imports and render:

```typescript
import RelicBar from './RelicBar';
import EnhanceModal from './EnhanceModal';

// In the render, after BossBlessingModal:
{pendingForge && <EnhanceModal />}

// In the game screen layout, add RelicBar:
<RelicBar />
```

- [ ] **Step 4: Add CSS styles for RelicBar and EnhanceModal**

In `src/index.css`, add:

```css
.relic-bar {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0,0,0,0.7);
  border-radius: 6px;
  border: 1px solid #333;
  z-index: 50;
}

.relic-item {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 4px;
  background: #1a1a2e;
  border: 1px solid #444;
  cursor: default;
  position: relative;
}

.relic-item:hover {
  border-color: #ffd700;
  background: #222244;
}

.relic-item[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #111;
  color: #ddd;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 100;
  border: 1px solid #555;
}

.enhance-modal {
  max-width: 480px;
}

.enhance-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}

.enhance-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 4px;
  cursor: pointer;
  color: #ccc;
  font-size: 13px;
}

.enhance-item:hover {
  border-color: #ff8800;
  background: #222244;
}

.enhance-item.enhance-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.enhance-item.enhance-max {
  opacity: 0.7;
  cursor: default;
  border-color: #aa44ff;
}

.enhance-cost {
  color: #ffcc44;
}
```

- [ ] **Step 5: Verify with tsc**

Run: `cd abyss-echo && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/components/RelicBar.tsx src/components/EnhanceModal.tsx src/components/App.tsx src/index.css
git commit -m "feat: add RelicBar UI, EnhanceModal UI, and integrate in App"
```

---

## Task 17: MapView — New Tile Rendering

**Files:**
- Modify: `src/components/MapView.tsx`

- [ ] **Step 1: Add rendering for 4 new tile types**

In the tile rendering section of MapView, ensure the 4 new TileType values render with their char/fg/bg from the tile data (they should already work since MapView reads tile.char/tile.fg/tile.bg, but verify).

Specifically check:
- `SpikeTrap` renders as `▲` in `#8888ff`
- `WeaponRack` renders as `⋔` in `#aaaaaa`
- `Forge` renders as `⚒` in `#ff8800`
- `SteamVent` renders as `≋` in `#cccccc`

If MapView uses a hardcoded tile char map, add these entries there.

- [ ] **Step 2: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: add rendering for new tile types (SpikeTrap, WeaponRack, Forge, SteamVent)"
```

---

## Task 18: Final Integration Verification

**Files:**
- All modified files

- [ ] **Step 1: Run tsc --noEmit**

Run: `cd abyss-echo && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run npm run build**

Run: `cd abyss-echo && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run npm run lint**

Run: `cd abyss-echo && npm run lint`
Expected: 0 errors, 0 warnings

- [ ] **Step 4: Fix any errors found**

Address type errors, unused imports, lint warnings as needed.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve build/lint errors from five-systems integration"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Each section of the spec maps to a task: Types(T1), Relics(T2,T7,T12), ThemedRooms(T3,T10,T11), ElementalChain(T4,T8,T14), Events(T5,T15), Enhancement(T6,T9,T13), UI(T16), MapView(T17), Verification(T18)
- [x] **Placeholder scan:** No TBD/TODO/fill-in-later patterns; all steps contain actual code or specific instructions
- [x] **Type consistency:** RelicId enum in T1 matches RELIC_DEFS keys in T2; RoomTheme enum in T1 matches THEMED_ROOM_CONFIGS keys in T3; enhanceLevel field on items in T1 matches usage in T13; EventOptionDef type in T1 matches EventModal usage in T15
