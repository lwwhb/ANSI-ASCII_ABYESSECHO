// ============================================================
// 元素连锁系统 - 8 Chain Reaction Definitions + Utility Functions
// ============================================================

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
