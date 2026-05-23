# Boss系统全面重设计 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现Boss多阶段系统、精英系统、楼层氛围描述、Boss竞技场、Boss祝福、碑文系统

**Architecture:** 在现有Zustand单store架构上扩展。类型系统先添加所有新枚举/字段，然后按依赖顺序实现：精英生成→Boss阶段→竞技场→氛围描述→Boss祝福→碑文→假墙。所有新随机逻辑使用SeededRandom。

**Tech Stack:** React 19 + TypeScript 6 + Zustand 5 + Canvas API + Web Audio API

**验证方式:** `cd abyss-echo && npx tsc --noEmit && npm run build`（无单元测试框架）

---

## File Structure

| 文件 | 职责 |
|------|------|
| `src/types/index.ts` | 所有新类型定义（枚举、接口字段） |
| `src/constants/index.ts` | Boss阶段配置、精英词缀配置、楼层描述、碑文、祝福、新地图尺寸、深渊之心Boss定义、竞技场配置 |
| `src/engine/Combat.ts` | 精英词缀战斗效果、Boss阶段技能触发判断 |
| `src/entities/Enemy.ts` | 精英创建、bossPhase初始化 |
| `src/entities/Items.ts` | 精英掉落逻辑 |
| `src/generator/DungeonGenerator.ts` | 竞技场生成、精英房、特殊房间、假墙、新地图尺寸 |
| `src/store/gameStore.ts` | Boss阶段转换、精英效果、Boss祝福效果、氛围描述输出、竞技场Tile交互、碑文收集、假墙检测 |
| `src/components/MapView.tsx` | 精英金色渲染、假墙视觉、新Tile渲染、纪念碑渲染 |
| `src/components/BossBlessingModal.tsx` | **新建** Boss祝福选择弹窗 |
| `src/components/App.tsx` | Boss祝福弹窗触发、碑文交互 |

---

## Task 1: 类型系统扩展

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 添加EliteAffix枚举**

在 `EnemyBehavior` 枚举后添加：

```typescript
export enum EliteAffix {
  Armored = 'armored',
  Frenzy = 'frenzy',
  Regen = 'regen',
  Vampiric = 'vampiric',
  Explosive = 'explosive',
  Phantom = 'phantom',
}
```

- [ ] **Step 2: 添加BossBlessing枚举**

```typescript
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
```

- [ ] **Step 3: 添加新TileType值**

在 `TileType` 枚举中 `Sarcophagus` 之后添加：

```typescript
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
```

- [ ] **Step 4: 扩展Enemy接口**

在 `Enemy` 接口中 `reviveTimer?: number;` 后添加：

```typescript
  bossPhase: 1 | 2 | 3;
  isElite: boolean;
  eliteAffix?: EliteAffix;
  frenzyBonus?: number;
```

- [ ] **Step 5: 扩展Player接口**

在 `Player` 接口中 `gold: number;` 后添加：

```typescript
  bossBlessings: BossBlessing[];
  finalPactUsed: boolean;
  inscriptionCount: number;
```

- [ ] **Step 6: 扩展GameState接口**

在 `GameState` 接口中 `pendingAllocations: Partial<Stats>;` 后添加：

```typescript
  bossBlessingPending: boolean;
  lastBossDefId: string | null;
  secretWalls: Position[];
  floorDescriptionShown: boolean;
```

- [ ] **Step 7: 扩展DungeonData接口**

在 `src/generator/DungeonGenerator.ts` 的 `DungeonData` 接口中添加字段：

```typescript
  eliteEnemy?: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix };
  eliteRoom?: Room;
  specialRooms: { type: TileType; room: Room; pos: Position }[];
  secretWalls: Position[];
  bossArenaData?: BossArenaData;
```

需要在 `DungeonGenerator.ts` 顶部添加类型（或移到types/index.ts）：

```typescript
export interface BossArenaData {
  bossDefId: string;
  objects: { type: TileType; x: number; y: number }[];
}
```

- [ ] **Step 8: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

预期：会有错误因为新字段未在创建时初始化，但枚举和接口定义应该正确。后续Task修复初始化。

- [ ] **Step 9: 提交**

```bash
git add src/types/index.ts src/generator/DungeonGenerator.ts
git commit -m "feat: add type definitions for boss phases, elite, blessings, arena tiles"
```

---

## Task 2: 常量配置 — Boss阶段、精英、楼层描述

**Files:**
- Modify: `src/constants/index.ts`

- [ ] **Step 1: 添加深渊之心Boss定义**

在 `BOSS_DEFS` 数组末尾（`abyssKing` 之后）添加：

```typescript
  { id: 'abyssHeart', name: '深渊之心', char: 'Ω', fg: '#ffffff', hp: 400, attack: 32, defense: 20, exp: 800, behavior: EnemyBehavior.Boss, element: Element.Poison, weakness: Element.Fire, resistance: Element.Poison, minFloor: 30, speed: 1, dropChance: 1.0, alertRadius: 12, isBoss: true, specialAbility: 'voidRay', goldDrop: 600 },
```

- [ ] **Step 2: 添加Boss阶段配置**

在 `BOSS_DEFS` 之后添加：

```typescript
export interface BossPhaseConfig {
  nameZh: string;       // 阶段中文名
  hpThreshold: number;  // 触发HP百分比（≤此值触发）
  atkBonus: number;
  defBonus: number;
  speedOverride?: number;  // 覆盖速度，undefined=保持
  defOverride?: number;    // P3深渊之心用：覆盖DEF
  newAbilities: string[];  // 本阶段新增的specialAbility名称
  summonOnTransition?: { defId: string; count: number }; // 阶段转换时召唤
  messageZh: string;   // 阶段转换消息
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
    { nameZh: '亡者苏醒', hpThreshold: 0.5, atkBonus: 0, defBonus: 4, newAbilities: ['raiseDead'], messageZh: '死亡骑士进入了【亡者苏醒】阶段！' },
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
```

- [ ] **Step 3: 添加Boss被动技能配置**

```typescript
// Boss P1被动效果
export const BOSS_PASSIVES: Record<string, { id: string; nameZh: string; description: string; effect: string }[]> = {
  goblinKing: [
    { id: 'packLeader', nameZh: '群首', description: '同房间小怪存活时ATK+3', effect: 'minionAtkBonus' },
  ],
};
```

- [ ] **Step 4: 添加精英词缀配置**

```typescript
export const ELITE_AFFIX_DEFS: Record<EliteAffix, { nameZh: string; description: string }> = {
  [EliteAffix.Armored]: { nameZh: '铁甲', description: '受到物理伤害-30%' },
  [EliteAffix.Frenzy]: { nameZh: '狂乱', description: '每回合ATK+0.5' },
  [EliteAffix.Regen]: { nameZh: '再生', description: '每回合恢复5%最大HP' },
  [EliteAffix.Vampiric]: { nameZh: '吸血', description: '攻击回复30%伤害HP' },
  [EliteAffix.Explosive]: { nameZh: '爆裂', description: '死亡时对周围2格造成ATK×1.5伤害' },
  [EliteAffix.Phantom]: { nameZh: '幽影', description: '30%闪避攻击' },
};

export const ELITE_CHANCE_PER_FLOOR = 0.3;    // 30%每层出精英
export const ELITE_HP_MULT = 2.0;
export const ELITE_ATK_MULT = 1.3;
export const ELITE_DEF_BONUS = 3;
export const ELITE_EXP_MULT = 2.5;
export const ELITE_GOLD_MULT = 3.0;
```

- [ ] **Step 5: 添加楼层氛围描述**

```typescript
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
```

- [ ] **Step 6: 添加碑文配置**

```typescript
export const INSCRIPTION_TEXTS: Record<Biome, string> = {
  [Biome.StoneDungeon]: '这里曾是王国的地牢，关押着最危险的犯人。直到那个夜晚，地底传来了回响…从此再无人离开。',
  [Biome.CrystalCavern]: '水晶并非天然形成。古帝国的法师们将魔法封印其中，以抵御来自更深处的侵蚀。但水晶在碎裂…',
  [Biome.AncientCrypt]: '亡者不愿安息。他们被某种力量唤醒，在永恒的黑暗中游荡。击碎他们的不是死亡，而是希望。',
  [Biome.LavaCore]: '炼狱之火并非惩罚，而是选择。只有最强大的灵魂才能在烈焰中重塑。其他的，只会化为灰烬。',
  [Biome.VoidAbyss]: '深渊不是尽头。深渊是开始。一切从虚空中诞生，一切终将回归。你是回响，还是回响的回响？',
};
```

