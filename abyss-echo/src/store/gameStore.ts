import { create } from 'zustand';
import {
  GameState, GamePhase, Player, CharacterClass, Enemy, Item,
  Tile, TileType, Message, MessageCategory, Stats, EquipmentSlot,
  StatusEffectType, ItemType, PotionEffect, ScrollEffect, Element, Rarity,
  WeaponItem, ArmorItem, RingItem, AmuletItem, PotionItem, ScrollItem, FoodItem, FloorItem,
  GameEventDef, ExtendedGameEventDef, Biome, Position, EquipmentEffect, EnemyBehavior,
  BossBlessing, EliteAffix, RelicId, RoomTheme, HiddenRoomType, RelicRarity,
} from '../types';
import { CLASS_DEFS, HUNGER_RATE, HUNGER_STARVE_DAMAGE, getBiomeForFloor, BIOME_CONFIG, ENEMY_DEFS, SKILL_DEFS, TALENT_DEFS, ACHIEVEMENT_DEFS, GAME_EVENTS, FLOOR_DESCRIPTIONS, BOSS_PHASES, INSCRIPTION_TEXTS, ENHANCE_COSTS, ENHANCE_SUCCESS_RATES, ENHANCE_ATK_MULT, ENHANCE_DEF_MULT, ELITE_REGEN_RATE, ENEMY_SPECIAL_CHANCE } from '../constants';
import { RELIC_DEFS, RELICS_BY_RARITY } from '../constants/relics';
import { THEMED_ROOM_CONFIGS } from '../constants/themedRooms';
import { EXTENDED_EVENT_DEFS } from '../constants/events';
import { hasRelic, getRelicAtkModifier, getRelicGoldModifier,
         getRelicForgeCostModifier,
         getRelicBurnDamageModifier, getRelicPoisonDamageModifier,
         isRelicBurnImmune, rollRelicStatusProcs,
         rollRandomRelic } from '../engine/RelicEffects';
