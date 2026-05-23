// ============================================================
// Relic Effects Engine - Pure helper functions for relic mechanics
// ============================================================

import { RelicId, RelicRarity, Element, Player, StatusEffectType } from '../types';
import { RELIC_DEFS, RELICS_BY_RARITY, ELEMENT_RELICS } from '../constants/relics';
import { SeededRandom } from '../utils/random';

// Check if player has a specific relic
export function hasRelic(player: Player, relicId: RelicId): boolean {
  return player.relics.includes(relicId);
}

// Get ATK% modifier from relics (returns additive modifier, e.g. -0.15 for hungerRing)
export function getRelicAtkModifier(player: Player): number {
  let mod = 0;
  if (hasRelic(player, RelicId.HungerRing)) mod -= 0.15;
  if (hasRelic(player, RelicId.CurseVessel)) mod += getCurseVesselBonus(player);
  if (hasRelic(player, RelicId.ElementResonance) && getElementResonanceActive(player)) mod += 0.25;
  // UndyingWill blessing checked separately, not a relic
  return mod;
}

// Get gold% modifier
export function getRelicGoldModifier(player: Player): number {
  return hasRelic(player, RelicId.GreedCrown) ? 0.5 : 0;
}

// Get shop price% modifier
export function getRelicShopPriceModifier(player: Player): number {
  return hasRelic(player, RelicId.GreedCrown) ? 0.3 : 0;
}

// Get forge cost% modifier (returns multiplier, e.g. 0.7 for blacksmithHammer)
export function getRelicForgeCostModifier(player: Player): number {
  return hasRelic(player, RelicId.BlacksmithHammer) ? 0.7 : 1.0;
}

// Get burn damage% modifier
export function getRelicBurnDamageModifier(player: Player): number {
  return hasRelic(player, RelicId.FlameHeart) ? 0.5 : 0;
}

// Get poison damage% modifier
export function getRelicPoisonDamageModifier(player: Player): number {
  return hasRelic(player, RelicId.PoisonGland) ? 0.3 : 0;
}

// Check if player is immune to Burn
export function isRelicBurnImmune(player: Player): boolean {
  return hasRelic(player, RelicId.FlameHeart);
}

// Check proc relics: poisonGland, frostTouch, thunderMark (15% each)
// Returns StatusEffectType to apply, or null
export function rollRelicStatusProc(player: Player, rng: SeededRandom): StatusEffectType | null {
  if (hasRelic(player, RelicId.PoisonGland) && rng.chance(0.15)) return StatusEffectType.Poison;
  if (hasRelic(player, RelicId.FrostTouch) && rng.chance(0.15)) return StatusEffectType.Freeze;
  if (hasRelic(player, RelicId.ThunderMark) && rng.chance(0.15)) return StatusEffectType.Confusion;
  return null;
}

// CurseVessel: +5% ATK per debuff (max +25%)
export function getCurseVesselBonus(player: Player): number {
  if (!hasRelic(player, RelicId.CurseVessel)) return 0;
  const debuffCount = player.statusEffects.filter(e =>
    e.type === StatusEffectType.Poison || e.type === StatusEffectType.Burn ||
    e.type === StatusEffectType.Freeze || e.type === StatusEffectType.Bleed ||
    e.type === StatusEffectType.Confusion
  ).length;
  return Math.min(debuffCount * 0.05, 0.25);
}

// ElementResonance: active if player has 2+ different element debuffs
export function getElementResonanceActive(player: Player): boolean {
  const elementDebuffs = new Set<Element>();
  for (const e of player.statusEffects) {
    if (e.type === StatusEffectType.Burn) elementDebuffs.add(Element.Fire);
    if (e.type === StatusEffectType.Freeze) elementDebuffs.add(Element.Ice);
    if (e.type === StatusEffectType.Poison || e.type === StatusEffectType.PoisonBlade) elementDebuffs.add(Element.Poison);
    if (e.type === StatusEffectType.Confusion) elementDebuffs.add(Element.Lightning);
  }
  return elementDebuffs.size >= 2;
}

// Check if silentStep prevents enemy aggro
export function shouldSilentStepPreventAggro(player: Player, dist: number): boolean {
  return hasRelic(player, RelicId.SilentStep) && dist <= 3;
}

// Roll random relic respecting rarity weights and element affinity
export function rollRandomRelic(
  player: Player,
  rng: SeededRandom,
  rarityWeights: { common: number; rare: number; epic: number },
  elementAffinity?: Element,
): RelicId {
  const totalWeight = rarityWeights.common + rarityWeights.rare + rarityWeights.epic;
  const roll = rng.next() * totalWeight;
  let rarity: RelicRarity;
  if (roll < rarityWeights.epic) rarity = RelicRarity.Epic;
  else if (roll < rarityWeights.epic + rarityWeights.rare) rarity = RelicRarity.Rare;
  else rarity = RelicRarity.Common;

  let candidates = RELICS_BY_RARITY[rarity].filter(id => !player.relics.includes(id));
  if (candidates.length === 0) {
    for (const altRarity of [RelicRarity.Common, RelicRarity.Rare, RelicRarity.Epic]) {
      candidates = RELICS_BY_RARITY[altRarity].filter(id => !player.relics.includes(id));
      if (candidates.length > 0) { rarity = altRarity; break; }
    }
  }
  if (candidates.length === 0) candidates = RELICS_BY_RARITY[RelicRarity.Common];

  // Element affinity: double probability for matching relics
  if (elementAffinity && ELEMENT_RELICS[elementAffinity]?.length > 0) {
    const affinityRelics = candidates.filter(id => ELEMENT_RELICS[elementAffinity].includes(id));
    const normalRelics = candidates.filter(id => !ELEMENT_RELICS[elementAffinity].includes(id));
    // Build weighted array: affinity relics appear twice
    const weighted = [...affinityRelics, ...affinityRelics, ...normalRelics];
    return rng.pick(weighted);
  }

  return rng.pick(candidates);
}