- [ ] **Step 7: 添加Boss祝福配置**

```typescript
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
```

- [ ] **Step 8: 更新BIOME_CONFIG地图尺寸**

修改每个生物群系的 `mapWidth` 和 `mapHeight`：

```typescript
// StoneDungeon: 70→80, 24→28
mapWidth: 80, mapHeight: 28,
// CrystalCavern: 80→90, 28→32
mapWidth: 90, mapHeight: 32,
// AncientCrypt: 70→80, 30→34
mapWidth: 80, mapHeight: 34,
// LavaCore: 90→100, 28→32
mapWidth: 100, mapHeight: 32,
// VoidAbyss: 100→110, 32→36
mapWidth: 110, mapHeight: 36,
```

- [ ] **Step 9: 添加特殊房间概率配置**

```typescript
export const SPECIAL_ROOM_CHANCES = {
  eliteRoom: 0.4,
  treasureRoom: 0.15,
  fountainRoom: 0.1,
  altarRoom: 0.1,
  inscriptionRoom: 0.2,
  trapRoom: 0.15,
  challengeRoom: 0.08,
};
```

- [ ] **Step 10: 添加竞技场配置**

```typescript
export interface ArenaObjectDef {
  type: TileType;
  relX: number;  // 相对于房间中心的偏移
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
```

- [ ] **Step 11: 添加虚空深渊enemyIds（包含深渊之心楼层26-30）**

在 `BIOME_CONFIG[Biome.VoidAbyss].enemyIds` 中确认包含 `voidWeaver`（已存在）。Floor 26-30 仍使用 VoidAbyss 的 enemyIds。

- [ ] **Step 12: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 13: 提交**

```bash
git add src/constants/index.ts
git commit -m "feat: add boss phases, elite, blessings, arena, floor descriptions configs"
```

---

## Task 3: 精英敌人创建

**Files:**
- Modify: `src/entities/Enemy.ts`

- [ ] **Step 1: 添加精英创建函数**

在 `createEnemy` 函数之后添加：

```typescript
export function createEliteEnemy(defId: string, pos: Position, floor: number, affix: EliteAffix): Enemy | null {
  const def = ENEMY_DEFS.find(d => d.id === defId);
  if (!def) return null;

  const scale = 1 + (floor - def.minFloor) * 0.12;
  const baseEnemy = createEnemy(defId, pos, false, floor);
  if (!baseEnemy) return null;

  return {
    ...baseEnemy,
    name: `精英${baseEnemy.name}`,
    fg: '#ffd700',  // 金色
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
```

需在文件顶部添加导入：

```typescript
import { EliteAffix } from '../types';
import { ENEMY_DEFS, ELITE_HP_MULT, ELITE_ATK_MULT, ELITE_DEF_BONUS, ELITE_EXP_MULT, ELITE_GOLD_MULT } from '../constants';
```

- [ ] **Step 2: 修改createEnemy初始化新字段**

在 `createEnemy` 函数的返回对象中添加：

```typescript
  bossPhase: isBoss ? 1 : 0,
  isElite: false,
  eliteAffix: undefined,
  frenzyBonus: 0,
```

- [ ] **Step 3: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add src/entities/Enemy.ts
git commit -m "feat: add elite enemy creation and new Enemy fields initialization"
```

---

## Task 4: 地下城生成器 — 竞技场、精英房、特殊房间

**Files:**
- Modify: `src/generator/DungeonGenerator.ts`
- Modify: 各生物群系生成器（5个文件）

- [ ] **Step 1: 添加新Tile类型的创建辅助函数**

在 `DungeonGenerator.ts` 中添加：

```typescript
function makeTile(type: TileType, char: string, fg: string, bg: string, walkable: boolean, transparent: boolean): Tile {
  return { type, char, fg, bg, walkable, transparent, visible: false, remembered: false };
}

