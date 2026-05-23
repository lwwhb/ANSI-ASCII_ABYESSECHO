import { create } from 'zustand';
import {
  GameState, GamePhase, Player, CharacterClass, Enemy, Item,
  Tile, TileType, Message, MessageCategory, Stats, EquipmentSlot,
  StatusEffectType, ItemType, PotionEffect, ScrollEffect, Element, Rarity,
  WeaponItem, ArmorItem, PotionItem, ScrollItem, FoodItem, FloorItem,
  GameEventDef, Biome, Position, EquipmentEffect, EnemyBehavior,
  BossBlessing, EliteAffix,
} from '../types';
import { CLASS_DEFS, HUNGER_RATE, HUNGER_STARVE_DAMAGE, getBiomeForFloor, BIOME_CONFIG, ENEMY_DEFS, SKILL_DEFS, TALENT_DEFS, ACHIEVEMENT_DEFS, GAME_EVENTS, FLOOR_DESCRIPTIONS, BOSS_PHASES, INSCRIPTION_TEXTS } from '../constants';
import { createScroll } from '../entities/Items';
import { createFood } from '../entities/Items';
import { generateDungeon, createTile } from '../generator/DungeonGenerator';
import { computeFOV, distance } from '../engine/FOV';
import {
  calculateMeleeDamage, processStatusEffects, isFrozen, isConfused, applyConfusion,
  getEnemyAction, getTrapEffect, applyLevelUp, checkLevelUp, isTalentLevel,
} from '../engine/Combat';
import { createPlayer, getEffectiveStats, getPlayerWeaponDamage, getPlayerWeaponElement, equipItem, canEquipItem, getPlayerDefense, getMaxInventorySize, genId } from '../entities/Player';
import { createEnemy, createEliteEnemy } from '../entities/Enemy';
import { createRandomItem, getItemName, identifyItem, createShopItems } from '../entities/Items';
import { SeededRandom } from '../utils/random';
import { AudioManager } from '../audio/AudioManager';

let msgId = 0;
function msg(text: string, category: MessageCategory, fg: string = '#cccccc'): Message {
  return { id: `m${msgId++}`, text, category, fg, turn: 0 };
}