import { checkChainReactionWithMap, getEnemyElementDebuffs, executeChainReaction } from '../engine/ElementalChain';
import { createScroll } from '../entities/Items';
import { createFood, createPotion } from '../entities/Items';
import { generateDungeon, createTile } from '../generator/DungeonGenerator';
import { computeFOV, distance, hasLineOfSight } from '../engine/FOV';
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
// Floating text helper
// ============================================================
function addFloatingText(x: number, y: number, text: string, color: string, type: 'damage' | 'heal' | 'status' | 'crit' = 'damage') {
  const state = useGameStore.getState();
  useGameStore.setState({ floatingTexts: [...(state.floatingTexts || []), { x, y, text, color, createdAt: performance.now(), type }] });
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
const SAVE_VERSION = '1.3.4';

function saveGame(state: GameStore) {
  try {
    // Only save GameState fields (exclude computed: visibleTiles, rememberedMap)
    const { phase, player, currentFloor, map, width, height, enemies, items,
      messages, turn, seed, highScores, achievements, legacyItem,
      isDailyChallenge, shopItems, currentEvent,
      skillUseCount, shopBuyCount, musicEnabled, sfxEnabled,
      voidCorruption, currentFragmentTurns, lavaTideActive, lavaTideTurnsRemaining, lavaTideTiles,
      extraTurnCost, deathCause, warningPulse, pendingIdentify, pendingSacrifice, pendingAllocations,
      bossBlessingPending, lastBossDefId, secretWalls, floorDescriptionShown,
      pendingForge, themedRooms, steamVentTurns } = state;
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
        pendingForge, themedRooms, steamVentTurns,
        screenFlash: null,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch { /* ignore storage full */ }
}

// Default values for GameState fields that may be missing in older saves
const SAVE_FIELD_DEFAULTS: Partial<GameState> = {
  achievements: [],
  legacyItem: null,
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
  warningPulse: 'none',
  pendingIdentify: false,
  pendingSacrifice: false,
  pendingAllocations: {},
  bossBlessingPending: false,
  lastBossDefId: null,
  secretWalls: [],
  floorDescriptionShown: false,
  pendingForge: false,
  themedRooms: [],
  steamVentTurns: [],
  floatingTexts: [],
  screenShake: null,
};

function migrateSaveState(state: Record<string, unknown>): GameState {
  const migrated = { ...state };
  for (const [key, defaultValue] of Object.entries(SAVE_FIELD_DEFAULTS)) {
    if (!(key in migrated) || migrated[key] === undefined) {
      (migrated as Record<string, unknown>)[key] = defaultValue;
    }
  }
  return migrated as unknown as GameState;
}

function loadSave(): { state: GameState; message?: string } | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (!parsed.version || !parsed.state || typeof parsed.state !== 'object') {
      deleteSave('存档格式损坏，无法恢复');
      return null;
    }
    const migratedState = migrateSaveState(parsed.state);
    const isOldVersion = parsed.version !== SAVE_VERSION;
    return {
      state: migratedState,
      message: isOldVersion ? '存档已恢复（版本已迁移）' : '存档已恢复',
    };
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
  let rate = HUNGER_RATE;
  if (hasTalent(player, 'ironStomach')) rate *= 0.5;
  if (hasRelic(player, RelicId.HungerRing)) rate *= 0.5;
  return rate;
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
  let gold = baseGold;
  if (hasTalent(player, 'greedy')) gold = Math.floor(gold * 1.5);
  gold = Math.floor(gold * (1 + getRelicGoldModifier(player)));
  return gold;
}

function getTalentModifiedCritMultiplier(player: Player): number {
  return hasTalent(player, 'deadlyStrike') ? 2.0 : 1.5;
}

function getTalentModifiedElementalDamage(player: Player, baseDamage: number): number {
  return hasTalent(player, 'elementalAffinity') ? Math.floor(baseDamage * 1.2) : baseDamage;
}

function getTalentModifiedVisionRadius(player: Player): number {
  let radius = hasTalent(player, 'nightVision') ? player.visionRadius + 2 : player.visionRadius;
  if (player.relics.includes(RelicId.DarkVision)) radius += 2;
  // Blind status: vision reduced to 1
  if (player.statusEffects.some(e => e.type === StatusEffectType.Blind)) radius = 1;
  return radius;
}

// Mana Shield: absorb 30% of damage via MP
function applyManaShield(player: Player, damage: number): { hpDamage: number; mpAbsorbed: number } {
  if (!player.talents.includes('manaShield') || damage <= 0) {
    return { hpDamage: damage, mpAbsorbed: 0 };
  }
  const mpAbsorbed = Math.min(player.mp, Math.floor(damage * 0.3));
  return { hpDamage: damage - mpAbsorbed, mpAbsorbed };
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
  enhanceEquipment: (slot: EquipmentSlot) => void;
  enhanceInventoryItem: (index: number) => void;
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
  pendingForge: false,
  themedRooms: [],
  steamVentTurns: [],
  floatingTexts: [],
  screenShake: null,
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

    // Trap Sense talent: reveal traps in visible area
    if (state.player.talents.includes('trapSense')) {
      const TRAP_REVEAL: Record<string, { char: string; fg: string }> = {
        [TileType.TrapSpike]: { char: '▲', fg: '#aaaacc' },
        [TileType.TrapFire]: { char: '▲', fg: '#ff8844' },
        [TileType.TrapTeleport]: { char: '▲', fg: '#aa66ff' },
        [TileType.TrapPoison]: { char: '▲', fg: '#44cc44' },
        [TileType.TrapParalysis]: { char: '▲', fg: '#ccccff' },
        [TileType.TrapConfusion]: { char: '▲', fg: '#cccc44' },
        [TileType.TrapBlind]: { char: '▲', fg: '#666666' },
        [TileType.TrapAlarm]: { char: '▲', fg: '#ff4444' },
      };
      let trapRevealed = false;
      const trapMap = newMap.map(row => row.map(tile => ({ ...tile })));
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          const key = `${x},${y}`;
          if (visible.has(key) && !trapMap[y][x].trapRevealed) {
            const reveal = TRAP_REVEAL[trapMap[y][x].type];
            if (reveal) {
              trapMap[y][x].char = reveal.char;
              trapMap[y][x].fg = reveal.fg;
              trapMap[y][x].trapRevealed = true;
              remembered.set(key, { char: reveal.char, fg: reveal.fg, bg: trapMap[y][x].bg });
              trapRevealed = true;
            }
          }
        }
      }
      if (trapRevealed) {
        set({ map: trapMap, rememberedMap: remembered });
      }
    }

    set({ map: newMap, visibleTiles: visible, rememberedMap: remembered });
  }

  function handlePlayerDeath(player: Player, enemies: Enemy[], messages: Message[], deathCause: string) {
    const state = get();

    // Clamp HP to 0 — damage may overshoot, producing negative values
    player.hp = Math.max(0, player.hp);

    // VoidHeart: prevent first death
    if (player.relics.includes(RelicId.VoidHeart) && !player.voidHeartUsed) {
      player.hp = Math.floor(player.maxHp * 0.5);
      player.voidHeartUsed = true;
      player.relics = player.relics.filter(r => r !== RelicId.VoidHeart);
      set({ player });
      addMessages([msg('🟣 虚空之心碎裂！你从死亡边缘被拉回！', MessageCategory.Item, '#aa44ff')]);
      return; // Don't proceed to game over
    }

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

    // Handle TimeHourglass extra turn (player gets free action, enemies don't act)
    if (state.extraTurnCost < 0) {
      set({ extraTurnCost: 0 });
      return; // Player already acted, skip enemy turn processing
    }

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
        addFloatingText(player2.pos.x, player2.pos.y, `-${HUNGER_STARVE_DAMAGE}`, '#ff8800', 'status');
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
      const playHeartbeat = isLowHp2 && extraTurn % 3 === 0;
      const playGrowl = isStarving2 && extraTurn % 5 === 0;
      if (playHeartbeat && playGrowl) {
        AudioManager.playSFX(extraTurn % 2 === 0 ? 'heartbeat' : 'stomachGrowl');
      } else if (playHeartbeat) {
        AudioManager.playSFX('heartbeat');
      } else if (playGrowl) {
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
    // Save damage-dealing effects BEFORE processing (processStatusEffects removes expired ones)
    const damageTypes = new Set([StatusEffectType.Poison, StatusEffectType.Burn, StatusEffectType.Bleed]);
    const dmgEffectsBefore = player.statusEffects.filter(e => damageTypes.has(e.type as StatusEffectType) && e.damage > 0);

    if (player.statusEffects.length > 0) {
      // Relic: FlameHeart - Burn damage increased
      if (hasRelic(player, RelicId.FlameHeart)) {
        const burnModifier = getRelicBurnDamageModifier(player);
        player.statusEffects = player.statusEffects.map(e =>
          e.type === StatusEffectType.Burn
            ? { ...e, damage: Math.floor(e.damage * (1 + burnModifier)) }
            : e
        );
      }
      // Relic: PoisonGland - Poison damage increased
      if (hasRelic(player, RelicId.PoisonGland)) {
        const poisonModifier = getRelicPoisonDamageModifier(player);
        player.statusEffects = player.statusEffects.map(e =>
          e.type === StatusEffectType.Poison
            ? { ...e, damage: Math.floor(e.damage * (1 + poisonModifier)) }
            : e
        );
      }
      // Relic: isRelicBurnImmune - skip Burn application on player
      const burnImmune = isRelicBurnImmune(player);
      player.statusEffects = player.statusEffects.filter(e => !(burnImmune && e.type === StatusEffectType.Burn));

      const result = processStatusEffects(player, true);
      player.hp -= result.damage;
      player.statusEffects = result.newStatusEffects;
      if (result.damage > 0) addFloatingText(player.pos.x, player.pos.y, `-${result.damage}`, '#aa44ff', 'status');
      if (result.damage > 0) messages.push(...result.messages.map(m => msg(m, MessageCategory.Combat, '#ff4444')));
    }

    // Check player death from status effects
    if (player.hp <= 0) {
      const effectZh: Record<string, string> = { poison: '中毒', burn: '燃烧', bleed: '流血' };
      const cause = dmgEffectsBefore.length > 0
        ? `因${dmgEffectsBefore.map(e => effectZh[e.type] || e.type).join('和')}致死`
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
      addFloatingText(player.pos.x, player.pos.y, `-${HUNGER_STARVE_DAMAGE}`, '#ff8800', 'status');
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
      addFloatingText(player.pos.x, player.pos.y, '+1', '#87ceeb', 'heal');
    }
    // MP regen: only in combat (enemies visible)
    const enemyInSight = enemies.some(e => e.hp > 0 && state.visibleTiles.has(`${e.pos.x},${e.pos.y}`));
    if (enemyInSight && player.mp < player.maxMp) {
      const mpRegen = Math.max(1, Math.floor(player.stats.int / 8));
      player.mp = Math.min(player.maxMp, player.mp + mpRegen);
    }
    // Meditation talent: additional +1 MP per turn (only in combat)
    if (hasTalent(player, 'meditation') && enemyInSight && player.mp < player.maxMp) {
      player.mp = Math.min(player.maxMp, player.mp + 1);
    }

    // Relic: Eternal Flame - heal 5% maxHp when standing on Lava/CooledLava
    if (hasRelic(player, RelicId.EternalFlame)) {
      const tile = state.map[player.pos.y]?.[player.pos.x];
      if (tile && (tile.type === TileType.Lava || tile.type === TileType.CooledLava)) {
        const heal = Math.floor(player.maxHp * 0.05);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        messages.push(msg('永恒之焰回复了' + heal + '点HP', MessageCategory.Item, '#ff6644'));
        addFloatingText(player.pos.x, player.pos.y, `+${heal}`, '#87ceeb', 'heal');
      }
    }

    // Lava Tide mechanic (Lava Core only)
    let lavaTideActive = state.lavaTideActive;
    let lavaTideTurnsRemaining = state.lavaTideTurnsRemaining;
    let lavaTideTiles = state.lavaTideTiles;
    let currentMap = state.map;

    // Relic: Sixth Sense - auto-reveal adjacent SecretWalls
    if (hasRelic(player, RelicId.SixthSense)) {
      const dirs = [[0,-1],[0,1],[-1,0],[1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
      let revealed = false;
      const newMap = currentMap.map(row => row.map(t => ({ ...t })));
      for (const [dx, dy] of dirs) {
        const nx = player.pos.x + dx;
        const ny = player.pos.y + dy;
        if (ny >= 0 && ny < currentMap.length && nx >= 0 && nx < currentMap[0].length) {
          if (currentMap[ny][nx].type === TileType.SecretWall && state.visibleTiles.has(`${nx},${ny}`)) {
            newMap[ny][nx] = {
              ...newMap[ny][nx],
              type: TileType.DoorOpen,
              char: '◌',
              fg: '#aa88ff',
              bg: '#111118',
              walkable: true,
              transparent: true,
            };
            revealed = true;
          }
        }
      }
      if (revealed) {
        currentMap = newMap;
        messages.push(msg('👁️ 第六感！你发现了隐藏的暗墙！', MessageCategory.Item, '#aa88ff'));
      }
    }

    // Relic: Time Hourglass - every 5 turns, grant extra action
    if (hasRelic(player, RelicId.TimeHourglass)) {
      if (!player.extraTurnAccumulator) player.extraTurnAccumulator = 0;
      player.extraTurnAccumulator = Math.min(player.extraTurnAccumulator + 1, 5);
      if (player.extraTurnAccumulator >= 5) {
        messages.push(msg('时间沙漏触发：额外获得一回合！', MessageCategory.Item, '#ffcc44'));
        player.extraTurnAccumulator -= 5;
        set({ extraTurnCost: -1 }); // Negative cost means an extra turn (free action)
      }
    }

    // Decrease skill cooldowns
    player.skillCooldowns = player.skillCooldowns.map(cd => Math.max(0, cd - 1));

    // Check player death from starvation
    if (player.hp <= 0) {
      handlePlayerDeath(player, enemies, messages, '饥饿致死');
      return;
    }

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

    // Steam Vent eruption (every 3 turns)
    const activeSteamVents: number[] = [];
    if (state.turn > 0 && state.turn % 3 === 0) {
      for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[0].length; x++) {
          if (currentMap[y][x].type === TileType.SteamVent) {
            activeSteamVents.push(y * state.width + x);
          }
        }
      }
      if (activeSteamVents.length > 0) {
        messages.push(msg('蒸汽口喷发了！视野被遮蔽...', MessageCategory.Environment, '#aadddd'));
        // Store active steam vents for fog effect in rendering
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
        player = { ...player, stats: { ...player.stats, [stat]: Math.max(0, player.stats[stat] - 1) } };
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
    // H1 fix: Add bounds check for map[0].length
    if (state.turn % 5 === 0 && state.map.length > 0) {
      const rifts: Position[] = [];
      for (let y = 0; y < state.map.length; y++) {
        if (state.map[y] && state.map[y].length > 0) {
          for (let x = 0; x < state.map[y].length; x++) {
            if (state.map[y][x].type === TileType.VoidRift) rifts.push({ x, y });
          }
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
              AudioManager.playSFX('portalWarp');
            }
            break;
          }
        }
      }
    }

    // Arena: Corruption pool damage (every 2 turns)
    if (state.turn % 2 === 0 && state.map.length > 0) {
      let hasCorruptionPool = false;
      for (let y = 0; y < state.map.length && !hasCorruptionPool; y++) {
        if (state.map[y] && state.map[y].length > 0) {
          for (let x = 0; x < state.map[y].length && !hasCorruptionPool; x++) {
            if (state.map[y][x].type === TileType.CorruptionPool) hasCorruptionPool = true;
          }
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
          enemies[i] = { ...enemies[i], hp: enemies[i].hp - result.damage, statusEffects: result.newStatusEffects };
          if (result.damage > 0) addFloatingText(enemies[i].pos.x, enemies[i].pos.y, `-${result.damage}`, '#aa44ff', 'status');
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
          enemies[i] = { ...enemies[i], frenzyBonus: (enemies[i].frenzyBonus || 0) + 0.5 };
        }

        // Elite Regen: Heal 5% max HP per turn
        if (enemies[i].isElite && enemies[i].eliteAffix === EliteAffix.Regen && enemies[i].hp > 0) {
          const healAmt = Math.max(1, Math.floor(enemies[i].maxHp * ELITE_REGEN_RATE));
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
              addFloatingText(player.pos.x, player.pos.y, `-${ambushDamage}`, '#ff4444', 'damage');
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
              let damage = Math.max(1, Math.floor(rawDamage * 20 / (20 + defense)));

              // MirrorShield: reflect first damage per floor
              if (hasRelic(player, RelicId.MirrorShield) && !player._mirrorShieldUsed) {
                player._mirrorShieldUsed = true;
                const reflectedDmg = Math.floor(damage * 0.5);
                // Find the attacking enemy and deal reflected damage
                const eIdx = enemies.findIndex(e => e.id === enemy.id);
                if (eIdx >= 0) {
                  enemies[eIdx] = { ...enemies[eIdx], hp: enemies[eIdx].hp - reflectedDmg };
                }
                messages.push(msg('🪞 镜之盾反弹了部分伤害！', MessageCategory.Combat, '#aaddff'));
                // Player still takes damage but reduced
                damage = Math.floor(damage * 0.5);
              }

              player.hp -= damage;
              messages.push(msg(`${enemy.name}攻击了你，造成 ${damage} 点伤害！`, MessageCategory.Combat, '#ff4444'));
              AudioManager.playSFX('hit');
              flashScreen('#ff000033');

              // Mana Shield: 30% of damage absorbed by MP
              const shield = applyManaShield(player, damage);
              if (shield.mpAbsorbed > 0) {
                player.mp -= shield.mpAbsorbed;
                player.hp += shield.mpAbsorbed;
                addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
                messages.push(msg(`法力护盾吸收了${shield.mpAbsorbed}点伤害！`, MessageCategory.Combat, '#4488ff'));
              }

              // Add floating text for player damage
              addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#ff4444', 'damage');

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
    // Warning SFX: heartbeat every 3 turns, stomachGrowl every 5 turns
    // Avoid playing both low-freq SFX simultaneously when intervals coincide (every 15 turns)
    const playHeartbeat = isLowHp && newTurn % 3 === 0;
    const playGrowl = isStarving && newTurn % 5 === 0;
    if (playHeartbeat && playGrowl) {
      AudioManager.playSFX(newTurn % 2 === 0 ? 'heartbeat' : 'stomachGrowl');
    } else if (playHeartbeat) {
      AudioManager.playSFX('heartbeat');
    } else if (playGrowl) {
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
          AudioManager.playSFX('levelup');
        }
      }
      set({ achievements: allAchievements });
    }

    if (messages.length > 0) {
      addMessages(messages);
    }

    // Age floating texts and remove those older than 2 turns
    // Floating texts are now time-based and auto-cleaned by MapView animation loop
    // Screen shake is also time-based — decayed in MapView animation loop, not per-turn

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

    // Hidden room BGM: switch to secretRoom track when standing on HiddenFloor
    const finalState = get();
    if (finalState.player && finalState.map) {
      const playerTile = finalState.map[finalState.player.pos.y]?.[finalState.player.pos.x];
      if (playerTile?.type === TileType.HiddenFloor) {
        AudioManager.crossfade('secretRoom');
      } else {
        // Restore biome BGM when leaving hidden room
        const biome = getBiomeForFloor(finalState.currentFloor);
        const hasBoss = finalState.enemies.some(e => e.isBoss && e.hp > 0);
        AudioManager.updateContext('playing', finalState.currentFloor, hasBoss, biome);
      }
    }

    // AbyssWhisper relic: reveal 1 adjacent SecretWall per floor
    if (finalState.player?.relics.includes(RelicId.AbyssWhisper) && finalState.secretWalls.length > 0) {
      const revealedKey = `_abyssWhisperF${finalState.currentFloor}`;
      if (!(finalState.player as any)[revealedKey]) {
        for (const swPos of finalState.secretWalls) {
          const dist = Math.abs(swPos.x - finalState.player.pos.x) + Math.abs(swPos.y - finalState.player.pos.y);
          if (dist <= 3 && finalState.visibleTiles.has(`${swPos.x},${swPos.y}`)) {
            const newMap = finalState.map.map(row => row.map(t => ({ ...t })));
            const swTile = newMap[swPos.y][swPos.x];
            if (swTile.type === TileType.SecretWall) {
              newMap[swPos.y][swPos.x] = {
                ...swTile,
                type: TileType.DoorOpen,
                char: '◌',
                fg: '#aa88cc',
                bg: '#111118',
                walkable: true,
                transparent: true,
              };
              addMessages([msg('深渊低语揭示了一道暗墙...', MessageCategory.System, '#aa88cc')]);
              set({ map: newMap });
            }
            break;
          }
        }
        const p = { ...finalState.player, [revealedKey]: true };
        set({ player: p });
      }
    }
  }

  function handleSpecialAbility(enemy: Enemy, player: Player, enemies: Enemy[], messages: Message[], rng: SeededRandom) {
    // 装备特效：元素抗性 — 元素伤害-30%
    const hasElementResist = hasEquipmentEffect(player, EquipmentEffect.ElementResist);

    switch (enemy.specialAbility) {
      case 'fireball': {
        let damage = Math.floor(enemy.attack * 1.5);
        if (hasElementResist) { damage = Math.floor(damage * 0.7); }
        const shield = applyManaShield(player, damage);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#ff6600', 'damage');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        messages.push(msg(`${enemy.name}释放了火球术！造成 ${damage} 点🔥火伤害！${hasElementResist ? '(抗性减免)' : ''}${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#ff6644'));
        break;
      }
      case 'drain': {
        const damage = Math.floor(enemy.attack * 0.8);
        const shield = applyManaShield(player, damage);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#aa44ff', 'damage');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        const eidx = enemies.findIndex(e => e.id === enemy.id);
        if (eidx >= 0) {
          enemies[eidx] = { ...enemies[eidx], hp: Math.min(enemies[eidx].maxHp, enemies[eidx].hp + Math.floor(damage / 2)) };
        }
        messages.push(msg(`${enemy.name}吸取了你的生命力！造成 ${damage} 点伤害！${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#aa44ff'));
        break;
      }
      case 'poison': {
        player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 4, damage: 3 }];
        messages.push(msg(`${enemy.name}释放了毒雾！你中毒了！(☠3伤害/4回合)`, MessageCategory.Combat, '#44cc44'));
        break;
      }
      case 'petrify': {
        if (rng.chance(ENEMY_SPECIAL_CHANCE)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: 2, damage: 0 }];
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
        const shield = applyManaShield(player, damage);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#ff6600', 'damage');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        messages.push(msg(`${enemy.name}喷出了龙息！造成 ${damage} 点🔥火伤害！${hasElementResist ? '(抗性减免)' : ''}${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#ff4422'));
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
        const shield = applyManaShield(player, damage);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#cc44ff', 'damage');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        if (rng.chance(0.4)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 5, damage: 4 }];
          messages.push(msg(`${enemy.name}释放了不可名状的力量！造成 ${damage} 点虚空伤害！你中毒了！(☠4伤害/5回合)${hasElementResist ? '(抗性减免)' : ''}${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#cc44ff'));
        } else {
          messages.push(msg(`${enemy.name}释放了不可名状的力量！造成 ${damage} 点虚空伤害！${hasElementResist ? '(抗性减免)' : ''}${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#cc44ff'));
        }
        break;
      }
      case 'surprise': {
        const damage = Math.floor(enemy.attack * 2);
        const shield = applyManaShield(player, damage);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#ff4444', 'crit');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        messages.push(msg(`${enemy.name}突然袭击！造成 ${damage} 点伤害！${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#ff4444'));
        break;
      }
      case 'regenerate': {
        const eidx = enemies.findIndex(e => e.id === enemy.id);
        if (eidx >= 0) {
          const healAmt = Math.floor(enemies[eidx].maxHp * 0.1);
          enemies[eidx] = { ...enemies[eidx], hp: Math.min(enemies[eidx].maxHp, enemies[eidx].hp + healAmt) };
        }
        messages.push(msg(`${enemy.name}正在恢复生命...`, MessageCategory.Combat, '#44cc44'));
        break;
      }
      case 'web': {
        if (rng.chance(0.4)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: 1, damage: 0 }];
          messages.push(msg(`${enemy.name}吐出了蛛丝，将你缠住！`, MessageCategory.Combat, '#aaaaaa'));
        }
        break;
      }
      case 'poisonSting': {
        if (rng.chance(0.2)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 3, damage: 2 }];
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
        if (rng.chance(ENEMY_SPECIAL_CHANCE)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: 1, damage: 0 }];
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
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#aa66ff', 'damage');
        messages.push(msg(`${enemy.name}穿过了你！造成 ${damage} 点伤害！`, MessageCategory.Combat, '#aa66ff'));
        break;
      }
      case 'lavaSwim': {
        // Lava Worm: can swim in lava (movement handled in AI)
        const damage = Math.floor(enemy.attack * 0.7);
        player.hp -= damage;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#ff6622', 'damage');
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
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: 1, damage: 0 }];
          messages.push(msg(`${enemy.name}投出罗网！你被冰冻了！`, MessageCategory.Combat, '#ff4444'));
        } else {
          messages.push(msg(`${enemy.name}投出罗网，但你躲开了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'poisonMist': {
        const chance = enemy.bossPhase >= 3 ? 0.8 : 0.6;
        if (rng.next() < chance) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 5, damage: 4 }];
          messages.push(msg(`${enemy.name}喷射毒雾！你中毒了！`, MessageCategory.Combat, '#44cc44'));
        } else {
          messages.push(msg(`${enemy.name}喷射毒雾，但你抵抗了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'cocoon': {
        if (rng.next() < 0.25) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: 2, damage: 0 }];
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
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Burn, duration: 4, damage: 5 }];
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
        // H1 fix: Add bounds check for state.map[0].length
        if (state.map.length > 0 && state.map[0] && state.map[0].length > 0) {
          for (let dy = -6; dy <= 6; dy++) {
            for (let dx = -6; dx <= 6; dx++) {
              const nx = cx + dx, ny = cy + dy;
              if (ny >= 0 && ny < state.map.length && nx >= 0 && nx < state.map[0].length && state.map[ny]) {
                if (state.map[ny][nx].walkable && !enemies.some(e => e.hp > 0 && e.pos.x === nx && e.pos.y === ny)) {
                  walkable.push({ x: nx, y: ny });
                }
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
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Burn, duration: 3, damage: 3 }];
          messages.push(msg(`${enemy.name}释放湮灭波！你的HP降至1！燃烧了！`, MessageCategory.Combat, '#ff4444'));
        } else {
          messages.push(msg(`${enemy.name}释放湮灭波！你勉强撑住了！`, MessageCategory.Combat, '#888888'));
        }
        break;
      }
      case 'voidRay': {
        let damage = Math.floor(enemy.attack * 1.8);
        if (hasElementResist) { damage = Math.floor(damage * 0.7); }
        const shield = applyManaShield(player, damage);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${damage}`, '#cc44ff', 'damage');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        messages.push(msg(`${enemy.name}发射虚空射线！造成${damage}点伤害！${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#cc44ff'));
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
            addFloatingText(enemy.pos.x, enemy.pos.y, `+${healAmt}`, '#44cc44', 'heal');
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
        const shield = applyManaShield(player, dmg);
        player.hp -= shield.hpDamage;
        player.mp -= shield.mpAbsorbed;
        addFloatingText(player.pos.x, player.pos.y, `-${dmg}`, '#cc44ff', 'damage');
        if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
        const healAmt = Math.floor(dmg * vampRate);
        const bossIdx = enemies.findIndex(e => e.id === enemy.id);
        if (bossIdx >= 0) {
          enemies[bossIdx] = { ...enemy, hp: Math.min(enemy.maxHp, enemy.hp + healAmt) };
          addFloatingText(enemy.pos.x, enemy.pos.y, `+${healAmt}`, '#44cc44', 'heal');
        }
        messages.push(msg(`${enemy.name}释放虚空脉冲！造成${dmg}点伤害并回复${healAmt}HP！${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#cc44ff'));
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

    // Create items/enemies for hidden rooms
    const enemyIds = biomeConfig.enemyIds ?? ['skeleton'];
    for (const hr of dungeon.hiddenRooms ?? []) {
      const availablePositions = hr.positions.filter(p => !(p.x === hr.secretWallPos.x && p.y === hr.secretWallPos.y));
      if (availablePositions.length === 0) continue;

      switch (hr.type) {
        case HiddenRoomType.Slaughterhouse: {
          const foodCount = rng.nextInt(2, 4);
          for (let i = 0; i < foodCount && availablePositions.length > 0; i++) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            const foodIdx = floor < 10
              ? rng.nextInt(0, 2)
              : floor < 20
                ? rng.nextInt(1, 3)
                : rng.nextInt(2, 4);
            items.push({ item: createFood(foodIdx), pos });
          }
          break;
        }
        case HiddenRoomType.Treasury: {
          if (availablePositions.length > 0) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            items.push({ item: createRandomItem(floor, rng, false, 3, 0), pos });
          }
          break;
        }
        case HiddenRoomType.Armory: {
          const equipCount = rng.nextInt(1, 2);
          for (let i = 0; i < equipCount && availablePositions.length > 0; i++) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            const luckBonus = floor < 10 ? 3 : floor < 20 ? 6 : 10;
            items.push({ item: createRandomItem(floor, rng, false, luckBonus, 0), pos });
          }
          break;
        }
        case HiddenRoomType.AlchemyLab: {
          const potionCount = rng.nextInt(2, 3);
          for (let i = 0; i < potionCount && availablePositions.length > 0; i++) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            items.push({ item: createRandomItem(floor, rng, false, 0, 0), pos });
          }
          if (availablePositions.length > 0) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            items.push({ item: createScroll(rng.nextInt(0, 8)), pos });
          }
          break;
        }
        case HiddenRoomType.Library: {
          for (let i = 0; i < 2 && availablePositions.length > 0; i++) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            items.push({ item: createScroll(rng.nextInt(0, 8)), pos });
          }
          break;
        }
        case HiddenRoomType.MonsterNest: {
          const nestEnemyCount = rng.nextInt(2, 3);
          for (let i = 0; i < nestEnemyCount && availablePositions.length > 0; i++) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            const defId = rng.pick(enemyIds);
            const affixValues = Object.values(EliteAffix);
            const affix = rng.pick(affixValues) as EliteAffix;
            const elite = createEliteEnemy(defId, pos, floor, affix);
            if (elite) {
              if (floor >= 21) {
                elite.hp = Math.floor(elite.hp * 1.5);
                elite.maxHp = elite.hp;
              }
              enemies.push(elite);
            }
          }
          break;
        }
        case HiddenRoomType.FungiPatch: {
          const mushCount = rng.nextInt(1, 2);
          for (let i = 0; i < mushCount && availablePositions.length > 0; i++) {
            const posIdx = rng.nextInt(0, availablePositions.length - 1);
            const pos = availablePositions.splice(posIdx, 1)[0];
            items.push({ item: createFood(3), pos });
          }
          break;
        }
        case HiddenRoomType.AncientTomb:
        case HiddenRoomType.MagicSpring:
        case HiddenRoomType.HiddenAltar:
        case HiddenRoomType.VoidRift:
        case HiddenRoomType.Empty:
          break;
      }
    }

    // Create shop items if there's a shop
    let shopItems: Item[] = [];
    if (dungeon.shopPos) {
      shopItems = createShopItems(floor, rng, 4);
    }

    // Pick random event if there's an event tile
    let currentEvent: GameEventDef | ExtendedGameEventDef | null = null;
    if (dungeon.eventPos) {
      // Merge old and new events, weighted by biome affinity
      const currentBiome = getBiomeForFloor(floor);
      const allEvents: (GameEventDef | ExtendedGameEventDef)[] = [...GAME_EVENTS];
      if (EXTENDED_EVENT_DEFS && EXTENDED_EVENT_DEFS.length > 0) {
        // Build weighted list: events with matching biomeAffinity appear 3x
        for (const evt of EXTENDED_EVENT_DEFS) {
          if ('biomeAffinity' in evt && evt.biomeAffinity?.includes(currentBiome)) {
            allEvents.push(evt, evt, evt); // 3x weight for matching biome
          } else {
            allEvents.push(evt); // 1x weight for non-matching
          }
        }
      }
      currentEvent = rng.pick(allEvents);
    }

    const player = { ...state.player, pos: { ...dungeon.playerStart } };

    // Store themed rooms and steam vent turns from dungeon data
    const themedRooms = (dungeon as { themedRooms?: GameState['themedRooms'] }).themedRooms || [];
    const steamVentTurns = (dungeon as { steamVentTurns?: GameState['steamVentTurns'] }).steamVentTurns || [];

    // Reset _mirrorShieldUsed and _lifeSeedUsedThisFloor on floor entry
    player._mirrorShieldUsed = false;
    player._lifeSeedUsedThisFloor = false;
    player._fateWeaverCount = 0;
    player.comboAttackCount = 0;

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
      themedRooms,
      steamVentTurns,
      pendingForge: false,
    });

    // Clear remembered map from previous floor
    set({ rememberedMap: new Map<string, { char: string; fg: string; bg: string }>() });

    addMessages([
      msg(`你来到了第 ${floor} 层 - ${biomeConfig.nameZh}`, MessageCategory.Story, '#ffcc44'),
    ]);

    // OldMap: reveal a themed room
    if (player.relics.includes(RelicId.OldMap) && themedRooms.length > 0) {
      const revealed = rng.nextInt(0, themedRooms.length - 1);
      const theme = themedRooms[revealed].theme as RoomTheme;
      const config = THEMED_ROOM_CONFIGS[theme];
      if (config) {
        addMessages([msg(`🗺️ 破旧地图显示了前方有：${config.nameZh}`, MessageCategory.Item, '#aaaaaa')]);
      }
    }

    // Floor atmosphere description
    const desc = FLOOR_DESCRIPTIONS[floor];
    const nextState = get();
    if (desc && !nextState.floorDescriptionShown) {
      addMessages([msg(desc, MessageCategory.Story, '#88ccff')]);
      set({ floorDescriptionShown: true });
    }

    updateFOV();

    // Output themed room narrative if player starts on one
    const playerPos = { ...dungeon.playerStart };
    const currentThemedRooms = themedRooms || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const themedRoomOnStart = currentThemedRooms.find((tr: any) =>
      playerPos.x >= tr.room.x && playerPos.x < tr.room.x + tr.room.w &&
      playerPos.y >= tr.room.y && playerPos.y < tr.room.y + tr.room.h
    );
    if (themedRoomOnStart) {
      const theme = themedRoomOnStart.theme as RoomTheme;
      const config = THEMED_ROOM_CONFIGS[theme];
      if (config) {
        addMessages([msg(`【${config.nameZh}】${config.narrativeText}`, MessageCategory.Story, '#ffcc44')]);
      }
    }

    // Show all themed room names on floor entry (player will discover details when visiting)
    if (themedRooms.length > 0 && !themedRoomOnStart) {
      const roomNames = themedRooms.map(tr => {
        const config = THEMED_ROOM_CONFIGS[tr.theme as RoomTheme];
        return config ? config.nameZh : '???';
      });
      addMessages([msg(`此层特殊房间：${roomNames.join('、')}`, MessageCategory.Story, '#887744')]);
    }

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

      // Starting supplies: 2 bread + 1 rations + 1 jerky (+ Mage: extra bread + ration)
      player.inventory.push(createFood(0)); // 面包
      player.inventory.push(createFood(0)); // 面包
      player.inventory.push(createFood(1)); // 干粮
      player.inventory.push(createFood(2)); // 肉干
      if (charClass === CharacterClass.Mage) {
        player.inventory.push(createFood(0)); // 面包 (法师额外补给)
        player.inventory.push(createFood(1)); // 干粮 (法师额外补给)
      }
      if (charClass === CharacterClass.Warrior || charClass === CharacterClass.Rogue) {
        player.inventory.push(createFood(0)); // 面包 (战士/盗贼额外补给)
        player.inventory.push(createFood(1)); // 干粮 (战士/盗贼额外补给)
      }

      // 初始治疗药水
      if (charClass === CharacterClass.Warrior) {
        const hp1 = createPotion(0); hp1.identified = true;
        const hp2 = createPotion(0); hp2.identified = true;
        player.inventory.push(hp1, hp2);
      }
      if (charClass === CharacterClass.Rogue) {
        const hp = createPotion(0); hp.identified = true;
        player.inventory.push(hp);
      }

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
        visibleTiles: new Set<string>(),
        rememberedMap: new Map<string, { char: string; fg: string; bg: string }>(),
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

        // Relic: ComboRing - track combo and multiply damage on every 3rd hit
        if (hasRelic(player, RelicId.ComboRing)) {
          if (!player.comboAttackCount) player.comboAttackCount = 0;
          player.comboAttackCount++;
          if (player.comboAttackCount % 3 === 0) {
            finalDamage = Math.floor(finalDamage * 1.5);
            addMessages([msg('💍 连击！第三击伤害×1.5！', MessageCategory.Combat, '#ffcc44')]);
          }
        }

        // Relic status procs (poisonGland/frostTouch/thunderMark, each 15% independent)
        const procs = rollRelicStatusProcs(player, rng);
        for (const procStatus of procs) {
          const duration = procStatus === StatusEffectType.Freeze ? 2 : 3;
          const dmg = procStatus === StatusEffectType.Poison ? 2 : 0;
          enemy.statusEffects = [...enemy.statusEffects, { type: procStatus, duration, damage: dmg }];
          const statusName = procStatus === StatusEffectType.Poison ? '中毒' : procStatus === StatusEffectType.Freeze ? '冻结' : '混乱';
          addMessages([msg(`遗物效果！${enemy.name}${statusName}！`, MessageCategory.Combat, '#aa44ff')]);
        }

        // Relic: Apply ATK modifier from relics
        const atkModifier = getRelicAtkModifier(player);
        if (atkModifier !== 0) {
          finalDamage = Math.floor(finalDamage * (1 + atkModifier));
        }

        // Calculate new HP first
        const newHp = enemy.hp - finalDamage;

        // Check for elemental chain reaction
        if (weaponElement !== Element.None && newHp > 0) {
          const targetElements = getEnemyElementDebuffs(enemy);
          const reaction = checkChainReactionWithMap(
            weaponElement, targetElements, state.map, enemy.pos, state.turn, state.steamVentTurns
          );
          if (reaction) {
            const attackerAtk = getEffectiveStats(player).str;
            const chainResult = executeChainReaction(reaction, attackerAtk, enemy.pos, state.map, state.enemies, player, rng);
            let chainDamage = chainResult.damage;

            // Chaos core: double chain damage, but player takes 25% (reduced by defense)
            if (hasRelic(player, RelicId.ChaosCore)) {
              chainDamage *= 2;
              const rawSelfDmg = Math.floor(chainDamage * 0.25);
              const playerDef = getPlayerDefense(player);
              const selfDmg = Math.max(1, Math.floor(rawSelfDmg * 20 / (20 + playerDef)));
              player.hp -= selfDmg;
              addFloatingText(player.pos.x, player.pos.y, `-${selfDmg}`, '#ff8844', 'damage');
              addMessages([msg(`☄️ 混沌核心反噬！受到${selfDmg}点连锁伤害！`, MessageCategory.Combat, '#ff4444')]);
            }

            // Apply chain damage to affected enemies
            for (const pos of chainResult.affectedPositions) {
              const affectedEnemy = state.enemies.find(e => e.hp > 0 && e.pos.x === pos.x && e.pos.y === pos.y);
              if (affectedEnemy) {
                affectedEnemy.hp -= chainDamage;
                // Add floating text for chain reaction
                addFloatingText(pos.x, pos.y, `${chainDamage}`, '#ffff00', 'damage');
              }
            }

            // Screen shake for chain reaction
            set({ screenShake: { intensity: 10, createdAt: performance.now() } });

            // Apply status effects
            for (const se of chainResult.statusEffects) {
              const target = state.enemies.find(e => e.hp > 0 && e.pos.x === se.pos.x && e.pos.y === se.pos.y);
              if (target) {
                target.statusEffects = [...target.statusEffects, { type: se.type, duration: se.duration, damage: se.damage }];
              }
            }

            // Apply map changes
            if (chainResult.mapChanges.length > 0) {
              const newMap = state.map.map(row => row.map(t => ({ ...t })));
              const biome = getBiomeForFloor(state.currentFloor);
              for (const mc of chainResult.mapChanges) {
                if (mc.pos.y >= 0 && mc.pos.y < newMap.length && mc.pos.x >= 0 && mc.pos.x < newMap[0].length) {
                  newMap[mc.pos.y][mc.pos.x] = createTile(mc.toType, biome);
                }
              }
              set({ map: newMap });
            }

            addMessages([msg(chainResult.message, MessageCategory.Combat, '#ffcc44')]);
            AudioManager.playSFX('chainReaction');

            // FateWeaver: random buff on chain trigger (max 3 times per floor)
            if (hasRelic(player, RelicId.FateWeaver) && (player._fateWeaverCount ?? 0) < 3) {
              const buffs = [
                { stat: 'str', name: '力量' },
                { stat: 'dex', name: '灵巧' },
                { stat: 'int', name: '智慧' },
              ];
              const buff = rng.pick(buffs);
              player.bonusStats = { ...player.bonusStats, [buff.stat]: player.bonusStats[buff.stat as keyof typeof player.bonusStats] + 3 };
              player._fateWeaverCount = (player._fateWeaverCount ?? 0) + 1;
              addMessages([msg(`🕸️ 命运编织者赐予${buff.name}+3！`, MessageCategory.Item, '#aa44ff')]);
            }
          }
        }

        const updatedHp = enemy.hp - finalDamage;
        const enemies = state.enemies.map(e => {
          if (e.id !== enemy.id) return e;
          const updated = { ...e, hp: updatedHp, statusEffects: [...enemy.statusEffects] };
          // Activate dormant enemies when hit
          if (e.specialAbility === 'dormant') {
            updated.fg = '#cc4444';
            updated.specialAbility = undefined;
          }
          return updated;
        });

        // Add floating text for damage
        const damageText = result.critical ? `${finalDamage}!` : `${finalDamage}`;
        const damageColor = result.critical ? '#ffd700' : '#44ff44'; // Gold for crit, green for normal
        addFloatingText(enemy.pos.x, enemy.pos.y, damageText, damageColor, result.critical ? 'crit' : 'damage');

        // Screen shake on crit
        if (result.critical) {
          set({ screenShake: { intensity: 6, createdAt: performance.now() } });
        }

        // Screen shake on boss hit
        if (enemy.isBoss) {
          set({ screenShake: { intensity: 8, createdAt: performance.now() } });
        }

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
          addFloatingText(player.pos.x, player.pos.y, `-${reflectDmg}`, '#ff88ff', 'status');
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
                AudioManager.playSFX('bossPhase');

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

          // LifeSeed: first kill per floor heals 5% maxHp
          if (hasRelic(player, RelicId.LifeSeed) && !player._lifeSeedUsedThisFloor) {
            player._lifeSeedUsedThisFloor = true;
            const heal = Math.floor(player.maxHp * 0.05);
            player.hp = Math.min(player.maxHp, player.hp + heal);
            messages.push(msg(`🌱 生命种子回复了${heal}HP！`, MessageCategory.Item, '#44cc44'));
          }

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

            // 迷雾散去提示
            messages.push(msg('深渊迷雾缓缓散去，前路已然明晰……', MessageCategory.Story, '#88ccff'));

            // Trigger boss blessing selection
            set({ bossBlessingPending: true, lastBossDefId: enemy.defId });

            // Boss relic drop
            const bossRelicId = rollRandomRelic(player, rng, { common: 0, rare: 0.5, epic: 0.5 });
            player.relics = [...player.relics, bossRelicId];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg(`✦ Boss掉落遗物：${RELIC_DEFS[bossRelicId].icon} ${RELIC_DEFS[bossRelicId].name}`, MessageCategory.Item, '#ffcc44'));
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

          // Elite relic drop
          if (enemy.isElite) {
            const dropChance = hasRelic(player, RelicId.LuckyCoin) ? 1.0 : 0.2;
            if (rng.chance(dropChance)) {
              const relicId = rollRandomRelic(player, rng, { common: 0.2, rare: 0.8, epic: 0 });
              player.relics = [...player.relics, relicId];
              AudioManager.playSFX('relicAcquire');
              messages.push(msg(`✦ 精英掉落遗物：${RELIC_DEFS[relicId].icon} ${RELIC_DEFS[relicId].name}`, MessageCategory.Item, '#ffcc44'));
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
                      attackRange: enemy.attackRange ?? 1,
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
              addFloatingText(player.pos.x, player.pos.y, '-15', '#ff44ff', 'damage');
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
        // Open the secret wall: make it transparent so FOV reveals the hidden room
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], transparent: true };
        // Flood-fill reveal all connected HiddenFloor tiles (the whole hidden room)
        const toReveal: Position[] = [{ x: nx, y: ny }];
        const visited = new Set<string>();
        while (toReveal.length > 0) {
          const p = toReveal.pop()!;
          const key = `${p.x},${p.y}`;
          if (visited.has(key)) continue;
          visited.add(key);
          for (const [ddx, ddy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
            const ax = p.x + ddx;
            const ay = p.y + ddy;
            if (ay >= 0 && ay < newMap.length && ax >= 0 && ax < newMap[0].length) {
              if (newMap[ay][ax].type === TileType.HiddenFloor && !visited.has(`${ax},${ay}`)) {
                newMap[ay][ax] = { ...newMap[ay][ax], transparent: true };
                toReveal.push({ x: ax, y: ay });
              }
            }
          }
        }
        // EchoHeart relic: full heal on entering hidden room
        if (player.relics.includes(RelicId.EchoHeart)) {
          player.hp = player.maxHp;
          player.mp = player.maxMp;
          addMessages([msg('回响之心闪耀，HP/MP全回复！', MessageCategory.Item, '#cc88ff')]);
        }
        player.pos = { x: nx, y: ny };
        addMessages([msg('你穿过了一道暗墙！', MessageCategory.System, '#aa88aa')]);
        AudioManager.playSFX('door');
        set({ player, map: newMap });
        processTurn();
        return;
      }

      // GoldPile: Pick up gold (20-80 based on floor depth)
      if (tile.type === TileType.GoldPile) {
        const goldAmount = Math.floor(20 + Math.sqrt(state.currentFloor) * 15 + rng.nextInt(0, 20));
        player.gold += goldAmount;
        player.pos = { x: nx, y: ny };
        addMessages([msg(`你拾取了${goldAmount}枚金币！`, MessageCategory.Item, '#ffcc44')]);
        AudioManager.playSFX('coin');
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.HiddenFloor, char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: true };
        set({ player, map: newMap });
        processTurn();
        return;
      }

      // MagicSpring: Full heal + temporary defense buff
      if (tile.type === TileType.MagicSpring) {
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 10, damage: 5 }];
        player.pos = { x: nx, y: ny };
        addMessages([msg('魔法泉！HP/MP全回复，防御+5持续10回合！', MessageCategory.Item, '#44ccff')]);
        AudioManager.playSFX('magicSpring');
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.HiddenFloor, char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: true };
        set({ player, map: newMap });
        processTurn();
        return;
      }

      // HiddenAltar: Permanent stat +1 or relic
      if (tile.type === TileType.HiddenAltar) {
        player.pos = { x: nx, y: ny };
        if (rng.next() < 0.6) {
          const stat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
          const statName = stat === 'str' ? '力量' : stat === 'dex' ? '灵巧' : stat === 'int' ? '智慧' : '活力';
          player.bonusStats = { ...player.bonusStats, [stat]: player.bonusStats[stat] + 1 };
          addMessages([msg(`祭坛赐福！${statName}永久+1！`, MessageCategory.Item, '#cc88ff')]);
          AudioManager.playSFX('relicAcquire');
        } else {
          const commonRelics = RELICS_BY_RARITY[RelicRarity.Common];
          const availableRelics = commonRelics.filter(r => !player.relics.includes(r));
          if (availableRelics.length > 0) {
            const relicId = rng.pick(availableRelics) as RelicId;
            player.relics = [...player.relics, relicId];
            addMessages([msg(`祭坛赐予你${RELIC_DEFS[relicId].name}！`, MessageCategory.Item, '#cc88ff')]);
            AudioManager.playSFX('relicAcquire');
          } else {
            const stat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
            const statName = stat === 'str' ? '力量' : stat === 'dex' ? '灵巧' : stat === 'int' ? '智慧' : '活力';
            player.bonusStats = { ...player.bonusStats, [stat]: player.bonusStats[stat] + 1 };
            addMessages([msg(`祭坛赐福！${statName}永久+1！`, MessageCategory.Item, '#cc88ff')]);
            AudioManager.playSFX('relicAcquire');
          }
        }
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.HiddenFloor, char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: true };
        set({ player, map: newMap });
        processTurn();
        return;
      }

      // LibraryShelf: Gain extra scroll + 10% chance talent point
      if (tile.type === TileType.LibraryShelf) {
        player.pos = { x: nx, y: ny };
        const scroll = createScroll(rng.nextInt(0, 8));
        if (player.inventory.length < getMaxInventorySize(player)) {
          player.inventory = [...player.inventory, scroll];
          addMessages([msg(`从书架上取下了一卷${scroll.identified ? scroll.name : scroll.unidentifiedName ?? '卷轴'}！`, MessageCategory.Item, '#ccaa66')]);
        } else {
          addMessages([msg('书架上有一卷卷轴，但你的背包已满！', MessageCategory.Item, '#ccaa66')]);
        }
        if (rng.chance(0.1)) {
          player.statPoints = (player.statPoints ?? 0) + 1;
          addMessages([msg('古老的知识涌入脑海！获得1个额外属性点！', MessageCategory.Item, '#ffcc44')]);
        }
        AudioManager.playSFX('pickup');
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.HiddenFloor, char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: true };
        set({ player, map: newMap });
        processTurn();
        return;
      }

      // VoidRiftRoom: Exclusive relic (60%) or teleport away (40%)
      if (tile.type === TileType.VoidRiftRoom) {
        player.pos = { x: nx, y: ny };
        if (rng.next() < 0.6) {
          const exclusiveRelics: RelicId[] = [RelicId.DarkVision, RelicId.EchoHeart, RelicId.AbyssWhisper];
          const availableRelics = exclusiveRelics.filter(r => !player.relics.includes(r));
          if (availableRelics.length > 0) {
            const weightedRelics: RelicId[] = [];
            for (const r of availableRelics) {
              weightedRelics.push(r);
              if (RELIC_DEFS[r].rarity === RelicRarity.Rare) weightedRelics.push(r);
            }
            const relicId = rng.pick(weightedRelics);
            player.relics = [...player.relics, relicId];
            addMessages([msg(`虚空裂隙中，你获得了${RELIC_DEFS[relicId].name}！`, MessageCategory.Item, '#cc44ff')]);
            AudioManager.playSFX('voidRift');
            AudioManager.playSFX('relicAcquire');
          } else {
            player.hp = player.maxHp;
            player.mp = player.maxMp;
            addMessages([msg('虚空裂隙的能量涌入全身！HP/MP全回复！', MessageCategory.Item, '#cc44ff')]);
            AudioManager.playSFX('magicSpring');
          }
        } else {
          const walkablePositions: Position[] = [];
          for (let y = 0; y < state.map.length; y++) {
            for (let x = 0; x < state.map[0].length; x++) {
              if (state.map[y][x].walkable && !(x === player.pos.x && y === player.pos.y)) {
                walkablePositions.push({ x, y });
              }
            }
          }
          if (walkablePositions.length > 0) {
            player.pos = rng.pick(walkablePositions);
            addMessages([msg('虚空裂隙将你传送到了别处！', MessageCategory.Environment, '#cc44ff')]);
          } else {
            addMessages([msg('虚空裂隙震动了一下，但什么也没发生...', MessageCategory.Environment, '#cc44ff')]);
          }
          AudioManager.playSFX('voidRift');
        }
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.HiddenFloor, char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: true };
        set({ player, map: newMap });
        updateFOV();
        return;
      }

      // FungiPatch: walkable but poisons
      if (tile.type === TileType.FungiPatch) {
        player.pos = { x: nx, y: ny };
        if (!player.statusEffects.some(e => e.type === StatusEffectType.Poison)) {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Poison, duration: 4, damage: 3 }];
          addMessages([msg('踩到了毒菌丛！你中毒了！', MessageCategory.Environment, '#44cc44')]);
          AudioManager.playSFX('trap');
        }
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
          AudioManager.playSFX('bump');
          addMessages([msg('你破坏了木栏！', MessageCategory.System, '#aa8844')]);
          return;
        }
        // EliteDoor (精英门): Open on interaction
        if (tile.type === TileType.EliteDoor) {
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.DoorOpen, char: '░', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true };
          set({ map: newMap });
          addMessages([msg('你推开了铁门。前方传来强大的气息…', MessageCategory.System, '#ffd700')]);
          AudioManager.playSFX('ironDoor');
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

        // Throne (♔): Boss throne — show flavor text
        if (tile.type === TileType.Throne) {
          const boss = state.enemies.find(e => e.isBoss && e.hp > 0);
          if (boss) {
            addMessages([msg('王座散发着不祥的气息，Boss 还在！', MessageCategory.System, '#ffd700')]);
          } else {
            addMessages([msg('空荡的王座沉默地矗立着…', MessageCategory.System, '#888866')]);
          }
          AudioManager.playSFX('bump');
          return;
        }

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
            addFloatingText(player.pos.x, player.pos.y, `-${trapDmg}`, '#ff4444', 'damage');
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
        // HiddenSarcophagus: High-quality loot + elite guard spawn
        if (tile.type === TileType.HiddenSarcophagus) {
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.HiddenFloor, char: '·', fg: '#9977cc', bg: '#1a0a2a', walkable: true, transparent: true };
          addMessages([msg('你打开了古墓石棺！', MessageCategory.Environment, '#aa8866')]);
          AudioManager.playSFX('door');
          const luckBonus = state.currentFloor < 10 ? 5 : state.currentFloor < 20 ? 8 : 12;
          const loot = createRandomItem(state.currentFloor, rng, false, luckBonus, 0);
          let updatedItems = [...state.items, { item: loot, pos: { x: nx, y: ny } }];
          const guardDirs = [[1,0],[-1,0],[0,1],[0,-1]];
          let guardsSpawned = 0;
          const maxGuards = state.currentFloor < 10 ? 1 : 2;
          let updatedEnemies = [...state.enemies];
          const enemyIdsList = BIOME_CONFIG[getBiomeForFloor(state.currentFloor)].enemyIds ?? ['skeleton'];
          for (const [gdx, gdy] of guardDirs) {
            if (guardsSpawned >= maxGuards) break;
            const gx = nx + gdx;
            const gy = ny + gdy;
            if (gy >= 0 && gy < state.map.length && gx >= 0 && gx < state.map[0].length && state.map[gy][gx].walkable) {
              const defId = rng.pick(enemyIdsList);
              const affixValues = Object.values(EliteAffix);
              const affix = rng.pick(affixValues) as EliteAffix;
              const guard = createEliteEnemy(defId, { x: gx, y: gy }, state.currentFloor, affix);
              if (guard) {
                guard.name = '古墓守卫';
                if (state.currentFloor >= 21) {
                  guard.hp = Math.floor(guard.hp * 1.5);
                  guard.maxHp = guard.hp;
                }
                updatedEnemies.push(guard);
                guardsSpawned++;
              }
            }
          }
          if (guardsSpawned > 0) {
            AudioManager.playSFX('bossAppear');
          }
          set({ map: newMap, items: updatedItems, enemies: updatedEnemies });
          return;
        }
        // Wall bump — no special interaction, just blocked
        AudioManager.playSFX('bump');
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
        addFloatingText(player.pos.x, player.pos.y, `-${lavaDmg}`, '#ff6600', 'status');
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
          tile.type === TileType.TrapTeleport || tile.type === TileType.TrapPoison ||
          tile.type === TileType.TrapParalysis || tile.type === TileType.TrapConfusion ||
          tile.type === TileType.TrapBlind || tile.type === TileType.TrapAlarm) {
        const typeMap: Record<string, string> = {
          [TileType.TrapSpike]: 'spike',
          [TileType.TrapFire]: 'fire',
          [TileType.TrapTeleport]: 'teleport',
          [TileType.TrapPoison]: 'poison',
          [TileType.TrapParalysis]: 'paralysis',
          [TileType.TrapConfusion]: 'confusion',
          [TileType.TrapBlind]: 'blind',
          [TileType.TrapAlarm]: 'alarm',
        };
        const trapEffect = getTrapEffect(typeMap[tile.type] || 'spike');
        const hasFireResist = tile.type === TileType.TrapFire && player.statusEffects.some(e => e.type === StatusEffectType.FireResist);
        const trapDmg = hasFireResist ? Math.floor(trapEffect.damage / 3) : trapEffect.damage;

        // Iron Will: immune to paralysis and confusion trap effects
        const hasIronWill = player.talents.includes('ironWill');

        player.hp -= trapDmg;
        if (trapDmg > 0) addFloatingText(player.pos.x, player.pos.y, `-${trapDmg}`, '#ff4444', 'damage');
        if (trapEffect.statusEffect) {
          // Iron Will blocks Freeze (paralysis) and Confusion from traps
          if (hasIronWill && (trapEffect.statusEffect.type === StatusEffectType.Freeze ||
                              trapEffect.statusEffect.type === StatusEffectType.Confusion)) {
            addMessages([msg('铁壁意志抵御了陷阱效果！', MessageCategory.System, '#ffcc44')]);
          } else {
            player.statusEffects = [...player.statusEffects, trapEffect.statusEffect];
          }
        }
        addMessages([msg(trapEffect.message, MessageCategory.Environment, '#ff4444')]);
        flashScreen('#ff000033');

        // Play type-specific SFX
        if (tile.type === TileType.TrapParalysis) {
          AudioManager.playSFX('paralyze');
        } else if (tile.type === TileType.TrapConfusion) {
          AudioManager.playSFX('confuse');
        } else if (tile.type === TileType.TrapBlind) {
          AudioManager.playSFX('blind');
        } else if (tile.type === TileType.TrapAlarm) {
          AudioManager.playSFX('alarm');
        } else {
          AudioManager.playSFX('trap');
        }

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

        // Alarm trap: spawn 2 enemies nearby
        if (tile.type === TileType.TrapAlarm) {
          const rng2 = new SeededRandom(state.seed + state.turn * 7);
          const biome = getBiomeForFloor(state.currentFloor);
          const config = BIOME_CONFIG[biome];
          const enemyPool = config.enemyIds;
          if (enemyPool.length > 0) {
            const spawned: Enemy[] = [];
            for (let i = 0; i < 2; i++) {
              const defId = rng2.pick(enemyPool);
              const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:-1,dy:-1},{dx:1,dy:-1},{dx:-1,dy:1}];
              const shuffled = dirs.sort(() => rng2.next() - 0.5);
              for (const d of shuffled) {
                const nx = player.pos.x + d.dx;
                const ny = player.pos.y + d.dy;
                if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && state.map[ny]?.[nx]?.walkable) {
                  const enemy = createEnemy(defId, { x: nx, y: ny }, false, state.currentFloor);
                  if (enemy) { spawned.push(enemy); break; }
                }
              }
            }
            if (spawned.length > 0) {
              const newEnemies = [...state.enemies, ...spawned];
              set({ enemies: newEnemies });
              addMessages([msg(`警报吸引了${spawned.length}个敌人！`, MessageCategory.Combat, '#ff4444')]);
            }
          }
        }

        // Blind trap: rebuild FOV immediately
        if (tile.type === TileType.TrapBlind && !hasIronWill) {
          set({ player });
          updateFOV();
        } else {
          set({ player });
        }
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
        player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 8, damage: 3 }];
        set({ player });
        addMessages([msg('祭坛的力量涌遍全身！防御+3持续8回合！', MessageCategory.System, '#88ccff')]);
        AudioManager.playSFX('relicAcquire');
      }

      // Fountain: Heal 50% HP + 20 MP (one-time use)
      if (tile.type === TileType.Fountain) {
        const hpHeal = Math.floor(player.maxHp * 0.5);
        player.hp = Math.min(player.maxHp, player.hp + hpHeal);
        player.mp = Math.min(player.maxMp, player.mp + 20);
        addFloatingText(player.pos.x, player.pos.y, `+${hpHeal}`, '#87ceeb', 'heal');
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '·', fg: '#335577', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap, player });
        addMessages([msg('治愈泉的泉水恢复了你的力量！', MessageCategory.Item, '#44aaff')]);
        AudioManager.playSFX('magicSpring');
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
        const stat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
        const statName = stat === 'str' ? '力量' : stat === 'dex' ? '灵巧' : stat === 'int' ? '智慧' : '活力';
        player.bonusStats = {
          ...player.bonusStats,
          [stat]: player.bonusStats[stat] + 1,
        };
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '·', fg: '#aaaaaa', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap, player });
        addMessages([msg(`碑文的力量融入了你的身体！${statName}+1！`, MessageCategory.System, '#ffcc44')]);
        AudioManager.playSFX('relicAcquire');
      }

      // HealCrystal: Heal 30% HP (one-time use)
      if (tile.type === TileType.HealCrystal) {
        const hpHeal = Math.floor(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + hpHeal);
        addFloatingText(player.pos.x, player.pos.y, `+${hpHeal}`, '#87ceeb', 'heal');
        const newMap = state.map.map(row => row.map(t => ({ ...t })));
        newMap[ny][nx] = { ...newMap[ny][nx], type: TileType.Floor, char: '·', fg: '#005533', bg: 'transparent', walkable: true, transparent: true };
        set({ map: newMap, player });
        addMessages([msg(`治愈水晶碎裂，回复了${hpHeal}点HP！`, MessageCategory.Item, '#44cc44')]);
        AudioManager.playSFX('heal');
      }

      // CorruptionPool: Already handled by periodic effect
      // VoidRift: Already handled by periodic effect

      // Monument: Show boss memorial
      if (tile.type === TileType.Monument) {
        addMessages([msg('纪念碑上刻着已逝Boss的名字。', MessageCategory.Story, '#ffd700')]);
      }

      // Forge: Enhancement UI
      if (tile.type === TileType.Forge) {
        // Check if any equipment can be enhanced
        const slots = Object.values(EquipmentSlot);
        let canEnhance = false;
        for (const slot of slots) {
          const item = player.equipment[slot];
          if (item && 'enhanceLevel' in item && ((item as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0) < 3) {
            canEnhance = true;
            break;
          }
        }
        if (canEnhance) {
          set({ pendingForge: true, phase: GamePhase.Inventory });
          const forgeMsg = state.currentFloor >= 21
            ? '虚空锻造台：费用减半，但有10%概率被诅咒！'
            : '你可以在这里强化装备。费用根据强化等级而定。';
          addMessages([msg(forgeMsg, MessageCategory.System, '#ffcc44')]);
          AudioManager.playSFX('ironDoor');
        } else {
          addMessages([msg('你没有可强化的装备。', MessageCategory.System, '#888888')]);
        }
      }

      // WeaponRack: Free random weapon
      if (tile.type === TileType.WeaponRack) {
        const newWeapon = createRandomItem(state.currentFloor, rng, false) as WeaponItem;
        if (newWeapon && newWeapon.type === ItemType.Weapon) {
          const floorItem: FloorItem = { item: newWeapon, pos: { x: nx, y: ny } };
          // Convert tile to Floor after use
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          const biome = getBiomeForFloor(state.currentFloor);
          newMap[ny][nx] = createTile(TileType.Floor, biome);
          set({ items: [...state.items, floorItem], map: newMap });
          addMessages([msg(`武器架上有一件${getItemName(newWeapon)}！`, MessageCategory.Item, '#ffcc44')]);
          AudioManager.playSFX('pickup');
        } else {
          // Fallback: create a basic weapon
          const basicWeapon: WeaponItem = {
            id: genId(),
            type: ItemType.Weapon,
            name: '普通铁剑',
            char: '/',
            fg: '#aaaaaa',
            description: '一把普通的铁剑',
            rarity: Rarity.Common,
            damage: Math.floor(state.currentFloor * 1.5) + 3,
            element: Element.None,
            identified: true,
            cursed: false,
            value: 10,
          };
          const floorItem: FloorItem = { item: basicWeapon, pos: { x: nx, y: ny } };
          const newMap = state.map.map(row => row.map(t => ({ ...t })));
          const biome = getBiomeForFloor(state.currentFloor);
          newMap[ny][nx] = createTile(TileType.Floor, biome);
          set({ items: [...state.items, floorItem], map: newMap });
          addMessages([msg('武器架上有一把旧剑！', MessageCategory.Item, '#ccaa88')]);
        }
      }

      // SpikeTrap: Deal damage to player (scales with floor)
      if (tile.type === TileType.SpikeTrap) {
        const trapDmg = 5 + Math.floor(state.currentFloor * 0.5);
        player.hp -= trapDmg;
        addFloatingText(player.pos.x, player.pos.y, `-${trapDmg}`, '#ff4444', 'damage');
        addMessages([msg(`尖刺陷阱！受到${trapDmg}点伤害！`, MessageCategory.Combat, '#ff4444')]);
        flashScreen('#ff000033');
        AudioManager.playSFX('hit');
      }

      // Check if enemies are on spike traps
      const enemies = state.enemies.map(e => {
      if (e.hp > 0) {
        const tile = state.map[e.pos.y]?.[e.pos.x];
        if (tile && tile.type === TileType.SpikeTrap) {
          const trapDmg = 5 + Math.floor(state.currentFloor * 0.5);
          return { ...e, hp: Math.max(0, e.hp - trapDmg) };
        }
      }
      return e;
    });
    if (enemies.some(e => e.hp <= 0)) {
      // Enemy died from spike trap
      const deadEnemies = enemies.filter(e => e.hp <= 0);
      for (const dead of deadEnemies) {
        const original = state.enemies.find(e => e.id === dead.id);
        if (original && original.hp > 0) {
          const exp = getTalentModifiedExp(player, original.exp);
          const goldDrop = getTalentModifiedGoldDrop(player, original.goldDrop);
          player.exp += exp;
          player.killCount++;
          player.gold += goldDrop;
          addMessages([msg(`${dead.name}踩中尖刺陷阱死亡！获得 ${exp} 经验，${goldDrop} 金币`, MessageCategory.Combat, '#44cc44')]);
          if (original.isBoss) {
            player.bossKillCount++;
            // Place monument at boss position (if boss died to trap)
            const bossPos = original.pos;
            if (bossPos.y >= 0 && bossPos.y < state.map.length && bossPos.x >= 0 && bossPos.x < state.map[0].length) {
              const newMap = state.map.map(row => row.map(t => ({ ...t })));
              newMap[bossPos.y][bossPos.x] = { type: TileType.Monument, char: '☥', fg: '#ffd700', bg: 'transparent', walkable: true, transparent: true, visible: false, remembered: false };
              set({ map: newMap });
              set({ bossBlessingPending: true, lastBossDefId: original.defId });
            }
          }
        }
      }
      set({ player, enemies });
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
              addFloatingText(player.pos.x, player.pos.y, `+${potion.power}`, '#87ceeb', 'heal');
              break;
            case PotionEffect.ManaRestore:
              player.mp = Math.min(player.maxMp, player.mp + potion.power);
              messages.push(msg(`你恢复了 ${potion.power} 点魔力`, MessageCategory.Item, '#4488ff'));
              AudioManager.playSFX('heal');
              break;
            case PotionEffect.Strength:
              player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + potion.power };
              messages.push(msg(`力量永久提升 ${potion.power}！`, MessageCategory.Item, '#ff8844'));
              AudioManager.playSFX('relicAcquire');
              break;
            case PotionEffect.Dexterity:
              player.bonusStats = { ...player.bonusStats, dex: player.bonusStats.dex + potion.power };
              messages.push(msg(`灵巧永久提升 ${potion.power}！`, MessageCategory.Item, '#44cc44'));
              AudioManager.playSFX('relicAcquire');
              break;
            case PotionEffect.Intelligence:
              player.bonusStats = { ...player.bonusStats, int: player.bonusStats.int + potion.power };
              messages.push(msg(`智慧永久提升 ${potion.power}！`, MessageCategory.Item, '#4488ff'));
              AudioManager.playSFX('relicAcquire');
              break;
            case PotionEffect.Poison:
              player.hp -= potion.power;
              addFloatingText(player.pos.x, player.pos.y, `-${potion.power}`, '#44cc44', 'damage');
              messages.push(msg(`糟糕！这瓶药水有毒！受到 ${potion.power} 点伤害`, MessageCategory.Item, '#ff4444'));
              AudioManager.playSFX('trap');
              break;
            case PotionEffect.Paralysis:
              if (player.talents.includes('ironWill')) {
                messages.push(msg('铁壁意志抵御了麻痹效果！', MessageCategory.System, '#ffcc44'));
              } else {
                player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Freeze, duration: potion.power, damage: 0 }];
                messages.push(msg('你被麻痹了！', MessageCategory.Item, '#ff4444'));
                AudioManager.playSFX('trap');
              }
              break;
            case PotionEffect.Confusion:
              if (player.talents.includes('ironWill')) {
                messages.push(msg('铁壁意志抵御了混乱效果！', MessageCategory.System, '#ffcc44'));
              } else {
                player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Confusion, duration: potion.power, damage: 0 }];
                messages.push(msg('你感到头晕目眩，方向感全无！', MessageCategory.Item, '#cccc44'));
                AudioManager.playSFX('trap');
              }
              break;
            case PotionEffect.FullHeal:
              const healed = player.maxHp - player.hp;
              player.hp = player.maxHp;
              player.mp = player.maxMp;
              if (healed > 0) addFloatingText(player.pos.x, player.pos.y, `+${healed}`, '#ffcc44', 'heal');
              messages.push(msg('你感觉焕然一新！所有伤势痊愈！', MessageCategory.Item, '#ffcc44'));
              AudioManager.playSFX('heal');
              break;
            case PotionEffect.FireResist:
              player.statusEffects = [...player.statusEffects, { type: StatusEffectType.FireResist, duration: 5, damage: 0 }];
              messages.push(msg('你获得了火焰抗性！(5回合)', MessageCategory.Item, '#ff6622'));
              AudioManager.playSFX('relicAcquire');
              break;
          }

          player.inventory = player.inventory.filter((_, i) => i !== index);
          break;
        }
        case ItemType.Scroll: {
          const scroll = item as ScrollItem;
          AudioManager.playSFX('skill');
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
                  addFloatingText(e.pos.x, e.pos.y, `-${power}`, '#ff6600', 'damage');
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
                  addFloatingText(e.pos.x, e.pos.y, `-${power}`, '#44aaff', 'damage');
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
                addFloatingText(closest.pos.x, closest.pos.y, `-${power}`, '#cccc44', 'damage');
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
            case ScrollEffect.Detection: {
              // Reveal all traps on current floor
              const TRAP_REVEAL: Record<string, { char: string; fg: string }> = {
                [TileType.TrapSpike]: { char: '▲', fg: '#aaaacc' },
                [TileType.TrapFire]: { char: '▲', fg: '#ff8844' },
                [TileType.TrapTeleport]: { char: '▲', fg: '#aa66ff' },
                [TileType.TrapPoison]: { char: '▲', fg: '#44cc44' },
                [TileType.TrapParalysis]: { char: '▲', fg: '#ccccff' },
                [TileType.TrapConfusion]: { char: '▲', fg: '#cccc44' },
                [TileType.TrapBlind]: { char: '▲', fg: '#666666' },
                [TileType.TrapAlarm]: { char: '▲', fg: '#ff4444' },
              };
              const newMap = state.map.map(row => row.map(t => ({ ...t })));
              const remembered = new Map(get().rememberedMap);
              let trapCount = 0;
              for (let y = 0; y < state.height; y++) {
                for (let x = 0; x < state.width; x++) {
                  const reveal = TRAP_REVEAL[newMap[y][x].type];
                  if (reveal && !newMap[y][x].trapRevealed) {
                    newMap[y][x].char = reveal.char;
                    newMap[y][x].fg = reveal.fg;
                    newMap[y][x].trapRevealed = true;
                    remembered.set(`${x},${y}`, { char: reveal.char, fg: reveal.fg, bg: newMap[y][x].bg });
                    trapCount++;
                  }
                }
              }
              set({ map: newMap, rememberedMap: remembered });
              if (trapCount > 0) {
                messages.push(msg(`感知卷轴揭示了${trapCount}个隐藏陷阱！`, MessageCategory.Item, '#88ff88'));
              } else {
                messages.push(msg('感知卷轴没有发现任何陷阱。', MessageCategory.Item, '#88ff88'));
              }
              AudioManager.playSFX('magicSpring');
              break;
            }
          }

          player.inventory = player.inventory.filter((_, i) => i !== index);
          break;
        }
        case ItemType.Food: {
          const food = item as FoodItem;
          player.hunger = player.hunger + food.nutrition;
          messages.push(msg(`你吃了${food.name}，恢复了 ${food.nutrition} 饱食度`, MessageCategory.Item, '#ccaa66'));
          AudioManager.playSFX('heal');
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
      AudioManager.playSFX('pickup');
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
      AudioManager.playSFX('bump');
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

      // Boss floor lock: cannot descend while Boss is alive
      const bossFloor = [5, 10, 15, 20, 25, 30].includes(state.currentFloor);
      if (bossFloor) {
        const bossAlive = state.enemies.some(e => e.hp > 0 && e.isBoss);
        if (bossAlive) {
          // Extreme danger escape: HP ≤ 20% or starving with no food
          const criticallyEndangered = state.player.hp <= Math.floor(state.player.maxHp * 0.2) ||
            (state.player.hunger <= 0 && !state.player.inventory.some(i => i.type === ItemType.Food));
          if (criticallyEndangered) {
            // Allow escape with deserter penalty
            state.player.deserter = true;
            addMessages([
              msg('你逃离了Boss的追杀...', MessageCategory.Story, '#ff4444'),
              msg('逃亡者的诅咒降临：升级所需经验+50%', MessageCategory.System, '#ff6644'),
            ]);
          } else {
            addMessages([msg('深渊迷雾遮蔽了前路……击败本层主宰方可驱散', MessageCategory.System, '#ff4444')]);
            return;
          }
        }
      }

      const nextFloor = state.currentFloor + 1;
      addMessages([msg(`你沿着楼梯向下深入...`, MessageCategory.Story, '#ffcc44')]);
      AudioManager.playSFX('portalWarp');
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
      AudioManager.playSFX('relicAcquire');
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
      AudioManager.playSFX('relicAcquire');
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
      AudioManager.playSFX('levelup');
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
      AudioManager.playSFX('relicAcquire');
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

      // Pre-validate target requirements before consuming MP/CD
      // Skills that require a target: shieldBash (adjacent), fireball (LOS+range), chainLightning (LOS+range), shadowStep (range), fanOfKnives (radius)
      // Self/targetless skills: warCry, iceShield, whirlwind (hits all adjacent), poisonBlade
      const tempEnemies = state.enemies.map(e => ({ ...e }));
      if (skill.id === 'shieldBash') {
        if (!tempEnemies.some(e => e.hp > 0 && distance(player.pos, e.pos) <= 1.5)) {
          addMessages([msg('周围没有敌人！', MessageCategory.System, '#888888')]);
          return;
        }
      } else if (skill.id === 'fireball') {
        if (!tempEnemies.some(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range && hasLineOfSight(state.map, player.pos, e.pos))) {
          addMessages([msg('范围内没有敌人！', MessageCategory.System, '#888888')]);
          return;
        }
      } else if (skill.id === 'chainLightning') {
        if (!tempEnemies.some(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range && hasLineOfSight(state.map, player.pos, e.pos))) {
          addMessages([msg('范围内没有敌人！', MessageCategory.System, '#888888')]);
          return;
        }
      } else if (skill.id === 'shadowStep') {
        if (!tempEnemies.some(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range)) {
          addMessages([msg('范围内没有敌人！', MessageCategory.System, '#888888')]);
          return;
        }
      } else if (skill.id === 'fanOfKnives') {
        if (!tempEnemies.some(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.radius)) {
          addMessages([msg('范围内没有敌人！', MessageCategory.System, '#888888')]);
          return;
        }
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
          const adjacent = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= 1.5);
          if (adjacent.length > 0) {
            const target = adjacent[0];
            target.statusEffects = [...target.statusEffects, { type: StatusEffectType.Freeze, duration: 2, damage: 0 }];
            let bashDmg = Math.floor(getEffectiveStats(player).str * 0.5);
            const critted = rng.chance(skillCritChance);
            if (critted) bashDmg = Math.floor(bashDmg * skillCritMult);
            target.hp -= bashDmg;
            addFloatingText(target.pos.x, target.pos.y, `-${bashDmg}`, critted ? '#ffd700' : '#ff8844', critted ? 'crit' : 'damage');
            enemies = enemies.map(e => e.id === target.id ? target : e);
            messages.push(msg(critted ? `暴击！盾击！${target.name}被击退并眩晕！造成 ${bashDmg} 点伤害` : `盾击！${target.name}被击退并眩晕！造成 ${bashDmg} 点伤害`, MessageCategory.Combat, critted ? '#ffcc44' : '#ff8844'));
          } else {
            messages.push(msg('附近没有敌人！', MessageCategory.System, '#888888'));
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
          let whirlDmg = Math.floor(weaponDmg * 2.0 + getEffectiveStats(player).str * 0.5);
          const whirlCrit = rng.chance(skillCritChance);
          if (whirlCrit) whirlDmg = Math.floor(whirlDmg * skillCritMult);
          let hitCount = 0;
          const whirlHitIds = new Set<string>();
          enemies = enemies.map(e => {
            if (e.hp > 0 && distance(player.pos, e.pos) <= 1.5) {
              hitCount++;
              whirlHitIds.add(e.id);
              addFloatingText(e.pos.x, e.pos.y, `-${whirlDmg}`, whirlCrit ? '#ffd700' : '#ff4444', whirlCrit ? 'crit' : 'damage');
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
          const target = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range && hasLineOfSight(state.map, player.pos, e.pos))
            .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos))[0];
          if (target) {
            let rawDmg = skill.power + Math.floor(getEffectiveStats(player).int * 0.5);
            const fbCrit = rng.chance(skillCritChance);
            if (fbCrit) rawDmg = Math.floor(rawDmg * skillCritMult);
            const hasSpellPen = player.talents.includes('spellPenetration');
            const fbHitIds = new Set<string>();
            let totalDmg = 0;
            enemies = enemies.map(e => {
              if (e.hp > 0 && distance(target.pos, e.pos) <= skill.radius) {
                fbHitIds.add(e.id);
                const effectiveDef = hasSpellPen ? Math.floor(e.defense * 0.5) : e.defense;
                const dmg = Math.max(1, Math.floor(rawDmg * 20 / (20 + effectiveDef)));
                totalDmg += dmg;
                addFloatingText(e.pos.x, e.pos.y, `-${dmg}`, fbCrit ? '#ffd700' : '#ff6600', fbCrit ? 'crit' : 'damage');
                return { ...e, hp: e.hp - dmg };
              }
              return e;
            });
            messages.push(msg(fbCrit ? `暴击！火球术！造成 ${totalDmg} 点火焰伤害！` : `火球术！造成 ${totalDmg} 点火焰伤害！`, MessageCategory.Combat, fbCrit ? '#ffcc44' : '#ff6644'));
            for (const e of enemies.filter(e2 => e2.hp <= 0 && fbHitIds.has(e2.id))) {
              player.exp += getTalentModifiedExp(player, e.exp); player.killCount++; if (e.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
            }
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
          const targets = enemies.filter(e => e.hp > 0 && distance(player.pos, e.pos) <= skill.range && hasLineOfSight(state.map, player.pos, e.pos))
            .sort((a, b) => distance(player.pos, a.pos) - distance(player.pos, b.pos))
            .slice(0, 3);
          if (targets.length > 0) {
            let rawDmg = skill.power + Math.floor(getEffectiveStats(player).int * 0.3);
            const clCrit = rng.chance(skillCritChance);
            if (clCrit) rawDmg = Math.floor(rawDmg * skillCritMult);
            const hasSpellPen = player.talents.includes('spellPenetration');
            const hitIds = new Set(targets.map(t => t.id));
            let totalDmg = 0;
            enemies = enemies.map(e => {
              if (hitIds.has(e.id)) {
                const effectiveDef = hasSpellPen ? Math.floor(e.defense * 0.5) : e.defense;
                const dmg = Math.max(1, Math.floor(rawDmg * 20 / (20 + effectiveDef)));
                totalDmg += dmg;
                addFloatingText(e.pos.x, e.pos.y, `-${dmg}`, clCrit ? '#ffd700' : '#cccc44', clCrit ? 'crit' : 'damage');
                return { ...e, hp: e.hp - dmg };
              }
              return e;
            });
            messages.push(msg(clCrit ? `暴击！闪电链！击中 ${targets.length} 个敌人，共造成 ${totalDmg} 点伤害！` : `闪电链！击中 ${targets.length} 个敌人，共造成 ${totalDmg} 点伤害！`, MessageCategory.Combat, clCrit ? '#ffcc44' : '#cccc44'));
            for (const e of enemies.filter(e2 => e2.hp <= 0 && hitIds.has(e2.id))) {
              player.exp += getTalentModifiedExp(player, e.exp); player.killCount++; if (e.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, e.goldDrop);
            }
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
              addFloatingText(target.pos.x, target.pos.y, `-${critDmg}`, '#8844ff', 'crit');
              messages.push(msg(`暗影步！瞬移到${target.name}身边，暴击造成 ${critDmg} 点伤害！`, MessageCategory.Combat, '#8844ff'));
              if (target.hp - critDmg <= 0) {
                player.exp += getTalentModifiedExp(player, target.exp); player.killCount++; if (target.isBoss) player.bossKillCount++; player.gold += getTalentModifiedGoldDrop(player, target.goldDrop);
              }
            } else {
              messages.push(msg('无法瞬移到目标身边！', MessageCategory.System, '#888888'));
              player.mp += skill.mpCost; player.skillCooldowns[skillIndex] = 0;
            }
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
              addFloatingText(e.pos.x, e.pos.y, `-${dmg}`, fokCrit ? '#ffd700' : '#aaaaaa', fokCrit ? 'crit' : 'damage');
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = state.currentEvent as any;
      const choiceList = event.choices || event.options || [];
      const choice = choiceList[choiceIndex];
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
            player.hunger = player.hunger + 50;
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
                player.gold += Math.floor(40 * (1 + getRelicGoldModifier(player)));
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
            player.gold += Math.floor(15 * (1 + getRelicGoldModifier(player)));
            messages.push(msg('你帮助了旅人，他给了你15金币作为报酬！', MessageCategory.Item, '#ffcc44'));
          } else {
            messages.push(msg('你没有食物可以给他...', MessageCategory.System, '#888888'));
          }
          break;
        }
        case 'traveler_rob':
          player.gold += Math.floor(8 * (1 + getRelicGoldModifier(player)));
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
            addFloatingText(player.pos.x, player.pos.y, '-15', '#ff4444', 'damage');
            messages.push(msg('宝箱是个陷阱！受到15点伤害！', MessageCategory.Combat, '#ff4444'));
          } else {
            const loot = createRandomItem(state.currentFloor, rng, false);
            if (loot.rarity !== Rarity.Common) {
              player.inventory = [...player.inventory, loot];
              messages.push(msg(`宝箱中有${getItemName(loot)}！`, MessageCategory.Item, '#ffcc44'));
            } else {
              player.gold += Math.floor(10 * (1 + getRelicGoldModifier(player)));
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

        // === Abyss Merchant ===
        case 'abyssMerchant_buyRelic': {
          if (player.gold >= 200) {
            player.gold -= 200;
            const relicId = rollRandomRelic(player, rng, { common: 0, rare: 1, epic: 0 });
            player.relics = [...player.relics, relicId];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg(`花费200金获得了遗物：${RELIC_DEFS[relicId].icon} ${RELIC_DEFS[relicId].name}！`, MessageCategory.Item, '#ffcc44'));
          } else {
            messages.push(msg('金币不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'abyssMerchant_tradeHpForEpic': {
          const hpCost = Math.floor(player.hp * 0.3);
          if (player.hp > hpCost) {
            player.hp -= hpCost;
            const item = createRandomItem(state.currentFloor, rng, false, 0);
            if (item.rarity === Rarity.Common || item.rarity === Rarity.Good) {
              // Force rare+ quality
              const forcedItem = createRandomItem(state.currentFloor, rng, false, 0);
              player.inventory = [...player.inventory, forcedItem];
              messages.push(msg(`献祭了${hpCost}HP，获得了${getItemName(forcedItem)}！`, MessageCategory.Item, '#ffcc44'));
            } else {
              player.inventory = [...player.inventory, item];
              messages.push(msg(`献祭了${hpCost}HP，获得了${getItemName(item)}！`, MessageCategory.Item, '#ffcc44'));
            }
          } else {
            messages.push(msg('HP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'abyssMerchant_enhanceForMp': {
          const mpCost = Math.floor(player.maxMp * 0.5);
          if (player.mp >= mpCost) {
            player.mp -= mpCost;
            // Enhance one equipped weapon to +2
            const weapon = player.equipment[EquipmentSlot.Weapon] as WeaponItem | null;
            if (weapon && (weapon.enhanceLevel ?? 0) < 2) {
              const enhanced = { ...weapon, enhanceLevel: 2 as 0|1|2|3, damage: Math.floor(weapon.damage * 1.2) };
              player.equipment = { ...player.equipment, [EquipmentSlot.Weapon]: enhanced };
              messages.push(msg(`献祭了${mpCost}MP，武器强化至+2！`, MessageCategory.Item, '#4488ff'));
            } else {
              messages.push(msg('没有可强化的武器！', MessageCategory.System, '#ff4444'));
            }
          } else {
            messages.push(msg('MP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }

        // === Soul Furnace ===
        case 'soulFurnace_equipForRelic': {
          const equippable = Object.values(player.equipment).filter((e): e is Item => e !== null);
          if (equippable.length > 0) {
            const sacrificed = rng.pick(equippable);
            const slot = Object.keys(player.equipment).find(s => player.equipment[s as EquipmentSlot]?.id === sacrificed.id);
            if (slot) {
              player.equipment = { ...player.equipment, [slot]: null };
              player.gold += Math.floor(sacrificed.value * 0.5);
              const relicId = rollRandomRelic(player, rng, { common: 0.3, rare: 0.6, epic: 0.1 });
              player.relics = [...player.relics, relicId];
              AudioManager.playSFX('relicAcquire');
              messages.push(msg(`投入了${getItemName(sacrificed)}，获得了遗物：${RELIC_DEFS[relicId].icon} ${RELIC_DEFS[relicId].name}！`, MessageCategory.Item, '#ffcc44'));
            }
          } else {
            messages.push(msg('没有可献祭的装备！', MessageCategory.System, '#888888'));
          }
          break;
        }
        case 'soulFurnace_hpForAtk': {
          const hpCost = Math.floor(player.maxHp * 0.3);
          if (player.hp > hpCost) {
            player.hp -= hpCost;
            const buffs = player._permanentBuffsThisRun ?? 0;
            if (buffs < 6) {
              player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + 2 };
              player._permanentBuffsThisRun = buffs + 1;
              messages.push(msg(`献祭了${hpCost}HP，力量永久+2！`, MessageCategory.Item, '#ff8844'));
            } else {
              player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 10, damage: 5 }];
              messages.push(msg(`献祭了${hpCost}HP，获得10回合防御+5！（永久增益已达上限）`, MessageCategory.Item, '#ff8844'));
            }
          } else {
            messages.push(msg('HP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'soulFurnace_mpForMaxMp': {
          if (player.mp > 0) {
            player.mp = 0;
            player.maxMp += 10;
            messages.push(msg('献祭了所有MP，最大MP永久+10！', MessageCategory.Item, '#4488ff'));
          } else {
            messages.push(msg('MP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }

        // === Cursed Chest ===
        case 'cursedChest_open': {
          const item = createRandomItem(state.currentFloor, rng, false, 0);
          // Force rare+ quality
          player.inventory = [...player.inventory, item];
          // Random debuff
          const debuffs = [StatusEffectType.Poison, StatusEffectType.Burn, StatusEffectType.Bleed, StatusEffectType.Confusion];
          const debuff = rng.pick(debuffs);
          player.statusEffects = [...player.statusEffects, { type: debuff, duration: 3, damage: 2 }];
          const debuffName = debuff === StatusEffectType.Poison ? '中毒' : debuff === StatusEffectType.Burn ? '燃烧' : debuff === StatusEffectType.Bleed ? '流血' : '混乱';
          messages.push(msg(`获得了${getItemName(item)}，但受到了${debuffName}！`, MessageCategory.Item, '#ffcc44'));
          break;
        }
        case 'cursedChest_breakRune': {
          // Already checked INT condition in EventModal
          const item = createRandomItem(state.currentFloor, rng, false, 0);
          player.inventory = [...player.inventory, item];
          // Halved debuff
          const debuffs = [StatusEffectType.Poison, StatusEffectType.Burn];
          const debuff = rng.pick(debuffs);
          player.statusEffects = [...player.statusEffects, { type: debuff, duration: 1, damage: 1 }];
          messages.push(msg(`破坏了符文！获得了${getItemName(item)}，仅有轻微副作用！`, MessageCategory.Item, '#44cc44'));
          break;
        }

        // === Fate Crossroad ===
        case 'fateCrossroad_element': {
          const elementRelics = [RelicId.PoisonGland, RelicId.FlameHeart, RelicId.FrostTouch, RelicId.ThunderMark];
          const available = elementRelics.filter(r => !player.relics.includes(r));
          if (available.length > 0) {
            const relicId = rng.pick(available);
            player.relics = [...player.relics, relicId];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg(`元素之路！获得遗物：${RELIC_DEFS[relicId].icon} ${RELIC_DEFS[relicId].name}`, MessageCategory.Item, '#ffcc44'));
          }
          // Also give element weapon
          const weapon = createRandomItem(state.currentFloor, rng, false) as WeaponItem;
          if (weapon.type === ItemType.Weapon) {
            player.inventory = [...player.inventory, weapon];
            messages.push(msg(`获得了${getItemName(weapon)}！`, MessageCategory.Item, '#4488ff'));
          }
          break;
        }
        case 'fateCrossroad_power': {
          const buffs = player._permanentBuffsThisRun ?? 0;
          if (buffs < 6) {
            player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + 5, dex: player.bonusStats.dex - 2 };
            player._permanentBuffsThisRun = buffs + 1;
            messages.push(msg('力量之路！STR+5，DEX-2！', MessageCategory.Item, '#ff8844'));
          } else {
            player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 10, damage: 8 }];
            messages.push(msg('力量之路！获得10回合ATK+8！（永久增益已达上限）', MessageCategory.Item, '#ff8844'));
          }
          break;
        }
        case 'fateCrossroad_wisdom': {
          player.bonusStats = { ...player.bonusStats, int: player.bonusStats.int + 3 };
          player.mp = Math.min(player.maxMp, player.mp + 20);
          messages.push(msg('智慧之路！INT+3，MP+20！', MessageCategory.Item, '#4488ff'));
          break;
        }

        // === Mystery Rune ===
        case 'mysteryRune_fire': {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.FireResist, duration: 5, damage: 0 }];
          // Set 3x3 area on fire (convert floor tiles around event position)
          messages.push(msg('火符文激活！获得5回合火焰免疫，周围起火！', MessageCategory.Item, '#ff6622'));
          break;
        }
        case 'mysteryRune_ice': {
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 5, damage: 5 }];
          messages.push(msg('冰符文激活！获得5回合防御+5，周围结冰！', MessageCategory.Item, '#44aaff'));
          break;
        }
        case 'mysteryRune_both': {
          player.statusEffects = [...player.statusEffects,
            { type: StatusEffectType.FireResist, duration: 5, damage: 0 },
            { type: StatusEffectType.DefenseUp, duration: 5, damage: 5 }];
          if (!player.relics.includes(RelicId.ElementResonance)) {
            player.relics = [...player.relics, RelicId.ElementResonance];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg('双重符文！获得元素共鸣遗物！', MessageCategory.Item, '#aa44ff'));
          }
          break;
        }

        // === Rift Heart ===
        case 'riftHeart_accept': {
          if (!player.relics.includes(RelicId.VoidHeart)) {
            player.relics = [...player.relics, RelicId.VoidHeart];
            AudioManager.playSFX('relicAcquire');
            const hpLoss = Math.floor(player.maxHp * 0.15);
            player.maxHp -= hpLoss;
            player.hp = Math.min(player.hp, player.maxHp);
            messages.push(msg(`接受了虚空！获得虚空之心遗物，最大HP-${hpLoss}！`, MessageCategory.Item, '#aa44ff'));
          }
          break;
        }
        case 'riftHeart_refuse': {
          const heal = Math.floor(player.maxHp * 0.3);
          player.hp = Math.min(player.maxHp, player.hp + heal);
          player.gold += 50;
          messages.push(msg(`拒绝了虚空，回复${heal}HP，获得50金！`, MessageCategory.Item, '#44cc44'));
          break;
        }
        case 'riftHeart_master': {
          if (!player.relics.includes(RelicId.VoidHeart)) {
            player.relics = [...player.relics, RelicId.VoidHeart];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg('驾驭了虚空！获得虚空之心遗物！', MessageCategory.Item, '#ffcc44'));
          }
          break;
        }

        // === Abyss Gamble ===
        case 'abyssGamble_big': {
          if (player.gold >= 100) {
            player.gold -= 100;
            if (rng.chance(0.6)) {
              player.gold += 300;
              const relicId = rollRandomRelic(player, rng, { common: 0.5, rare: 0.5, epic: 0 });
              player.relics = [...player.relics, relicId];
              AudioManager.playSFX('relicAcquire');
              messages.push(msg(`赢了！获得300金和遗物${RELIC_DEFS[relicId].icon}！`, MessageCategory.Item, '#ffcc44'));
            } else {
              messages.push(msg('输了！100金币打了水漂…', MessageCategory.System, '#ff4444'));
            }
          } else {
            messages.push(msg('金币不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'abyssGamble_hp': {
          if (player.hp > Math.floor(player.maxHp * 0.3)) {
            if (rng.chance(0.5)) {
              player.hp = player.maxHp;
              player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 5, damage: 10 }];
              messages.push(msg('赢了！满血+防御提升5回合！', MessageCategory.Item, '#44cc44'));
            } else {
              player.hp = 1;
              messages.push(msg('输了！HP降至1！', MessageCategory.Combat, '#ff4444'));
            }
          } else {
            messages.push(msg('HP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'abyssGamble_allIn': {
          if (player.gold >= 500) {
            if (rng.chance(0.4)) {
              player.relics = [...player.relics, RelicId.ChaosCore];
              AudioManager.playSFX('relicAcquire');
              messages.push(msg('🎉 大赢！获得混沌核心遗物！', MessageCategory.Item, '#ffcc44'));
            } else {
              player.gold = Math.floor(player.gold / 2);
              const debuffs = [StatusEffectType.Poison, StatusEffectType.Burn];
              player.statusEffects = [...player.statusEffects, { type: rng.pick(debuffs), duration: 3, damage: 2 }];
              messages.push(msg('输了！失去一半金币+debuff！', MessageCategory.Combat, '#ff4444'));
            }
          } else {
            messages.push(msg('金币不足500！', MessageCategory.System, '#ff4444'));
          }
          break;
        }

        // === Unstable Portal ===
        case 'unstablePortal_enter': {
          // Teleport to random themed room + get relic
          if (state.themedRooms && state.themedRooms.length > 0) {
            const themedRoom = rng.pick(state.themedRooms);
            player.pos = { x: themedRoom.room.centerX, y: themedRoom.room.centerY };
            const config = THEMED_ROOM_CONFIGS[themedRoom.theme];
            const relicId = rollRandomRelic(player, rng, config.relicRarityWeights, config.elementAffinity);
            player.relics = [...player.relics, relicId];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg(`传送至${config.nameZh}！获得遗物${RELIC_DEFS[relicId].icon}！`, MessageCategory.Item, '#cc44ff'));
          } else {
            messages.push(msg('传送门无法连接…', MessageCategory.System, '#888888'));
          }
          break;
        }
        case 'unstablePortal_destroy': {
          player.gold += 50;
          const item = createRandomItem(state.currentFloor, rng, false);
          player.inventory = [...player.inventory, item];
          messages.push(msg(`破坏了传送门，获得50金和${getItemName(item)}！`, MessageCategory.Item, '#ffcc44'));
          break;
        }
        case 'unstablePortal_stabilize': {
          // Already checked MP condition in EventModal
          player.mp -= 30;
          // Give rare+ item
          const item = createRandomItem(state.currentFloor, rng, false, 2);
          player.inventory = [...player.inventory, item];
          messages.push(msg(`稳定传送门，发现了隐藏宝物：${getItemName(item)}！`, MessageCategory.Item, '#ffcc44'));
          break;
        }

        // === Blood Altar ===
        case 'bloodAltar_hp': {
          const hpCost = Math.floor(player.maxHp * 0.2);
          if (player.hp > hpCost) {
            player.hp -= hpCost;
            player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + 3 };
            messages.push(msg(`献祭了${hpCost}HP，力量永久+3！`, MessageCategory.Item, '#ff4444'));
            AudioManager.playSFX('relicAcquire');
          } else {
            messages.push(msg('HP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'bloodAltar_mp': {
          if (player.mp > 0) {
            player.mp = 0;
            player.bonusStats = { ...player.bonusStats, int: player.bonusStats.int + 3 };
            messages.push(msg('献祭了所有MP，智慧永久+3！', MessageCategory.Item, '#4488ff'));
            AudioManager.playSFX('relicAcquire');
          } else {
            messages.push(msg('MP不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'bloodAltar_relic': {
          if (player.relics.length >= 2) {
            const removed = rng.pick(player.relics);
            player.relics = player.relics.filter(r => r !== removed);
            if (player.relics.length > 0) {
              messages.push(msg(`献祭了${RELIC_DEFS[removed].name}，剩余遗物效果+50%本层！`, MessageCategory.Item, '#aa44ff'));
            }
          } else {
            messages.push(msg('遗物不足！需要至少2个遗物！', MessageCategory.System, '#ff4444'));
          }
          break;
        }

        // === Ancient Mural ===
        case 'ancientMural_study': {
          const buffs = player._permanentBuffsThisRun ?? 0;
          if (buffs < 6) {
            player.bonusStats = { ...player.bonusStats, str: player.bonusStats.str + 1, dex: player.bonusStats.dex + 1, int: player.bonusStats.int + 1, vit: player.bonusStats.vit + 1 };
            player._permanentBuffsThisRun = buffs + 1;
            messages.push(msg('仔细研究壁画，全属性+1！但壁画守卫出现了！', MessageCategory.Item, '#ffcc44'));
          } else {
            player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 8, damage: 5 }];
            messages.push(msg('仔细研究壁画，获得8回合防御+5！（永久增益已达上限）', MessageCategory.Item, '#ffcc44'));
          }
          // Spawn 2 elite mural guards near player
          const biome = getBiomeForFloor(state.currentFloor);
          const enemyIds = BIOME_CONFIG[biome]?.enemyIds ?? ['skeleton'];
          const affixes = [EliteAffix.Armored, EliteAffix.Frenzy, EliteAffix.Regen, EliteAffix.Vampiric, EliteAffix.Explosive, EliteAffix.Phantom];
          const spawnDirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]];
          let spawned = 0;
          for (const [dx, dy] of spawnDirs) {
            if (spawned >= 2) break;
            const sx = player.pos.x + dx;
            const sy = player.pos.y + dy;
            if (sy >= 0 && sy < state.map.length && sx >= 0 && sx < state.map[0].length && state.map[sy][sx].walkable) {
              const defId = rng.pick(enemyIds);
              const affix = rng.pick(affixes);
              const guard = createEliteEnemy(defId, { x: sx, y: sy }, state.currentFloor, affix);
              if (guard) {
                guard.name = `壁画守卫`;
                state.enemies = [...state.enemies, guard];
                spawned++;
              }
            }
          }
          if (spawned > 0) {
            set({ enemies: state.enemies });
            AudioManager.playSFX('bossAppear');
          }
          break;
        }
        case 'ancientMural_copy': {
          const buffs = player._permanentBuffsThisRun ?? 0;
          const stat = rng.pick(['str', 'dex', 'int', 'vit'] as const);
          const statName = stat === 'str' ? '力量' : stat === 'dex' ? '灵巧' : stat === 'int' ? '智慧' : '活力';
          if (buffs < 6) {
            player.bonusStats = { ...player.bonusStats, [stat]: player.bonusStats[stat] + 1 };
            player._permanentBuffsThisRun = buffs + 1;
            messages.push(msg(`临摹壁画，${statName}永久+1！`, MessageCategory.Item, '#ffcc44'));
          } else {
            player.statusEffects = [...player.statusEffects, { type: StatusEffectType.DefenseUp, duration: 8, damage: 3 }];
            messages.push(msg(`临摹壁画，获得8回合防御+3！（永久增益已达上限）`, MessageCategory.Item, '#ffcc44'));
          }
          break;
        }

        // === Lost Traveler ===
        case 'lostTraveler_help': {
          const foodItem = player.inventory.find(i => i.type === ItemType.Food || i.type === ItemType.Potion);
          if (foodItem) {
            player.inventory = player.inventory.filter(i => i.id !== foodItem.id);
            // Reveal a secret wall
            const secretWalls = state.secretWalls;
            if (secretWalls.length > 0) {
              const revealed = rng.pick(secretWalls);
              messages.push(msg(`帮助了旅人！他告诉你附近有暗墙(${revealed.x},${revealed.y})！`, MessageCategory.Item, '#44cc44'));
            } else {
              messages.push(msg('帮助了旅人，但他没有更多信息…', MessageCategory.Item, '#44cc44'));
            }
          } else {
            messages.push(msg('没有食物或药水可以给他！', MessageCategory.System, '#888888'));
          }
          break;
        }
        case 'lostTraveler_rob': {
          const gold = rng.nextInt(100, 200);
          player.gold += gold;
          player.statusEffects = [...player.statusEffects, { type: StatusEffectType.Bleed, duration: 3, damage: 3 }];
          messages.push(msg(`抢劫了${gold}金，但内疚感让你心神不宁…`, MessageCategory.Item, '#aa8844'));
          break;
        }
        case 'lostTraveler_talk': {
          const secretWalls = state.secretWalls;
          if (secretWalls.length > 0) {
            const revealed = rng.pick(secretWalls);
            messages.push(msg(`交谈后，旅人告诉你暗墙位置(${revealed.x},${revealed.y})，并透露了关于下层的线索…`, MessageCategory.Item, '#4488ff'));
          } else {
            messages.push(msg('旅人告诉你关于下层的线索…', MessageCategory.Item, '#4488ff'));
          }
          break;
        }

        // === Echo Well ===
        case 'echoWell_listen': {
          // Hint about next floor
          const nextFloor = state.currentFloor + 1;
          const nextBiome = getBiomeForFloor(nextFloor);
          const biomeName = nextBiome === 'stoneDungeon' ? '石窟' : nextBiome === 'crystalCavern' ? '水晶洞' : nextBiome === 'ancientCrypt' ? '古墓' : nextBiome === 'lavaCore' ? '熔岩' : '虚空';
          messages.push(msg(`井中回声：下一层是${biomeName}…`, MessageCategory.Story, '#aa44ff'));
          const debuffs = [StatusEffectType.Poison, StatusEffectType.Burn, StatusEffectType.Confusion];
          player.statusEffects = [...player.statusEffects, { type: rng.pick(debuffs), duration: 2, damage: 1 }];
          break;
        }
        case 'echoWell_gold': {
          if (player.gold >= 100) {
            player.gold -= 100;
            player.statusEffects = player.statusEffects.filter(e =>
              e.type !== StatusEffectType.Poison && e.type !== StatusEffectType.Burn &&
              e.type !== StatusEffectType.Freeze && e.type !== StatusEffectType.Bleed &&
              e.type !== StatusEffectType.Confusion
            );
            messages.push(msg('投入100金，所有debuff被净化！', MessageCategory.Item, '#44cc44'));
          } else {
            messages.push(msg('金币不足！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
        case 'echoWell_relic': {
          if (player.relics.length >= 3) {
            const removed = rng.pick(player.relics);
            player.relics = player.relics.filter(r => r !== removed);
            const r1 = rollRandomRelic(player, rng, { common: 0.3, rare: 0.5, epic: 0.2 });
            player.relics = [...player.relics, r1];
            const r2 = rollRandomRelic(player, rng, { common: 0.3, rare: 0.5, epic: 0.2 });
            player.relics = [...player.relics, r2];
            AudioManager.playSFX('relicAcquire');
            messages.push(msg(`献祭了${RELIC_DEFS[removed].name}，获得${RELIC_DEFS[r1].name}和${RELIC_DEFS[r2].name}！`, MessageCategory.Item, '#ffcc44'));
          } else {
            messages.push(msg('遗物不足3个！', MessageCategory.System, '#ff4444'));
          }
          break;
        }
      }

      set({ player, currentEvent: null, phase: GamePhase.Playing });
      addMessages(messages);
      AudioManager.playSFX('relicAcquire');
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
      AudioManager.playSFX('relicAcquire');
      set({ player, bossBlessingPending, lastBossDefId });
      updateFOV();
    },

    enhanceEquipment: (slot: EquipmentSlot) => {
      const state = get();
      if (!state.player || !state.pendingForge) return;
      if (state.phase !== GamePhase.Inventory) return;

      const player = { ...state.player };
      const item = player.equipment[slot];
      if (!item || !('enhanceLevel' in item)) {
        addMessages([msg('该装备无法强化', MessageCategory.System, '#ff4444')]);
        set({ pendingForge: false, phase: GamePhase.Playing });
        return;
      }

      const enhanceLevel = (item as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0;
      if (enhanceLevel >= 3) {
        addMessages([msg('该装备已达到最大强化等级', MessageCategory.System, '#ff4444')]);
        set({ pendingForge: false, phase: GamePhase.Playing });
        return;
      }

      const baseCost = ENHANCE_COSTS[enhanceLevel];
      const costModifier = getRelicForgeCostModifier(player);
      const cost = Math.floor(baseCost * costModifier);

      // VoidForge (floor >= 21) → half price but 10% curse risk
      const isVoidForge = state.currentFloor >= 21;
      const finalCost = isVoidForge ? Math.floor(cost / 2) : cost;

      if (player.gold < finalCost) {
        addMessages([msg(`金币不足！需要 ${finalCost} 金币`, MessageCategory.System, '#ff4444')]);
        return;
      }

      const rng = new SeededRandom(state.seed + state.turn * 29);
      const successRate = ENHANCE_SUCCESS_RATES[enhanceLevel];
      const success = rng.next() < successRate;

      player.gold -= finalCost;

      if (success) {
        const newLevel = (enhanceLevel + 1) as 0 | 1 | 2 | 3;
        const enhanced = { ...item, enhanceLevel: newLevel } as WeaponItem | ArmorItem | RingItem | AmuletItem;
        if (enhanced.type === ItemType.Weapon) {
          enhanced.damage = Math.floor(enhanced.damage * ENHANCE_ATK_MULT[enhanceLevel]);
        } else if (enhanced.type === ItemType.Armor) {
          enhanced.defense = Math.floor(enhanced.defense * ENHANCE_DEF_MULT[enhanceLevel]);
        }

        // VoidForge success: 10% chance to curse item (with warning)
        if (state.currentFloor >= 21 && rng.chance(0.1)) {
          enhanced.cursed = true;
          enhanced.name = `诅咒${enhanced.name.replace('诅咒', '')}`;
          addMessages([msg('虚空之力诅咒了你的装备！', MessageCategory.Combat, '#8844ff')]);
        }

        // LavaForge (floor 16-20) success: add Fire element StatusProc if no special effect
        if (state.currentFloor >= 16 && state.currentFloor <= 20 && !enhanced.specialEffect) {
          enhanced.specialEffect = EquipmentEffect.StatusProc;
          if (enhanced.type === ItemType.Weapon) {
            enhanced.element = Element.Fire;
          }
          addMessages([msg('熔岩之火为你的武器注入了火焰之力！', MessageCategory.Item, '#ff6644')]);
        }

        player.equipment = { ...player.equipment, [slot]: enhanced };
        addMessages([msg(`强化成功！${getItemName(enhanced)} 升级到 +${enhanceLevel + 1}`, MessageCategory.Item, '#44cc44')]);
        AudioManager.playSFX('enhanceSuccess');
        AudioManager.playSFX('levelup');
      } else {
        addMessages([msg(`强化失败！花费了 ${finalCost} 金币`, MessageCategory.Item, '#ff4444')]);
        AudioManager.playSFX('enhanceFail');
      }

      set({ player, pendingForge: false, phase: GamePhase.Playing });
    },

    enhanceInventoryItem: (index: number) => {
      const state = get();
      if (!state.player || !state.pendingForge) return;
      if (state.phase !== GamePhase.Inventory) return;

      const player = { ...state.player };
      const item = player.inventory[index];
      if (!item || !('enhanceLevel' in item)) {
        addMessages([msg('该物品无法强化', MessageCategory.System, '#ff4444')]);
        return;
      }

      const enhanceLevel = (item as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0;
      if (enhanceLevel >= 3) {
        addMessages([msg('该物品已达到最大强化等级', MessageCategory.System, '#ff4444')]);
        return;
      }

      const baseCost = ENHANCE_COSTS[enhanceLevel];
      const costModifier = getRelicForgeCostModifier(player);
      const cost = Math.floor(baseCost * costModifier);
      const isVoidForge = state.currentFloor >= 21;
      const finalCost = isVoidForge ? Math.floor(cost / 2) : cost;

      if (player.gold < finalCost) {
        addMessages([msg(`金币不足！需要 ${finalCost} 金币`, MessageCategory.System, '#ff4444')]);
        return;
      }

      const rng = new SeededRandom(state.seed + state.turn * 31);
      const successRate = ENHANCE_SUCCESS_RATES[enhanceLevel];
      const success = rng.next() < successRate;

      player.gold -= finalCost;

      if (success) {
        const newLevel = (enhanceLevel + 1) as 0 | 1 | 2 | 3;
        const enhanced = { ...item, enhanceLevel: newLevel } as WeaponItem | ArmorItem | RingItem | AmuletItem;
        if (enhanced.type === ItemType.Weapon) {
          enhanced.damage = Math.floor(enhanced.damage * ENHANCE_ATK_MULT[enhanceLevel]);
        } else if (enhanced.type === ItemType.Armor) {
          enhanced.defense = Math.floor(enhanced.defense * ENHANCE_DEF_MULT[enhanceLevel]);
        }
        if (state.currentFloor >= 21 && rng.chance(0.1)) {
          enhanced.cursed = true;
          enhanced.name = `诅咒${enhanced.name.replace('诅咒', '')}`;
          addMessages([msg('虚空之力诅咒了你的装备！', MessageCategory.Combat, '#8844ff')]);
        }
        if (state.currentFloor >= 16 && state.currentFloor <= 20 && !enhanced.specialEffect) {
          enhanced.specialEffect = EquipmentEffect.StatusProc;
          if (enhanced.type === ItemType.Weapon) {
            enhanced.element = Element.Fire;
          }
          addMessages([msg('熔岩之火为你的武器注入了火焰之力！', MessageCategory.Item, '#ff6644')]);
        }
        player.inventory = player.inventory.map((inv, i) => i === index ? enhanced : inv);
        addMessages([msg(`强化成功！${getItemName(enhanced)} 升级到 +${enhanceLevel + 1}`, MessageCategory.Item, '#44cc44')]);
        AudioManager.playSFX('enhanceSuccess');
        AudioManager.playSFX('levelup');
      } else {
        addMessages([msg(`强化失败！花费了 ${finalCost} 金币`, MessageCategory.Item, '#ff4444')]);
        AudioManager.playSFX('enhanceFail');
      }

      set({ player, pendingForge: false, phase: GamePhase.Playing });
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
          relics: loadedState.player.relics ?? [],
          comboAttackCount: loadedState.player.comboAttackCount ?? 0,
          voidHeartUsed: loadedState.player.voidHeartUsed ?? false,
          extraTurnAccumulator: loadedState.player.extraTurnAccumulator ?? 0,
          _mirrorShieldUsed: loadedState.player._mirrorShieldUsed ?? false,
          _lifeSeedUsedThisFloor: loadedState.player._lifeSeedUsedThisFloor ?? false,
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
        themedRooms: loadedState.themedRooms ?? [],
        steamVentTurns: loadedState.steamVentTurns ?? [],
        pendingForge: loadedState.pendingForge ?? false,
        floatingTexts: [],
        screenShake: null,
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