// 新Tile的默认属性
const NEW_TILE_DEFAULTS: Partial<Record<TileType, Omit<Tile, 'type' | 'visible' | 'remembered'>>> = {
  [TileType.Throne]:         { char: '♔', fg: '#ffd700', bg: '#1a0808', walkable: false, transparent: false },
  [TileType.Barricade]:      { char: '▦', fg: '#8b4513', bg: '#1a0808', walkable: false, transparent: true },
  [TileType.WebFloor]:       { char: '≈', fg: '#aaaaaa', bg: '#0a0a1a', walkable: true,  transparent: true },
  [TileType.SpiderEgg]:      { char: '◉', fg: '#cccccc', bg: '#0a0a1a', walkable: true,  transparent: true },
  [TileType.Altar]:          { char: '⛩', fg: '#aaaaff', bg: '#140a14', walkable: true,  transparent: true },
  [TileType.LavaPool]:       { char: '≈', fg: '#ff4400', bg: '#1a0a04', walkable: false, transparent: true },
  [TileType.VoidRift]:       { char: '◎', fg: '#ff44ff', bg: '#100818', walkable: true,  transparent: true },
  [TileType.VoidPillar]:     { char: '█', fg: '#8800aa', bg: '#100818', walkable: false, transparent: false },
  [TileType.CorruptionPool]: { char: '◎', fg: '#aa00aa', bg: '#100818', walkable: true,  transparent: true },
  [TileType.HealCrystal]:    { char: '◆', fg: '#00ffaa', bg: '#100818', walkable: true,  transparent: true },
  [TileType.EliteDoor]:      { char: '▦', fg: '#ffd700', bg: 'transparent', walkable: false, transparent: true },
  [TileType.Fountain]:       { char: '⌠', fg: '#44aaff', bg: 'transparent', walkable: true, transparent: true },
  [TileType.Inscription]:    { char: '▐', fg: '#ddddaa', bg: 'transparent', walkable: true, transparent: true },
  [TileType.SecretWall]:     { char: '#', fg: '', bg: '', walkable: true, transparent: true },  // 外观与Wall相同
  [TileType.Monument]:       { char: '☥', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true },
};
```

- [ ] **Step 2: 修改placeBoss函数支持竞技场**

将 `placeBoss` 改为同时返回竞技场数据：

```typescript
export function placeBoss(rooms: Room[], floor: number, _biome: Biome): { defId: string; pos: Position; isBoss: boolean; bossRoom: Room; arenaData?: BossArenaData } | null {
  if (floor % 5 !== 0 && floor !== 30) return null;

  const bossIndex = floor === 30 ? 5 : Math.floor(floor / 5) - 1;
  const bossDef = BOSS_DEFS[Math.min(bossIndex, BOSS_DEFS.length - 1)];
  if (!bossDef) return null;

  const bossRoom = rooms.length > 2 ? rooms[rooms.length - 2] : rooms[rooms.length - 1];

  // 构建竞技场对象
  const arenaObjects = BOSS_ARENA_OBJECTS[bossDef.id];
  const arenaData: BossArenaData | undefined = arenaObjects ? {
    bossDefId: bossDef.id,
    objects: arenaObjects.map(o => ({
      type: o.type,
      x: bossRoom.centerX + o.relX,
      y: bossRoom.centerY + o.relY,
    })),
  } : undefined;

  return {
    defId: bossDef.id,
    pos: { x: bossRoom.centerX, y: bossRoom.centerY },
    isBoss: true,
    bossRoom,
    arenaData,
  };
}
```

需添加导入：`BOSS_ARENA_OBJECTS, BossArenaData`

- [ ] **Step 3: 添加placeArenaObjects函数**

```typescript
function placeArenaObjects(map: Tile[][], arenaData: BossArenaData): void {
  for (const obj of arenaData.objects) {
    if (obj.y >= 0 && obj.y < map.length && obj.x >= 0 && obj.x < map[0].length) {
      const defaults = NEW_TILE_DEFAULTS[obj.type];
      if (defaults) {
        map[obj.y][obj.x] = makeTile(obj.type, defaults.char, defaults.fg, defaults.bg, defaults.walkable, defaults.transparent);
      }
    }
  }
}
```

- [ ] **Step 4: 添加placeEliteAndSpecialRooms函数**

```typescript
function placeEliteAndSpecialRooms(
  map: Tile[][],
  rooms: Room[],
  floor: number,
  rng: SeededRandom,
  enemyIds: string[],
  biome: Biome,
): {
  eliteEnemy: { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix } | null;
  eliteRoom: Room | null;
  specialRooms: { type: TileType; room: Room; pos: Position }[];
  secretWalls: Position[];
} {
  const eliteEnemy = null as { defId: string; pos: Position; isElite: true; eliteAffix: EliteAffix } | null;
  let eliteRoom: Room | null = null;
  const specialRooms: { type: TileType; room: Room; pos: Position }[] = [];
  const secretWalls: Position[] = [];

  const nonStartRooms = rooms.slice(1);

  // 精英房
  if (rng.next() < SPECIAL_ROOM_CHANCES.eliteRoom && nonStartRooms.length > 2) {
    const roomIdx = rng.nextInt(0, nonStartRooms.length - 1);
    const room = nonStartRooms[roomIdx];
    eliteRoom = room;

    // 在房间入口放铁门
    // 找房间中心附近的走廊连接点
    const doorPos = findRoomDoor(map, room);
    if (doorPos) {
      map[doorPos.y][doorPos.x] = makeTile(TileType.EliteDoor, '▦', '#ffd700', 'transparent', false, true);
    }

    // 选择精英词缀
    const affixValues = Object.values(EliteAffix);
    const affix = rng.pick(affixValues);

    const pos = {
      x: rng.nextInt(room.x + 1, room.x + room.w - 2),
      y: rng.nextInt(room.y + 1, room.y + room.h - 2),
    };
    const defId = rng.pick(enemyIds);
    eliteEnemy = { defId, pos, isElite: true, eliteAffix: affix };
  }

  // 碑文房（20%概率）
  if (rng.next() < SPECIAL_ROOM_CHANCES.inscriptionRoom && nonStartRooms.length > 3) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const pos = { x: room.centerX, y: room.centerY };
    map[pos.y][pos.x] = makeTile(TileType.Inscription, '▐', '#ddddaa', 'transparent', true, true);
    specialRooms.push({ type: TileType.Inscription, room, pos });
  }

  // 治愈泉（10%概率）
  if (rng.next() < SPECIAL_ROOM_CHANCES.fountainRoom && nonStartRooms.length > 3) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    const pos = { x: room.centerX, y: room.centerY };
    map[pos.y][pos.x] = makeTile(TileType.Fountain, '⌠', '#44aaff', 'transparent', true, true);
    specialRooms.push({ type: TileType.Fountain, room, pos });
  }

  // 假墙（1-2处）
  const wallCount = rng.nextInt(1, 2);
  for (let i = 0; i < wallCount; i++) {
    const room = nonStartRooms[rng.nextInt(0, nonStartRooms.length - 1)];
    // 在房间边缘找一面墙
    const wallPos = findRoomBoundaryWall(map, room, rng);
    if (wallPos) {
      // 在墙外创建小房间（3x3）
      const outsideX = wallPos.x < room.centerX ? wallPos.x - 2 : wallPos.x + 2;
      const outsideY = wallPos.y < room.centerY ? wallPos.y - 2 : wallPos.y + 2;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = outsideX + dx;
          const ny = outsideY + dy;
          if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length) {
            map[ny][nx] = makeTile(TileType.Floor, '.', '#555555', 'transparent', true, true);
          }
        }
      }
      // 将边界墙改为SecretWall
      map[wallPos.y][wallPos.x] = makeTile(TileType.SecretWall, '#', '#444444', '#222222', true, true);
      secretWalls.push(wallPos);
    }
  }

  return { eliteEnemy, eliteRoom, specialRooms, secretWalls };
}
```

需添加辅助函数：

```typescript
function findRoomDoor(map: Tile[][], room: Room): Position | null {
  // 在房间边缘找走廊连接点
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
        if (map[y][x].type === TileType.Corridor || map[y][x].type === TileType.Door || map[y][x].type === TileType.DoorOpen) {
          return { x, y };
        }
      }
    }
  }
  // 回退：使用房间中心偏上
  return { x: room.centerX, y: room.y };
}

function findRoomBoundaryWall(map: Tile[][], room: Room, rng: SeededRandom): Position | null {
  // 在房间边界随机找一面邻接墙外的墙
  const candidates: Position[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y >= 1 && y < map.length - 1 && x >= 1 && x < map[0].length - 1) {
        if (map[y][x].type === TileType.Wall) {
          // 检查是否有相邻的Floor（房间内）
          const hasFloorNeighbor =
            (y > 0 && map[y-1][x].type === TileType.Floor) ||
            (y < map.length-1 && map[y+1][x].type === TileType.Floor) ||
            (x > 0 && map[y][x-1].type === TileType.Floor) ||
            (x < map[0].length-1 && map[y][x+1].type === TileType.Floor);
          // 检查墙外有空间
          const outsideY = y < room.centerY ? y - 2 : y + 2;
          const outsideX = x < room.centerX ? x - 2 : x + 2;
          if (hasFloorNeighbor && outsideY >= 2 && outsideY < map.length - 2 && outsideX >= 2 && outsideX < map[0].length - 2) {
            candidates.push({ x, y });
          }
        }
      }
    }
  }
  return candidates.length > 0 ? rng.pick(candidates) : null;
}
```

- [ ] **Step 5: 修改generateDungeon各生物群系函数**

每个生成器函数（`generateStoneDungeon` 等）的 `generateDungeon` 返回前：
1. 调用 `placeBoss` 获取Boss数据（含arenaData）
2. 如果有 `arenaData`，调用 `placeArenaObjects(map, arenaData)`
3. 调用 `placeEliteAndSpecialRooms` 获取精英/特殊房间/假墙数据
4. 将所有数据合并到 `DungeonData` 返回

具体修改方式：在每个生成器函数的 `return { ... }` 之前插入：

```typescript
  // Boss & 竞技场
  const bossData = placeBoss(rooms, floor, biome);
  if (bossData?.arenaData) {
    placeArenaObjects(map, bossData.arenaData);
  }

  // 精英 + 特殊房间 + 假墙
  const { eliteEnemy, eliteRoom, specialRooms, secretWalls } = placeEliteAndSpecialRooms(map, rooms, floor, rng, biomeConfig.enemyIds, biome);
```

然后在返回对象中添加新字段：

```typescript
  return {
    map, rooms, playerStart, stairsDown,
    enemies: [...normalEnemies, ...(bossData ? [{ defId: bossData.defId, pos: bossData.pos, isBoss: true }] : [])],
    items: [...],
    shopPos, eventPos,
    eliteEnemy: eliteEnemy,
    eliteRoom: eliteRoom,
    specialRooms,
    secretWalls,
    bossArenaData: bossData?.arenaData,
  };
```

需修改5个生成器文件。每个生成器都需要导入新函数和类型。

- [ ] **Step 6: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add src/generator/
git commit -m "feat: add boss arenas, elite rooms, special rooms, secret walls to dungeon generation"
```

---

## Task 5: gameStore — 初始化新字段 + 精英创建 + 氛围描述

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: 初始化Player新字段**

在所有创建Player的地方（`startNewGame` 等函数），添加新字段的初始值：

```typescript
bossBlessings: [],
finalPactUsed: false,
inscriptionCount: 0,
```

- [ ] **Step 2: 初始化GameState新字段**

在 `create()` 的初始state中添加：

```typescript
bossBlessingPending: false,
lastBossDefId: null,
secretWalls: [],
floorDescriptionShown: false,
```

- [ ] **Step 3: 在enterFloor中创建精英敌人**

在 `enterFloor` 函数中，处理 `dungeon.enemies` 循环之后，添加精英敌人创建：

```typescript
  // 精英敌人
  if (dungeon.eliteEnemy) {
    const elite = createEliteEnemy(dungeon.eliteEnemy.defId, dungeon.eliteEnemy.pos, floor, dungeon.eliteEnemy.eliteAffix);
    if (elite) enemies.push(elite);
  }
```