// ============================================================
// Persistence
// ============================================================
function loadHighScores() {
  try {
    const data = localStorage.getItem('abyss-echo-highscores');
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveHighScores(scores: GameState['highScores']) {
  try {
    localStorage.setItem('abyss-echo-highscores', JSON.stringify(scores.slice(0, 10)));
  } catch { /* ignore */ }
}

function loadAchievements(): string[] {
  try {
    const data = localStorage.getItem('abyss-echo-achievements');
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveAchievements(achievements: string[]) {
  try {
    localStorage.setItem('abyss-echo-achievements', JSON.stringify(achievements));
  } catch { /* ignore */ }
}

function loadLegacyItem(): Item | null {
  try {
    const data = localStorage.getItem('abyss-echo-legacy');
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function saveLegacyItem(item: Item | null) {
  try {
    if (item) localStorage.setItem('abyss-echo-legacy', JSON.stringify(item));
    else localStorage.removeItem('abyss-echo-legacy');
  } catch { /* ignore */ }
}

// ============================================================
// Suspend Save System
// ============================================================
const SAVE_KEY = 'abyss-echo-save';
const SAVE_VERSION = '1.3.3';

function saveGame(state: GameStore) {
  try {
    // Only save GameState fields (exclude computed: visibleTiles, rememberedMap)
    const { phase, player, currentFloor, map, width, height, enemies, items,
      messages, turn, seed, highScores, achievements, legacyItem,
      isDailyChallenge, shopItems, currentEvent,
      skillUseCount, shopBuyCount, musicEnabled, sfxEnabled,
      voidCorruption, currentFragmentTurns, lavaTideActive, lavaTideTurnsRemaining, lavaTideTiles,
      extraTurnCost, deathCause, warningPulse, pendingIdentify, pendingSacrifice, pendingAllocations,
      bossBlessingPending, lastBossDefId, secretWalls, floorDescriptionShown } = state;
    const saveData = {
      version: SAVE_VERSION,
      state: {
        phase, player, currentFloor, map, width, height, enemies, items,
        messages, turn, seed, highScores, achievements, legacyItem,
        isDailyChallenge, shopItems, currentEvent,
        skillUseCount, shopBuyCount, musicEnabled, sfxEnabled,
        voidCorruption, currentFragmentTurns, lavaTideActive, lavaTideTurnsRemaining, lavaTideTiles,
        extraTurnCost, deathCause, warningPulse, pendingIdentify, pendingSacrifice, pendingAllocations,
        bossBlessingPending, lastBossDefId, secretWalls, floorDescriptionShown,
        screenFlash: null,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch { /* ignore storage full */ }
}

function loadSave(): { state: GameState; message?: string } | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!parsed.version || !parsed.state) {
      deleteSave('存档格式损坏，无法恢复');
      return { state: parsed.state ?? parsed, message: '存档格式异常，已尝试恢复' };
    }
    return { state: parsed.state, message: '存档已恢复' };
  } catch {
    deleteSave('存档数据损坏，无法读取');
    return null;
  }
}

function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch { return false; }
}

function deleteSave(reason?: string) {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
  if (reason) {
    console.log(`[存档] ${reason}`);
  }
}

// ============================================================
// Talent Effects
// ============================================================
function hasTalent(player: Player, talentId: string): boolean {
  return player.talents.includes(talentId);
}

// 获取玩家装备中所有特效
function getEquipmentEffects(player: Player): EquipmentEffect[] {
  const effects: EquipmentEffect[] = [];
  for (const slot of Object.values(EquipmentSlot)) {
    const item = player.equipment[slot];
    if (item && 'specialEffect' in item && item.specialEffect) {
      effects.push(item.specialEffect);
    }
  }
  return effects;
}

function hasEquipmentEffect(player: Player, effect: EquipmentEffect): boolean {
  return getEquipmentEffects(player).includes(effect);
}

// 特效中文名
const _EFFECT_NAME_ZH: Record<EquipmentEffect, string> = {
  [EquipmentEffect.LifeSteal]: '吸血',
  [EquipmentEffect.ManaSteal]: '吸魔',
  [EquipmentEffect.CritBonus]: '暴击强化',
  [EquipmentEffect.KillReset]: '击杀重置',
  [EquipmentEffect.StatusProc]: '元素触发',
  [EquipmentEffect.Thorns]: '反伤',
  [EquipmentEffect.DodgeMana]: '闪避回蓝',
  [EquipmentEffect.DamageShield]: '受伤护盾',
  [EquipmentEffect.CooldownReduce]: '冷却缩减',
  [EquipmentEffect.ElementResist]: '元素抗性',
};

function getTalentModifiedHungerRate(player: Player): number {
  return hasTalent(player, 'ironStomach') ? HUNGER_RATE * 0.5 : HUNGER_RATE;
}

function getTalentModifiedDamageReduction(player: Player): number {
  return hasTalent(player, 'thickSkin') ? 2 : 0;
}

function getTalentModifiedExp(player: Player, baseExp: number): number {
  return hasTalent(player, 'fastLearner') ? Math.floor(baseExp * 1.2) : baseExp;
}

function getTalentModifiedDropChance(player: Player, baseChance: number): number {
  return hasTalent(player, 'lucky') ? Math.min(1, baseChance * 1.15) : baseChance;
}

function getTalentModifiedGoldDrop(player: Player, baseGold: number): number {
  return hasTalent(player, 'greedy') ? Math.floor(baseGold * 1.5) : baseGold;
}

function getTalentModifiedCritMultiplier(player: Player): number {
  return hasTalent(player, 'deadlyStrike') ? 2.0 : 1.5;
}

function getTalentModifiedElementalDamage(player: Player, baseDamage: number): number {
  return hasTalent(player, 'elementalAffinity') ? Math.floor(baseDamage * 1.2) : baseDamage;
}

function getTalentModifiedVisionRadius(player: Player): number {
  return hasTalent(player, 'nightVision') ? player.visionRadius + 2 : player.visionRadius;
}

function getTalentModifiedTenaciousDefense(player: Player): number {
  return (hasTalent(player, 'tenacious') && player.hp < player.maxHp * 0.2) ? 5 : 0;
}

function getTalentShieldWallDefense(player: Player): number {
  return (hasTalent(player, 'shieldWall') && player.equipment[EquipmentSlot.Armor]) ? 3 : 0;
}

function getTalentBloodFuryAttack(player: Player): number {
  if (!hasTalent(player, 'bloodFury')) return 0;
  const hpRatio = player.hp / player.maxHp;
  return Math.floor(player.stats.str * 0.3 * (1 - hpRatio));
}

// ============================================================
// Achievement Checking
// ============================================================
function checkAchievements(state: GameState, player: Player): string[] {
  const newAchievements: string[] = [];
  const existing = new Set(state.achievements);

  const check = (id: string, condition: boolean) => {
    if (condition && !existing.has(id)) newAchievements.push(id);
  };

  check('firstBlood', player.killCount >= 1);
  check('floor5', state.currentFloor >= 5);
  check('floor10', state.currentFloor >= 10);
  check('floor15', state.currentFloor >= 15);
  check('floor20', state.currentFloor >= 20);
  check('floor25', state.currentFloor >= 25);
  check('floor30', state.currentFloor >= 30);
  check('bossSlayer', player.bossKillCount >= 1);
  check('bossMaster', player.bossKillCount >= 3);
  check('rich', player.gold >= 100);
  check('talent3', player.talents.length >= 3);
  check('pacifist10', state.currentFloor >= 10 && player.killCount === 0);
  check('glutton', state.currentFloor >= 5 && player.hunger >= 150);

  return newAchievements;
}

// ============================================================
// Helper Functions
// ============================================================
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

// ============================================================
// Store Interface
// ============================================================
interface GameStore extends GameState {
  newGame: (name: string, charClass: CharacterClass, isDaily?: boolean) => void;
  movePlayer: (dx: number, dy: number) => void;
  waitTurn: () => void;
  pickupItem: () => void;
  useItem: (index: number) => void;
  equipItem: (index: number, targetSlot?: EquipmentSlot) => void;
  dropItem: (index: number) => void;
  sellItem: (index: number) => void;
  descendStairs: () => void;
  openDoor: (dx: number, dy: number) => void;
  allocateStat: (stat: keyof Stats) => void;
  deallocateStat: (stat: keyof Stats) => void;
  resetAllocations: () => void;
  toggleInventory: () => void;
  confirmIdentify: (index: number) => void;
  confirmSacrifice: (index: number) => void;
  confirmLevelUp: () => void;
  selectTalent: (talentId: string) => void;
  useSkill: (skillIndex: number) => void;
  buyShopItem: (index: number) => void;
  closeShop: () => void;
  chooseEventChoice: (choiceIndex: number) => void;
  closeEvent: () => void;
  chooseBossBlessing: (blessing: BossBlessing) => void;
  restartGame: () => void;
  setPhase: (phase: GamePhase) => void;
  toggleMusic: () => void;
  toggleSfx: () => void;
  loadGame: () => boolean;
  suspendAndQuit: () => void;
  hasSaveGame: () => boolean;
  visibleTiles: Set<string>;
  rememberedMap: Map<string, { char: string; fg: string; bg: string }>;
}

const initialState: GameState = {
  phase: GamePhase.CharacterCreation,
  player: null,
  currentFloor: 0,
  map: [],
  width: 80,
  height: 28,
  enemies: [],
  items: [],
  messages: [],
  turn: 0,
  seed: Date.now(),
  highScores: loadHighScores(),
  achievements: loadAchievements(),
  legacyItem: loadLegacyItem(),
  isDailyChallenge: false,
  shopItems: [],
  currentEvent: null,
  screenFlash: null,
  skillUseCount: 0,
  shopBuyCount: 0,
  musicEnabled: true,
  sfxEnabled: true,
  voidCorruption: { str: 0, dex: 0, int: 0, vit: 0 },
  currentFragmentTurns: 0,
  lavaTideActive: false,
  lavaTideTurnsRemaining: 0,
  lavaTideTiles: [],
  extraTurnCost: 0,
  deathCause: '',
  warningPulse: 'none' as const,
  pendingIdentify: false,
  pendingSacrifice: false,
  pendingAllocations: { str: 0, dex: 0, int: 0, vit: 0 },
  bossBlessingPending: false,
  lastBossDefId: null,
  secretWalls: [],
  floorDescriptionShown: false,
};

export const useGameStore = create<GameStore>((set, get) => {
  function addMessages(newMsgs: Message[]) {
    const state = get();
    const turn = state.turn;
    const msgs = newMsgs.map(m => ({ ...m, turn }));
    set({ messages: [...state.messages.slice(-100), ...msgs] });
  }

  function flashScreen(color: string) {
    set({ screenFlash: color });
    setTimeout(() => set({ screenFlash: null }), 150);
  }

  function updateFOV() {
    const state = get();
    if (!state.player) return;
    const effectiveVision = getTalentModifiedVisionRadius(state.player);
    const biome = getBiomeForFloor(state.currentFloor);
    const visible = computeFOV(state.map, state.player.pos, effectiveVision, biome, state.seed + state.turn);

    const newMap = state.map.map(row => row.map(tile => ({ ...tile })));
    const remembered = new Map(state.rememberedMap);

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const key = `${x},${y}`;
        if (visible.has(key)) {
          newMap[y][x].visible = true;
          newMap[y][x].remembered = true;
          remembered.set(key, { char: newMap[y][x].char, fg: newMap[y][x].fg, bg: newMap[y][x].bg });
        } else {
          newMap[y][x].visible = false;
          if (remembered.has(key)) {
            newMap[y][x].remembered = true;
            const r = remembered.get(key)!;
            newMap[y][x].rememberedChar = r.char;
            newMap[y][x].rememberedFg = r.fg;
            newMap[y][x].rememberedBg = r.bg;
          }
        }
      }
    }

    set({ map: newMap, visibleTiles: visible, rememberedMap: remembered });
  }

  function handlePlayerDeath(player: Player, enemies: Enemy[], messages: Message[], deathCause: string) {
    const state = get();
    messages.push(msg('你倒在了深渊之中...', MessageCategory.System, '#ff0000'));
    AudioManager.playSFX('death');
    flashScreen('#ff0000');

    // Legacy: save best equipped item
    const equippedItems = Object.values(player.equipment).filter((i): i is Item => i !== null && !i.cursed);
    const legacyItem = equippedItems.length > 0 ? equippedItems[equippedItems.length - 1] : null;
    saveLegacyItem(legacyItem);

    // Check achievements one last time
    const newAchievements = checkAchievements(state, player);
    const allAchievements = [...new Set([...state.achievements, ...newAchievements])];
    saveAchievements(allAchievements);

    const scores = [...state.highScores, {
      name: player.name, class: player.class, floor: state.currentFloor,
      level: player.level, kills: player.killCount, turns: state.turn,
      date: new Date().toISOString(), isDaily: state.isDailyChallenge,
    }].sort((a, b) => b.floor - a.floor).slice(0, 10);
    saveHighScores(scores);

    set({ player, enemies, messages: [...state.messages.slice(-100), ...messages], phase: GamePhase.GameOver, highScores: scores, achievements: allAchievements, deathCause, warningPulse: 'none' as const });

    // Delete save on death (permadeath)
    deleteSave('角色已死亡，存档已删除');
  }

  function processTurn() {
    const state = get();
    if (!state.player) return;

    // Handle extra turn cost (e.g. ShallowWater slow movement)
    if (state.extraTurnCost > 0) {
      set({ extraTurnCost: state.extraTurnCost - 1 });
      // Run a full turn where enemies act but player cannot move
      const s2 = get();
      if (!s2.player) return;
      const player2: Player = { ...s2.player };
      const enemies2 = s2.enemies.map(e => ({ ...e }));
      const rng2 = new SeededRandom(s2.seed + s2.turn * 13);
      const msgs2: Message[] = [];

      // Process hunger & status on extra turn
      const hungerRate2 = getTalentModifiedHungerRate(player2);
      player2.hunger -= hungerRate2;
      if (player2.hunger <= 0) {
        player2.hunger = 0;
        player2.hp -= HUNGER_STARVE_DAMAGE;
        if (player2.hp <= 0) {
          handlePlayerDeath(player2, enemies2, msgs2, '饥饿致死');
          return;
        }
      }

      // Process enemy turns
      const visibleTiles2 = s2.visibleTiles;
      const ec2 = enemies2.length;
      for (let i = 0; i < ec2; i++) {
        if (enemies2[i].hp <= 0) continue;
        const er = getEnemyAction(enemies2[i], player2.pos, s2.map, visibleTiles2, enemies2, rng2);
        if (er === 'attack') {
          const def2 = getPlayerDefense(player2) + getTalentModifiedDamageReduction(player2) + getTalentModifiedTenaciousDefense(player2) + getTalentShieldWallDefense(player2);
          const dmg2 = Math.max(1, Math.floor(enemies2[i].attack * 20 / (20 + def2)));
          player2.hp -= dmg2;
          msgs2.push(msg(`${enemies2[i].name}攻击了你，造成 ${dmg2} 点伤害！`, MessageCategory.Combat, '#ff4444'));
          if (player2.hp <= 0) {
            handlePlayerDeath(player2, enemies2, msgs2, `被${enemies2[i].name}击杀`);
            return;
          }
        } else if (er !== 'wait' && er !== 'special') {
          const mv = er as { dx: number; dy: number };
          const enx = enemies2[i].pos.x + mv.dx;
          const eny = enemies2[i].pos.y + mv.dy;
          if (enx >= 0 && enx < s2.width && eny >= 0 && eny < s2.height && s2.map[eny][enx].walkable) {
            const occ2 = enemies2.some(e => e !== enemies2[i] && e.hp > 0 && e.pos.x === enx && e.pos.y === eny);
            if (!occ2) enemies2[i] = { ...enemies2[i], pos: { x: enx, y: eny } };
          }
        } else if (er === 'special' && enemies2[i].specialAbility) {
          handleSpecialAbility(enemies2[i], player2, enemies2, msgs2, rng2);
          if (player2.hp <= 0) {
            handlePlayerDeath(player2, enemies2, msgs2, `被${enemies2[i].name}击杀`);
            return;
          }
        }
      }

      // Warning pulse on extra turn
      const isLowHp2 = player2.hp / player2.maxHp < 0.3;
      const isStarving2 = player2.hunger <= 0;
      let warningPulse2: GameState['warningPulse'] = 'none';
      if (isLowHp2 && isStarving2) {
        warningPulse2 = 'both';
      } else if (isLowHp2) {
        warningPulse2 = 'lowHp';
      } else if (isStarving2) {
        warningPulse2 = 'hunger';
      }
      const extraTurn = s2.turn + 1;
      if (isLowHp2) {
        AudioManager.playSFX('heartbeat');
      }
      if (isStarving2) {
        AudioManager.playSFX('stomachGrowl');
      }

      set({
        turn: extraTurn,
        player: player2,
        enemies: enemies2.filter(e => e.hp > 0),
        messages: [...s2.messages.slice(-100), ...msgs2],
        warningPulse: warningPulse2,
      });
      updateFOV();
      return;
    }

    let player = { ...state.player };
    let enemies = state.enemies.map(e => ({ ...e }));
    const rng = new SeededRandom(state.seed + state.turn * 13);
    const messages: Message[] = [];

    // Process player status effects
    if (player.statusEffects.length > 0) {
      const result = processStatusEffects(player, true);
      player.hp -= result.damage;
      if (result.damage > 0) messages.push(...result.messages.map(m => msg(m, MessageCategory.Combat, '#ff4444')));
    }

    // Check player death from status effects
    if (player.hp <= 0) {
      const dmgEffects = player.statusEffects.filter(e => e.damage && e.damage > 0);
      const effectZh: Record<string, string> = { poison: '中毒', burn: '燃烧', bleed: '流血' };
      const cause = dmgEffects.length > 0
        ? `因${dmgEffects.map(e => effectZh[e.type] || e.type).join('和')}致死`
        : '因异常状态致死';
      handlePlayerDeath(player, enemies, messages, cause);
      return;
    }

    // Check if player is frozen (BUG FIX: freeze now actually prevents action)
    const playerFrozen = isFrozen(player);

    // Hunger
    const hungerRate = getTalentModifiedHungerRate(player);
    const prevHunger = player.hunger;
    player.hunger -= hungerRate;
    if (player.hunger <= 0) {
      player.hunger = 0;
      player.hp -= HUNGER_STARVE_DAMAGE;
      if (prevHunger > 0) {
        messages.push(msg('你饥饿难耐，生命在流逝...', MessageCategory.System, '#ff8844'));
      } else if ((state.turn + 1) % 3 === 0) {
        messages.push(msg('饥饿仍在侵蚀你的生命...', MessageCategory.System, '#ff6622'));
      }
    } else if (prevHunger >= 20 && player.hunger < 20) {
      messages.push(msg('你的肚子咕咕叫，需要尽快进食！', MessageCategory.System, '#ffaa44'));
    } else if (prevHunger >= 10 && player.hunger < 10) {
      messages.push(msg('⚠ 饥饿感越来越强烈！', MessageCategory.System, '#ff8844'));
    } else if (prevHunger >= 5 && player.hunger < 5) {
      messages.push(msg('⚠ 你快要饿死了！赶紧吃东西！', MessageCategory.System, '#ff4422'));
    } else if (prevHunger >= 30 && player.hunger < 30) {
      messages.push(msg('你感到饥饿...', MessageCategory.System, '#ffaa44'));
    }

    // Regeneration talent
    if (hasTalent(player, 'regeneration') && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
    }
    // MP regen: only in combat (enemies visible)
    const enemyInSight = enemies.some(e => e.hp > 0 && state.visibleTiles.has(`${e.pos.x},${e.pos.y}`));
    if (enemyInSight && player.mp < player.maxMp) {
      const mpRegen = Math.max(1, Math.floor(player.stats.int / 5));
      player.mp = Math.min(player.maxMp, player.mp + mpRegen);
    }
    // Meditation talent: additional +1 MP per turn (only in combat)
    if (hasTalent(player, 'meditation') && enemyInSight && player.mp < player.maxMp) {
      player.mp = Math.min(player.maxMp, player.mp + 1);
    }

    // Decrease skill cooldowns
    player.skillCooldowns = player.skillCooldowns.map(cd => Math.max(0, cd - 1));

    // Check player death from starvation
    if (player.hp <= 0) {
      handlePlayerDeath(player, enemies, messages, '饥饿致死');
      return;
    }

    // Lava Tide mechanic (Lava Core only)
    let lavaTideActive = state.lavaTideActive;
    let lavaTideTurnsRemaining = state.lavaTideTurnsRemaining;
    let lavaTideTiles = state.lavaTideTiles;
    let currentMap = state.map;
    if (getBiomeForFloor(state.currentFloor) === Biome.LavaCore) {
      if (state.turn > 0 && state.turn % 50 === 0 && !lavaTideActive) {
        // Tide rises: convert all CooledLava to Lava
        lavaTideActive = true;
        lavaTideTurnsRemaining = 5;
        const newMap = currentMap.map(row => row.map(t => ({ ...t })));
        const cooledPositions: { x: number; y: number }[] = [];
        for (let y = 0; y < newMap.length; y++) {
          for (let x = 0; x < newMap[y].length; x++) {
            if (newMap[y][x].type === TileType.CooledLava) {
              cooledPositions.push({ x, y });
              newMap[y][x] = createTile(TileType.Lava, Biome.LavaCore);
            }
          }
        }
        currentMap = newMap;
        lavaTideTiles = cooledPositions;
        messages.push(msg('熔岩涨潮了！冷却的熔岩重新涌动！', MessageCategory.Environment, '#ff4422'));
      }
      if (lavaTideActive) {
        lavaTideTurnsRemaining--;
        if (lavaTideTurnsRemaining <= 0) {
          // Tide recedes: restore CooledLava from saved positions
          lavaTideActive = false;
          const newMap = currentMap.map(row => row.map(t => ({ ...t })));
          for (const pos of lavaTideTiles) {
            if (newMap[pos.y] && newMap[pos.y][pos.x] && newMap[pos.y][pos.x].type === TileType.Lava) {
              newMap[pos.y][pos.x] = createTile(TileType.CooledLava, Biome.LavaCore);
            }
          }
          currentMap = newMap;
          lavaTideTiles = [];
          messages.push(msg('熔岩退潮了。', MessageCategory.Environment, '#994433'));
        }
      }
    }

    // Void Corruption (Void Abyss only)
    let voidCorruption = state.voidCorruption;
    let currentFragmentTurns = state.currentFragmentTurns;
    if (getBiomeForFloor(state.currentFloor) === Biome.VoidAbyss) {
      currentFragmentTurns++;
      if (currentFragmentTurns > 0 && currentFragmentTurns % 20 === 0) {
        const stats = ['str', 'dex', 'int', 'vit'] as const;
        const stat = stats[rng.nextInt(0, 3)];
        const statZh: Record<string, string> = { str: '力量', dex: '灵巧', int: '智力', vit: '体质' };
        voidCorruption = { ...voidCorruption, [stat]: voidCorruption[stat] + 1 };
        player.stats[stat]--;
        messages.push(msg(`虚空侵蚀了你的${statZh[stat]}！(-1)`, MessageCategory.Environment, '#8844ff'));
      }
    }

    // Arena: Lava pool overflow (every 3 turns on demonLord floor)
    if (state.turn % 3 === 0 && state.enemies.some(e => e.isBoss && e.defId === 'demonLord' && e.hp > 0)) {
      for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[0].length; x++) {
          if (currentMap[y][x].type === TileType.LavaPool) {
            const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
            for (const [dx, dy] of dirs) {
              const nx = x + dx, ny = y + dy;
              if (ny >= 0 && ny < currentMap.length && nx >= 0 && nx < currentMap[0].length) {
                if (currentMap[ny][nx].type === TileType.Floor || currentMap[ny][nx].type === TileType.Corridor) {
                  currentMap[ny][nx] = { ...currentMap[ny][nx], type: TileType.Lava, char: '~', fg: '#ff4400', bg: '#1a0a04', walkable: false, transparent: true };
                }
              }
            }
          }
        }
      }
    }
    // Lava reverts next turn
    if (state.turn % 3 === 1) {
      for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[0].length; x++) {
          if (currentMap[y][x].type === TileType.Lava) {
            currentMap[y][x] = { ...currentMap[y][x], type: TileType.CooledLava, char: '=', fg: '#553322', bg: '#1a0a04', walkable: true, transparent: true };
          }
        }
      }
    }

    // Arena: Void rift teleport (every 5 turns)
    if (state.turn % 5 === 0) {
      const rifts: Position[] = [];
      for (let y = 0; y < state.map.length; y++) {
        for (let x = 0; x < state.map[0].length; x++) {
          if (state.map[y][x].type === TileType.VoidRift) rifts.push({ x, y });
        }
      }
      if (rifts.length >= 2) {
        // Check if player is adjacent to a rift
        for (const rift of rifts) {
          if (Math.abs(player.pos.x - rift.x) <= 1 && Math.abs(player.pos.y - rift.y) <= 1) {
            // Teleport to another rift
            const otherRift = rifts.find(r => r.x !== rift.x || r.y !== rift.y);
            if (otherRift) {
              player.pos = { ...otherRift };
              messages.push(msg('虚空裂隙将你传送到了另一个位置！', MessageCategory.Environment, '#cc44ff'));
            }
            break;
          }
        }
      }
    }

    // Arena: Corruption pool damage (every 2 turns)
    if (state.turn % 2 === 0) {
      let hasCorruptionPool = false;
      for (let y = 0; y < state.map.length && !hasCorruptionPool; y++) {
        for (let x = 0; x < state.map[0].length && !hasCorruptionPool; x++) {
          if (state.map[y][x].type === TileType.CorruptionPool) hasCorruptionPool = true;
        }
      }
      if (hasCorruptionPool) {
        player.hp = Math.max(0, player.hp - 2);
        messages.push(msg('腐蚀池的毒气侵蚀了你！受到2点伤害！', MessageCategory.Combat, '#aa44ff'));
      }
    }

    // Process enemy turns
    if (!playerFrozen) {
      const visibleTiles = state.visibleTiles;
      // 只处理当前回合开始时存在的敌人，新召唤的敌人下回合才行动
      const enemyCountAtTurnStart = enemies.length;
      for (let i = 0; i < enemyCountAtTurnStart; i++) {
        if (enemies[i].hp <= 0) continue;

        // Process enemy status effects
        if (enemies[i].statusEffects.length > 0) {
          const result = processStatusEffects(enemies[i], false);
          enemies[i].hp -= result.damage;
          if (enemies[i].hp <= 0) {
            const exp = getTalentModifiedExp(player, enemies[i].exp);
            const goldDrop = getTalentModifiedGoldDrop(player, enemies[i].goldDrop);
            player.exp += exp;
            player.gold += goldDrop;
            player.killCount++;

            if (enemies[i].isBoss) player.bossKillCount++;
            messages.push(msg(`${enemies[i].name}被效果杀死了！获得 ${exp} 经验，${goldDrop} 金币`, MessageCategory.Combat, '#44cc44'));
            AudioManager.playSFX('coin');

            // Elite Explosive: Death blast dealing ATK×1.5 in 2-tile radius
            if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Explosive) {
              const blastDmg = Math.floor(enemies[i].attack * 1.5);
              const blastRadius = 2;
              // Damage player if in range
              const distToPlayer = Math.abs(enemies[i].pos.x - player.pos.x) + Math.abs(enemies[i].pos.y - player.pos.y);
              if (distToPlayer <= blastRadius) {
                player.hp = Math.max(0, player.hp - blastDmg);
                messages.push(msg(`${enemies[i].name}爆裂！你受到${blastDmg}点伤害！`, MessageCategory.Combat, '#ff4444'));
                flashScreen('#ff000033');
              }
              // Damage other enemies in range
              for (const other of enemies) {
                if (other.id !== enemies[i].id && other.hp > 0) {
                  const dist = Math.abs(enemies[i].pos.x - other.pos.x) + Math.abs(enemies[i].pos.y - other.pos.y);
                  if (dist <= blastRadius) {
                    other.hp = Math.max(0, other.hp - blastDmg);
                  }
                }
              }
              if (player.hp <= 0) {
                handlePlayerDeath(player, enemies, messages, `被${enemies[i].name}爆裂`);
                return;
              }
            }
            continue;
          }
        }

        // Elite Frenzy: +0.5 ATK per turn
        if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Frenzy && enemies[i].hp > 0) {
          enemies[i].frenzyBonus = (enemies[i].frenzyBonus || 0) + 0.5;
        }

        // Elite Regen: Heal 5% max HP per turn
        if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Regen && enemies[i].hp > 0) {
          const healAmt = Math.max(1, Math.floor(enemies[i].maxHp * 0.05));
          enemies[i].hp = Math.min(enemies[i].maxHp, enemies[i].hp + healAmt);
        }

        // Fast enemies get multiple actions
        for (let action = 0; action < enemies[i].speed; action++) {
          const enemy = enemies[i]; // Re-read current state each action

          // Skip attack on phase transition
          if (enemy._skipAttack) {
            enemies[i] = { ...enemy, _skipAttack: false };
            continue;
          }

          // 装备行为修正：虫群ATK加成
          let swarmBonus = 0;
          if (enemy.behavior === EnemyBehavior.Swarm) {
            const allies = enemies.filter(e => e.hp > 0 && e.id !== enemy.id && e.defId === enemy.defId && Math.abs(e.pos.x - enemy.pos.x) + Math.abs(e.pos.y - enemy.pos.y) <= 2);
            if (allies.length >= 2) swarmBonus = Math.floor(enemy.attack * 0.5);
          }

          // 装备行为修正：狂暴ATK×2 DEF-5
          let berserkAtkBonus = 0;
          let berserkDefPenalty = 0;
          if (enemy.behavior === EnemyBehavior.Berserk && enemy.hp < enemy.maxHp * 0.3) {
            berserkAtkBonus = enemy.attack; // ATK×2
            berserkDefPenalty = 5;
          }

          // 装备行为修正：呼唤——首次发现玩家时给同类加速
          if (enemy.behavior === EnemyBehavior.CallAlly && !enemy.hasCalledAlly) {
            const isVisible = visibleTiles.has(`${enemy.pos.x},${enemy.pos.y}`);
            if (isVisible) {
              enemies[i] = { ...enemies[i], hasCalledAlly: true };
              let alerted = 0;
              for (let j = 0; j < enemies.length; j++) {
                if (j !== i && enemies[j].hp > 0 && enemies[j].defId === enemy.defId) {
                  enemies[j] = { ...enemies[j], speed: enemies[j].speed + 1 };
                  alerted++;
                }
              }
              if (alerted > 0) {
                messages.push(msg(`${enemy.name}发出警报！${alerted}个同伴获得加速！`, MessageCategory.Combat, '#ffcc44'));
              }
            }
          }

          // 装备行为修正：伏击——玩家靠近时解除hidden，首击×2
          if (enemy.behavior === EnemyBehavior.Ambush && enemy.hidden) {
            const dist = Math.abs(enemy.pos.x - player.pos.x) + Math.abs(enemy.pos.y - player.pos.y);
            if (dist <= 1) {
              enemies[i] = { ...enemies[i], hidden: false };
              messages.push(msg(`${enemy.name}从暗处发起伏击！`, MessageCategory.Combat, '#ff4444'));
              // 首击×2
              const defense = getPlayerDefense(player) + getTalentModifiedDamageReduction(player) + getTalentModifiedTenaciousDefense(player) + getTalentShieldWallDefense(player);
              const ambushDamage = Math.max(1, Math.floor((enemy.attack + berserkAtkBonus) * 2 * 20 / (20 + defense)));
              player.hp -= ambushDamage;
              messages.push(msg(`伏击！${enemy.name}造成 ${ambushDamage} 点伤害！`, MessageCategory.Combat, '#ff4444'));
              flashScreen('#ff000033');
              if (player.hp <= 0) { handlePlayerDeath(player, enemies, messages, `被${enemy.name}伏击`); return; }
              continue;
            }
          }
          // 被攻击解除伏击
          if (enemy.behavior === EnemyBehavior.Ambush && enemy.hidden && visibleTiles.has(`${enemy.pos.x},${enemy.pos.y}`)) {
            enemies[i] = { ...enemies[i], hidden: false };
          }

          const actionResult = getEnemyAction(
            enemy, player.pos,
            currentMap,
            visibleTiles, enemies, rng
          );

          // Boss phase skill selection
          const originalSpecialAbility = enemy.specialAbility;
          if (enemy.isBoss && enemy.bossPhase > 1) {
            const phases = BOSS_PHASES[enemy.defId];
            if (phases) {
              // Collect all abilities from P1 up to current phase
              const availableAbilities: string[] = [];
              if (enemy.specialAbility) availableAbilities.push(enemy.specialAbility);
              for (let p = 0; p < enemy.bossPhase - 1 && p < phases.length; p++) {
                availableAbilities.push(...phases[p].newAbilities);
              }
              // 35% chance to use a phase ability instead of normal attack
              if (rng.next() < 0.35 && availableAbilities.length > 0) {
                const ability = rng.pick(availableAbilities);
                enemies[i] = { ...enemy, specialAbility: ability };
              }
            }
          }

          if (actionResult === 'wait') {
            // do nothing
          } else if (actionResult === 'special') {
            if (enemy.specialAbility) {
              handleSpecialAbility(enemies[i], player, enemies, messages, rng);
            }
            // Restore original special ability if boss used a phase ability
            if (enemy.isBoss && enemy.bossPhase > 1 && originalSpecialAbility !== undefined) {
              enemies[i] = { ...enemies[i], specialAbility: originalSpecialAbility };
            }
            if (player.hp <= 0) {
              handlePlayerDeath(player, enemies, messages, `被${enemy.name}击杀`);
              return;
            }
          } else if (actionResult === 'attack') {
            const defense = getPlayerDefense(player) + getTalentModifiedDamageReduction(player) + getTalentModifiedTenaciousDefense(player) + getTalentShieldWallDefense(player) - berserkDefPenalty;
            const variance = rng.nextInt(-2, 2);

            // Boss passive: Goblin King pack leader (+3 ATK when minions alive)
            let packLeaderBonus = 0;
            if (enemy.isBoss && enemy.defId === 'goblinKing') {
              const hasMinions = enemies.some(e => e.hp > 0 && !e.isBoss && !e.isElite &&
                Math.abs(e.pos.x - enemy.pos.x) <= 8 && Math.abs(e.pos.y - enemy.pos.y) <= 6);
              if (hasMinions) packLeaderBonus = 3;
            }

            // Add frenzy bonus to attack
            let atkBonus = 0;
            if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Frenzy) {
              atkBonus = enemies[i].frenzyBonus || 0;
            }

            const rawDamage = enemy.attack + swarmBonus + berserkAtkBonus + packLeaderBonus + variance + atkBonus;

            // 装备特效：闪避回蓝 — 闪避判定在受伤前
            const evasion = (player.equipment[EquipmentSlot.Armor] as ArmorItem | null)?.evasion ?? 0;
            const totalEvasion = Math.floor(getEffectiveStats(player).dex / 5) + evasion;
            const dodged = totalEvasion > 0 && rng.chance(Math.min(totalEvasion * 0.04, 0.3));

            if (dodged) {
              messages.push(msg(`你闪避了${enemy.name}的攻击！`, MessageCategory.Combat, '#44ccff'));
              // 装备特效：闪避回蓝
              if (hasEquipmentEffect(player, EquipmentEffect.DodgeMana) && player.mp < player.maxMp) {
                player.mp = Math.min(player.maxMp, player.mp + 3);
                messages.push(msg('闪避回蓝 +3 MP', MessageCategory.Combat, '#4488ff'));
              }
            } else {
              const damage = Math.max(1, Math.floor(rawDamage * 20 / (20 + defense)));
              player.hp -= damage;
              messages.push(msg(`${enemy.name}攻击了你，造成 ${damage} 点伤害！`, MessageCategory.Combat, '#ff4444'));
              AudioManager.playSFX('hit');
              flashScreen('#ff000033');

              // Elite Vampiric: Heal 30% of damage dealt
              if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Vampiric) {
                const healAmt = Math.floor(damage * 0.3);
                enemies[i] = { ...enemies[i], hp: Math.min(enemies[i].maxHp, enemies[i].hp + healAmt) };
              }

              // 装备特效：反伤 — 反弹10%近战伤害
              if (hasEquipmentEffect(player, EquipmentEffect.Thorns)) {
                const thornDmg = Math.max(1, Math.floor(damage * 0.1));
                const eIdx = enemies.findIndex(e => e.id === enemy.id);
                if (eIdx >= 0) {
                  enemies[eIdx] = { ...enemies[eIdx], hp: enemies[eIdx].hp - thornDmg };
                  messages.push(msg(`反伤造成 ${thornDmg} 点伤害！`, MessageCategory.Combat, '#cc88ff'));
                }
              }

              // 装备特效：受伤护盾 — 10%概率获得5防御5回合
              if (hasEquipmentEffect(player, EquipmentEffect.DamageShield) && rng.chance(0.10)) {
                if (!player.statusEffects.some(e => e.type === StatusEffectType.DefenseUp)) {
                  player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 5, damage: 5 }];
                  messages.push(msg('受伤护盾触发！防御提升5点，持续5回合', MessageCategory.Combat, '#88ccff'));
                }
              }
            }

            if (player.hp <= 0) {
              handlePlayerDeath(player, enemies, messages, `被${enemy.name}击杀`);
              return;
            }
          } else {
            const move = actionResult as { dx: number; dy: number };
            const nx = enemy.pos.x + move.dx;
            const ny = enemy.pos.y + move.dy;
            if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && state.map[ny][nx].walkable) {
              const occupied = enemies.some(e => e !== enemy && e.hp > 0 && e.pos.x === nx && e.pos.y === ny);
              if (!occupied) {
                enemies[i] = { ...enemy, pos: { x: nx, y: ny } };
              }
            }
          }
        }
      }
    }

    // Process revive timers & remove dead enemies
    const enemiesToKeep: Enemy[] = [];
    for (const e of enemies) {
      if (e.hp > 0) {
        enemiesToKeep.push(e);
        continue;
      }
      // Revive behavior: 2-turn timer
      if (e.behavior === EnemyBehavior.Revive && e.reviveTimer !== -1) {
        if (e.reviveTimer === undefined) {
          enemiesToKeep.push({ ...e, reviveTimer: 2 });
          messages.push(msg(`${e.name}的骸骨散落一地...`, MessageCategory.Combat, '#887766'));
        } else if (e.reviveTimer > 0) {
          enemiesToKeep.push({ ...e, reviveTimer: e.reviveTimer - 1 });
        } else {
          // Revive at 30% HP, can only revive once (reviveTimer = -1 after)
          enemiesToKeep.push({ ...e, hp: Math.floor(e.maxHp * 0.3), reviveTimer: -1, statusEffects: [] });
          messages.push(msg(`${e.name}重新站了起来！`, MessageCategory.Combat, '#aa44ff'));
          AudioManager.playSFX('levelup');
        }
        continue;
      }
      // Not revive, or already revived once: remove
    }
    enemies = enemiesToKeep;

    // Warning pulse: low HP / hunger
    const isLowHp = player.hp / player.maxHp < 0.3;
    const isStarving = player.hunger <= 0;
    const newTurn = state.turn + 1;
    let warningPulse: GameState['warningPulse'] = 'none';
    if (isLowHp && isStarving) {
      warningPulse = 'both';
    } else if (isLowHp) {
      warningPulse = 'lowHp';
    } else if (isStarving) {
      warningPulse = 'hunger';
    }
    if (isLowHp) {
      AudioManager.playSFX('heartbeat');
    }
    if (isStarving) {
      AudioManager.playSFX('stomachGrowl');
    }

    // Check level up
    if (checkLevelUp(player)) {
      player = applyLevelUp(player);
      messages.push(msg(`你升到了 ${player.level} 级！`, MessageCategory.System, '#ffcc44'));
      AudioManager.playSFX('levelup');
      flashScreen('#ffcc44');

      if (isTalentLevel(player.level)) {
        set({ player, enemies, phase: GamePhase.TalentSelection, pendingAllocations: { str: 0, dex: 0, int: 0, vit: 0 } });
      } else {
        set({ player, enemies, phase: GamePhase.LevelUp, pendingAllocations: { str: 0, dex: 0, int: 0, vit: 0 } });
      }
    } else {
      set({ player, enemies });
    }

    // Check achievements
    const newAchievements = checkAchievements(get(), player);
    if (newAchievements.length > 0) {
      const allAchievements = [...new Set([...get().achievements, ...newAchievements])];
      saveAchievements(allAchievements);
      for (const id of newAchievements) {
        const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
        if (def) {
          messages.push(msg(`🏆 成就解锁：${def.nameZh}！`, MessageCategory.System, '#ffcc44'));
        }
      }
      set({ achievements: allAchievements });
    }

    if (messages.length > 0) {
      addMessages(messages);
    }
    set({
      turn: newTurn,
      map: currentMap,
      lavaTideActive,
      lavaTideTurnsRemaining,
      lavaTideTiles,
      voidCorruption,
      currentFragmentTurns,
      warningPulse,
    });
    updateFOV();
  }

  function handleSpecialAbility(enemy: Enemy, player: Player, enemies: Enemy[], messages: Message[], rng: SeededRandom) {
    // 装备特效：元素抗性 — 元素伤害-30%
    const hasElementResist = hasEquipmentEffect(player, EquipmentEffect.ElementResist);

    switch (enemy.specialAbility) {
      case 'fireball': {
        let damage = Math.floor(enemy.attack * 1.5);
        if (hasElementResist) { damage = Math.floor(damage * 0.7); }
        player.hp -= damage;
        messages.push(msg(`${enemy.name}释放了火球术！造成 ${damage} 点🔥火伤害！${hasElementResist ? '(抗性减免)' : ''}`, MessageCategory.Combat, '#ff6644'));
        break;
      }
      case 'drain': {
        const damage = Math.floor(enemy.attack * 0.8);
        player.hp -= damage;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.floor(damage / 2));
        messages.push(msg(`${enemy.name}吸取了你的生命力！造成 ${damage} 点伤害！`, MessageCategory.Combat, '#aa44ff'));
        break;
      }
      case 'poison': {
        player.statusEffects.push({ type: StatusEffectType.Poison, duration: 4, damage: 3 });
        messages.push(msg(`${enemy.name}释放了毒雾！你中毒了！(☠3伤害/4回合)`, MessageCategory.Combat, '#44cc44'));
        break;
      }
      case 'petrify': {
        if (rng.chance(0.3)) {
          player.statusEffects.push({ type: StatusEffectType.Freeze, duration: 2, damage: 0 });
          messages.push(msg(`${enemy.name}的凝视将你石化了！`, MessageCategory.Combat, '#8888aa'));
        }
        break;
      }
      case 'summon': {
        const state = get();
        const biome = getBiomeForFloor(state.currentFloor);
        const config = BIOME_CONFIG[biome];
        // 排除拥有summon能力的敌人类型，防止递归召唤导致无限循环
        const safeEnemyIds = config.enemyIds.filter(id => {
          const def = ENEMY_DEFS.find(d => d.id === id);
          return !def || def.specialAbility !== 'summon';
        });
        const pool = safeEnemyIds.length > 0 ? safeEnemyIds : config.enemyIds;
        const summonCount = rng.nextInt(1, 2);
        let actualSummoned = 0;
        for (let i = 0; i < summonCount; i++) {
          const defId = rng.pick(pool);
          const offset = { x: rng.nextInt(-2, 2), y: rng.nextInt(-2, 2) };
          const spawnPos = { x: enemy.pos.x + offset.x, y: enemy.pos.y + offset.y };
          if (spawnPos.x >= 0 && spawnPos.x < state.width && spawnPos.y >= 0 && spawnPos.y < state.height && state.map[spawnPos.y][spawnPos.x].walkable) {
            const summoned = createEnemy(defId, spawnPos, false, state.currentFloor);
            if (summoned) { enemies.push(summoned); actualSummoned++; }
          }
        }
        messages.push(msg(`${enemy.name}召唤了 ${actualSummoned} 个援军！`, MessageCategory.Combat, '#ff8844'));
        break;
      }
      case 'breath': {
        let damage = Math.floor(enemy.attack * 1.8);
        if (hasElementResist) { damage = Math.floor(damage * 0.7); }
        player.hp -= damage;
        messages.push(msg(`${enemy.name}喷出了龙息！造成 ${damage} 点🔥火伤害！${hasElementResist ? '(抗性减免)' : ''}`, MessageCategory.Combat, '#ff4422'));
        break;
      }
      case 'teleport': {
        const curState = get();
        const tx = rng.nextInt(1, curState.width - 2);
        const ty = rng.nextInt(1, curState.height - 2);
        const eidx = enemies.findIndex(e => e.id === enemy.id);
        if (eidx >= 0) {
          enemies[eidx] = { ...enemy, pos: { x: tx, y: ty } };
        }
        messages.push(msg(`${enemy.name}瞬间移动了！`, MessageCategory.Combat, '#8844ff'));
        break;
      }
      case 'eldritch': {
        let damage = Math.floor(enemy.attack * 1.5);
        if (hasElementResist) { damage = Math.floor(damage * 0.7); }
        player.hp -= damage;
        if (rng.chance(0.4)) {
          player.statusEffects.push({ type: StatusEffectType.Poison, duration: 5, damage: 4 });
          messages.push(msg(`${enemy.name}释放了不可名状的力量！造成 ${damage} 点虚空伤害！你中毒了！(☠4伤害/5回合)${hasElementResist ? '(抗性减免)' : ''}`, MessageCategory.Combat, '#cc44ff'));
        } else {
          messages.push(msg(`${enemy.name}释放了不可名状的力量！造成 ${damage} 点虚空伤害！${hasElementResist ? '(抗性减免)' : ''}`, MessageCategory.Combat, '#cc44ff'));
        }
        break;
      }
      case 'surprise': {
        const damage = Math.floor(enemy.attack * 2);
        player.hp -= damage;
        messages.push(msg(`${enemy.name}突然袭击！造成 ${damage} 点伤害！`, MessageCategory.Combat, '#ff4444'));
        break;
      }
      case 'regenerate': {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.floor(enemy.maxHp * 0.1));
        messages.push(msg(`${enemy.name}正在恢复生命...`, MessageCategory.Combat, '#44cc44'));
        break;
      }
      case 'web': {
        if (rng.chance(0.4)) {
          player.statusEffects.push({ type: StatusEffectType.Freeze, duration: 1, damage: 0 });
          messages.push(msg(`${enemy.name}吐出了蛛丝，将你缠住！`, MessageCategory.Combat, '#aaaaaa'));
        }
        break;
      }
      case 'poisonSting': {
        if (rng.chance(0.2)) {
          player.statusEffects.push({ type: StatusEffectType.Poison, duration: 3, damage: 2 });
          messages.push(msg(`${enemy.name}的毒刺扎中了你！你中毒了！(☠2伤害/3回合)`, MessageCategory.Combat, '#44cc44'));
        }
        break;
      }
      case 'dormant': {
        // Gargoyle activates: change color and remove dormant flag
        enemy.fg = '#cc4444';
        enemy.specialAbility = undefined;
        messages.push(msg(`${enemy.name}苏醒了！石像的眼中闪过红光！`, MessageCategory.Combat, '#ff4444'));
        break;
      }
      case 'reflect': {
        // Crystal Guard: reflect handled in melee attack code
        break;
      }
      case 'glare': {
        if (rng.chance(0.3)) {
          player.statusEffects.push({ type: StatusEffectType.Freeze, duration: 1, damage: 0 });
          messages.push(msg(`${enemy.name}的强光令你短暂失明！`, MessageCategory.Combat, '#aaffcc'));
        }
        break;
      }
      case 'patrol': {
        // Tomb Guard: patrol behavior handled in AI movement
        break;
      }
      case 'phaseThrough': {
        // Soul Eater: can move through enemies (handled in movement AI)
        const damage = Math.floor(enemy.attack * 0.8);
        player.hp -= damage;
        messages.push(msg(`${enemy.name}穿过了你！造成 ${damage} 点伤害！`, MessageCategory.Combat, '#aa66ff'));
        break;
      }
      case 'lavaSwim': {
        // Lava Worm: can swim in lava (movement handled in AI)
        const damage = Math.floor(enemy.attack * 0.7);
        player.hp -= damage;
        messages.push(msg(`${enemy.name}从熔岩中突袭！造成 ${damage} 点伤害！`, MessageCategory.Combat, '#ff6622'));
        break;
      }
      case 'blockade': {
        // Obsidian Golem: stationary blocker, no special action
        break;
      }
      case 'blink': {
        // Void Weaver: teleport near player every 3 turns
        const blinkState = get();
        const tx = player.pos.x + rng.nextInt(-3, 4);
        const ty = player.pos.y + rng.nextInt(-3, 4);
        if (tx >= 0 && tx < blinkState.width && ty >= 0 && ty < blinkState.height && blinkState.map[ty]?.[tx]?.walkable) {
          const eidx = enemies.findIndex(e => e.id === enemy.id);
          if (eidx >= 0) {
            enemies[eidx] = { ...enemy, pos: { x: tx, y: ty } };
          }
          messages.push(msg(`${enemy.name}闪烁到了你身边！`, MessageCategory.Combat, '#cc44ff'));
        }
        break;
      }
      case 'mirrorExplode': {
        // Mirror Image: explodes on death (handled in death processing)
        break;
      }
      // === Boss Phase Abilities ===
      case 'warCry': {
        const allies = enemies.filter(e => e.hp > 0 && !e.isBoss && e.id !== enemy.id);
        for (const ally of allies) {
          const allyIdx = enemies.findIndex(e => e.id === ally.id);
          if (allyIdx >= 0) {
            // Use existing speed increment instead of status effect
            enemies[allyIdx] = { ...ally, speed: ally.speed + 1 };
          }
        }
        messages.push(msg(`${enemy.name}发出战吼！所有同伴速度提升！`, MessageCategory.Combat, '#ffcc44'));
        break;
      }
      case 'throwNet': {
        if (rng.next() < 0.35) {
          player.statusEffects.push({ type: StatusEffectType.Freeze, duration: 1, damage: 0 });
          messages.push(msg(`${enemy.name}投出罗网！你被冰冻了！`, MessageCategory.Combat, '#ff4444'));
        } else {
          messages.push(msg(`${enemy.name}投出罗网，但你躲开了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'poisonMist': {
        const chance = enemy.bossPhase >= 3 ? 0.8 : 0.6;
        if (rng.next() < chance) {
          player.statusEffects.push({ type: StatusEffectType.Poison, duration: 5, damage: 4 });
          messages.push(msg(`${enemy.name}喷射毒雾！你中毒了！`, MessageCategory.Combat, '#44cc44'));
        } else {
          messages.push(msg(`${enemy.name}喷射毒雾，但你抵抗了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'cocoon': {
        if (rng.next() < 0.25) {
          player.statusEffects.push({ type: StatusEffectType.Freeze, duration: 2, damage: 0 });
          messages.push(msg(`${enemy.name}吐出茧缚！你被冰冻了2回合！`, MessageCategory.Combat, '#ff4444'));
        } else {
          messages.push(msg(`${enemy.name}吐出茧缚，但你挣脱了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'raiseDead': {
        const state = get();
        const deadEnemyTypes = [...new Set(enemies.filter(e => e.hp <= 0 && !e.isBoss).map(e => e.defId))];
        let raised = 0;
        for (const deadDefId of deadEnemyTypes.slice(0, 2)) {
          const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
          if (pos) {
            const raisedEnemy = createEnemy(deadDefId, pos, false, state.currentFloor);
            if (raisedEnemy) {
              enemies.push({ ...raisedEnemy, hp: Math.floor(raisedEnemy.maxHp * 0.3) });
              raised++;
            }
          }
        }
        messages.push(msg(`${enemy.name}施展亡者苏醒！${raised}个亡灵复活了！`, MessageCategory.Combat, '#cc44ff'));
        break;
      }
      case 'infernalFire': {
        if (rng.next() < 0.7) {
          player.statusEffects.push({ type: StatusEffectType.Burn, duration: 4, damage: 5 });
          messages.push(msg(`${enemy.name}释放狱火！你燃烧了！`, MessageCategory.Combat, '#ff6644'));
        } else {
          messages.push(msg(`${enemy.name}释放狱火，但你避开了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'summonLavaWorm': {
        const state = get();
        const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
        if (pos) {
          const minion = createEnemy('lavaWorm', pos, false, state.currentFloor);
          if (minion) {
            enemies.push(minion);
            messages.push(msg(`${enemy.name}召唤了一只熔岩虫！`, MessageCategory.Combat, '#ff6622'));
          }
        }
        break;
      }
      case 'infernalCharge': {
        const dmg = Math.floor(enemy.attack * 1.2);
        player.hp = Math.max(1, player.hp - dmg);
        messages.push(msg(`${enemy.name}释放炼狱冲击！造成${dmg}点火焰伤害！`, MessageCategory.Combat, '#ff4422'));
        // Also damages allied minions
        const allies = enemies.filter(e => e.hp > 0 && !e.isBoss && e.id !== enemy.id);
        for (const ally of allies) {
          const allyIdx = enemies.findIndex(e => e.id === ally.id);
          if (allyIdx >= 0) {
            enemies[allyIdx] = { ...ally, hp: Math.max(0, ally.hp - dmg) };
          }
        }
        if (allies.length > 0) {
          messages.push(msg(`炼狱冲击也波及了${allies.length}只小怪！`, MessageCategory.Combat, '#ffaa44'));
        }
        break;
      }
      case 'dimensionTear': {
        // Teleport player to random walkable position near boss room center
        const state = get();
        const cx = enemy.pos.x;
        const cy = enemy.pos.y;
        const walkable: Position[] = [];
        for (let dy = -6; dy <= 6; dy++) {
          for (let dx = -6; dx <= 6; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (ny >= 0 && ny < state.map.length && nx >= 0 && nx < state.map[0].length) {
              if (state.map[ny][nx].walkable && !enemies.some(e => e.hp > 0 && e.pos.x === nx && e.pos.y === ny)) {
                walkable.push({ x: nx, y: ny });
              }
            }
          }
        }
        if (walkable.length > 0) {
          const newPos = rng.pick(walkable);
          player.pos = { ...newPos };
          messages.push(msg(`${enemy.name}撕裂了维度！你被传送到了！`, MessageCategory.Combat, '#cc44ff'));
        }
        break;
      }
      case 'summonVoidWeaver': {
        const state = get();
        const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
        if (pos) {
          const minion = createEnemy('voidWeaver', pos, false, state.currentFloor);
          if (minion) {
            enemies.push(minion);
            messages.push(msg(`${enemy.name}召唤了一只虚空织者！`, MessageCategory.Combat, '#cc44ff'));
          }
        }
        break;
      }
      case 'summonVoidWeaver2': {
        const state = get();
        for (let s = 0; s < 2; s++) {
          const pos = findAdjacentEmpty(enemy.pos, state.map, enemies);
          if (pos) {
            const minion = createEnemy('voidWeaver', pos, false, state.currentFloor);
            if (minion) enemies.push(minion);
          }
        }
        messages.push(msg(`${enemy.name}召唤了虚空织者！`, MessageCategory.Combat, '#cc44ff'));
        break;
      }
      case 'annihilate': {
        if (rng.next() < 0.2) {
          player.hp = 1;
          player.statusEffects.push({ type: StatusEffectType.Burn, duration: 3, damage: 3 });
          messages.push(msg(`${enemy.name}释放湮灭波！你的HP降至1！燃烧了！`, MessageCategory.Combat, '#ff4444'));
        } else {
          messages.push(msg(`${enemy.name}释放湮灭波！你勉强撑住了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'voidRay': {
        let damage = Math.floor(enemy.attack * 1.8);
        if (hasElementResist) { damage = Math.floor(damage * 0.7); }
        player.hp -= damage;
        messages.push(msg(`${enemy.name}发射虚空射线！造成${damage}点伤害！`, MessageCategory.Combat, '#cc44ff'));
        break;
      }
      case 'devourMinion': {
        const minion = enemies.find(e => e.hp > 0 && !e.isBoss && e.id !== enemy.id);
        if (minion) {
          const minionIdx = enemies.findIndex(e => e.id === minion.id);
          if (minionIdx >= 0) {
            enemies[minionIdx] = { ...minion, hp: 0 };
          }
          const healAmt = Math.floor(enemy.maxHp * 0.3);
          const bossIdx = enemies.findIndex(e => e.id === enemy.id);
          if (bossIdx >= 0) {
            enemies[bossIdx] = { ...enemy, hp: Math.min(enemy.maxHp, enemy.hp + healAmt) };
          }
          messages.push(msg(`${enemy.name}吞噬了${minion.name}！回复了${healAmt}点HP！`, MessageCategory.Combat, '#cc44ff'));
        } else {
          messages.push(msg(`${enemy.name}试图吞噬仆从，但周围没有可吞噬的目标！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'voidPulse': {
        const vampRate = enemy.bossPhase >= 3 ? 0.8 : 0.6;
        const dmg = Math.floor(enemy.attack * 1.0);
        player.hp -= dmg;
        const healAmt = Math.floor(dmg * vampRate);
        const bossIdx = enemies.findIndex(e => e.id === enemy.id);
        if (bossIdx >= 0) {
          enemies[bossIdx] = { ...enemy, hp: Math.min(enemy.maxHp, enemy.hp + healAmt) };
        }
        messages.push(msg(`${enemy.name}释放虚空脉冲！造成${dmg}点伤害并回复${healAmt}HP！`, MessageCategory.Combat, '#cc44ff'));
        break;
      }
      case 'corrodeAll': {
        player.stats = {
          str: Math.max(1, player.stats.str - 1),
          dex: Math.max(1, player.stats.dex - 1),
          int: Math.max(1, player.stats.int - 1),
          vit: Math.max(1, player.stats.vit - 1),
        };
        messages.push(msg(`${enemy.name}释放全属性侵蚀！你的所有属性-1！`, MessageCategory.Combat, '#cc44ff'));
        break;
      }
    }
  }

  function enterFloor(floor: number) {
    const state = get();
    if (!state.player) return;

    const dungeon = generateDungeon(floor, state.seed);
    const biome = getBiomeForFloor(floor);
    const biomeConfig = BIOME_CONFIG[biome];

    // Create enemies
    const enemies: Enemy[] = [];
    for (const eData of dungeon.enemies) {
      const enemy = createEnemy(eData.defId, eData.pos, eData.isBoss, floor);
      if (enemy) enemies.push(enemy);
    }

    // Elite enemy
    if (dungeon.eliteEnemy) {
      const elite = createEliteEnemy(dungeon.eliteEnemy.defId, dungeon.eliteEnemy.pos, floor, dungeon.eliteEnemy.eliteAffix);
      if (elite) enemies.push(elite);
    }

    // Create items
    const items: FloorItem[] = [];
    const rng = new SeededRandom(state.seed + floor * 31);
    for (let i = 0; i < Math.floor(3 + Math.sqrt(floor) * 1.2); i++) {
      const room = rng.pick(dungeon.rooms.length > 1 ? dungeon.rooms.slice(1) : dungeon.rooms);
      if (!room) continue;
      const pos = {
        x: rng.nextInt(room.x + 1, room.x + room.w - 2),
        y: rng.nextInt(room.y + 1, room.y + room.h - 2),
      };
      items.push({ item: createRandomItem(floor, rng, true, 0, biomeConfig.foodDropMultiplier), pos });
    }

    // Create shop items if there's a shop
    let shopItems: Item[] = [];
    if (dungeon.shopPos) {
      shopItems = createShopItems(floor, rng, 4);
    }

    // Pick random event if there's an event tile
    let currentEvent: GameEventDef | null = null;
    if (dungeon.eventPos) {
      currentEvent = rng.pick(GAME_EVENTS);
    }

    const player = { ...state.player, pos: { ...dungeon.playerStart } };

    set({
      player,
      currentFloor: floor,
      map: dungeon.map,
      width: dungeon.map[0]?.length ?? 80,
      height: dungeon.map.length ?? 28,
      enemies,
      items,
      shopItems,
      currentEvent,
      voidCorruption: { str: 0, dex: 0, int: 0, vit: 0 },
      currentFragmentTurns: 0,
      lavaTideActive: false,
      lavaTideTurnsRemaining: 0,
      lavaTideTiles: [],
      extraTurnCost: 0,
      secretWalls: dungeon.secretWalls || [],
      floorDescriptionShown: false,
    });

    // Clear remembered map from previous floor
    set({ rememberedMap: new Map<string, { char: string; fg: string; bg: string }>() });

    addMessages([
      msg(`你来到了第 ${floor} 层 - ${biomeConfig.nameZh}`, MessageCategory.Story, '#ffcc44'),
    ]);

    // Floor atmosphere description
    const desc = FLOOR_DESCRIPTIONS[floor];
    const nextState = get();
    if (desc && !nextState.floorDescriptionShown) {
      addMessages([msg(desc, MessageCategory.Story, '#88ccff')]);
      set({ floorDescriptionShown: true });
    }

    updateFOV();

    // Update BGM for new floor
    const hasBoss = enemies.some(e => e.isBoss);
    AudioManager.updateContext('playing', floor, hasBoss, biome);

    // Auto-save on each floor (suspend save)
    saveGame(get());
  }

  return {
    ...initialState,
    visibleTiles: new Set<string>(),
    rememberedMap: new Map<string, { char: string; fg: string; bg: string }>(),

    newGame: (name: string, charClass: CharacterClass, isDaily?: boolean) => {
      msgId = 0;
      let player = createPlayer(name, charClass);
      // Initialize new Player fields
      player = { ...player, bossBlessings: [], finalPactUsed: false, inscriptionCount: 0 };
      const seed = isDaily ? (new Date().getUTCFullYear() * 10000 + (new Date().getUTCMonth() + 1) * 100 + new Date().getUTCDate()) : Date.now();

      // Apply legacy item
      const legacy = loadLegacyItem();
      if (legacy && player.inventory.length < getMaxInventorySize(player)) {
        player.inventory.push(legacy);
        saveLegacyItem(null); // Clear legacy after use
      }

      // Starting supplies: 2 bread + 1 rations + 1 jerky
      player.inventory.push(createFood(0)); // 面包
      player.inventory.push(createFood(0)); // 面包
      player.inventory.push(createFood(1)); // 干粮
      player.inventory.push(createFood(2)); // 肉干

      set({
        phase: GamePhase.Playing,
        player,
        currentFloor: 1,
        seed,
        messages: [],
        turn: 0,
        highScores: loadHighScores(),
        achievements: loadAchievements(),
        legacyItem: null,
        isDailyChallenge: isDaily ?? false,
        shopItems: [],
        currentEvent: null,
        screenFlash: null,
        voidCorruption: { str: 0, dex: 0, int: 0, vit: 0 },
        currentFragmentTurns: 0,
        lavaTideActive: false,
        lavaTideTurnsRemaining: 0,
        lavaTideTiles: [],
        warningPulse: 'none' as const,
      });
      enterFloor(1);
      AudioManager.updateContext('playing', 1, false, 'stoneDungeon');
      addMessages([
        msg('═══════════════════════════════════', MessageCategory.Story, '#ffcc44'),
        msg('  深渊回响 - Abyss Echo', MessageCategory.Story, '#ffcc44'),
        msg('═══════════════════════════════════', MessageCategory.Story, '#ffcc44'),
        msg('你坠入了无尽的深渊...', MessageCategory.Story, '#aaaaaa'),
        msg('只有不断向下，才能找到出路。', MessageCategory.Story, '#aaaaaa'),
        msg('朝敌人方向移动 = 普通攻击（不消耗法力）', MessageCategory.System, '#4488ff'),
        msg('Z/X/C = 技能 │ I = 背包 │ , = 拾取 │ ? = 帮助', MessageCategory.System, '#4488ff'),
      ]);
    },

    movePlayer: (dx: number, dy: number) => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Playing) return;

      const player = { ...state.player };
      const rng = new SeededRandom(state.seed + state.turn * 7);

      if (isConfused(player)) {
        const confused = applyConfusion(dx, dy, rng);
        dx = confused.dx;
        dy = confused.dy;
      }

      // BUG FIX: Frozen players can't move
      if (isFrozen(player)) {
        addMessages([msg('你被冰冻了，无法行动！', MessageCategory.System, '#88aaff')]);
        processTurn();
        return;
      }

      const nx = player.pos.x + dx;
      const ny = player.pos.y + dy;

      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) return;

      // Check for enemy
      const enemy = state.enemies.find(e => e.hp > 0 && e.pos.x === nx && e.pos.y === ny);
      if (enemy) {
        const stats = getEffectiveStats(player);
        const weaponDmg = getPlayerWeaponDamage(player);
        const weaponElement = getPlayerWeaponElement(player);
        let result = calculateMeleeDamage(stats, weaponDmg, enemy, weaponElement, rng);

        // Apply talent: Blood Fury (physical bonus)
        const bloodFuryBonus = getTalentBloodFuryAttack(player);
        if (bloodFuryBonus > 0) result = { ...result, damage: result.damage + bloodFuryBonus, physicalDamage: result.physicalDamage + bloodFuryBonus };

        // Apply talent: Deadly Strike (crit multiplier)
        if (result.critical) {
          const critMult = getTalentModifiedCritMultiplier(player);
          const ratio = critMult / 1.5;
          result = { ...result, damage: Math.floor(result.damage * ratio), physicalDamage: Math.floor(result.physicalDamage * ratio), elementalDamage: Math.floor(result.elementalDamage * ratio) };
        }

        // Apply talent: Elemental Affinity (elemental bonus)
        if (weaponElement !== Element.None) {
          const oldDamage = result.damage;
          const newDamage = getTalentModifiedElementalDamage(player, result.damage);
          const extraElemental = newDamage - oldDamage;
          result = { ...result, damage: newDamage, elementalDamage: result.elementalDamage + extraElemental };
        }

        // 装备特效：暴击强化 — 未暴击时额外10%暴击率
        if (!result.critical && hasEquipmentEffect(player, EquipmentEffect.CritBonus) && rng.chance(0.10)) {
          result = { ...result, damage: Math.floor(result.damage * 1.5), physicalDamage: Math.floor(result.physicalDamage * 1.5), elementalDamage: Math.floor(result.elementalDamage * 1.5), critical: true };
        }

        // 装备特效：元素触发 — 30%概率施加武器元素异常
        if (hasEquipmentEffect(player, EquipmentEffect.StatusProc) && weaponElement !== Element.None && rng.chance(0.30)) {
          const statusMap: Record<string, { type: StatusEffectType; duration: number; damage: number }> = {
            fire: { type: StatusEffectType.Burn, duration: 3, damage: 4 },
            ice: { type: StatusEffectType.Freeze, duration: 2, damage: 0 },
            lightning: { type: StatusEffectType.Confusion, duration: 2, damage: 0 },
            poison: { type: StatusEffectType.Poison, duration: 4, damage: 3 },
          };
          const effectDef = statusMap[weaponElement];
          if (effectDef) {
            enemy.statusEffects = [...enemy.statusEffects, { type: effectDef.type, duration: effectDef.duration, damage: effectDef.damage }];
          }
        }

        // Apply poison blade buff
        if (player.statusEffects.some(e => e.type === StatusEffectType.PoisonBlade)) {
          enemy.statusEffects = [...enemy.statusEffects, { type: StatusEffectType.Poison, duration: 4, damage: 5 }];
          player.statusEffects = player.statusEffects.filter(e => e.type !== StatusEffectType.PoisonBlade);
          addMessages([msg('毒刃生效！敌人中毒了！(☠5伤害/4回合)', MessageCategory.Combat, '#44cc44')]);
        }

        // Apply talent: Toxic Blade (random poison on hit)
        if (hasTalent(player, 'toxicBlade') && rng.chance(0.2)) {
          enemy.statusEffects = [...enemy.statusEffects, { type: StatusEffectType.Poison, duration: 3, damage: 2 }];
          addMessages([msg('淬毒生效！敌人中毒了！(☠2伤害/3回合)', MessageCategory.Combat, '#44cc44')]);
        }

        // Elite Phantom: 30% dodge chance
        let finalDamage = result.damage;
        if (enemy.isElite && enemy.eliteAffix === EliteAffix.Phantom) {
          if (rng.next() < 0.3) {
            addMessages([msg(`${enemy.name}闪避了攻击！`, MessageCategory.Combat, '#cccccc')]);
            // Skip the rest of damage application
            const enemies = state.enemies.map(e => {
              if (e.id !== enemy.id) return e;
              return { ...e, statusEffects: [...enemy.statusEffects] };
            });
            set({ player, enemies });
            processTurn();
            return;
          }
        }

        // Elite Armored: -30% physical damage
        if (enemy.isElite && enemy.eliteAffix === EliteAffix.Armored) {
          finalDamage = Math.floor(finalDamage * 0.7);
        }

        const newHp = enemy.hp - finalDamage;
        const enemies = state.enemies.map(e => {
          if (e.id !== enemy.id) return e;
          const updated = { ...e, hp: newHp, statusEffects: [...enemy.statusEffects] };
          // Activate dormant enemies when hit
          if (e.specialAbility === 'dormant') {
            updated.fg = '#cc4444';
            updated.specialAbility = undefined;
          }
          return updated;
        });

        const messages: Message[] = [];
        const elemZh: Record<string, string> = { fire: '🔥火', ice: '❄冰', lightning: '⚡雷', poison: '☠毒' };
        // Build damage label: split physical + elemental
        let dmgLabel: string;
        if (result.elementalDamage > 0 && result.element !== Element.None && elemZh[result.element]) {
          dmgLabel = `${result.physicalDamage} + ${result.elementalDamage}${elemZh[result.element]}`;
        } else {
          dmgLabel = `${result.damage}`;
        }
        if (result.critical) {
          messages.push(msg(`暴击！你攻击了${enemy.name}，造成 ${finalDamage > 0 ? dmgLabel : '0'} 点伤害！`, MessageCategory.Combat, '#ffcc44'));
          AudioManager.playSFX('critical');
        } else {
          messages.push(msg(`你攻击了${enemy.name}，造成 ${finalDamage > 0 ? dmgLabel : '0'} 点伤害`, MessageCategory.Combat, '#ff8844'));
          AudioManager.playSFX('attack');
        }

        // Dormant enemy activated by being hit
        if (enemy.specialAbility === 'dormant') {
          messages.push(msg(`${enemy.name}苏醒了！石像的眼中闪过红光！`, MessageCategory.Combat, '#ff4444'));
        }

        // Crystal Guard reflect: 20% chance to reflect 50% melee damage back
        if (enemy.specialAbility === 'reflect' && rng.chance(0.2)) {
          const reflectDmg = Math.floor(finalDamage * 0.5);
          player.hp -= reflectDmg;
          messages.push(msg(`${enemy.name}反射了 ${reflectDmg} 点伤害！`, MessageCategory.Combat, '#88ccff'));
          flashScreen('#88ccff33');
        }

        // 装备特效：吸血 — 回复伤害的20%HP
        if (hasEquipmentEffect(player, EquipmentEffect.LifeSteal)) {
          const heal = Math.max(1, Math.floor(finalDamage * 0.2));
          player.hp = Math.min(player.maxHp, player.hp + heal);
          messages.push(msg(`吸血回复 ${heal} HP`, MessageCategory.Combat, '#44cc44'));
        }
        // 装备特效：吸魔 — 回复伤害的15%MP
        if (hasEquipmentEffect(player, EquipmentEffect.ManaSteal)) {
          const mpGain = Math.max(1, Math.floor(finalDamage * 0.15));
          player.mp = Math.min(player.maxMp, player.mp + mpGain);
          messages.push(msg(`吸魔回复 ${mpGain} MP`, MessageCategory.Combat, '#4488ff'));
        }

        // Boss phase transition check
        const enemyIdx = enemies.findIndex(e => e.id === enemy.id);
        if (enemy.isBoss && enemyIdx >= 0 && newHp > 0) {
          const boss = enemies[enemyIdx];
          const phases = BOSS_PHASES[boss.defId];
          if (phases) {
            const hpPercent = boss.hp / boss.maxHp;
            const currentPhaseIdx = boss.bossPhase - 1;  // bossPhase 1→idx 0, phase 2→idx 1
            if (currentPhaseIdx < phases.length) {
              const nextPhase = phases[currentPhaseIdx];
              if (hpPercent <= nextPhase.hpThreshold) {
                // Execute phase transition
                enemies[enemyIdx] = { ...boss, bossPhase: (currentPhaseIdx + 2) as 1 | 2 | 3, attack: boss.attack + nextPhase.atkBonus, defense: boss.defense + nextPhase.defBonus };
                if (nextPhase.speedOverride !== undefined) enemies[enemyIdx] = { ...enemies[enemyIdx], speed: nextPhase.speedOverride };
                if (nextPhase.defOverride !== undefined) enemies[enemyIdx] = { ...enemies[enemyIdx], defense: nextPhase.defOverride };

                // Phase transition summon
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

                // Message
                messages.push(msg(nextPhase.messageZh, MessageCategory.Combat, '#ff4444'));

                // Boss skips this turn (1 turn preparation for player)
                enemies[enemyIdx] = { ...enemies[enemyIdx], _skipAttack: true };
              }
            }
          }
        }

        if (newHp <= 0) {
          const exp = getTalentModifiedExp(player, enemy.exp);
          const goldDrop = getTalentModifiedGoldDrop(player, enemy.goldDrop);
          player.exp += exp;
          player.killCount++;
          if (enemy.isBoss) player.bossKillCount++;
          player.gold += goldDrop;
          messages.push(msg(`${enemy.name}被击败了！获得 ${exp} 经验，${goldDrop} 金币`, MessageCategory.Combat, '#44cc44'));
          AudioManager.playSFX('coin');

          // Place monument at boss position
          if (enemy.isBoss) {
            const bossPos = enemy.pos;
            if (bossPos.y >= 0 && bossPos.y < state.map.length && bossPos.x >= 0 && bossPos.x < state.map[0].length) {
              const newMap = state.map.map(row => row.map(t => ({ ...t })));
              newMap[bossPos.y][bossPos.x] = { type: TileType.Monument, char: '☥', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true, visible: false, remembered: false };
              set({ map: newMap });
            }

            // Special victory message for AbyssHeart (floor 30)
            if (enemy.defId === 'abyssHeart') {
              addMessages([
                msg('═', MessageCategory.Story, '#ffffff'),
                msg('深渊之心停止了跳动...', MessageCategory.Story, '#ffffff'),
                msg('你理解了深渊的本质。', MessageCategory.Story, '#ffffff'),
                msg('但深渊也理解了你。', MessageCategory.Story, '#ffffff'),
                msg('你成为了新的回响。', MessageCategory.Story, '#ffffff'),
                msg('═', MessageCategory.Story, '#ffffff'),
              ]);
            }

            // Trigger boss blessing selection
            set({ bossBlessingPending: true, lastBossDefId: enemy.defId });
          }

          // Elite Explosive: Death blast dealing ATK×1.5 in 2-tile radius
          if (enemy.isElite && enemy.eliteAffix === EliteAffix.Explosive) {
            const blastDmg = Math.floor(enemy.attack * 1.5);
            const blastRadius = 2;
            // Damage player if in range
            const distToPlayer = Math.abs(enemy.pos.x - player.pos.x) + Math.abs(enemy.pos.y - player.pos.y);
            if (distToPlayer <= blastRadius) {
              player.hp = Math.max(0, player.hp - blastDmg);
              messages.push(msg(`${enemy.name}爆裂！你受到${blastDmg}点伤害！`, MessageCategory.Combat, '#ff4444'));
              flashScreen('#ff000033');
            }
            // Damage other enemies in range
            const enemies = state.enemies.map(e => ({ ...e }));
            for (const other of enemies) {
              if (other.id !== enemy.id && other.hp > 0) {
                const dist = Math.abs(enemy.pos.x - other.pos.x) + Math.abs(enemy.pos.y - other.pos.y);
                if (dist <= blastRadius) {
                  const otherIdx = enemies.findIndex(e => e.id === other.id);
                  if (otherIdx >= 0) {
                    enemies[otherIdx] = { ...other, hp: Math.max(0, other.hp - blastDmg) };
                  }
                }
              }
            }
            set({ player, enemies });
            if (player.hp <= 0) {
              handlePlayerDeath(player, enemies, messages, `被${enemy.name}爆裂`);
              return;
            }
          }

          // 装备特效：击杀重置 — 击杀后重置所有技能CD
          if (hasEquipmentEffect(player, EquipmentEffect.KillReset)) {
            player.skillCooldowns = [0, 0, 0];
            messages.push(msg('击杀重置！技能冷却已恢复', MessageCategory.Combat, '#ffcc44'));
          }

          // Split behavior: 死亡时分裂为2个50%属性的小体
          if (enemy.behavior === EnemyBehavior.Split) {
            const def = ENEMY_DEFS.find(d => d.id === enemy.defId);
            if (def) {
              const splitCount = 2;
              for (let s = 0; s < splitCount; s++) {
                const offset = { x: rng.nextInt(-1, 1), y: rng.nextInt(-1, 1) };
                const spawnPos = { x: enemy.pos.x + offset.x, y: enemy.pos.y + offset.y };
                if (spawnPos.x >= 0 && spawnPos.x < state.width && spawnPos.y >= 0 && spawnPos.y < state.height && state.map[spawnPos.y][spawnPos.x].walkable) {
                  const occupied = state.enemies.some(e => e.hp > 0 && e.pos.x === spawnPos.x && e.pos.y === spawnPos.y);
                  if (!occupied) {
                    const mini: Enemy = {
                      id: genId(),
                      defId: enemy.defId + '_mini',
                      name: `${enemy.name}幼体`,
                      char: enemy.char,
                      fg: enemy.fg,
                      bg: 'transparent',
                      pos: spawnPos,
                      hp: Math.floor(enemy.maxHp * 0.5),
                      maxHp: Math.floor(enemy.maxHp * 0.5),
                      attack: Math.floor(enemy.attack * 0.5),
                      defense: Math.floor(enemy.defense * 0.5),
                      exp: Math.floor(enemy.exp * 0.3),
                      behavior: EnemyBehavior.Aggressive, // 幼体不再分裂
                      element: enemy.element,
                      weakness: enemy.weakness,
                      resistance: enemy.resistance,
                      speed: enemy.speed,
                      statusEffects: [],
                      dropChance: Math.max(0.1, enemy.dropChance * 0.5),
                      specialAbility: enemy.specialAbility,
                      alertRadius: enemy.alertRadius,
                      isBoss: false,
                      goldDrop: Math.floor(enemy.goldDrop * 0.3),
                      bossPhase: 1,
                      isElite: false,
                    };
                    enemies.push(mini);
                  }
                }
              }
              messages.push(msg(`${enemy.name}分裂了！`, MessageCategory.Combat, '#ff44ff'));
            }
          }

          // Switch music back to biome BGM after boss death
          if (enemy.isBoss) {
            const biome = getBiomeForFloor(state.currentFloor);
            AudioManager.updateContext('playing', state.currentFloor, false, biome);
          }

          // Mirror Image explosion on death
          if (enemy.specialAbility === 'mirrorExplode') {
            const dist = Math.abs(enemy.pos.x - player.pos.x) + Math.abs(enemy.pos.y - player.pos.y);
            if (dist <= 3) {
              player.hp -= 15;
              messages.push(msg('镜像体爆炸！受到15点伤害！', MessageCategory.Combat, '#ff44ff'));
            }
          }

          // Drop item
          const dropChance = getTalentModifiedDropChance(player, enemy.dropChance);
          if (rng.chance(dropChance)) {
            const luckBonus = hasTalent(player, 'lucky') ? 0.05 : 0;
            const droppedItem = createRandomItem(state.currentFloor, rng, true, luckBonus, BIOME_CONFIG[getBiomeForFloor(state.currentFloor)].foodDropMultiplier);
            const floorItem: FloorItem = { item: droppedItem, pos: { ...enemy.pos } };
            set({ items: [...state.items, floorItem] });
            messages.push(msg(`${enemy.name}掉落了${getItemName(droppedItem)}！`, MessageCategory.Item, '#4488ff'));

            // Achievement: legendary find
            if (droppedItem.rarity === Rarity.Legendary) {
              const newAch = [...new Set([...state.achievements, 'legendary'])];
              saveAchievements(newAch);
              set({ achievements: newAch });
              messages.push(msg('🏆 成就解锁：传说发现！', MessageCategory.System, '#ffcc44'));
            }
          }
        }

        set({ player, enemies });
        addMessages(messages);
        processTurn();
        return;
      }

      const tile = state.map[ny][nx];

      // SecretWall: player passes through
      if (tile.type === TileType.SecretWall) {
        player.pos = { x: nx, y: ny };
        addMessages([msg('你穿过了一道暗墙！', MessageCategory.System, '#aa88aa')]);
        set({ player });
        processTurn();
        return;
      }

      if (!tile.walkable) {
        if (tile.type === TileType.Door) {
          // Door interaction (existing)
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = {
            ...newMap[ny][nx],
            type: TileType.DoorOpen,
            char: '░',
            fg: '#887744',
            walkable: true,
            transparent: true,
          };
          set({ map: newMap });
          addMessages([msg('你打开了门', MessageCategory.Environment, '#aa8844')]);
          AudioManager.playSFX('door');
          return;
        }
        // Barricade (木栏): Attack to destroy
        if (tile.type === TileType.Barricade) {
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
          set({ map: newMap });
          addMessages([msg('你破坏了木栏！', MessageCategory.System, '#aa8844')]);
          return;
        }
        // EliteDoor (精英门): Open on interaction
        if (tile.type === TileType.EliteDoor) {
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.DoorOpen, char: '/', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true };
          set({ map: newMap });
          addMessages([msg('你推开了铁门。前方传来强大的气息…', MessageCategory.System, '#ffd700')]);
          return;
        }
        // VoidPillar (虚空柱): Attack to destroy, reduces boss ATK by 3
        if (tile.type === TileType.VoidPillar) {
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
          set({ map: newMap });
          addMessages([msg('你击碎了虚空柱！', MessageCategory.System, '#aa88ff')]);
          // Boss ATK-3
          const boss = state.enemies.find(e => e.isBoss && e.hp > 0);
          if (boss && (boss.defId === 'abyssKing' || boss.defId === 'abyssHeart')) {
            const enemies = state.enemies.map(e => {
              if (e.id === boss.id) {
                return { ...e, attack: Math.max(1, boss.attack - 3) };
              }
              return e;
            });
            set({ enemies });
            addMessages([msg(`${boss.name}的力量减弱了！`, MessageCategory.System, '#ff4444')]);
          }
          return;
        }
        // LavaPool: Can't walk into it (like Lava)
        // Already handled by walkable:false — no special interaction needed

        if (tile.type === TileType.Sarcophagus) {
          // 50% good, 50% bad
          if (rng.chance(0.5)) {
            const item = createRandomItem(state.currentFloor, rng, false);
            const floorItem: FloorItem = { item, pos: { x: nx, y: ny } };
            set({ items: [...state.items, floorItem] });
            addMessages([msg('石棺中藏着宝物！', MessageCategory.Item, '#44cc44')]);
            AudioManager.playSFX('coin');
          } else {
            const trapDmg = rng.nextInt(5, 16);
            player.hp -= trapDmg;
            addMessages([msg(`石棺陷阱！受到${trapDmg}点伤害！`, MessageCategory.Combat, '#ff4444')]);
            flashScreen('#ff000033');
            AudioManager.playSFX('trap');
          }
          // Replace sarcophagus with floor
          const biome = getBiomeForFloor(state.currentFloor);
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = createTile(TileType.Floor, biome);
          set({ map: newMap, player });
          processTurn();
          return;
        }
        return;
      }

      player.pos = { x: nx, y: ny };
      set({ player });

      // ShallowWater: movement costs extra turn
      if (tile.type === TileType.ShallowWater) {
        set({ extraTurnCost: 1 });
        addMessages([msg('浅水区减缓了你的速度...', MessageCategory.Environment, '#5599dd')]);
      }

      // CooledLava damage check (Lava Core biome)
      if (tile.type === TileType.CooledLava) {
        const hasFireResist = player.statusEffects.some(e => e.type === StatusEffectType.FireResist);
        const lavaDmg = hasFireResist ? 1 : 5;
        player.hp -= lavaDmg;
        addMessages([msg(hasFireResist ? `灼热的熔岩灼伤了你！(-${lavaDmg}HP) 火焰抗性抵消了大部分伤害！` : `灼热的熔岩灼伤了你！(-${lavaDmg}HP)`, MessageCategory.Environment, '#ff6622')]);
        flashScreen('#ff662233');
        AudioManager.playSFX('hit');
      }

      // Portal teleportation (Void Abyss biome)
      if (tile.type === TileType.Portal) {
        const rng = new SeededRandom(state.seed + state.turn * 19);
        // Find all other portal positions
        const otherPortals: Position[] = [];
        for (let y = 0; y < state.map.length; y++) {
          for (let x = 0; x < state.map[y].length; x++) {
            if (state.map[y][x].type === TileType.Portal && (x !== nx || y !== ny)) {
              otherPortals.push({ x, y });
            }
          }
        }
        if (otherPortals.length > 0) {
          const dest = otherPortals[rng.nextInt(0, otherPortals.length - 1)];
          player.pos = { x: dest.x, y: dest.y };
          set({ player });
          addMessages([msg('传送门将你送到了另一个碎片！', MessageCategory.Environment, '#cc44ff')]);
          processTurn();
          return;
        } else {
          addMessages([msg('传送门闪烁着微光，但无法连接...', MessageCategory.Environment, '#8844aa')]);
        }
      }

      // Check for trap
      if (tile.type === TileType.TrapSpike || tile.type === TileType.TrapFire ||
          tile.type === TileType.TrapTeleport || tile.type === TileType.TrapPoison) {
        const typeMap: Record<string, string> = {
          [TileType.TrapSpike]: 'spike',
          [TileType.TrapFire]: 'fire',
          [TileType.TrapTeleport]: 'teleport',
          [TileType.TrapPoison]: 'poison',
        };
        const trapEffect = getTrapEffect(typeMap[tile.type] || 'spike');
        const hasFireResist = tile.type === TileType.TrapFire && player.statusEffects.some(e => e.type === StatusEffectType.FireResist);
        const trapDmg = hasFireResist ? Math.floor(trapEffect.damage / 3) : trapEffect.damage;
        player.hp -= trapDmg;
        if (trapEffect.statusEffect) {
          player.statusEffects = [...player.statusEffects, trapEffect.statusEffect];
        }
        addMessages([msg(trapEffect.message, MessageCategory.Environment, '#ff4444')]);
        flashScreen('#ff000033');
        AudioManager.playSFX('trap');

        // BUG FIX: Teleport trap finds valid walkable position
        if (tile.type === TileType.TrapTeleport) {
          const rng2 = new SeededRandom(state.seed + state.turn * 3);
          let attempts = 0;
          let tx, ty;
          do {
            tx = rng2.nextInt(1, state.width - 2);
            ty = rng2.nextInt(1, state.height - 2);
            attempts++;
          } while ((!state.map[ty]?.[tx]?.walkable) && attempts < 200);
          if (attempts < 200) {
            player.pos = { x: tx, y: ty };
          }
        }

        set({ player });
      }

      // Poison gas tile
      if (tile.type === TileType.PoisonGas) {
        if (rng.chance(0.3)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 3, damage: 2 }];
          addMessages([msg('毒气侵入你的身体！', MessageCategory.Environment, '#44cc44')]);
        }
      }

      // Cursed ground: curse a random equipped item
      if (tile.type === TileType.CursedGround) {
        const slots = Object.keys(player.equipment) as EquipmentSlot[];
        const equipped = slots.filter(s => player.equipment[s] !== null);
        if (equipped.length > 0 && rng.chance(0.3)) {
          const slot = equipped[rng.nextInt(0, equipped.length - 1)];
          const item = player.equipment[slot]!;
          if (!item.cursed) {
            player.equipment = { ...player.equipment, [slot]: { ...item, cursed: true } };
            addMessages([msg(`${item.name}被诅咒了！`, MessageCategory.Environment, '#aa44ff')]);
          }
        }
      }

      // WebFloor: Slow movement
      if (tile.type === TileType.WebFloor) {
        set({ extraTurnCost: 1 });
        addMessages([msg('蛛网缠住了你的脚！移动速度降低。', MessageCategory.Environment, '#aaaaaa')]);
      }

      // SpiderEgg: Hatch into baby spider
      if (tile.type === TileType.SpiderEgg) {
        const hatchPos = { x: nx, y: ny };
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '.', fg: '#555555', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap });
        const babySpider = createEnemy('spider', hatchPos, false, state.currentFloor);
        if (babySpider) {
          babySpider.name = '幼蛛';
          babySpider.hp = Math.max(1, Math.floor(babySpider.maxHp * 0.4));
          babySpider.maxHp = babySpider.hp;
          babySpider.attack = Math.max(1, Math.floor(babySpider.attack * 0.5));
          babySpider.char = 's';
          const enemies = [...state.enemies, babySpider];
          set({ enemies });
          addMessages([msg('蛛卵破裂！一只幼蛛爬了出来！', MessageCategory.Combat, '#aaaaaa')]);
        }
      }

      // Altar: +3 DEF for 3 turns
      if (tile.type === TileType.Altar) {
        player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 3, damage: 3 }];
        set({ player });
        addMessages([msg('祭坛的力量涌遍全身！防御+3持续3回合！', MessageCategory.System, '#88ccff')]);
      }

      // Fountain: Heal 50% HP + 20 MP (one-time use)
      if (tile.type === TileType.Fountain) {
        const hpHeal = Math.floor(player.maxHp * 0.5);
        player.hp = Math.min(player.maxHp, player.hp + hpHeal);
        player.mp = Math.min(player.maxMp, player.mp + 20);
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '·', fg: '#335577', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap, player });
        addMessages([msg('治愈泉的泉水恢复了你的力量！', MessageCategory.Item, '#44aaff')]);
      }

      // Inscription: Read lore + permanent buff
      if (tile.type === TileType.Inscription) {
        const biome = getBiomeForFloor(state.currentFloor);
        const biomeKey = biome; // Biome enum values are already strings
        const text = INSCRIPTION_TEXTS[biomeKey];
        if (text) {
          addMessages([msg(`碑文：${text}`, MessageCategory.Story, '#aaaaaa')]);
        }
        player.inscriptionCount++;
        player.bonusStats = {
          ...player.bonusStats,
          str: player.bonusStats.str + 1,
          dex: player.bonusStats.dex + 1,
          int: player.bonusStats.int + 1,
          vit: player.bonusStats.vit + 1,
        };
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '·', fg: '#aaaaaa', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap, player });
        addMessages([msg('碑文的力量融入了你的身体！全属性+1！', MessageCategory.System, '#ffcc44')]);
      }

      // HealCrystal: Heal 30% HP (one-time use)
      if (tile.type === TileType.HealCrystal) {
        const hpHeal = Math.floor(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + hpHeal);
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '·', fg: '#005533', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap, player });
        addMessages([msg(`治愈水晶碎裂，回复了${hpHeal}点HP！`, MessageCategory.Item, '#44cc44')]);
      }

      // CorruptionPool: Already handled by periodic effect
      // VoidRift: Already handled by periodic effect

      // Monument: Show boss memorial
      if (tile.type === TileType.Monument) {
        addMessages([msg('纪念碑上刻着已逝Boss的名字。', MessageCategory.Story, '#ffd700')]);
      }

      // Check for shop
      if (tile.type === TileType.Shop && state.shopItems.length > 0) {
        addMessages([msg('你发现了流浪商人！按P打开商店', MessageCategory.Item, '#ffcc44')]);
      }

      // Check for event
      if (tile.type === TileType.Event && state.currentEvent) {
        set({ phase: GamePhase.Event });
        return;
      }

      // Check for items
      const itemsHere = state.items.filter(fi => fi.pos.x === nx && fi.pos.y === ny);
      if (itemsHere.length > 0) {
        if (player.inventory.length < getMaxInventorySize(player)) {
          const names = itemsHere.map(fi => getItemName(fi.item)).join('、');
          addMessages([msg(`地上有 ${names}，按 , 拾取`, MessageCategory.Item, '#4488ff')]);
        } else {
          addMessages([msg('地上有物品，但背包已满！', MessageCategory.System, '#ff4444')]);
        }
      }

      // SecretWall proximity hint
      const adjDirs = [[0,-1],[0,1],[-1,0],[1,0]];
      const checkX = player.pos.x;
      const checkY = player.pos.y;
      for (const [dx, dy] of adjDirs) {
        const nx_adj = checkX + dx;
        const ny_adj = checkY + dy;
        if (ny_adj >= 0 && ny_adj < state.map.length && nx_adj >= 0 && nx_adj < state.map[0].length) {
          if (state.map[ny_adj][nx_adj].type === TileType.SecretWall && state.map[ny_adj][nx_adj].visible) {
            addMessages([msg('墙壁似乎有裂缝…', MessageCategory.System, '#aa88aa')]);
            break;
          }
        }
      }

      processTurn();
    },

    waitTurn: () => {
      const state = get();
      if (state.phase !== GamePhase.Playing) return;
      processTurn();
    },

    pickupItem: () => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Playing) return;

      let player = { ...state.player };
      const pos = player.pos;
      const items = [...state.items];
      const messages: Message[] = [];
      let picked = false;

      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].pos.x === pos.x && items[i].pos.y === pos.y) {
          if (player.inventory.length < getMaxInventorySize(player)) {
            const pickedItem = items[i].item;
            const itemName = getItemName(pickedItem);
            items.splice(i, 1);

            // Auto-equip: if equippable and the slot is empty (skip cursed items)
            const slot = canEquipItem(player, pickedItem);
            if (slot && !player.equipment[slot] && !pickedItem.cursed) {
              player.inventory = [...player.inventory, pickedItem];
              player = equipItem(player, pickedItem);
              messages.push(msg(`你拾取并装备了${itemName}`, MessageCategory.Item, '#4488ff'));
            } else {
              player.inventory = [...player.inventory, pickedItem];
              messages.push(msg(`你拾取了${itemName}，按I打开背包管理`, MessageCategory.Item, '#44cc44'));
            }
            AudioManager.playSFX('pickup');
            picked = true;
          } else {
            messages.push(msg('背包已满，无法拾取！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
      }

      if (!picked) {
        messages.push(msg('这里没有可拾取的物品', MessageCategory.System, '#888888'));
      }

      set({ player, items });
      addMessages(messages);
    },

    useItem: (index: number) => {
      const state = get();
      if (!state.player) return;
      if (state.phase !== GamePhase.Playing && state.phase !== GamePhase.Inventory) return;

      const player = { ...state.player };
      const item = player.inventory[index];
      if (!item) return;

      const messages: Message[] = [];

      switch (item.type) {
        case ItemType.Potion: {
          const potion = item as PotionItem;
          if (!potion.identified) {
            const identified = identifyItem(potion);
            player.inventory = player.inventory.map((inv, i) => i === index ? identified : inv);
            messages.push(msg(`这是${identified.name}！`, MessageCategory.Item, '#ffcc44'));
          }

          switch (potion.effect) {
            case PotionEffect.Healing:
              player.hp = Math.min(player.maxHp, player.hp + potion.power);
              messages.push(msg(`你恢复了 ${potion.power} 点生命`, MessageCategory.Item, '#44cc44'));
              AudioManager.playSFX('heal');
              break;
            case PotionEffect.ManaRestore:
              player.mp = Math.min(player.maxMp, player.mp + potion.power);
              messages.push(msg(`你恢复了 ${potion.power} 点魔力`, MessageCategory.Item, '#4488ff'));
              AudioManager.playSFX('heal');
              break;
            case PotionEffect.Strength:
              player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + potion.power };
              messages.push(msg(`力量永久提升 ${potion.power}！`, MessageCategory.Item, '#ff8844'));
              break;
            case PotionEffect.Dexterity:
              player.bonusStats = { ...player.bonusStats, dex: player.bonusStats.dex + potion.power };
              messages.push(msg(`灵巧永久提升 ${potion.power}！`, MessageCategory.Item, '#44cc44'));
              break;
            case PotionEffect.Intelligence:
              player.bonusStats = { ...player.bonusStats, int: player.bonusStats.int + potion.power };
              messages.push(msg(`智慧永久提升 ${potion.power}！`, MessageCategory.Item, '#4488ff'));
              break;
            case PotionEffect.Poison:
              player.hp -= potion.power;
              messages.push(msg(`糟糕！这瓶药水有毒！受到 ${potion.power} 点伤害`, MessageCategory.Item, '#ff4444'));
              break;
            case PotionEffect.Paralysis:
              player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: potion.power, damage: 0 }];
              messages.push(msg('你被麻痹了！', MessageCategory.Item, '#ff4444'));
              break;
            case PotionEffect.Confusion:
              // BUG FIX: Confusion now actually applies the status
              player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Confusion, duration: potion.power, damage: 0 }];
              messages.push(msg('你感到头晕目眩，方向感全无！', MessageCategory.Item, '#cccc44'));
              break;
            case PotionEffect.FullHeal:
              player.hp = player.maxHp;
              player.mp = player.maxMp;
              messages.push(msg('你感觉焕然一新！所有伤势痊愈！', MessageCategory.Item, '#ffcc44'));
              AudioManager.playSFX('heal');
              break;
            case PotionEffect.FireResist:
              player.statusEffects.push({ type: StatusEffectType.FireResist, duration: 5, damage: 0 });
              messages.push(msg('你获得了火焰抗性！(5回合)', MessageCategory.Item, '#ff6622'));
              break;
          }

          player.inventory = player.inventory.filter((_, i) => i !== index);
          break;
        }
        case ItemType.Scroll: {
          const scroll = item as ScrollItem;
          if (!scroll.identified) {
            const identified = identifyItem(scroll);
            player.inventory = player.inventory.map((inv, i) => i === index ? identified : inv);
            messages.push(msg(`这是${identified.name}！`, MessageCategory.Item, '#ffcc44'));
          }

          switch (scroll.effect) {
            case ScrollEffect.Identify: {
              const unidentified = player.inventory.filter(i => !i.identified);
              if (unidentified.length > 0) {
                if (unidentified.length === 1) {
                  const identified = identifyItem(unidentified[0]);
                  player.inventory = player.inventory.map(i => i.id === identified.id ? identified : i);
                  messages.push(msg(`你鉴定了${identified.name}！`, MessageCategory.Item, '#ffcc44'));
                } else {
                  messages.push(msg('请选择要鉴定的物品...', MessageCategory.Item, '#ffcc44'));
                  set({ pendingIdentify: true, phase: GamePhase.Inventory });
                }
              } else {
                messages.push(msg('没有需要鉴定的物品', MessageCategory.System, '#888888'));
              }
              break;
            }
            case ScrollEffect.Mapping: {
              const newMap = state.map.map(row => row.map(t => ({ ...t, remembered: true })));
              const remembered = new Map(state.rememberedMap);
              for (let y = 0; y < state.height; y++) {
                for (let x = 0; x < state.width; x++) {
                  const key = `${x},${y}`;
                  remembered.set(key, { char: newMap[y][x].char, fg: newMap[y][x].fg, bg: newMap[y][x].bg });
                }
              }
              set({ map: newMap, rememberedMap: remembered });
              messages.push(msg('地图卷轴揭示了这一层的全貌！', MessageCategory.Item, '#aacc88'));
              break;
            }
            case ScrollEffect.Teleport: {
              const rng2 = new SeededRandom(state.seed + state.turn * 3);
              let tx, ty;
              let attempts = 0;
              do {
                tx = rng2.nextInt(1, state.width - 2);
                ty = rng2.nextInt(1, state.height - 2);
                attempts++;
              } while (!state.map[ty]?.[tx]?.walkable && attempts < 200);
              if (attempts < 200) {
                player.pos = { x: tx, y: ty };
                messages.push(msg('你被传送到了另一个位置！', MessageCategory.Item, '#aa88cc'));
              }
              break;
            }
            case ScrollEffect.Fireball: {
              const power = hasTalent(player, 'arcaneResonance') ? Math.floor(scroll.power * 1.3) : scroll.power;
              const aliveBefore = new Set(state.enemies.filter(e => e.hp > 0).map(e => e.id));
              const enemies = state.enemies.map(e => {
                if (e.hp > 0 && distance(player.pos, e.pos) <= 3) {
                  return { ...e, hp: e.hp - power };
                }
                return e;
              });
              const killed = enemies.filter(e => e.hp <= 0 && aliveBefore.has(e.id));
              set({ enemies });
              messages.push(msg(`火球术造成了 ${power} 点范围伤害！击杀 ${killed.length} 个敌人`, MessageCategory.Combat, '#ff6644'));
              for (const e of killed) {
                player.exp += getTalentModifiedExp(player, e.exp);
                player.killCount++;
                if (e.isBoss) player.bossKillCount++;
                player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
              }
              break;
            }
            case ScrollEffect.IceStorm: {
              const power = hasTalent(player, 'arcaneResonance') ? Math.floor(scroll.power * 1.3) : scroll.power;
              const aliveBefore = new Set(state.enemies.filter(e => e.hp > 0).map(e => e.id));
              const enemies = state.enemies.map(e => {
                if (e.hp > 0 && distance(player.pos, e.pos) <= 3) {
                  const newE = { ...e, hp: e.hp - power };
                  newE.statusEffects = [...newE.statusEffects, { type: StatusEffectType.Freeze, duration: 2, damage: 0 }];
                  return newE;
                }
                return e;
              });
              const killed = enemies.filter(e => e.hp <= 0 && aliveBefore.has(e.id));
              set({ enemies });
              messages.push(msg(`冰风暴造成了 ${power} 点范围伤害并冻结了敌人！`, MessageCategory.Combat, '#44aaff'));
              for (const e of killed) {
                player.exp += getTalentModifiedExp(player, e.exp);
                player.killCount++;
                if (e.isBoss) player.bossKillCount++;
                player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
              }
              break;
            }
            case ScrollEffect.Lightning: {
              const power = hasTalent(player, 'arcaneResonance') ? Math.floor(scroll.power * 1.3) : scroll.power;
              const closest = state.enemies
                .filter(e => e.hp > 0)
                .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos))[0];
              if (closest) {
                const enemies = state.enemies.map(e =>
                  e.id === closest.id ? { ...e, hp: e.hp - power } : e
                );
                set({ enemies });
                messages.push(msg(`闪电击中了${closest.name}，造成 ${power} 点伤害！`, MessageCategory.Combat, '#cccc44'));
                if (closest.hp - power <= 0) {
                  player.exp += getTalentModifiedExp(player, closest.exp);
                  player.killCount++;
                  if (closest.isBoss) player.bossKillCount++;
                  player.gold += getTalentModifiedGoldDrop(player, closest.goldDrop);
                }
              }
              break;
            }
            case ScrollEffect.Enchant: {
              const weaponSlot = player.equipment[EquipmentSlot.Weapon];
              if (weaponSlot && weaponSlot.type === ItemType.Weapon) {
                const weapon = weaponSlot as WeaponItem;
                const enchanted = { ...weapon, damage: weapon.damage + 2, name: weapon.cursed ? weapon.name.replace('诅咒', '') : `附魔${weapon.name}`, cursed: false };
                player.equipment = { ...player.equipment, [EquipmentSlot.Weapon]: enchanted };
                messages.push(msg(`你的武器被附魔了！伤害+2`, MessageCategory.Item, '#ff88ff'));
              } else {
                messages.push(msg('没有装备武器可以附魔', MessageCategory.System, '#888888'));
              }
              break;
            }
            case ScrollEffect.RemoveCurse: {
              // BUG FIX: Actually remove curses from all items
              let cursedCount = 0;
              player.inventory = player.inventory.map(i => {
                if (i.cursed) {
                  cursedCount++;
                  const uncursed = { ...i, cursed: false, name: i.name.replace('诅咒', '') };
                  return uncursed;
                }
                return i;
              });
              // Also un-curse equipped items
              const newEquipment = { ...player.equipment };
              for (const slot of Object.values(EquipmentSlot)) {
                const eq = newEquipment[slot];
                if (eq && eq.cursed) {
                  newEquipment[slot] = { ...eq, cursed: false, name: eq.name.replace('诅咒', '') };
                  cursedCount++;
                }
              }
              player.equipment = newEquipment;
              if (cursedCount > 0) {
                messages.push(msg(`解除了 ${cursedCount} 件物品的诅咒！`, MessageCategory.Item, '#ffcc44'));
              } else {
                messages.push(msg('没有受到诅咒的物品', MessageCategory.System, '#888888'));
              }
              break;
            }
            case ScrollEffect.CreatePortal: {
              const px = player.pos.x, py = player.pos.y;
              if (state.map[py][px].type === TileType.StairsDown) {
                messages.push(msg('楼梯上的空间无法承载传送门！', MessageCategory.System, '#888888'));
                addMessages(messages);
                return; // 不消耗卷轴
              }
              const newMap = state.map.map(row => row.map(t => ({ ...t })));
              newMap[py][px] = createTile(TileType.Portal, getBiomeForFloor(state.currentFloor));
              set({ map: newMap });
              messages.push(msg('脚下出现了传送门！', MessageCategory.Item, '#cc44ff'));
              break;
            }
          }

          player.inventory = player.inventory.filter((_, i) => i !== index);
          break;
        }
        case ItemType.Food: {
          const food = item as FoodItem;
          player.hunger = Math.min(player.maxHunger, player.hunger + food.nutrition);
          messages.push(msg(`你吃了${food.name}，恢复了 ${food.nutrition} 饱食度`, MessageCategory.Item, '#ccaa66'));
          player.inventory = player.inventory.filter((_, i) => i !== index);
          break;
        }
        default:
          messages.push(msg('这个物品无法直接使用，试试装备它', MessageCategory.System, '#888888'));
          addMessages(messages);
          return;
      }

      set({ player });
      addMessages(messages);
      processTurn();
    },

    equipItem: (index: number, targetSlot?: EquipmentSlot) => {
      const state = get();
      if (!state.player) return;
      if (state.phase !== GamePhase.Playing && state.phase !== GamePhase.Inventory) return;

      const item = state.player.inventory[index];
      if (!item) return;

      const slot = targetSlot ?? canEquipItem(state.player, item);
      if (!slot) {
        addMessages([msg('这个物品无法装备', MessageCategory.System, '#888888')]);
        return;
      }

      const player = equipItem(state.player, item, slot);
      set({ player });
      addMessages([msg(`你装备了${getItemName(item)}`, MessageCategory.Item, '#4488ff')]);
    },

    dropItem: (index: number) => {
      const state = get();
      if (!state.player) return;
      if (state.phase !== GamePhase.Playing && state.phase !== GamePhase.Inventory) return;

      const player = { ...state.player };
      const item = player.inventory[index];
      if (!item) return;

      // BUG FIX: Can't drop cursed equipped items (handled by unequipItem)
      if (item.cursed && Object.values(player.equipment).some(e => e?.id === item.id)) {
        addMessages([msg('诅咒物品无法丢弃！', MessageCategory.System, '#ff4444')]);
        return;
      }

      const floorItem: FloorItem = { item, pos: { ...player.pos } };
      const items = [...state.items, floorItem];
      player.inventory = player.inventory.filter((_, i) => i !== index);

      set({ player, items });
      addMessages([msg(`你丢弃了${getItemName(item)}`, MessageCategory.Item, '#888888')]);
    },

    sellItem: (index: number) => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Shop) return;

      const player = { ...state.player };
      const item = player.inventory[index];
      if (!item) return;

      const sellPrice = item.cursed ? Math.max(1, Math.floor(item.value / 4)) : Math.floor(item.value / 2);
      player.gold += sellPrice;
      player.inventory = player.inventory.filter((_, i) => i !== index);

      set({ player });
      addMessages([msg(`出售了${getItemName(item)}，获得 ${sellPrice} 金币`, MessageCategory.Item, '#ffcc44')]);
      AudioManager.playSFX('coin');
    },

    descendStairs: () => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Playing) return;

      const playerPos = state.player.pos;
      const tile = state.map[playerPos.y]?.[playerPos.x];
      if (tile?.type !== TileType.StairsDown) {
        addMessages([msg('这里没有楼梯', MessageCategory.System, '#888888')]);
        return;
      }

      const nextFloor = state.currentFloor + 1;
      addMessages([msg(`你沿着楼梯向下深入...`, MessageCategory.Story, '#ffcc44')]);
      enterFloor(nextFloor);
    },

    openDoor: (dx: number, dy: number) => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Playing) return;

      const nx = state.player.pos.x + dx;
      const ny = state.player.pos.y + dy;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) return;

      if (state.map[ny][nx].type === TileType.Door) {
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = {
          ...newMap[ny][nx],
          type: TileType.DoorOpen,
          char: '░',
          fg: '#887744',
          walkable: true,
          transparent: true,
        };
        set({ map: newMap });
        addMessages([msg('你打开了门', MessageCategory.Environment, '#aa8844')]);
        AudioManager.playSFX('door');
      }
    },

    allocateStat: (stat: keyof Stats) => {
      const state = get();
      if (!state.player || state.player.statPoints <= 0) return;

      const player = { ...state.player };
      player.stats = { ...player.stats, [stat]: player.stats[stat] + 1 };
      player.statPoints--;
      const pendingAllocations = { ...state.pendingAllocations, [stat]: (state.pendingAllocations[stat] || 0) + 1 };

      const classDef = CLASS_DEFS[player.class];
      player.maxHp = classDef.baseHp + player.stats.vit * 3 + (player.level - 1) * classDef.hpPerLevel;
      player.maxMp = classDef.baseMp + player.stats.int * 2 + (player.level - 1) * classDef.mpPerLevel;

      set({ player, pendingAllocations });
      addMessages([msg(`${stat.toUpperCase()} +1`, MessageCategory.System, '#ffcc44')]);
    },

    deallocateStat: (stat: keyof Stats) => {
      const state = get();
      if (!state.player || !state.pendingAllocations[stat] || (state.pendingAllocations[stat] || 0) <= 0) return;

      const player = { ...state.player };
      player.stats = { ...player.stats, [stat]: player.stats[stat] - 1 };
      player.statPoints++;
      const pendingAllocations = { ...state.pendingAllocations, [stat]: (state.pendingAllocations[stat] || 0) - 1 };

      const classDef = CLASS_DEFS[player.class];
      player.maxHp = classDef.baseHp + player.stats.vit * 3 + (player.level - 1) * classDef.hpPerLevel;
      player.maxMp = classDef.baseMp + player.stats.int * 2 + (player.level - 1) * classDef.mpPerLevel;

      set({ player, pendingAllocations });
    },

    resetAllocations: () => {
      const state = get();
      if (!state.player) return;

      const player = { ...state.player };
      const pa = state.pendingAllocations;
      // Reverse all pending allocations
      if (pa.str) { player.stats = { ...player.stats, str: player.stats.str - pa.str }; player.statPoints += pa.str; }
      if (pa.dex) { player.stats = { ...player.stats, dex: player.stats.dex - pa.dex }; player.statPoints += pa.dex; }
      if (pa.int) { player.stats = { ...player.stats, int: player.stats.int - pa.int }; player.statPoints += pa.int; }
      if (pa.vit) { player.stats = { ...player.stats, vit: player.stats.vit - pa.vit }; player.statPoints += pa.vit; }

      const classDef = CLASS_DEFS[player.class];
      player.maxHp = classDef.baseHp + player.stats.vit * 3 + (player.level - 1) * classDef.hpPerLevel;
      player.maxMp = classDef.baseMp + player.stats.int * 2 + (player.level - 1) * classDef.mpPerLevel;

      set({ player, pendingAllocations: { str: 0, dex: 0, int: 0, vit: 0 } });
    },

    toggleInventory: () => {
      const state = get();
      if (state.phase === GamePhase.Playing || state.phase === GamePhase.Inventory) {
        set({ phase: state.phase === GamePhase.Playing ? GamePhase.Inventory : GamePhase.Playing, pendingIdentify: false, pendingSacrifice: false });
      }
    },

    confirmIdentify: (index: number) => {
      const state = get();
      if (!state.player || !state.pendingIdentify) return;

      const player = { ...state.player };
      const item = player.inventory[index];
      if (!item || item.identified) {
        addMessages([msg('请选择未鉴定的物品', MessageCategory.System, '#888888')]);
        return;
      }

      const identified = identifyItem(item);
      player.inventory = player.inventory.map(i => i.id === identified.id ? identified : i);
      addMessages([msg(`你鉴定了${identified.name}！`, MessageCategory.Item, '#ffcc44')]);
      set({ player, pendingIdentify: false, phase: GamePhase.Playing });
    },

    confirmSacrifice: (index: number) => {
      const state = get();
      if (!state.player || !state.pendingSacrifice) return;

      const player = { ...state.player };
      const item = player.inventory[index];
      if (!item || (item.type !== ItemType.Potion && item.type !== ItemType.Food)) {
        addMessages([msg('请选择消耗品进行献祭', MessageCategory.System, '#888888')]);
        return;
      }

      player.inventory = player.inventory.filter(i => i.id !== item.id);
      player.bonusStats = { ...player.bonusStats, vit: player.bonusStats.vit + 1 };
      addMessages([msg(`献祭了${getItemName(item)}！活力永久+1！`, MessageCategory.Item, '#ffcc44')]);
      set({ player, pendingSacrifice: false, phase: GamePhase.Playing });
    },

    confirmLevelUp: () => {
      const state = get();
      if (!state.player) return;
      if (state.player.statPoints > 0) {
        addMessages([msg(`还有 ${state.player.statPoints} 点属性点未分配！`, MessageCategory.System, '#ffcc44')]);
        return;
      }
      set({ phase: GamePhase.Playing, pendingAllocations: { str: 0, dex: 0, int: 0, vit: 0 } });
    },

    selectTalent: (talentId: string) => {
      const state = get();
      if (!state.player) return;

      const player = { ...state.player };
      if (player.talents.includes(talentId)) return;

      player.talents = [...player.talents, talentId];

      // Apply immediate effects
      if (talentId === 'nightVision') {
        player.visionRadius += 2;
      }

      set({ player, phase: GamePhase.LevelUp });
      const talent = TALENT_DEFS.find(t => t.id === talentId);
      addMessages([msg(`获得天赋：${talent?.nameZh ?? talentId}！`, MessageCategory.System, '#ffcc44')]);
    },

    useSkill: (skillIndex: number) => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Playing) return;
      if (state.player.skillCooldowns[skillIndex] > 0) {
        addMessages([msg('技能冷却中！', MessageCategory.System, '#888888')]);
        return;
      }

      const player = { ...state.player };
      const skills = SKILL_DEFS[player.class];
      const skill = skills[skillIndex];
      if (!skill) return;

      if (player.mp < skill.mpCost) {
        addMessages([msg('魔力不足！', MessageCategory.System, '#4488ff')]);
        return;
      }

      player.mp -= skill.mpCost;
      player.skillCooldowns = [...player.skillCooldowns];
      // 装备特效：冷却缩减 — CD-1（最低1）
      const cdReduce = hasEquipmentEffect(player, EquipmentEffect.CooldownReduce) ? 1 : 0;
      player.skillCooldowns[skillIndex] = Math.max(1, skill.maxCooldown - cdReduce);

      const rng = new SeededRandom(state.seed + state.turn * 17 + skillIndex);
      const messages: Message[] = [];
      let enemies = state.enemies.map(e => ({ ...e }));

      // Skill crit: 5% + DEX/300, DeadlyStrike raises multiplier from 1.5x to 2.0x
      const skillCritChance = 0.05 + getEffectiveStats(player).dex / 300;
      const skillCritMult = getTalentModifiedCritMultiplier(player);

      AudioManager.playSFX('skill');
      flashScreen('#4488ff33');

      switch (skill.id) {
        case 'shieldBash': {
          // Stun adjacent enemy for 2 turns
          const adjacent = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= 1.5);
          if (adjacent.length > 0) {
            const target = adjacent[0];
            target.statusEffects = [...target.statusEffects, { type: StatusEffectType.Freeze, duration: 2, damage: 0 }];
            let bashDmg = Math.floor(getEffectiveStats(player).str * 0.5);
            const critted = rng.chance(skillCritChance);
            if (critted) bashDmg = Math.floor(bashDmg * skillCritMult);
            target.hp -= bashDmg;
            enemies = enemies.map(e => e.id === target.id ? target : e);
            messages.push(msg(critted ? `暴击！盾击！${target.name}被击退并眩晕！造成 ${bashDmg} 点伤害` : `盾击！${target.name}被击退并眩晕！造成 ${bashDmg} 点伤害`, MessageCategory.Combat, critted ? '#ffcc44' : '#ff8844'));
          } else {
            messages.push(msg('附近没有敌人！', MessageCategory.System, '#888888'));
            player.mp += skill.mpCost; // Refund
            player.skillCooldowns[skillIndex] = 0;
          }
          break;
        }
        case 'warCry': {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 5, damage: 0 }];
          messages.push(msg('战吼！防御提升5点，持续5回合！', MessageCategory.Combat, '#ff6644'));
          break;
        }
        case 'whirlwind': {
          const weaponDmg = getPlayerWeaponDamage(player);
          let whirlDmg = Math.floor(weaponDmg * 1.5 + getEffectiveStats(player).str * 0.5);
          const whirlCrit = rng.chance(skillCritChance);
          if (whirlCrit) whirlDmg = Math.floor(whirlDmg * skillCritMult);
          let hitCount = 0;
          const whirlHitIds = new Set<string>();
          enemies = enemies.map(e => {
            if (e.hp > 0 && distance(player.pos, e.pos) <= 1.5) {
              hitCount++;
              whirlHitIds.add(e.id);
              return { ...e, hp: e.hp - whirlDmg };
            }
            return e;
          });
          messages.push(msg(whirlCrit ? `暴击！旋风斩！对 ${hitCount} 个敌人造成 ${whirlDmg} 点伤害！` : `旋风斩！对 ${hitCount} 个敌人造成 ${whirlDmg} 点伤害！`, MessageCategory.Combat, whirlCrit ? '#ffcc44' : '#ff4444'));
          for (const e of enemies.filter(e2 => e2.hp <= 0 && whirlHitIds.has(e2.id))) {
            player.exp += getTalentModifiedExp(player, e.exp);
            player.killCount++;
            if (e.isBoss) player.bossKillCount++;
            player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
          }
          break;
        }
        case 'fireball': {
          const target = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range)
            .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos))[0];
          if (target) {
            let dmg = skill.power + Math.floor(getEffectiveStats(player).int * 0.5);
            const fbCrit = rng.chance(skillCritChance);
            if (fbCrit) dmg = Math.floor(dmg * skillCritMult);
            const fbHitIds = new Set<string>();
            enemies = enemies.map(e => {
              if (e.hp > 0 && distance(target.pos, e.pos) <= skill.radius) {
                fbHitIds.add(e.id);
                return { ...e, hp: e.hp - dmg };
              }
              return e;
            });
            messages.push(msg(fbCrit ? `暴击！火球术！造成 ${dmg} 点火焰伤害！` : `火球术！造成 ${dmg} 点火焰伤害！`, MessageCategory.Combat, fbCrit ? '#ffcc44' : '#ff6644'));
            for (const e of enemies.filter(e2 => e2.hp <= 0 && fbHitIds.has(e2.id))) {
              player.exp += getTalentModifiedExp(player, e.exp); player.killCount++; if (e.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
            }
          } else {
            messages.push(msg('范围内没有敌人！', MessageCategory.System, '#888888'));
            player.mp += skill.mpCost; player.skillCooldowns[skillIndex] = 0;
          }
          break;
        }
        case 'iceShield': {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 5, damage: 0 }];
          // Remove any freeze effects on player
          player.statusEffects = player.statusEffects.filter(e => e.type !== StatusEffectType.Freeze);
          messages.push(msg('冰盾！防御+5，免疫冰冻，持续5回合！', MessageCategory.Combat, '#44aaff'));
          break;
        }
        case 'chainLightning': {
          const targets = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range)
            .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos))
            .slice(0, 3);
          if (targets.length > 0) {
            let dmg = skill.power + Math.floor(getEffectiveStats(player).int * 0.3);
            const clCrit = rng.chance(skillCritChance);
            if (clCrit) dmg = Math.floor(dmg * skillCritMult);
            const hitIds = new Set(targets.map(t => t.id));
            enemies = enemies.map(e => hitIds.has(e.id) ? { ...e, hp: e.hp - dmg } : e);
            messages.push(msg(clCrit ? `暴击！闪电链！击中 ${targets.length} 个敌人，各造成 ${dmg} 点伤害！` : `闪电链！击中 ${targets.length} 个敌人，各造成 ${dmg} 点伤害！`, MessageCategory.Combat, clCrit ? '#ffcc44' : '#cccc44'));
            for (const e of enemies.filter(e2 => e2.hp <= 0 && hitIds.has(e2.id))) {
              player.exp += getTalentModifiedExp(player, e.exp); player.killCount++; if (e.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
            }
          } else {
            messages.push(msg('范围内没有敌人！', MessageCategory.System, '#888888'));
            player.mp += skill.mpCost; player.skillCooldowns[skillIndex] = 0;
          }
          break;
        }
        case 'shadowStep': {
          const target = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range)
            .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos))[0];
          if (target) {
            // Teleport next to target
            const dirs = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
            let teleportPos: { x: number; y: number } | null = null;
            for (const d of dirs) {
              const nx = target.pos.x + d.x;
              const ny = target.pos.y + d.y;
              if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && state.map[ny][nx].walkable) {
                teleportPos = { x: nx, y: ny };
                break;
              }
            }
            if (teleportPos) {
              player.pos = teleportPos;
              const weaponDmg = getPlayerWeaponDamage(player);
              const critDmg = Math.floor((weaponDmg * skill.power + getEffectiveStats(player).str) * skillCritMult / 1.5);
              enemies = enemies.map(e => e.id === target.id ? { ...e, hp: e.hp - critDmg } : e);
              messages.push(msg(`暗影步！瞬移到${target.name}身边，暴击造成 ${critDmg} 点伤害！`, MessageCategory.Combat, '#8844ff'));
              if (target.hp - critDmg <= 0) {
                player.exp += getTalentModifiedExp(player, target.exp); player.killCount++; if (target.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, target.goldDrop);
              }
            } else {
              messages.push(msg('无法瞬移到目标身边！', MessageCategory.System, '#888888'));
              player.mp += skill.mpCost; player.skillCooldowns[skillIndex] = 0;
            }
          } else {
            messages.push(msg('范围内没有敌人！', MessageCategory.System, '#888888'));
            player.mp += skill.mpCost; player.skillCooldowns[skillIndex] = 0;
          }
          break;
        }
        case 'poisonBlade': {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.PoisonBlade, duration: 10, damage: 0 }];
          messages.push(msg('毒刃！下一次攻击将附加剧毒！', MessageCategory.Combat, '#44cc44'));
          break;
        }
        case 'fanOfKnives': {
          let dmg = skill.power + Math.floor(getEffectiveStats(player).dex * 0.5);
          const fokCrit = rng.chance(skillCritChance);
          if (fokCrit) dmg = Math.floor(dmg * skillCritMult);
          let hitCount = 0;
          const fokHitIds = new Set<string>();
          enemies = enemies.map(e => {
            if (e.hp > 0 && distance(player.pos, e.pos) <= skill.radius) {
              hitCount++;
              fokHitIds.add(e.id);
              return { ...e, hp: e.hp - dmg };
            }
            return e;
          });
          messages.push(msg(fokCrit ? `暴击！扇刃！对 ${hitCount} 个敌人造成 ${dmg} 点伤害！` : `扇刃！对 ${hitCount} 个敌人造成 ${dmg} 点伤害！`, MessageCategory.Combat, fokCrit ? '#ffcc44' : '#aaaaaa'));
          for (const e of enemies.filter(e2 => e2.hp <= 0 && fokHitIds.has(e2.id))) {
            player.exp += getTalentModifiedExp(player, e.exp); player.killCount++; if (e.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
          }
          break;
        }
      }

      const newSkillUseCount = get().skillUseCount + 1;
      set({ player, enemies, skillUseCount: newSkillUseCount });

      // Achievement: skill master
      if (newSkillUseCount >= 50) {
        const newAch = [...new Set([...state.achievements, 'skillMaster'])];
        saveAchievements(newAch);
        set({ achievements: newAch });
      }

      addMessages(messages);
      processTurn();
    },

    buyShopItem: (index: number) => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Shop) return;

      const item = state.shopItems[index];
      if (!item) return;

      const player = { ...state.player };
      if (player.gold < item.value) {
        addMessages([msg('金币不足！', MessageCategory.System, '#ff4444')]);
        return;
      }

      if (player.inventory.length >= getMaxInventorySize(player)) {
        addMessages([msg('背包已满！', MessageCategory.System, '#ff4444')]);
        return;
      }

      player.gold -= item.value;
      player.inventory = [...player.inventory, item];
      const shopItems = state.shopItems.filter((_, i) => i !== index);
      const newBuyCount = get().shopBuyCount + 1;

      set({ player, shopItems, shopBuyCount: newBuyCount });
      addMessages([msg(`购买了${getItemName(item)}，花费 ${item.value} 金币`, MessageCategory.Item, '#44cc44')]);
      AudioManager.playSFX('coin');

      // Achievement: shopper
      if (newBuyCount >= 5) {
        const newAch = [...new Set([...state.achievements, 'shopper'])];
        saveAchievements(newAch);
        set({ achievements: newAch });
        addMessages([msg('🏆 成就解锁：精明买家！', MessageCategory.System, '#ffcc44')]);
      }
    },

    closeShop: () => {
      get().setPhase(GamePhase.Playing);
    },

    chooseEventChoice: (choiceIndex: number) => {
      const state = get();
      if (!state.player || !state.currentEvent) return;

      const choice = state.currentEvent.choices[choiceIndex];
      if (!choice) return;

      const player = { ...state.player };
      const messages: Message[] = [];
      const rng = new SeededRandom(state.seed + state.turn * 23);

      switch (choice.effectId) {
        // Wishing Well
        case 'wish_gold':
          if (player.gold >= 10) {
            player.gold -= 10;
            const effect = rng.nextInt(0, 2);
            if (effect === 0) {
              player.hp = Math.min(player.maxHp, player.hp + 30);
              messages.push(msg('许愿池闪耀！你恢复了30点生命！', MessageCategory.Item, '#44cc44'));
            } else if (effect === 1) {
              player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + 1 };
              messages.push(msg('许愿池闪耀！力量永久+1！', MessageCategory.Item, '#ff8844'));
            } else {
              player.mp = Math.min(player.maxMp, player.mp + 20);
              messages.push(msg('许愿池闪耀！魔力恢复了！', MessageCategory.Item, '#4488ff'));
            }
          } else {
            messages.push(msg('金币不足！池水黯淡无光...', MessageCategory.System, '#888888'));
          }
          break;
        case 'wish_touch':
          if (rng.chance(0.5)) {
            player.hunger = Math.min(player.maxHunger, player.hunger + 50);
            messages.push(msg('水面温暖！饱食度+50！', MessageCategory.Item, '#44cc44'));
          } else {
            player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 3, damage: 2 }];
            messages.push(msg('水面冰冷！你中毒了！', MessageCategory.Combat, '#ff4444'));
          }
          break;
        case 'wish_ignore':
          messages.push(msg('你无视了许愿池继续前进', MessageCategory.System, '#888888'));
          break;

        // Ancient Altar
        case 'altar_hp':
          if (player.hp > 10) {
            player.hp -= 10;
            player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + 1 };
            messages.push(msg('献祭10HP！力量永久+1！', MessageCategory.Item, '#ff8844'));
          } else {
            messages.push(msg('HP不足，无法献祭！', MessageCategory.System, '#ff4444'));
          }
          break;
        case 'altar_mp':
          if (player.mp >= 10) {
            player.mp -= 10;
            player.bonusStats = { ...player.bonusStats, int: player.bonusStats.int + 1 };
            messages.push(msg('献祭10MP！智慧永久+1！', MessageCategory.Item, '#4488ff'));
          } else {
            messages.push(msg('MP不足，无法献祭！', MessageCategory.System, '#ff4444'));
          }
          break;
        case 'altar_item': {
          const consumables = player.inventory.filter(i => i.type === ItemType.Potion || i.type === ItemType.Food);
          if (consumables.length > 0) {
            if (consumables.length === 1) {
              const sacrificed = consumables[0];
              player.inventory = player.inventory.filter(i => i.id !== sacrificed.id);
              player.bonusStats = { ...player.bonusStats, vit: player.bonusStats.vit + 1 };
              messages.push(msg(`献祭了${getItemName(sacrificed)}！活力永久+1！`, MessageCategory.Item, '#ffcc44'));
            } else {
              messages.push(msg('请选择要献祭的消耗品...', MessageCategory.Item, '#ffcc44'));
              set({ pendingSacrifice: true, phase: GamePhase.Inventory });
            }
          } else {
            messages.push(msg('没有可献祭的消耗品！', MessageCategory.System, '#888888'));
          }
          break;
        }

        // Gambler
        case 'gamble_big':
          if (player.gold >= 20) {
            player.gold -= 20;
            if (rng.chance(0.35)) {
              const prize = createRandomItem(state.currentFloor, rng, false);
              if (prize.rarity === Rarity.Rare || prize.rarity === Rarity.Epic || prize.rarity === Rarity.Legendary) {
                player.inventory = [...player.inventory, prize];
                messages.push(msg(`赢了！获得了${getItemName(prize)}！`, MessageCategory.Item, '#ffcc44'));
              } else {
                player.gold += 40;
                messages.push(msg('赢了！获得40金币！', MessageCategory.Item, '#ffcc44'));
              }
            } else {
              messages.push(msg('输了！20金币打了水漂...', MessageCategory.System, '#ff4444'));
            }
          } else {
            messages.push(msg('金币不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        case 'gamble_small':
          if (player.gold >= 5) {
            player.gold -= 5;
            if (rng.chance(0.5)) {
              const prize = createRandomItem(state.currentFloor, rng, false);
              player.inventory = [...player.inventory, prize];
              messages.push(msg(`赢了！获得了${getItemName(prize)}！`, MessageCategory.Item, '#ffcc44'));
            } else {
              messages.push(msg('输了！5金币打了水漂...', MessageCategory.System, '#ff4444'));
            }
          } else {
            messages.push(msg('金币不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        case 'gamble_refuse':
          messages.push(msg('你明智地拒绝了赌博', MessageCategory.System, '#888888'));
          break;

        // Wounded Traveler
        case 'traveler_help': {
          const foodItem = player.inventory.find(i => i.type === ItemType.Food);
          if (foodItem) {
            player.inventory = player.inventory.filter(i => i.id !== foodItem.id);
            player.gold += 15;
            messages.push(msg('你帮助了旅人，他给了你15金币作为报酬！', MessageCategory.Item, '#ffcc44'));
          } else {
            messages.push(msg('你没有食物可以给他...', MessageCategory.System, '#888888'));
          }
          break;
        }
        case 'traveler_rob':
          player.gold += 8;
          messages.push(msg('你搜刮了8金币...良心有些不安', MessageCategory.Item, '#aa8844'));
          break;
        case 'traveler_leave':
          messages.push(msg('你默默离开了', MessageCategory.System, '#888888'));
          break;

        // Mystery Rune
        case 'rune_touch':
          if (rng.chance(0.4)) {
            const stat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
            player.bonusStats = { ...player.bonusStats, [stat]: player.bonusStats[stat] + 2 };
            messages.push(msg(`符文之力涌入！${stat.toUpperCase()}+2！`, MessageCategory.Item, '#ffcc44'));
          } else {
            player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Confusion, duration: 3, damage: 0 }];
            messages.push(msg('符文释放了混乱之力！你陷入了混乱！', MessageCategory.Combat, '#cc44ff'));
          }
          break;
        case 'rune_study': {
          const scroll = createScroll(rng.nextInt(0, 6));
          scroll.identified = true;
          player.inventory = [...player.inventory, scroll];
          messages.push(msg(`你研究符文，领悟了${scroll.name}！`, MessageCategory.Item, '#4488ff'));
          break;
        }
        case 'rune_avoid':
          messages.push(msg('你绕过了符文', MessageCategory.System, '#888888'));
          break;

        // Treasure Chest
        case 'chest_open':
          if (rng.chance(0.3)) {
            // It's a trap!
            player.hp -= 15;
            messages.push(msg('宝箱是个陷阱！受到15点伤害！', MessageCategory.Combat, '#ff4444'));
          } else {
            const loot = createRandomItem(state.currentFloor, rng, false);
            if (loot.rarity !== Rarity.Common) {
              player.inventory = [...player.inventory, loot];
              messages.push(msg(`宝箱中有${getItemName(loot)}！`, MessageCategory.Item, '#ffcc44'));
            } else {
              player.gold += 10;
              messages.push(msg('宝箱中有10金币！', MessageCategory.Item, '#ffcc44'));
            }
          }
          break;
        case 'chest_careful':
          if (rng.chance(0.8)) {
            const loot = createRandomItem(state.currentFloor, rng, false);
            player.inventory = [...player.inventory, loot];
            messages.push(msg(`小心检查后安全打开！获得${getItemName(loot)}！`, MessageCategory.Item, '#44cc44'));
          } else {
            messages.push(msg('宝箱是空的...', MessageCategory.System, '#888888'));
          }
          break;
        case 'chest_skip':
          messages.push(msg('你放弃了宝箱', MessageCategory.System, '#888888'));
          break;
      }

      set({ player, currentEvent: null, phase: GamePhase.Playing });
      addMessages(messages);
    },

    closeEvent: () => {
      set({ phase: GamePhase.Playing });
    },

    chooseBossBlessing: (blessing: BossBlessing) => {
      const state = get();
      if (!state.player) return;
      const player = { ...state.player };
      player.bossBlessings.push(blessing);
      const bossBlessingPending = false;
      const lastBossDefId = null;

      // Immediately-activated blessings
      if (blessing === BossBlessing.EchoBody) {
        player.bonusStats.str += 3;
        player.bonusStats.dex += 3;
        player.bonusStats.int += 3;
        player.bonusStats.vit += 3;
      }
      if (blessing === BossBlessing.AbyssEye) {
        player.visionRadius += 2;
      }

      addMessages([msg('获得了Boss祝福！', MessageCategory.System, '#ffd700')]);
      set({ player, bossBlessingPending, lastBossDefId });
      updateFOV();
    },

    restartGame: () => {
      set({ ...initialState, phase: GamePhase.CharacterCreation, highScores: loadHighScores(), achievements: loadAchievements(), legacyItem: loadLegacyItem() });
    },

    setPhase: (phase: GamePhase) => {
      set({ phase });
      // Context-aware BGM on phase change
      const state = get();
      if (phase === GamePhase.Shop) {
        AudioManager.updateContext('shop', 0, false, '');
      } else if (phase === GamePhase.GameOver) {
        AudioManager.updateContext('gameOver', 0, false, '');
      } else if (phase === GamePhase.Playing) {
        const biome = getBiomeForFloor(state.currentFloor);
        const hasBoss = state.enemies.some(e => e.isBoss && e.hp > 0);
        AudioManager.updateContext('playing', state.currentFloor, hasBoss, biome);
      }
    },

    toggleMusic: () => {
      AudioManager.toggleMusic();
      set({ musicEnabled: AudioManager.musicEnabled });
    },

    toggleSfx: () => {
      AudioManager.toggleSfx();
      set({ sfxEnabled: AudioManager.sfxEnabled });
    },

    loadGame: () => {
      const result = loadSave();
      if (!result) return false;

      const loadedState = result.state;
      // Restore all game state
      set({
        phase: GamePhase.Playing,
        player: loadedState.player ? {
          ...loadedState.player,
          bossKillCount: loadedState.player.bossKillCount ?? 0,
          bossBlessings: loadedState.player.bossBlessings ?? [],
          finalPactUsed: loadedState.player.finalPactUsed ?? false,
          inscriptionCount: loadedState.player.inscriptionCount ?? 0,
        } : null,
        currentFloor: loadedState.currentFloor,
        map: loadedState.map,
        width: loadedState.width ?? 80,
        height: loadedState.height ?? 28,
        enemies: loadedState.enemies,
        items: loadedState.items,
        messages: loadedState.messages,
        turn: loadedState.turn,
        seed: loadedState.seed,
        highScores: loadedState.highScores ?? loadHighScores(),
        achievements: loadedState.achievements ?? loadAchievements(),
        legacyItem: loadedState.legacyItem ?? loadLegacyItem(),
        shopItems: loadedState.shopItems ?? [],
        currentEvent: loadedState.currentEvent,
        skillUseCount: loadedState.skillUseCount ?? 0,
        shopBuyCount: loadedState.shopBuyCount ?? 0,
        musicEnabled: loadedState.musicEnabled ?? true,
        sfxEnabled: loadedState.sfxEnabled ?? true,
        isDailyChallenge: loadedState.isDailyChallenge ?? false,
        screenFlash: null,
        voidCorruption: loadedState.voidCorruption ?? { str: 0, dex: 0, int: 0, vit: 0 },
        currentFragmentTurns: loadedState.currentFragmentTurns ?? 0,
        lavaTideActive: loadedState.lavaTideActive ?? false,
        lavaTideTurnsRemaining: loadedState.lavaTideTurnsRemaining ?? 0,
        lavaTideTiles: loadedState.lavaTideTiles ?? [],
        extraTurnCost: loadedState.extraTurnCost ?? 0,
        deathCause: '',
        warningPulse: 'none' as const,
        pendingIdentify: false,
        pendingSacrifice: false,
        pendingAllocations: loadedState.pendingAllocations ?? { str: 0, dex: 0, int: 0, vit: 0 },
        bossBlessingPending: loadedState.bossBlessingPending ?? false,
        lastBossDefId: loadedState.lastBossDefId ?? null,
        secretWalls: loadedState.secretWalls ?? [],
        floorDescriptionShown: true,  // Already shown on original floor
      });

      // Suspend save: delete after loading to prevent save-scumming
      deleteSave('游戏已恢复，暂停存档已删除');

      // Rebuild FOV
      updateFOV();

      // Restore audio context
      const biome = getBiomeForFloor(loadedState.currentFloor);
      const hasBoss = Array.isArray(loadedState.enemies) && loadedState.enemies.some((e: Enemy) => e.isBoss && e.hp > 0);
      AudioManager.updateContext('playing', loadedState.currentFloor, hasBoss, biome);

      addMessages([
        msg('═══════════════════════════════════', MessageCategory.System, '#4488ff'),
        msg('  游戏已恢复', MessageCategory.System, '#4488ff'),
        msg('═══════════════════════════════════', MessageCategory.System, '#4488ff'),
      ]);

      if (result.message) {
        addMessages([msg(result.message, MessageCategory.System, '#ff8844')]);
      }

      return true;
    },

    suspendAndQuit: () => {
      const state = get();
      if (!state.player || state.phase !== GamePhase.Playing) return;

      saveGame(state);
      addMessages([msg('游戏已暂停，下次打开可继续', MessageCategory.System, '#4488ff')]);

      // Return to title
      AudioManager.stopBGM();
      set({ phase: GamePhase.CharacterCreation, screenFlash: null });
      AudioManager.updateContext('characterCreation', 0, false, '');
    },

    hasSaveGame: () => {
      return hasSave();
    },
  };
});
