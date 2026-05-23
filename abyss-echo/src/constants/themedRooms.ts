// ============================================================
// 主题房间系统 - 20 Themed Room Configurations
// ============================================================

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