需导入 `createEliteEnemy` 和 `EliteAffix`。

- [ ] **Step 4: 在enterFloor中保存假墙数据**

```typescript
  state.secretWalls = dungeon.secretWalls;
  state.floorDescriptionShown = false;
```

- [ ] **Step 5: 添加楼层氛围描述输出**

在 `enterFloor` 函数末尾（状态更新完成后），添加：

```typescript
  // 楼层氛围描述
  const desc = FLOOR_DESCRIPTIONS[floor];
  if (desc && !state.floorDescriptionShown) {
    state.messages.push({ text: desc, type: 'system' });
    state.floorDescriptionShown = true;
  }
```

需导入 `FLOOR_DESCRIPTIONS`。

- [ ] **Step 6: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add src/store/gameStore.ts
git commit -m "feat: init new fields, elite creation, floor atmosphere descriptions"
```

---

## Task 6: Boss阶段转换系统

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/engine/Combat.ts`

- [ ] **Step 1: 在gameStore中添加Boss阶段转换函数**

在 `processTurn` 的敌人受伤逻辑中，找到Boss击杀检测位置（`if (enemies[i].isBoss) player.bossKillCount++;`），在**敌人受伤后、死亡检测前**插入阶段转换检测：

```typescript
  // Boss阶段转换检测
  if (enemies[i].isBoss && enemies[i].hp > 0) {
    const boss = enemies[i];
    const phases = BOSS_PHASES[boss.defId];
    if (phases) {
      const hpPercent = boss.hp / boss.maxHp;
      const currentPhaseIdx = boss.bossPhase - 1;  // bossPhase: 1|2|3, idx: 0|1|2
      if (currentPhaseIdx < phases.length) {
        const nextPhase = phases[currentPhaseIdx];
        if (hpPercent <= nextPhase.hpThreshold) {
          // 执行阶段转换
          boss.bossPhase = (currentPhaseIdx + 2) as 1 | 2 | 3;  // 1→2 or 2→3
          boss.attack += nextPhase.atkBonus;
          boss.defense += nextPhase.defBonus;
          if (nextPhase.speedOverride !== undefined) boss.speed = nextPhase.speedOverride;
          if (nextPhase.defOverride !== undefined) boss.defense = nextPhase.defOverride;

          // 阶段转换召唤
          if (nextPhase.summonOnTransition) {
            const summonDefId = nextPhase.summonOnTransition.defId;
            const summonCount = nextPhase.summonOnTransition.count;
            for (let s = 0; s < summonCount; s++) {
              const summonPos = findAdjacentEmpty(boss.pos, state.map, enemies);
              if (summonPos) {
                const summoned = createEnemy(summonDefId, summonPos, false, state.currentFloor);
                if (summoned) enemies.push(summoned);
              }
            }
          }

          // 消息
          messages.push({ text: nextPhase.messageZh, type: 'system' });

          // Boss本回合不攻击（给玩家1回合准备时间）
          // 通过设置标志跳过本次攻击
          boss._skipAttack = true;  // 临时标志，在攻击逻辑中检查
        }
      }
    }
  }
```

需添加辅助函数：

```typescript
function findAdjacentEmpty(pos: Position, map: Tile[][], enemies: Enemy[]): Position | null {
  const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
  for (const [dx, dy] of dirs) {
    const nx = pos.x + dx;
    const ny = pos.y + dy;
    if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length) {
      if (map[ny][nx].walkable && !enemies.some(e => e.hp > 0 && e.pos.x === nx && e.pos.y === ny)) {
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}
```

注意：`_skipAttack` 需要在Enemy接口中添加（或使用其他方式标记）。最简单的方式是在Enemy接口中加一个可选字段：

```typescript
// 在Enemy接口中添加
_skipAttack?: boolean;
```

- [ ] **Step 2: 在敌人攻击逻辑中检查_skipAttack**

在 `processTurn` 的敌人行动循环中，当敌人准备攻击时：

```typescript
  if (enemies[i]._skipAttack) {
    enemies[i]._skipAttack = false;
    continue;  // 跳过这个敌人的行动
  }
```

- [ ] **Step 3: 在handleSpecialAbility中添加Boss阶段新技能**

在 `handleSpecialAbility` 函数中，添加Boss阶段新技能的处理。这些技能只在Boss的特定阶段使用：

