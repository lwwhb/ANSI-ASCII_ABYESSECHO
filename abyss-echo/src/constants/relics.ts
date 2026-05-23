// ============================================================
// 遗物系统 - 24 Relic Definitions
// ============================================================

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
