// ============================================================
// 扩展事件系统 - 12 New Event Definitions
// ============================================================

import { ExtendedGameEventDef, Biome } from '../types';

export const EXTENDED_EVENT_DEFS: ExtendedGameEventDef[] = [
  // === Resource Exchange Events ===

  {
    id: 'abyssMerchant',
    nameZh: '深渊商人',
    description: '一位蒙面商人从暗处走出，他的货物来自另一个维度',
    biomeAffinity: [Biome.StoneDungeon, Biome.CrystalCavern, Biome.AncientCrypt, Biome.LavaCore, Biome.VoidAbyss],
    options: [
      {
        id: 'abyssMerchant_buyRelic',
        textZh: '花200金购买随机稀有遗物',
        effectId: 'abyssMerchant_buyRelic',
        condition: { type: 'resource', resource: 'gold', minPercent: 200 },
        isRare: false,
      },
      {
        id: 'abyssMerchant_tradeHpForEpic',
        textZh: '花30%当前HP换取随机史诗装备',
        effectId: 'abyssMerchant_tradeHpForEpic',
        condition: { type: 'resource', resource: 'hp', minPercent: 30 },
        isRare: false,
      },
      {
        id: 'abyssMerchant_enhanceForMp',
        textZh: '🔮 花50%MaxMP换取Forge强化1件装备+2',
        effectId: 'abyssMerchant_enhanceForMp',
        condition: { type: 'resource', resource: 'mp', minPercent: 50 },
        isRare: true,
      },
    ],
  },

  {
    id: 'soulFurnace',
    nameZh: '灵魂熔炉',
    description: '熔炉中燃烧的不是火焰，而是灵魂',
    biomeAffinity: [Biome.AncientCrypt, Biome.VoidAbyss],
    options: [
      {
        id: 'soulFurnace_equipForRelic',
        textZh: '投入1件装备 → 获得其50%价值的金币 + 随机遗物',
        effectId: 'soulFurnace_equipForRelic',
        isRare: false,
      },
      {
        id: 'soulFurnace_hpForAtk',
        textZh: '投入30%MaxHP → 永久ATK+2',
        effectId: 'soulFurnace_hpForAtk',
        condition: { type: 'resource', resource: 'hp', minPercent: 30 },
        isRare: false,
      },
      {
        id: 'soulFurnace_mpForMaxMp',
        textZh: '🔮 投入所有MP → 永久MaxMP+10',
        effectId: 'soulFurnace_mpForMaxMp',
        condition: { type: 'resource', resource: 'mp', minPercent: 1 },
        isRare: true,
      },
    ],
  },

  {
    id: 'cursedChest',
    nameZh: '诅咒宝箱',
    description: '宝箱上刻满符文，打开它必定付出代价',
    biomeAffinity: [Biome.AncientCrypt],
    options: [
      {
        id: 'cursedChest_open',
        textZh: '打开：获得随机史诗物品 + 获得随机debuff(3层)',
        effectId: 'cursedChest_open',
        isRare: false,
      },
      {
        id: 'cursedChest_leave',
        textZh: '离开：无',
        effectId: 'cursedChest_leave',
        isRare: false,
      },
      {
        id: 'cursedChest_breakRune',
        textZh: '🔮 破坏符文(需INT≥12)：获得物品，debuff减半',
        effectId: 'cursedChest_breakRune',
        condition: { type: 'stat', stat: 'int', min: 12 },
        isRare: true,
      },
    ],
  },

  // === Build Choice Events ===

  {
    id: 'fateCrossroad',
    nameZh: '命运岔路',
    description: '两条路延伸向不同方向，你只能选一条',
    biomeAffinity: [Biome.CrystalCavern],
    options: [
      {
        id: 'fateCrossroad_element',
        textZh: '元素之路：获得随机元素遗物 + 1件元素武器',
        effectId: 'fateCrossroad_element',
        isRare: false,
      },
      {
        id: 'fateCrossroad_power',
        textZh: '力量之路：ATK+5 DEF-2',
        effectId: 'fateCrossroad_power',
        isRare: false,
      },
      {
        id: 'fateCrossroad_wisdom',
        textZh: '🔮 智慧之路：INT+3 MP+20 (需遗物≥3)',
        effectId: 'fateCrossroad_wisdom',
        condition: { type: 'relicCount', min: 3 },
        isRare: true,
      },
    ],
  },

  {
    id: 'mysteryRune',
    nameZh: '神秘符文',
    description: '地面上的符文发出微光，触摸它会改变什么',
    biomeAffinity: [Biome.VoidAbyss],
    options: [
      {
        id: 'mysteryRune_fire',
        textZh: '激活火符文：获得Burn免疫5回合 + 周围3×3起火',
        effectId: 'mysteryRune_fire',
        isRare: false,
      },
      {
        id: 'mysteryRune_ice',
        textZh: '激活冰符文：获得Freeze免疫5回合 + 周围3×3结冰',
        effectId: 'mysteryRune_ice',
        isRare: false,
      },
      {
        id: 'mysteryRune_both',
        textZh: '🔮 同时激活(需遗物≥3)：两种效果 + 获得元素共鸣遗物',
        effectId: 'mysteryRune_both',
        condition: { type: 'relicCount', min: 3 },
        isRare: true,
      },
    ],
  },

  {
    id: 'riftHeart',
    nameZh: '裂隙之心',
    description: '你感受到来自深渊的脉动，它似乎在回应你',
    biomeAffinity: [Biome.LavaCore, Biome.VoidAbyss],
    options: [
      {
        id: 'riftHeart_accept',
        textZh: '接受虚空：获得虚空之心遗物(史诗) + MaxHP-15%',
        effectId: 'riftHeart_accept',
        isRare: false,
      },
      {
        id: 'riftHeart_refuse',
        textZh: '拒绝：回复30%HP + 获得50金',
        effectId: 'riftHeart_refuse',
        isRare: false,
      },
      {
        id: 'riftHeart_master',
        textZh: '🔮 驾驭(需bossKillCount≥3)：获得虚空之心，MaxHP不变',
        effectId: 'riftHeart_master',
        condition: { type: 'bossKillCount', min: 3 },
        isRare: true,
      },
    ],
  },

  // === Risk Gamble Events ===

  {
    id: 'abyssGamble',
    nameZh: '深渊赌局',
    description: '一个幽灵邀请你参加一场赌局',
    biomeAffinity: [Biome.LavaCore],
    options: [
      {
        id: 'abyssGamble_big',
        textZh: '赌100金：60%获得300金+随机遗物，40%失去下注金',
        effectId: 'abyssGamble_big',
        condition: { type: 'resource', resource: 'gold', minPercent: 100 },
        isRare: false,
      },
      {
        id: 'abyssGamble_hp',
        textZh: '赌30%HP：50%满血+临时ATK+10(5回合)，50%HP归1',
        effectId: 'abyssGamble_hp',
        condition: { type: 'resource', resource: 'hp', minPercent: 30 },
        isRare: false,
      },
      {
        id: 'abyssGamble_allIn',
        textZh: '🔮 梭哈(需金币≥500)：40%获得混沌核心遗物，60%失去一半金币+所有debuff',
        effectId: 'abyssGamble_allIn',
        condition: { type: 'resource', resource: 'gold', minPercent: 500 },
        isRare: true,
      },
    ],
  },

  {
    id: 'unstablePortal',
    nameZh: '不稳定传送门',
    description: '传送门闪烁不定，目的地未知',
    biomeAffinity: [Biome.CrystalCavern],
    options: [
      {
        id: 'unstablePortal_enter',
        textZh: '进入：随机传送至本层某个主题房间 + 获得该房间遗物',
        effectId: 'unstablePortal_enter',
        isRare: false,
      },
      {
        id: 'unstablePortal_destroy',
        textZh: '破坏：获得50金 + 1个随机物品',
        effectId: 'unstablePortal_destroy',
        isRare: false,
      },
      {
        id: 'unstablePortal_stabilize',
        textZh: '🔮 稳定(需MP≥30)：传送至隐藏宝藏室',
        effectId: 'unstablePortal_stabilize',
        condition: { type: 'resource', resource: 'mp', minPercent: 30 },
        isRare: true,
      },
    ],
  },

  {
    id: 'bloodAltar',
    nameZh: '血之祭坛',
    description: '祭坛需要鲜血才能启动',
    biomeAffinity: [Biome.LavaCore],
    options: [
      {
        id: 'bloodAltar_hp',
        textZh: '献祭20%HP：获得ATK+3持续本层',
        effectId: 'bloodAltar_hp',
        condition: { type: 'resource', resource: 'hp', minPercent: 20 },
        isRare: false,
      },
      {
        id: 'bloodAltar_mp',
        textZh: '献祭所有MP：获得INT+3持续本层',
        effectId: 'bloodAltar_mp',
        condition: { type: 'resource', resource: 'mp', minPercent: 1 },
        isRare: false,
      },
      {
        id: 'bloodAltar_relic',
        textZh: '🔮 献祭遗物(需遗物≥2)：移除1个遗物，剩余遗物效果+50%本层',
        effectId: 'bloodAltar_relic',
        condition: { type: 'relicCount', min: 2 },
        isRare: true,
      },
    ],
  },

  // === Exploration Narrative Events ===

  {
    id: 'ancientMural',
    nameZh: '古代壁画',
    description: '壁画描绘着英雄与深渊的战斗',
    biomeAffinity: [Biome.StoneDungeon, Biome.AncientCrypt],
    options: [
      {
        id: 'ancientMural_study',
        textZh: '仔细研究：获得Inscription效果(全属性+1) + 进入战斗(2个强化敌人)',
        effectId: 'ancientMural_study',
        isRare: false,
      },
      {
        id: 'ancientMural_pass',
        textZh: '快速通过：无',
        effectId: 'ancientMural_pass',
        isRare: false,
      },
      {
        id: 'ancientMural_copy',
        textZh: '🔮 临摹(需inscriptionCount≥1)：获得永久+1随机属性',
        effectId: 'ancientMural_copy',
        condition: { type: 'inscriptionCount', min: 1 },
        isRare: true,
      },
    ],
  },

  {
    id: 'lostTraveler',
    nameZh: '迷失的旅者',
    description: '一个和你一样探索深渊的人，但他已经疯了',
    biomeAffinity: [Biome.StoneDungeon],
    options: [
      {
        id: 'lostTraveler_help',
        textZh: '帮助他：花费1个食物/药水，他告诉你1个隐藏房间位置',
        effectId: 'lostTraveler_help',
        isRare: false,
      },
      {
        id: 'lostTraveler_rob',
        textZh: '抢劫他：获得100-200金，但获得Debuff"内疚"（ATK-3，3层）',
        effectId: 'lostTraveler_rob',
        isRare: false,
      },
      {
        id: 'lostTraveler_talk',
        textZh: '🔮 交谈(需INT≥12)：他告诉你1个隐藏房间 + 1个下层的秘密',
        effectId: 'lostTraveler_talk',
        condition: { type: 'stat', stat: 'int', min: 12 },
        isRare: true,
      },
    ],
  },

  {
    id: 'echoWell',
    nameZh: '回声之井',
    description: '井中传来你自己的声音，但说着不同的话',
    biomeAffinity: [Biome.CrystalCavern],
    options: [
      {
        id: 'echoWell_listen',
        textZh: '倾听：获得1条关于下层的提示(主题+敌人类型) + 随机debuff 2层',
        effectId: 'echoWell_listen',
        isRare: false,
      },
      {
        id: 'echoWell_gold',
        textZh: '投入金币(100)：移除所有debuff',
        effectId: 'echoWell_gold',
        condition: { type: 'resource', resource: 'gold', minPercent: 100 },
        isRare: false,
      },
      {
        id: 'echoWell_relic',
        textZh: '🔮 投入遗物(需遗物≥3)：移除1个遗物，获得2个随机遗物',
        effectId: 'echoWell_relic',
        condition: { type: 'relicCount', min: 3 },
        isRare: true,
      },
    ],
  },
];