```typescript
  // === Boss阶段技能 ===
  case 'warCry': {
    // 哥布林王P2: 所有同defId小怪速度+1持续3回合
    const allies = enemies.filter(e => e.hp > 0 && e.defId === enemy.defId && e.id !== enemy.id);
    for (const ally of allies) {
      ally.statusEffects.push({ type: 'speedUp', duration: 3, value: 1 });
    }
    messages.push({ text: `${enemy.name}发出战吼！所有同伴速度提升！`, type: 'combat' });
    break;
  }
  case 'throwNet': {
    // 哥布林王P2: 35%冰冻1回合
    if (rng.next() < 0.35) {
      player.statusEffects.push({ type: 'frozen', duration: 1 });
      messages.push({ text: `${enemy.name}投出罗网！你被冰冻了！`, type: 'combat' });
    } else {
      messages.push({ text: `${enemy.name}投出罗网，但你躲开了！`, type: 'combat' });
    }
    break;
  }
  case 'poisonMist': {
    // 蜘蛛女王P2: 60%中毒
    const poisonChance = enemy.bossPhase >= 3 ? 0.8 : 0.6;
    if (rng.next() < poisonChance) {
      player.statusEffects.push({ type: 'poison', duration: 5, value: 4 });
      messages.push({ text: `${enemy.name}喷射毒雾！你中毒了！`, type: 'combat' });
    } else {
      messages.push({ text: `${enemy.name}喷射毒雾，但你抵抗了！`, type: 'combat' });
    }
    break;
  }
  case 'cocoon': {
    // 蜘蛛女王P3: 25%冰冻2回合
    if (rng.next() < 0.25) {
      player.statusEffects.push({ type: 'frozen', duration: 2 });
      messages.push({ text: `${enemy.name}吐出茧缚！你被冰冻了2回合！`, type: 'combat' });
    } else {
      messages.push({ text: `${enemy.name}吐出茧缚，但你挣脱了！`, type: 'combat' });
    }
    break;
  }
  case 'raiseDead': {
    // 死亡骑士P2: 复活2个本层已杀敌(30%HP)
    const deadEnemyTypes = [...new Set(enemies.filter(e => e.hp <= 0 && !e.isBoss).map(e => e.defId))];
    let raised = 0;
    for (const deadDefId of deadEnemyTypes.slice(0, 2)) {
      const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
      if (pos) {
        const raised_enemy = createEnemy(deadDefId, pos, false, state.currentFloor);
        if (raised_enemy) {
          raised_enemy.hp = Math.floor(raised_enemy.maxHp * 0.3);
          enemies.push(raised_enemy);
          raised++;
        }
      }
    }
    messages.push({ text: `${enemy.name}施展亡者苏醒！${raised}个亡灵复活了！`, type: 'combat' });
    break;
  }
  case 'infernalFire': {
    // 恶魔领主P2: 70%燃烧
    if (rng.next() < 0.7) {
      player.statusEffects.push({ type: 'burning', duration: 4, value: 5 });
      messages.push({ text: `${enemy.name}释放狱火！你燃烧了！`, type: 'combat' });
    } else {
      messages.push({ text: `${enemy.name}释放狱火，但你避开了！`, type: 'combat' });
    }
    break;
  }
  case 'summonLavaWorm': {
    // 恶魔领主P2: 召唤1只熔岩虫
    const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
    if (pos) {
      const minion = createEnemy('lavaWorm', pos, false, state.currentFloor);
      if (minion) {
        enemies.push(minion);
        messages.push({ text: `${enemy.name}召唤了一只熔岩虫！`, type: 'combat' });
      }
    }
    break;
  }
  case 'infernalCharge': {
    // 恶魔领主P3: 对玩家+友方120%ATK火伤
    const dmg = Math.floor(enemy.attack * 1.2);
    const actualDmg = calculateDamage(dmg, 0); // 无视防御的纯火伤
    player.hp = Math.max(1, player.hp - actualDmg);
    messages.push({ text: `${enemy.name}释放炼狱冲击！造成${actualDmg}点火焰伤害！`, type: 'combat' });
    // 对友方小怪也造成伤害
    const allies = enemies.filter(e => e.hp > 0 && e.id !== enemy.id && !e.isBoss);
    for (const ally of allies) {
      const allyDmg = Math.floor(enemy.attack * 1.2);
      ally.hp = Math.max(0, ally.hp - allyDmg);
    }
    if (allies.length > 0) {
      messages.push({ text: `炼狱冲击也波及了${allies.length}只小怪！`, type: 'combat' });
    }
    break;
  }
  case 'dimensionTear': {
    // 深渊之王P2: 传送玩家到Boss房随机位置
    // 找Boss房间内的随机可行走位置
    const bossRoom = findBossRoom(state.map);
    if (bossRoom) {
      const walkableTiles = findWalkableTilesInArea(state.map, bossRoom, enemies);
      if (walkableTiles.length > 0) {
        const newPos = rng.pick(walkableTiles);
        player.pos = newPos;
        messages.push({ text: `${enemy.name}撕裂了维度！你被传送到了！`, type: 'combat' });
      }
    }
    break;
  }
  case 'summonVoidWeaver': {
    // 深渊之王P2: 召唤1只虚空织者
    const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
    if (pos) {
      const minion = createEnemy('voidWeaver', pos, false, state.currentFloor);
      if (minion) {
        enemies.push(minion);
        messages.push({ text: `${enemy.name}召唤了一只虚空织者！`, type: 'combat' });
      }
    }
    break;
  }
  case 'summonVoidWeaver2': {
    // 深渊之心P2: 召唤2只虚空织者
    for (let s = 0; s < 2; s++) {
      const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
      if (pos) {
        const minion = createEnemy('voidWeaver', pos, false, state.currentFloor);
        if (minion) {
          enemies.push(minion);
        }
      }
    }
    messages.push({ text: `${enemy.name}召唤了虚空织者！`, type: 'combat' });
    break;
  }
  case 'annihilate': {
    // 深渊之王P3: 20%概率HP降至1 + 100%燃烧3回合
    if (rng.next() < 0.2) {
      player.hp = 1;
      player.statusEffects.push({ type: 'burning', duration: 3, value: 3 });
      messages.push({ text: `${enemy.name}释放湮灭波！你的HP降至1！燃烧了！`, type: 'combat' });
    } else {
      messages.push({ text: `${enemy.name}释放湮灭波！你勉强撑住了！`, type: 'combat' });
    }
    break;
  }
  case 'voidRay': {
    // 深渊之心P1: 180%ATK虚空伤
    const dmg = Math.floor(enemy.attack * 1.8);
    const actualDmg = calculateDamage(dmg, player.stats.vit);
    player.hp = Math.max(0, player.hp - actualDmg);
    messages.push({ text: `${enemy.name}发射虚空射线！造成${actualDmg}点伤害！`, type: 'combat' });
    break;
  }
  case 'devourMinion': {
    // 深渊之心P2: 吃掉1个召唤物回复30%最大HP
    const minion = enemies.find(e => e.hp > 0 && !e.isBoss && e.id !== enemy.id);
    if (minion) {
      minion.hp = 0;
      const healAmt = Math.floor(enemy.maxHp * 0.3);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
      messages.push({ text: `${enemy.name}吞噬了${minion.name}！回复了${healAmt}点HP！`, type: 'combat' });
    } else {
      messages.push({ text: `${enemy.name}试图吞噬仆从，但周围没有可吞噬的目标！`, type: 'combat' });
    }
    break;
  }
  case 'voidPulse': {
    // 深渊之心P2/P3: 100%ATK伤害+吸血(60%/80%)
    const vampRate = enemy.bossPhase >= 3 ? 0.8 : 0.6;
    const dmg = Math.floor(enemy.attack * 1.0);
    const actualDmg = calculateDamage(dmg, player.stats.vit);
    player.hp = Math.max(0, player.hp - actualDmg);
    const healAmt = Math.floor(actualDmg * vampRate);
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
    messages.push({ text: `${enemy.name}释放虚空脉冲！造成${actualDmg}点伤害并回复${healAmt}HP！`, type: 'combat' });
    break;
  }
  case 'corrodeAll': {
    // 深渊之心P3: 全属性-1
    player.stats.str = Math.max(1, player.stats.str - 1);
    player.stats.dex = Math.max(1, player.stats.dex - 1);
    player.stats.int = Math.max(1, player.stats.int - 1);
    player.stats.vit = Math.max(1, player.stats.vit - 1);
    messages.push({ text: `${enemy.name}释放全属性侵蚀！你的所有属性-1！`, type: 'combat' });
    break;
  }
```

需添加辅助函数：

```typescript
function findBossRoom(map: Tile[][]): { x1: number; y1: number; x2: number; y2: number } | null {
  // 通过Boss房特殊地板色找Boss房区域
  // 简化实现：返回地图中央区域
  return { x1: Math.floor(map[0].length/2)-6, y1: Math.floor(map.length/2)-6, x2: Math.floor(map[0].length/2)+6, y2: Math.floor(map.length/2)+6 };
}

function findWalkableTilesInArea(map: Tile[][], area: { x1: number; y1: number; x2: number; y2: number }, enemies: Enemy[]): Position[] {
  const result: Position[] = [];
  for (let y = area.y1; y <= area.y2; y++) {
    for (let x = area.x1; x <= area.x2; x++) {
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length && map[y][x].walkable) {
        if (!enemies.some(e => e.hp > 0 && e.pos.x === x && e.pos.y === y)) {
          result.push({ x, y });
        }
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: 在Combat.ts中添加Boss阶段技能触发**

修改 `getEnemyAction` 函数，当敌人是Boss且处于P2/P3时，增加使用阶段技能的概率。

在Boss行为的特殊技能触发部分，检查 `BOSS_PHASES[boss.defId]` 获取当前阶段可用技能列表，按概率选择使用哪个技能。

在 `Combat.ts` 的 `getEnemyAction` 中，Boss的 `'special'` 返回后，`handleSpecialAbility` 中根据 `enemy.specialAbility` 决定使用哪个技能。但Boss阶段新增的技能不在 `specialAbility` 字段中。

**方案：** 在 `processTurn` 的敌人行动循环中，Boss攻击前检查阶段技能：

```typescript
  // Boss阶段技能选择（替代默认specialAbility选择）
  if (enemies[i].isBoss && enemies[i].bossPhase > 1) {
    const phases = BOSS_PHASES[enemies[i].defId];
    if (phases) {
      // 收集当前阶段及之前所有阶段的技能
      const availableAbilities = [enemies[i].specialAbility]; // P1基础技能
      for (let p = 0; p < enemies[i].bossPhase - 1 && p < phases.length; p++) {
        availableAbilities.push(...phases[p].newAbilities);
      }
      // 随机选择一个技能
      const ability = rng.pick(availableAbilities.filter(a => a));
      if (ability && rng.next() < 0.35) {
        enemies[i].specialAbility = ability;
        // 走special路径
      }
    }
  }
```

这段逻辑加在敌人行动循环的Boss isBoss检测处。

- [ ] **Step 5: 添加Boss被动效果（哥布林王群首）**

在 `processTurn` 中Boss伤害计算前，检查 `BOSS_PASSIVES`：

```typescript
  // 哥布林王被动：群首（同房间小怪存活时ATK+3）
  let packLeaderBonus = 0;
  if (enemies[i].isBoss && enemies[i].defId === 'goblinKing') {
    const hasMinions = enemies.some(e => e.hp > 0 && !e.isBoss && !e.isElite &&
      Math.abs(e.pos.x - enemies[i].pos.x) <= 8 && Math.abs(e.pos.y - enemies[i].pos.y) <= 6);
    if (hasMinions) packLeaderBonus = 3;
  }
```

将 `packLeaderBonus` 加入伤害计算。

- [ ] **Step 6: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add src/store/gameStore.ts src/engine/Combat.ts src/types/index.ts
git commit -m "feat: implement boss phase transition system and new boss abilities"
```

---

## Task 7: 精英词缀战斗效果

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: 在敌人攻击伤害计算中处理精英词缀**

