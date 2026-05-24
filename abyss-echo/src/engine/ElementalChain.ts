// ============================================================
// Elemental Chain Engine - Chain reaction detection and execution
// ============================================================

import { Element, TileType, ChainReactionDef, Position, StatusEffectType, Enemy, Player, Tile } from '../types';
import { CHAIN_REACTIONS, TERRAIN_ELEMENTS, isSteamVentActive } from '../constants/elementalChain';
import { SeededRandom } from '../utils/random';

export interface ChainResult {
  damage: number;
  affectedPositions: Position[];
  statusEffects: { pos: Position; type: StatusEffectType; duration: number; damage: number }[];
  mapChanges: { pos: Position; fromType: TileType; toType: TileType }[];
  message: string;
}

// Get elements provided by terrain at position
export function getTerrainElementsAt(
  map: Tile[][],
  x: number,
  y: number,
  _currentTurn: number,
  _steamVentTurns: { x: number; y: number; spawnTurn: number }[],
): Element[] {
  if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return [];
  const tileType = map[y][x].type;

  // Special case: SteamVent only provides elements when active
  if (tileType === TileType.SteamVent) {
    const vent = _steamVentTurns.find((v: { x: number; y: number; spawnTurn: number }) => v.x === x && v.y === y);
    if (vent && isSteamVentActive(_currentTurn, vent.spawnTurn)) {
      return TERRAIN_ELEMENTS[TileType.SteamVent] ?? [];
    }
    return [];
  }

  return TERRAIN_ELEMENTS[tileType] ?? [];
}

// Get element debuffs on an enemy
export function getEnemyElementDebuffs(enemy: Enemy): Element[] {
  const elements: Element[] = [];
  for (const e of enemy.statusEffects) {
    if (e.type === StatusEffectType.Burn) elements.push(Element.Fire);
    if (e.type === StatusEffectType.Freeze) elements.push(Element.Ice);
    if (e.type === StatusEffectType.Poison) elements.push(Element.Poison);
    if (e.type === StatusEffectType.Confusion) elements.push(Element.Lightning);
    // Bleed maps to Fire (no Blood element; shares Fire reactions)
    if (e.type === StatusEffectType.Bleed) elements.push(Element.Fire);
  }
  return elements;
}

// Check if a chain reaction can be triggered
/** @deprecated Use checkChainReactionWithMap instead for proper terrain element detection */
export function checkChainReaction(
  attackElement: Element,
  targetElements: Element[],
  terrainType: TileType,
  _currentTurn: number,
  _steamVentTurns: { x: number; y: number; spawnTurn: number }[],
): ChainReactionDef | null {
  // This simplified version can't properly check terrain elements without full map access
  // Use checkChainReactionWithMap instead for proper terrain element detection
  if (attackElement === Element.None) return null;

  for (const reaction of CHAIN_REACTIONS) {
    if (reaction.elements[0] !== attackElement) continue;

    const secondElement = reaction.elements[1];

    // From target debuffs
    if (targetElements.includes(secondElement)) return reaction;

    // From terrain (basic check, not including terrain elements like SteamVent)
    if (reaction.requiresTerrain && reaction.requiresTerrain.includes(terrainType)) return reaction;
  }

  return null;
}

// Overload: check with full map access
export function checkChainReactionWithMap(
  attackElement: Element,
  targetElements: Element[],
  map: Tile[][],
  targetPos: Position,
  currentTurn: number,
  steamVentTurns: { x: number; y: number; spawnTurn: number }[],
): ChainReactionDef | null {
  if (attackElement === Element.None) return null;

  const terrainElements = getTerrainElementsAt(map, targetPos.x, targetPos.y, currentTurn, steamVentTurns);

  for (const reaction of CHAIN_REACTIONS) {
    if (reaction.elements[0] !== attackElement) continue;

    const secondElement = reaction.elements[1];
    if (targetElements.includes(secondElement) || terrainElements.includes(secondElement)) {
      // Check requiresTerrain constraint
      if (reaction.requiresTerrain) {
        const tileType = map[targetPos.y]?.[targetPos.x]?.type;
        if (!tileType || !reaction.requiresTerrain.includes(tileType)) continue;
      }
      return reaction;
    }
  }

  return null;
}

// Execute a chain reaction
export function executeChainReaction(
  reaction: ChainReactionDef,
  attackerAtk: number,
  targetPos: Position,
  map: Tile[][],
  enemies: Enemy[],
  player: Player,
  rng: SeededRandom,
): ChainResult {
  const result: ChainResult = {
    damage: 0,
    affectedPositions: [],
    statusEffects: [],
    mapChanges: [],
    message: reaction.messageTemplate,
  };

  const baseDamage = Math.floor(attackerAtk * reaction.damageMultiplier);

  // Handle specific chain effects
  switch (reaction.id) {
    case 'steamBurst': {
      result.damage = baseDamage;
      result.affectedPositions.push(targetPos);
      // Add adjacent positions within range (with bounds check)
      const mapH = map.length;
      const mapW = map[0]?.length ?? 0;
      for (const dir of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = targetPos.x + dir[0];
        const ny = targetPos.y + dir[1];
        if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
          result.affectedPositions.push({ x: nx, y: ny });
        }
      }
      break;
    }
    case 'freezeSolid': {
      // Extend freeze duration and spread to water enemies
      result.statusEffects.push({
        pos: targetPos,
        type: StatusEffectType.Freeze,
        duration: 2,
        damage: 0,
      });
      break;
    }
    case 'conduct': {
      // Damage all enemies in ShallowWater tiles
      result.damage = baseDamage;
      for (const enemy of enemies) {
        if (enemy.hp > 0 && map[enemy.pos.y]?.[enemy.pos.x]?.type === TileType.ShallowWater) {
          result.affectedPositions.push(enemy.pos);
        }
      }
      break;
    }
    case 'poisonIgnition': {
      result.damage = baseDamage;
      // Clear poison gas tiles in area, deal AoE damage
      // Map changes handled by caller
      break;
    }
    case 'corruptDischarge': {
      result.damage = baseDamage;
      result.affectedPositions.push(targetPos);
      // Jump to another poisoned enemy within range
      const otherPoisoned = enemies.filter(e =>
        e.hp > 0 && e.pos.x !== targetPos.x && e.pos.y !== targetPos.y &&
        e.statusEffects.some(se => se.type === StatusEffectType.Poison) &&
        Math.abs(e.pos.x - targetPos.x) + Math.abs(e.pos.y - targetPos.y) <= reaction.range
      );
      if (otherPoisoned.length > 0) {
        result.affectedPositions.push(rng.pick(otherPoisoned).pos);
      }
      break;
    }
    case 'lavaActivate': {
      // Spread lava 1 tile for 2 turns
      for (const dir of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = targetPos.x + dir[0];
        const ny = targetPos.y + dir[1];
        if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length) {
          const tile = map[ny][nx];
          if (tile.type === TileType.Floor || tile.type === TileType.Corridor) {
            result.mapChanges.push({ pos: { x: nx, y: ny }, fromType: tile.type, toType: TileType.Lava });
          }
        }
      }
      break;
    }
    case 'lavaSolidify': {
      result.mapChanges.push({ pos: { x: targetPos.x, y: targetPos.y }, fromType: TileType.LavaPool, toType: TileType.CooledLava });
      break;
    }
    case 'overload': {
      result.damage = baseDamage;
      result.affectedPositions.push(targetPos);
      result.statusEffects.push({
        pos: targetPos,
        type: StatusEffectType.Freeze, // Using Freeze as "stun" proxy
        duration: 1,
        damage: 0,
      });
      break;
    }
  }

  return result;
}