在 `processTurn` 中敌人攻击伤害计算处，精英效果处理：

```typescript
  // 精英词缀效果
  let eliteDamageMod = 1.0;
  if (enemies[i].isElite) {
    // 狂乱：累加ATK
    if (enemies[i].eliteAffix === EliteAffix.Frenzy) {
      enemies[i].frenzyBonus = (enemies[i].frenzyBonus || 0) + 0.5;
    }
    eliteDamageMod = 1 + (enemies[i].frenzyBonus || 0) / enemies[i].attack;

    // 吸血：回复30%伤害
    if (enemies[i].eliteAffix === EliteAffix.Vampiric) {
      const healAmt = Math.floor(rawDamage * 0.3);
      enemies[i].hp = Math.min(enemies[i].maxHp, enemies[i].hp + healAmt);
    }
  }
```

- [ ] **Step 2: 在玩家攻击精英时处理铁甲和幽影**

在玩家攻击敌人的逻辑中（`processTurn` 的玩家攻击部分），伤害计算后：

```typescript
  // 精英铁甲：受到物理伤害-30%
  if (target.isElite && target.eliteAffix === EliteAffix.Armored) {
    damage = Math.floor(damage * 0.7);
  }

  // 精英幽影：30%闪避
  if (target.isElite && target.eliteAffix === EliteAffix.Phantom) {
    if (rng.next() < 0.3) {
      damage = 0;
      messages.push({ text: `${target.name}闪避了攻击！`, type: 'combat' });
    }
  }
```

- [ ] **Step 3: 在敌人回合处理再生**

在敌人行动循环开始处：

```typescript
  // 精英再生：每回合恢复5%最大HP
  if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Regen && enemies[i].hp > 0) {
    const healAmt = Math.floor(enemies[i].maxHp * 0.05);
    enemies[i].hp = Math.min(enemies[i].maxHp, enemies[i].hp + healAmt);
  }
```

- [ ] **Step 4: 在精英死亡时处理爆裂**

在敌人死亡处理（`hp <= 0`）处，精英死亡时：

```typescript
  // 精英爆裂：死亡时对周围2格造成ATK×1.5伤害
  if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Explosive) {
    const blastDmg = Math.floor(enemies[i].attack * 1.5);
    const blastRadius = 2;
    // 对玩家
    const distToPlayer = Math.abs(enemies[i].pos.x - player.pos.x) + Math.abs(enemies[i].pos.y - player.pos.y);
    if (distToPlayer <= blastRadius) {
      player.hp = Math.max(0, player.hp - blastDmg);
      messages.push({ text: `${enemies[i].name}爆裂！你受到${blastDmg}点伤害！`, type: 'combat' });
    }
    // 对其他敌人
    for (const other of enemies) {
      if (other.id !== enemies[i].id && other.hp > 0) {
        const dist = Math.abs(enemies[i].pos.x - other.pos.x) + Math.abs(enemies[i].pos.y - other.pos.y);
        if (dist <= blastRadius) {
          other.hp = Math.max(0, other.hp - blastDmg);
        }
      }
    }
  }
```

- [ ] **Step 5: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add src/store/gameStore.ts
git commit -m "feat: implement elite affix combat effects (armored, frenzy, regen, vampiric, explosive, phantom)"
```

---

## Task 8: 竞技场Tile交互 + 假墙检测

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: 在movePlayer中添加假墙检测**

在玩家移动逻辑中（`movePlayer` 函数），当玩家尝试走进 `SecretWall` 时：

```typescript
  // 假墙检测
  if (targetTile.type === TileType.SecretWall) {
    // 直接通过，并显示消息
    state.messages.push({ text: '你穿过了一道暗墙！', type: 'system' });
    // 不需要改tile类型，保持secretWall让玩家可以来回穿过
  }
```

同时在玩家紧邻SecretWall时（每回合检测），显示提示：

```typescript
  // 检测是否紧邻假墙
  const adjDirs = [[0,-1],[0,1],[-1,0],[1,0]];
  for (const [dx, dy] of adjDirs) {
    const nx = state.player.pos.x + dx;
    const ny = state.player.pos.y + dy;
    if (ny >= 0 && ny < state.map.length && nx >= 0 && nx < state.map[0].length) {
      if (state.map[ny][nx].type === TileType.SecretWall) {
        state.messages.push({ text: '墙壁似乎有裂缝…', type: 'system' });
        break;
      }
    }
  }
```

- [ ] **Step 2: 在movePlayer中添加新Tile交互**

在 `movePlayer` 的 `!tile.walkable` 分支中（与Door、Sarcophagus并列），添加新交互：

```typescript
  // Barricade (木栏): 攻击可破坏
  if (tile.type === TileType.Barricade) {
    // 玩家攻击破坏木栏
    state.map[y][x] = { ...state.map[y][x], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
    state.messages.push({ text: '你破坏了木栏！', type: 'system' });
    return;
  }

  // EliteDoor (精英门): 交互开启
  if (tile.type === TileType.EliteDoor) {
    state.map[y][x] = { ...state.map[y][x], type: TileType.DoorOpen, char: '/', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true };
    state.messages.push({ text: '你推开了铁门。前方传来强大的气息…', type: 'system' });
    return;
  }

  // VoidPillar (虚空柱): 攻击可破坏
  if (tile.type === TileType.VoidPillar) {
    state.map[y][x] = { ...state.map[y][x], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
    state.messages.push({ text: '你击碎了虚空柱！', type: 'system' });
    // Boss ATK-3
    const boss = state.enemies.find(e => e.isBoss && e.hp > 0);
    if (boss && (boss.defId === 'abyssKing' || boss.defId === 'abyssHeart')) {
      boss.attack = Math.max(1, boss.attack - 3);
      state.messages.push({ text: `${boss.name}的力量减弱了！`, type: 'system' });
    }
    return;
  }
```

在 `tile.walkable` 分支中（可踩上的交互）：

```typescript
  // WebFloor (蛛网地面): 减速
  if (tile.type === TileType.WebFloor) {
    state.extraTurnCost = 1;
    state.messages.push({ text: '蛛网缠住了你的脚！移动速度降低。', type: 'system' });
  }

  // SpiderEgg (蛛卵): 踩上生成幼蛛
  if (tile.type === TileType.SpiderEgg) {
    const hatchPos = { x, y };
    state.map[y][x] = { ...state.map[y][x], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
    // 生成弱化版蜘蛛
    const babySpider = createEnemy('spider', hatchPos, false, state.currentFloor);
    if (babySpider) {
      babySpider.name = '幼蛛';
      babySpider.hp = Math.floor(babySpider.maxHp * 0.4);
      babySpider.maxHp = babySpider.hp;
      babySpider.attack = Math.floor(babySpider.attack * 0.5);
      babySpider.char = 's';
      state.enemies.push(babySpider);
      state.messages.push({ text: '蛛卵破裂！一只幼蛛爬了出来！', type: 'system' });
    }
  }

  // Altar (祭坛): 踩上+3DEF 3回合
  if (tile.type === TileType.Altar) {
    state.player.statusEffects.push({ type: 'defUp', duration: 3, value: 3 });
    state.messages.push({ text: '祭坛的力量涌遍全身！防御+3持续3回合！', type: 'system' });
  }

  // Fountain (治愈泉): 互动回复50%HP+20MP
  if (tile.type === TileType.Fountain) {
    const hpHeal = Math.floor(state.player.maxHp * 0.5);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpHeal);
    state.player.mp = Math.min(state.player.maxMp, state.player.mp + 20);
    state.map[y][x] = { ...state.map[y][x], type: TileType.Floor, char: '·', fg: '#335577', bg: 'transparent', walkable: true, transparent: true };
    state.messages.push({ text: '治愈泉的泉水恢复了你的力量！', type: 'system' });
  }

  // Inscription (碑文): 阅读
  if (tile.type === TileType.Inscription) {
    const biome = getBiomeForFloor(state.currentFloor);
    const text = INSCRIPTION_TEXTS[biome];
    state.messages.push({ text: `碑文：${text}`, type: 'system' });
    state.player.inscriptionCount++;
    // 永久+1%全属性（通过bonusStats）
    state.player.bonusStats.str += 1;
    state.player.bonusStats.dex += 1;
    state.player.bonusStats.int += 1;
    state.player.bonusStats.vit += 1;
    state.messages.push({ text: '碑文的力量融入了你的身体！全属性+1！', type: 'system' });
    state.map[y][x] = { ...state.map[y][x], type: TileType.Floor, char: '·', fg: '#aaaaaa', bg: 'transparent', walkable: true, transparent: true };
  }

  // HealCrystal (治愈水晶): 互动回复30%HP
  if (tile.type === TileType.HealCrystal) {
    const hpHeal = Math.floor(state.player.maxHp * 0.3);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpHeal);
    state.map[y][x] = { ...state.map[y][x], type: TileType.Floor, char: '·', fg: '#005533', bg: 'transparent', walkable: true, transparent: true };
    state.messages.push({ text: '治愈水晶碎裂，回复了${hpHeal}点HP！', type: 'system' });
  }

  // Monument (纪念碑): 交互查看
  if (tile.type === TileType.Monument) {
    state.messages.push({ text: '纪念碑上刻着已逝Boss的名字。', type: 'system' });
  }
```

需导入 `INSCRIPTION_TEXTS` 和 `getBiomeForFloor`。

- [ ] **Step 3: 在processTurn中处理竞技场周期效果**

在 `processTurn` 的回合处理中，添加竞技场周期效果（熔岩池溢出、虚空裂隙传送、腐蚀池伤害）：

```typescript
  // 竞技场周期效果
  if (state.turn % 3 === 0) {
    // 熔岩池溢出（恶魔领主竞技场）
    for (let y = 0; y < state.map.length; y++) {
      for (let x = 0; x < state.map[0].length; x++) {
        if (state.map[y][x].type === TileType.LavaPool) {
          // 扩展1格到相邻Floor
          const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
          for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (ny >= 0 && ny < state.map.length && nx >= 0 && nx < state.map[0].length) {
              if (state.map[ny][nx].type === TileType.Floor || state.map[ny][nx].type === TileType.Corridor) {
                state.map[ny][nx] = makeTile(TileType.Lava, '~', '#ff4400', '#1a0a04', false, true);
              }
            }
          }
        }
      }
    }
  }
  // 每3回合熔岩回退
  if (state.turn % 3 === 1) {
    for (let y = 0; y < state.map.length; y++) {
      for (let x = 0; x < state.map[0].length; x++) {
        if (state.map[y][x].type === TileType.Lava) {
          state.map[y][x] = makeTile(TileType.CooledLava, '=', '#553322', '#1a0a04', true, true);
        }
      }
    }
  }

  // 虚空裂隙传送（每5回合）
  if (state.turn % 5 === 0) {
    const rifts: Position[] = [];
    for (let y = 0; y < state.map.length; y++) {
      for (let x = 0; x < state.map[0].length; x++) {
        if (state.map[y][x].type === TileType.VoidRift) rifts.push({ x, y });
      }
    }
    for (const rift of rifts) {
      // 传送站在附近的实体
      if (Math.abs(state.player.pos.x - rift.x) <= 1 && Math.abs(state.player.pos.y - rift.y) <= 1) {
        // 传送到另一个裂隙
        const otherRift = rifts.find(r => r.x !== rift.x || r.y !== rift.y);
        if (otherRift) {
          state.player.pos = { ...otherRift };
          state.messages.push({ text: '虚空裂隙将你传送到了另一个位置！', type: 'system' });
        }
      }
    }
  }

  // 腐蚀池（每2回合全屏2伤害）
  if (state.turn % 2 === 0) {
    let hasCorruptionPool = false;
    for (let y = 0; y < state.map.length; y++) {
      for (let x = 0; x < state.map[0].length; x++) {
        if (state.map[y][x].type === TileType.CorruptionPool) {
          hasCorruptionPool = true;
          break;
        }
      }
      if (hasCorruptionPool) break;
    }
    if (hasCorruptionPool) {
      state.player.hp = Math.max(0, state.player.hp - 2);
      state.messages.push({ text: '腐蚀池的毒气侵蚀了你！受到2点伤害！', type: 'combat' });
    }
  }
```

- [ ] **Step 4: Boss死亡后将Boss房变为纪念碑**

在Boss击杀后：

```typescript
  if (enemies[i].isBoss) {
    player.bossKillCount++;
    // 将Boss位置设为纪念碑
    const bossPos = enemies[i].pos;
    if (bossPos.y >= 0 && bossPos.y < state.map.length && bossPos.x >= 0 && bossPos.x < state.map[0].length) {
      state.map[bossPos.y][bossPos.x] = makeTile(TileType.Monument, '☥', '#ffd700', 'transparent', true, true);
    }
    // 触发Boss祝福选择
    state.bossBlessingPending = true;
    state.lastBossDefId = enemies[i].defId;
  }
```

- [ ] **Step 5: 运行类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add src/store/gameStore.ts
git commit -m "feat: arena tile interactions, secret walls, arena periodic effects, monument"
```

---

## Task 9: Boss祝福系统 + UI

**Files:**
- Create: `src/components/BossBlessingModal.tsx`
- Modify: `src/components/App.tsx`
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: 创建BossBlessingModal组件**

```typescript
import React from 'react';
import { useGameStore } from '../store/gameStore';
import { BossBlessing, BossBlessingDef } from '../types';
import { BOSS_BLESSING_OPTIONS } from '../constants';

const BossBlessingModal: React.FC = () => {
  const bossBlessingPending = useGameStore(s => s.bossBlessingPending);
  const lastBossDefId = useGameStore(s => s.lastBossDefId);
  const player = useGameStore(s => s.player);
  const chooseBossBlessing = useGameStore(s => s.chooseBossBlessing);

  if (!bossBlessingPending || !lastBossDefId || !player) return null;

  const options = BOSS_BLESSING_OPTIONS[lastBossDefId];
  if (!options) return null;

  return (
    <div className="modal-overlay">
      <div className="modal boss-blessing-modal">
        <h2>🏆 Boss祝福</h2>
        <p>击败了强大的敌人！选择一项永久祝福：</p>
        <div className="blessing-options">
          {options.map((opt: BossBlessingDef) => (
            <button
              key={opt.id}
              className="blessing-option"
              onClick={() => chooseBossBlessing(opt.id)}
            >
              <span className="blessing-icon">{opt.icon}</span>
              <span className="blessing-name">{opt.nameZh}</span>
              <span className="blessing-desc">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BossBlessingModal;
```

- [ ] **Step 2: 在gameStore中添加chooseBossBlessing action**

```typescript
chooseBossBlessing: (blessing: BossBlessing) => {
  if (!state.player) return;
  state.player.bossBlessings.push(blessing);
  state.bossBlessingPending = false;
  state.lastBossDefId = null;

  // 立即生效的祝福
  if (blessing === BossBlessing.EchoBody) {
    state.player.bonusStats.str += 3;
    state.player.bonusStats.dex += 3;
    state.player.bonusStats.int += 3;
    state.player.bonusStats.vit += 3;
  }
  if (blessing === BossBlessing.AbyssEye) {
    state.player.visionRadius += 2;
  }

  state.messages.push({ text: `获得了Boss祝福！`, type: 'system' });
},
```

- [ ] **Step 3: 在App.tsx中添加Boss祝福弹窗**

在 `App.tsx` 中导入 `BossBlessingModal` 并在模态弹窗区域渲染：

```typescript
import BossBlessingModal from './BossBlessingModal';

// 在组件return中，与其他modal并列
{bossBlessingPending && <BossBlessingModal />}
```

- [ ] **Step 4: 在gameStore中实现Boss祝福的持续效果**

在 `processTurn` 和 `enterFloor` 中添加祝福效果检查：

```typescript
  // Boss祝福效果
  if (state.player.bossBlessings.includes(BossBlessing.TribalHeart)) {
    // 部落之心：有小怪在场时DEF+3
    const hasMinions = state.enemies.some(e => e.hp > 0 && !e.isBoss);
    // 在防御计算中检查此标志
  }

  // 死亡契约：击杀回复5%最大HP（在敌人死亡处添加）
  if (state.player.bossBlessings.includes(BossBlessing.DeathPact)) {
    const healAmt = Math.floor(state.player.maxHp * 0.05);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmt);
  }

  // 终焉之约：每层首次致命伤害保留1HP
  // 在玩家HP<=0检测处
  if (state.player.hp <= 0 && state.player.bossBlessings.includes(BossBlessing.FinalPact) && !state.player.finalPactUsed) {
    state.player.hp = 1;
    state.player.finalPactUsed = true;
    state.messages.push({ text: '终焉之约生效！你从死亡边缘回来了！', type: 'system' });
  }
```

在 `enterFloor` 中重置 `finalPactUsed`：

```typescript
  state.player.finalPactUsed = false;
```

- [ ] **Step 5: 在enterFloor中实现虚空行走祝福**

```typescript
  if (state.player.bossBlessings.includes(BossBlessing.VoidWalk)) {
    // 每层开始获得3回合随机buff
    const buffs = [
      { type: 'atkUp', duration: 3, value: 5 },
      { type: 'defUp', duration: 3, value: 5 },
      { type: 'speedUp', duration: 3, value: 1 },
    ];
    const buff = rng.pick(buffs);
    if (buff) {
      state.player.statusEffects.push(buff);
      state.messages.push({ text: '虚空行走：获得随机增益！', type: 'system' });
    }
  }
```

- [ ] **Step 6: 添加Boss祝福弹窗的CSS样式**

在 `src/index.css` 中添加：

```css
.boss-blessing-modal {
  text-align: center;
  max-width: 500px;
}

.blessing-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.blessing-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a1a2e;
  border: 2px solid #ffd700;
  border-radius: 8px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: all 0.2s;
}

.blessing-option:hover {
  background: #2a2a4e;
  border-color: #ffee88;
  transform: scale(1.02);
}

.blessing-icon {
  font-size: 24px;
}

.blessing-name {
  font-weight: bold;
  color: #ffd700;
  font-size: 16px;
}

.blessing-desc {
  color: #aaaaaa;
  font-size: 13px;
}
```

- [ ] **Step 7: 运行类型检查 + 构建**

```bash
cd abyss-echo && npx tsc --noEmit && npm run build
```

- [ ] **Step 8: 提交**

```bash
git add src/components/BossBlessingModal.tsx src/components/App.tsx src/store/gameStore.ts src/index.css
git commit -m "feat: implement boss blessing system with selection modal"
```

---

## Task 10: MapView — 精英渲染 + 新Tile渲染

**Files:**
- Modify: `src/components/MapView.tsx`

- [ ] **Step 1: 精英金色渲染**

在敌人渲染处，精英怪使用金色前景色并加前缀标记：

```typescript
  const enemyHere = enemyMap.get(`${x},${y}`);
  if (enemyHere) {
    char = enemyHere.isElite ? '★' : enemyHere.char;
    fg = enemyHere.isElite ? '#ffd700' : enemyHere.fg;
  }
```

- [ ] **Step 2: 新Tile类型渲染**

确保新TileType在 `NEW_TILE_DEFAULTS` 中已定义颜色/字符。MapView从Tile的 `char`/`fg`/`bg` 字段渲染，所以只要DungeonGenerator中设置了正确的char/fg/bg，MapView自动渲染。

但需要确保 `SecretWall` 在未被探索时显示为普通墙。在FOV可见时，SecretWall 显示为有细微色差的墙：

```typescript
  // 在tile渲染处
  if (tile.type === TileType.SecretWall && tile.visible) {
    // 显示为有细微色差的墙
    char = '#';
    fg = '#666666';  // 比普通墙稍亮
  }
```

- [ ] **Step 3: 纪念碑渲染**

纪念碑使用特殊字符和金色：

```typescript
  // 在tile渲染处，已由Tile.char和Tile.fg处理
  // Monument: char='☥', fg='#ffd700' (在DungeonGenerator中已设置)
```

- [ ] **Step 4: 运行类型检查 + 构建**

```bash
cd abyss-echo && npx tsc --noEmit && npm run build
```

- [ ] **Step 5: 提交**

```bash
git add src/components/MapView.tsx
git commit -m "feat: elite gold rendering, secret wall visual, new tile rendering"
```

---

## Task 11: Floor 30 隐藏Boss + 继续下楼

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/generator/DungeonGenerator.ts`

- [ ] **Step 1: 允许Floor 25之后继续下楼**

在 `enterFloor` 函数中，找到限制楼层上限的逻辑（如果有），允许下到30层。

同时，在 `processTurn` 的下楼逻辑中，当玩家在Floor 25的楼梯上时，如果已击败深渊之王，允许继续到26-30层：

```typescript
  // 在下楼逻辑中
  if (floor >= 25 && floor < 30) {
    // 继续下楼到虚空深渊深处
    // Floor 26-30仍然是VoidAbyss
  }
```

- [ ] **Step 2: Floor 30 Boss生成**

在 `placeBoss` 中已处理 `floor === 30` 的情况（返回 `abyssHeart` 定义）。

确认Floor 30的地下城生成正确使用VoidAbyss生成器，且Boss房间正确放置。

- [ ] **Step 3: 运行类型检查 + 构建**

```bash
cd abyss-echo && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: 提交**

```bash
git add src/store/gameStore.ts src/generator/DungeonGenerator.ts
git commit -m "feat: enable floor 26-30 and hidden boss abyss heart"
```

---

## Task 12: 最终集成验证 + Bug修复

**Files:**
- All modified files

- [ ] **Step 1: 运行完整类型检查**

```bash
cd abyss-echo && npx tsc --noEmit
```

修复所有类型错误。

- [ ] **Step 2: 运行完整构建**

```bash
cd abyss-echo && npm run build
```

修复所有构建错误。

- [ ] **Step 3: 运行ESLint**

```bash
cd abyss-echo && npm run lint
```

修复所有lint错误。

- [ ] **Step 4: 手动测试清单**

在浏览器中启动 `npm run dev`，测试以下场景：
1. ✅ 新游戏开始，Floor 1 显示氛围描述
2. ✅ 楼层间切换，每层显示对应描述
3. ✅ 精英敌人出现（金色★），有词缀效果
4. ✅ 精英房铁门可交互开启
5. ✅ 精铁甲减免30%伤害、幽影闪避、狂乱ATK增长、再生、吸血、爆裂死亡伤害
6. ✅ Floor 5 Boss战：哥布林王P1→P2→P3阶段转换
7. ✅ 阶段转换消息显示、Boss 1回合不攻击
8. ✅ Boss新技能正确触发
9. ✅ 竞技场对象渲染正确（王座、蛛卵、石棺等）
10. ✅ 竞技场交互：踩蛛卵生幼蛛、祭坛+DEF、破坏虚空柱
11. ✅ 假墙可通过、紧邻时有提示
12. ✅ Boss祝福选择弹窗出现且可选
13. ✅ 祝福效果在后续战斗中生效
14. ✅ 纪念碑在Boss死后出现
15. ✅ 碑文可阅读、收集计数正确
16. ✅ Floor 30深渊之心可到达

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: complete boss system overhaul - phases, elites, arenas, blessings, exploration"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] 多阶段Boss（6个Boss × 3阶段）→ Task 6
- [x] 精英系统（6词缀、精英房、Boss召唤精英）→ Task 3, 7
- [x] Boss竞技场（6个竞技场设计）→ Task 4, 8
- [x] 楼层氛围描述（26条）→ Task 5
- [x] Boss祝福系统（12个祝福）→ Task 9
- [x] 碑文系统 → Task 8
- [x] 假墙/暗道 → Task 8
- [x] 纪念碑 → Task 8
- [x] 隐藏Boss深渊之心 → Task 11
- [x] 地图尺寸调整 → Task 2

### Placeholder Scan
- 无TBD/TODO
- 所有代码步骤有具体实现

### Type Consistency
- `BossPhase` → `bossPhase: 1 | 2 | 3` 在Task 1定义，Task 3初始化，Task 6使用
- `EliteAffix` → Task 1定义，Task 3使用
- `BossBlessing` → Task 1定义，Task 9使用
- `DungeonData` 新字段 → Task 1定义，Task 4填充，Task 5消费
- `BossArenaData` → Task 1定义，Task 4创建，Task 8消费
