// ============================================================
// Main simulation runner — orchestrates AI gameplay tests
// ============================================================

import { setupBrowserMocks } from './mock-browser.js';
setupBrowserMocks();

import { useGameStore } from '../src/store/gameStore.js';
import { CharacterClass, TileType, GamePhase, ItemType, BossBlessing, EquipmentSlot } from '../src/types/index.js';
import { SeededRandom } from '../src/utils/random.js';
import { decideAction, type AIAction, resetVisitedPositions, markEquipFailed } from './ai-player.js';
import { type RunResult, type FloorSnapshot, type BugReport, computeClassSummary, formatReport } from './statistics.js';

// ============================================================
// Config
// ============================================================
const MAX_FLOOR = 30;
const RUNS_PER_CLASS = 5;
const MAX_TURNS_PER_FLOOR = 500;
const CLASSES: CharacterClass[] = ['warrior', 'mage', 'rogue'];
const BOSS_FLOORS = [5, 10, 15, 20, 25, 30];

// ============================================================
// State validation — runtime bug detection
// ============================================================

interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  detail: string;
  turn?: number;
  floor?: number;
}

function validateState(state: any, turnOnFloor: number, currentFloor: number, phaseTurns: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const p = state.player;

  // 1. NaN / Infinity detection on player stats
  if (p) {
    const numericFields = [
      ['hp', p.hp], ['maxHp', p.maxHp], ['mp', p.mp], ['maxMp', p.maxMp],
      ['gold', p.gold], ['hunger', p.hunger], ['maxHunger', p.maxHunger],
      ['level', p.level], ['exp', p.exp], ['expToNext', p.expToNext],
      ['killCount', p.killCount], ['bossKillCount', p.bossKillCount],
      ['visionRadius', p.visionRadius],
      ['stats.str', p.stats?.str], ['stats.dex', p.stats?.dex],
      ['stats.int', p.stats?.int], ['stats.vit', p.stats?.vit],
      ['bonusStats.str', p.bonusStats?.str], ['bonusStats.dex', p.bonusStats?.dex],
      ['bonusStats.int', p.bonusStats?.int], ['bonusStats.vit', p.bonusStats?.vit],
    ];
    for (const [name, val] of numericFields) {
      if (val !== undefined && val !== null && (typeof val !== 'number' || !Number.isFinite(val))) {
        issues.push({
          severity: 'critical',
          category: 'NaN/Infinity',
          detail: `player.${name} = ${String(val)} (${typeof val})`,
          turn: turnOnFloor,
          floor: currentFloor,
        });
      }
    }

    // 2. Negative HP overflow (significantly below 0 suggests damage calc bug)
    if (typeof p.hp === 'number' && p.hp < -50) {
      issues.push({
        severity: 'critical',
        category: 'HP溢出',
        detail: `player.hp = ${p.hp} (大幅低于0，伤害计算可能溢出)`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }

    // 3. HP > maxHp without valid reason
    if (typeof p.hp === 'number' && typeof p.maxHp === 'number' && p.hp > p.maxHp + 50) {
      issues.push({
        severity: 'warning',
        category: 'HP越界',
        detail: `player.hp(${p.hp}) >> maxHp(${p.maxHp})`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }

    // 4. Negative hunger overflow
    if (typeof p.hunger === 'number' && p.hunger < -100) {
      issues.push({
        severity: 'warning',
        category: '饥饿溢出',
        detail: `player.hunger = ${p.hunger}`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }

    // 5. Negative gold
    if (typeof p.gold === 'number' && p.gold < 0) {
      issues.push({
        severity: 'warning',
        category: '金币负数',
        detail: `player.gold = ${p.gold}`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }

    // 6. Equipment-inventory duplication check
    if (p.inventory && p.equipment) {
      const equipIds = new Set<string>();
      for (const slot of Object.values(p.equipment)) {
        if (slot && typeof slot === 'object' && slot.id) equipIds.add(slot.id);
      }
      for (const item of p.inventory) {
        if (item && item.id && equipIds.has(item.id)) {
          issues.push({
            severity: 'critical',
            category: '物品重复',
            detail: `物品 ${item.name ?? item.id} 同时存在于装备栏和背包中`,
            turn: turnOnFloor,
            floor: currentFloor,
          });
          break; // only report once per check
        }
      }
    }

    // 7. Inventory size exceeds max (20 or 30 with packMule)
    if (p.inventory) {
      const maxSize = p.talents?.includes('packMule') ? 30 : 20;
      if (p.inventory.length > maxSize) {
        issues.push({
          severity: 'critical',
          category: '背包溢出',
          detail: `inventory.length = ${p.inventory.length}, max = ${maxSize}`,
          turn: turnOnFloor,
          floor: currentFloor,
        });
      }
    }

    // 8. Equipment with enhanceLevel > 3 (should be capped)
    if (p.equipment) {
      for (const [slot, item] of Object.entries(p.equipment)) {
        if (item && typeof item === 'object' && 'enhanceLevel' in item) {
          if ((item as any).enhanceLevel > 3) {
            issues.push({
              severity: 'warning',
              category: '强化越界',
              detail: `${slot} enhanceLevel = ${(item as any).enhanceLevel}`,
              turn: turnOnFloor,
              floor: currentFloor,
            });
          }
        }
      }
    }

    // 9. Level 0 or negative level
    if (typeof p.level === 'number' && p.level < 1) {
      issues.push({
        severity: 'critical',
        category: '等级异常',
        detail: `player.level = ${p.level}`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }

    // 10. Status effects with invalid duration
    if (Array.isArray(p.statusEffects)) {
      for (const eff of p.statusEffects) {
        if (eff && typeof eff.duration === 'number' && (eff.duration < 0 || !Number.isFinite(eff.duration))) {
          issues.push({
            severity: 'warning',
            category: '状态异常',
            detail: `statusEffect ${eff.type} duration = ${eff.duration}`,
            turn: turnOnFloor,
            floor: currentFloor,
          });
        }
      }
    }
  }

  // 11. Phase vs state inconsistency
  const phase = state.phase;
  if (phase === GamePhase.Playing && state.player?.hp !== undefined && state.player.hp <= 0) {
    issues.push({
      severity: 'critical',
      category: '状态不一致',
      detail: `phase=playing 但 player.hp=${state.player.hp} (应为gameOver)`,
      turn: turnOnFloor,
      floor: currentFloor,
    });
  }

  // 12. Stuck phase detection: sub-phase lasting too many consecutive turns
  if (phase !== GamePhase.Playing && phase !== GamePhase.GameOver && phase !== GamePhase.Title && phase !== GamePhase.CharacterCreation) {
    if (phaseTurns > 30) {
      issues.push({
        severity: 'warning',
        category: '阶段卡死',
        detail: `phase=${phase} 已持续${phaseTurns}回合 (statPoints=${state.player?.statPoints ?? '?'})`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }
  }

  // 13. Map dimension sanity
  const map = state.map;
  if (map) {
    const height = map.length;
    const width = map[0]?.length ?? 0;
    if (width !== state.width || height !== state.height) {
      issues.push({
        severity: 'warning',
        category: '地图尺寸不一致',
        detail: `map=${width}×${height} state=${state.width}×${state.height}`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }
  }

  // 14. Player position out of bounds
  if (state.player?.pos && state.map) {
    const { x, y } = state.player.pos;
    const h = state.map.length;
    const w = state.map[0]?.length ?? 0;
    if (x < 0 || x >= w || y < 0 || y >= h) {
      issues.push({
        severity: 'critical',
        category: '位置越界',
        detail: `player.pos=(${x},${y}) map=${w}×${h}`,
        turn: turnOnFloor,
        floor: currentFloor,
      });
    }
  }

  // 15. Enemies with NaN/Infinity hp
  if (Array.isArray(state.enemies)) {
    for (const e of state.enemies) {
      if (e && typeof e.hp === 'number' && !Number.isFinite(e.hp)) {
        issues.push({
          severity: 'critical',
          category: '敌人NaN',
          detail: `enemy ${e.name ?? e.id} hp=${e.hp}`,
          turn: turnOnFloor,
          floor: currentFloor,
        });
      }
      if (e && typeof e.hp === 'number' && e.hp < -100) {
        issues.push({
          severity: 'warning',
          category: '敌人HP溢出',
          detail: `enemy ${e.name ?? e.id} hp=${e.hp}`,
          turn: turnOnFloor,
          floor: currentFloor,
        });
      }
    }
  }

  return issues;
}

// ============================================================
// Helpers
// ============================================================

function equipmentPower(player: any): number {
  let power = 0;
  if (!player?.equipment) return 0;
  for (const slot of Object.values(player.equipment)) {
    if (slot && typeof slot === 'object') {
      if ('damage' in slot && typeof slot.damage === 'number') power += slot.damage * 3;
      if ('defense' in slot && typeof slot.defense === 'number') power += slot.defense * 2;
      if ('magicAttack' in slot && typeof slot.magicAttack === 'number') power += slot.magicAttack * 3;
      if ('enhanceLevel' in slot && typeof slot.enhanceLevel === 'number') power += slot.enhanceLevel * 2;
    }
  }
  return power;
}

function takeSnapshot(state: any, floor: number, turnOnFloor: number, kills: number, dmgTaken: number, dmgDealt: number): FloorSnapshot {
  const p = state.player;
  return {
    floor,
    turnOnExit: turnOnFloor,
    hp: p?.hp ?? 0,
    maxHp: p?.maxHp ?? 0,
    mp: p?.mp ?? 0,
    maxMp: p?.maxMp ?? 0,
    gold: p?.gold ?? 0,
    level: p?.level ?? 1,
    hunger: p?.hunger ?? 0,
    inventorySize: p?.inventory?.length ?? 0,
    equipmentPower: equipmentPower(p),
    relics: p?.relics ?? [],
    enemiesKilled: kills,
    damageTaken: dmgTaken,
    damageDealt: dmgDealt,
    itemsFound: p?.inventory?.length ?? 0,
    statPoints: p?.statPoints ?? 0,
  };
}

function executeAction(store: any, action: AIAction) {
  const s = store.getState();

  // Auto-convert move actions targeting a closed door into openDoor
  // Also handle eliteDoor which gameStore.openDoor() doesn't handle natively
  if (action.type === 'move') {
    const dx = action.dx ?? 0, dy = action.dy ?? 0;
    const px = s.player?.pos?.x ?? 0, py = s.player?.pos?.y ?? 0;
    const targetTile = s.map?.[py + dy]?.[px + dx];
    if (targetTile?.type === 'door') {
      s.openDoor(dx, dy);
      return;
    }
    // eliteDoor: openDoor() only handles Door, use movePlayer() which has eliteDoor logic
    if (targetTile?.type === 'eliteDoor') {
      // movePlayer handles eliteDoor in its !walkable branch — just use it directly
      s.movePlayer(dx, dy);
      return;
    }
  }

  switch (action.type) {
    case 'move': s.movePlayer(action.dx ?? 0, action.dy ?? 0); break;
    case 'wait': s.waitTurn(); break;
    case 'pickup': s.pickupItem(); break;
    case 'useItem': s.useItem(action.itemIndex ?? 0); break;
    case 'equip': s.equipItem(action.itemIndex ?? 0, action.targetSlot); break;
    case 'drop': s.dropItem(action.itemIndex ?? 0); break;
    case 'sellItem': s.sellItem(action.itemIndex ?? 0); break;
    case 'descend': s.descendStairs(); break;
    case 'useSkill': s.useSkill(action.itemIndex ?? 0); break;
    case 'allocateStat': s.allocateStat(action.stat ?? 'str'); break;
    case 'confirmLevelUp': s.confirmLevelUp(); break;
    case 'selectTalent': s.selectTalent(action.talentId ?? 'nightVision'); break;
    case 'buyShopItem': s.buyShopItem(action.shopIndex ?? 0); break;
    case 'closeShop': s.closeShop(); break;
    case 'chooseEventChoice': s.chooseEventChoice(action.eventChoice ?? 0); break;
    case 'closeEvent': s.closeEvent(); break;
    case 'chooseBossBlessing': s.chooseBossBlessing(action.blessing ?? BossBlessing.EchoBody); break;
    case 'enhanceEquipment': s.enhanceEquipment(action.targetSlot ?? EquipmentSlot.Weapon); break;
    case 'openDoor': s.openDoor(action.dx ?? 0, action.dy ?? 0); break;
    case 'confirmIdentify': s.confirmIdentify(action.itemIndex ?? 0); break;
    case 'confirmSacrifice': s.confirmSacrifice(action.itemIndex ?? 0); break;
  }
}

// ============================================================
// Single simulation run
// ============================================================

function runSingleSimulation(className: CharacterClass, runIndex: number, maxFloor: number, randomSeed?: number): RunResult {
  const store = useGameStore;
  const runSeed = randomSeed ?? (10000 + runIndex * 1000 + CLASSES.indexOf(className) * 100);

  const result: RunResult = {
    className,
    seed: runSeed,
    deathFloor: null,
    deathCause: '',
    totalTurns: 0,
    totalKills: 0,
    totalGoldEarned: 0,
    totalDamageTaken: 0,
    totalDamageDealt: 0,
    bossKills: 0,
    floors: [],
    deathSnapshot: null,
    errors: [],
    bugs: [],
    skillsUsed: {},
    potionsUsed: {},
    scrollsUsed: {},
    hungerDeathTurns: null,
  };

  // Validation interval: check every N turns (reduce overhead while still catching bugs)
  const VALIDATE_INTERVAL = 5;
  let lastActionType = '';

  // Action repetition detection
  let consecutiveSameAction = 0;
  let lastActionDetail = '';
  const REPEAT_THRESHOLD = 20;

  // Phase tracking for stuck detection
  let currentPhaseStartTurn = 0;
  let lastPhase = '';

  // Action trace ring buffer — last N actions for stuck diagnosis
  const TRACE_SIZE = 80;
  const actionTrace: string[] = [];

  try {
    // Use restartGame() for proper state cleanup
    store.getState().restartGame();

    // Reset AI position tracking for new run
    resetVisitedPositions();

    // Start a new game
    store.getState().newGame(`Test${className}`, className);

    // Disable audio to prevent AudioManager scheduler from running
    try {
      const s0 = store.getState();
      if (s0.musicEnabled) store.getState().toggleMusic();
      if (s0.sfxEnabled) store.getState().toggleSfx();
    } catch { /* ignore */ }

    // Create a deterministic RNG for the AI player
    const aiRng = new SeededRandom(runSeed + 999);

    let state = store.getState();
    let prevHp = state.player?.hp ?? 0;
    let prevAliveEnemyCount = state.enemies?.filter((e: any) => e.hp > 0).length ?? 0;
    let prevEnemyHpSum = state.enemies?.reduce((s: number, e: any) => s + (e.hp > 0 ? e.hp : 0), 0) ?? 0;
    let prevGold = state.player?.gold ?? 0;

    let lastFloor = state.currentFloor;
    let floorKills = 0;
    let floorDmgTaken = 0;
    let floorDmgDealt = 0;
    let turnOnFloor = 0;
    let totalTurns = 0;
    let prevBossKillCount = state.player?.bossKillCount ?? 0;

    const MAX_TOTAL_TURNS = MAX_TURNS_PER_FLOOR * maxFloor;

    while (totalTurns < MAX_TOTAL_TURNS) {
      state = store.getState();

      // Track phase changes for stuck detection
      const currentPhaseStr = String(state.phase ?? '');
      if (currentPhaseStr !== lastPhase) {
        lastPhase = currentPhaseStr;
        currentPhaseStartTurn = totalTurns;
      }

      // Check death
      if (state.player?.hp !== undefined && state.player.hp <= 0) {
        result.deathFloor = state.currentFloor;
        result.deathCause = state.deathCause || '未知死因';
        result.deathSnapshot = takeSnapshot(state, state.currentFloor, turnOnFloor, floorKills, floorDmgTaken, floorDmgDealt);

        // Validate death state for bugs
        const deathIssues = validateState(state, turnOnFloor, state.currentFloor, 0);
        for (const issue of deathIssues) {
          result.bugs.push({
            severity: issue.severity,
            category: issue.category,
            detail: `[死亡时] ${issue.detail}`,
            turn: issue.turn,
            floor: issue.floor,
            lastAction: lastActionType,
          });
        }
        break;
      }

      // Check floor change
      if (state.currentFloor !== lastFloor) {
        if (state.currentFloor > lastFloor) {
          // Descended to new floor — track boss kills from player.bossKillCount
          const curBossKillCount = state.player?.bossKillCount ?? 0;
          const bossKillsThisFloor = curBossKillCount - prevBossKillCount;
          if (bossKillsThisFloor > 0) {
            result.bossKills += bossKillsThisFloor;
          }
          result.floors.push(takeSnapshot(state, lastFloor, turnOnFloor, floorKills, floorDmgTaken, floorDmgDealt));
          result.totalKills += floorKills;
          result.totalDamageTaken += floorDmgTaken;
          result.totalDamageDealt += floorDmgDealt;
        }
        lastFloor = state.currentFloor;
        floorKills = 0;
        floorDmgTaken = 0;
        floorDmgDealt = 0;
        turnOnFloor = 0;
        actionTrace.length = 0; // reset trace on floor change
        prevBossKillCount = state.player?.bossKillCount ?? 0;
        prevHp = state.player?.hp ?? 0;
        prevGold = state.player?.gold ?? 0;
        prevAliveEnemyCount = state.enemies?.filter((e: any) => e.hp > 0).length ?? 0;
        prevEnemyHpSum = state.enemies?.reduce((s: number, e: any) => s + (e.hp > 0 ? e.hp : 0), 0) ?? 0;
      }

      // Victory condition
      if (state.currentFloor > maxFloor) {
        result.floors.push(takeSnapshot(state, maxFloor, turnOnFloor, floorKills, floorDmgTaken, floorDmgDealt));
        break;
      }

      // Compute damage/kills from state delta
      const curHp = state.player?.hp ?? 0;
      if (prevHp > curHp) floorDmgTaken += prevHp - curHp;
      prevHp = curHp;

      const curAlive = state.enemies?.filter((e: any) => e.hp > 0).length ?? 0;
      if (curAlive < prevAliveEnemyCount) {
        floorKills += prevAliveEnemyCount - curAlive;
      }
      prevAliveEnemyCount = curAlive;

      const curEnemyHpSum = state.enemies?.reduce((s: number, e: any) => s + (e.hp > 0 ? e.hp : 0), 0) ?? 0;
      if (curEnemyHpSum < prevEnemyHpSum) {
        floorDmgDealt += prevEnemyHpSum - curEnemyHpSum;
      }
      prevEnemyHpSum = curEnemyHpSum;

      const curGold = state.player?.gold ?? 0;
      if (curGold > prevGold) result.totalGoldEarned += curGold - prevGold;
      prevGold = curGold;

      // Periodic state validation (every VALIDATE_INTERVAL turns)
      if (totalTurns > 0 && totalTurns % VALIDATE_INTERVAL === 0) {
        const phaseTurns = totalTurns - currentPhaseStartTurn;
        const issues = validateState(state, turnOnFloor, state.currentFloor, phaseTurns);
        for (const issue of issues) {
          // Deduplicate: skip if same category+detail seen recently
          const key = `${issue.category}:${issue.detail}`;
          const recentlySeen = result.bugs.some(b =>
            b.category === issue.category && b.detail.includes(issue.detail.slice(0, 30)) &&
            b.turn !== undefined && Math.abs((b.turn ?? 0) - turnOnFloor) < 20
          );
          if (!recentlySeen) {
            result.bugs.push({
              severity: issue.severity,
              category: issue.category,
              detail: issue.detail,
              turn: turnOnFloor,
              floor: issue.floor,
              lastAction: lastActionType,
            });
          }
        }
      }

      // Get AI decision with full state context
      const action = decideAction(
        state.player,
        state.enemies ?? [],
        state.map ?? [],
        state.visibleTiles ?? new Set(),
        state.items ?? [],
        state.currentFloor,
        state.phase as GamePhase,
        state.phase === 'shop' ? state.shopItems : null,
        state.player?.statPoints ?? 0,
        state.player?.talents ?? [],
        state.player?.skillCooldowns ?? [99, 99, 99],
        maxFloor,
        turnOnFloor,
        state.pendingIdentify ?? false,
        state.pendingSacrifice ?? false,
        state.pendingForge ?? false,
        state.lastBossDefId ?? null,
        state.bossBlessingPending ?? false,
        aiRng,
        lastActionType,
      );

      lastActionType = action.type;

      // Detect action spinning (same action repeated many times without progress)
      const actionDetail = `${action.type}:${action.dx ?? ''},${action.dy ?? ''}:${action.itemIndex ?? ''}`;
      if (actionDetail === lastActionDetail) {
        consecutiveSameAction++;
      } else {
        consecutiveSameAction = 0;
        lastActionDetail = actionDetail;
      }
      // Early intervention: if same action repeated 8+ times, break the loop
      // Replacing with 'wait' just wastes turns — try random walkable direction instead
      let effectiveAction = action;
      if (consecutiveSameAction >= 8 && (action.type === 'move' || action.type === 'openDoor' || action.type === 'useSkill' || action.type === 'equip')) {
        if (action.type === 'useSkill') {
          effectiveAction = { type: 'wait' };
        } else if (action.type === 'equip') {
          // Equip loop — mark as failed and wait to break the loop
          markEquipFailed(`${action.itemIndex ?? ''}:${action.targetSlot ?? ''}:${state.player?.inventory?.[action.itemIndex ?? -1]?.name ?? ''}`);
          effectiveAction = { type: 'wait' };
        } else {
          const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
          const px = state.player?.pos?.x ?? 0, py = state.player?.pos?.y ?? 0;
          const mw = state.width ?? 70, mh = state.height ?? 24;
          const walkableDirs = dirs.filter(([ddx, ddy]) => {
            const nx = px + ddx, ny = py + ddy;
            if (nx < 0 || nx >= mw || ny < 0 || ny >= mh) return false;
            const t = state.map?.[ny]?.[nx];
            return t && (t.walkable || t.type === 'door' || t.type === 'eliteDoor');
          });
          if (walkableDirs.length > 0) {
            // Pick a direction different from the stuck one
            const stuckDx = action.dx ?? 0, stuckDy = action.dy ?? 0;
            const alternatives = walkableDirs.filter(([ddx, ddy]) => ddx !== stuckDx || ddy !== stuckDy);
            const pick = alternatives.length > 0 ? alternatives[Math.floor(Math.random() * alternatives.length)] : walkableDirs[Math.floor(Math.random() * walkableDirs.length)];
            effectiveAction = { type: 'move', dx: pick[0], dy: pick[1] };
          } else {
            effectiveAction = { type: 'wait' };
          }
        }
        consecutiveSameAction = 0;
      }
      if (consecutiveSameAction >= REPEAT_THRESHOLD) {
        result.bugs.push({
          severity: 'warning',
          category: 'AI空转',
          detail: `连续${consecutiveSameAction + 1}次执行相同操作: ${actionDetail.slice(0, 40)}`,
          turn: turnOnFloor,
          floor: state.currentFloor,
          lastAction: action.type,
        });
        consecutiveSameAction = 0; // reset to avoid spamming
      }

      // Track resource usage before executing
      // Snapshot key state before useSkill to detect rejected (no-op) skill attempts
      const preSkillMp = action.type === 'useSkill' ? state.player?.mp : null;
      const preSkillCd = action.type === 'useSkill' ? [...(state.player?.skillCooldowns ?? [])] : null;

      if (action.type === 'useSkill') {
        const skillNamesByClass: Record<string, string[]> = {
          warrior: ['shieldBash', 'warCry', 'whirlwind'],
          mage: ['fireball', 'iceShield', 'chainLightning'],
          rogue: ['shadowStep', 'poisonBlade', 'fanOfKnives'],
        };
        const cls = state.player?.class ?? 'warrior';
        const names = skillNamesByClass[cls] ?? skillNamesByClass.warrior;
        const name = names[action.itemIndex ?? 0] ?? `skill${action.itemIndex ?? 0}`;
        result.skillsUsed[name] = (result.skillsUsed[name] ?? 0) + 1;
      }
      if (action.type === 'useItem' && action.itemIndex !== undefined && action.itemIndex >= 0) {
        const item = state.player?.inventory?.[action.itemIndex];
        if (item) {
          if (item.type === 'potion' as string) {
            const name = item.name ?? item.identified ? 'identifiedPotion' : 'unknownPotion';
            result.potionsUsed[name] = (result.potionsUsed[name] ?? 0) + 1;
          }
          if (item.type === 'scroll' as string) {
            const name = item.name ?? item.identified ? 'identifiedScroll' : 'unknownScroll';
            result.scrollsUsed[name] = (result.scrollsUsed[name] ?? 0) + 1;
          }
          if (item.type === 'food' as string) {
            result.potionsUsed['food'] = (result.potionsUsed['food'] ?? 0) + 1;
          }
        }
      }

      // Track hunger reaching 0
      if (result.hungerDeathTurns === null && state.player?.hunger !== undefined && state.player.hunger <= 0) {
        result.hungerDeathTurns = totalTurns;
      }

      // Execute
      try {
        executeAction(store, effectiveAction);
      } catch (err: any) {
        const stackSnippet = err?.stack ? String(err.stack).split('\n').slice(0, 3).join(' ← ') : '';
        result.errors.push(`F${state.currentFloor}T${turnOnFloor}[${action.type}]: ${String(err?.message ?? err).slice(0, 60)} | ${stackSnippet.slice(0, 80)}`);

        // Also record as a bug
        result.bugs.push({
          severity: 'critical',
          category: '执行异常',
          detail: `${action.type}: ${String(err?.message ?? err).slice(0, 80)}`,
          turn: turnOnFloor,
          floor: state.currentFloor,
          lastAction: action.type,
        });

        try { store.getState().waitTurn(); } catch { break; }
      }

      turnOnFloor++;
      totalTurns++;
      result.totalTurns = totalTurns;

      // Detect rejected (no-op) skill attempts — game's useSkill returns without consuming MP/CD
      // when pre-validation fails (no target in range/LOS). These don't advance the game turn,
      // so we should not count them as effective turns.
      if (preSkillMp !== null && preSkillCd !== null) {
        const postState = store.getState();
        const postMp = postState.player?.mp;
        const postCd = postState.player?.skillCooldowns;
        if (postMp === preSkillMp && postCd && postCd[0] === preSkillCd[0]) {
          // Skill was rejected — no state change. Don't count as an effective turn.
          turnOnFloor--;
          // But still count totalTurns to prevent infinite outer loop
        }
      }

      // Record action trace for stuck diagnosis
      const s2 = store.getState();
      const traceEntry = `F${state.currentFloor}T${turnOnFloor} raw=${action.type}:${action.dx ?? ''},${action.dy ?? ''} eff=${effectiveAction.type}:${effectiveAction.dx ?? ''},${effectiveAction.dy ?? ''} pos=${s2.player?.pos?.x},${s2.player?.pos?.y} hp=${s2.player?.hp} hng=${s2.player?.hunger} phase=${s2.phase} bless=${s2.bossBlessingPending} enemies=${s2.enemies?.filter((e: any) => e.hp > 0).length}`;
      actionTrace.push(traceEntry);
      if (actionTrace.length > TRACE_SIZE) actionTrace.shift();

      // Progress output every 100 turns
      if (totalTurns % 100 === 0) {
        process.stdout.write('.');
      }

      // Safety: prevent infinite loops per floor
      if (turnOnFloor > MAX_TURNS_PER_FLOOR) {
        // Build environment snapshot for root cause analysis
        const envSnap: string[] = [];
        const p = state.player;
        const m = state.map;
        if (p && m) {
          envSnap.push(`player=(${p.pos.x},${p.pos.y}) floor=${state.currentFloor} stairs=${state.stairsPos ? `(${state.stairsPos.x},${state.stairsPos.y})` : '?'}`);
          // 5x5 area around player
          for (let dy = -2; dy <= 2; dy++) {
            const row: string[] = [];
            for (let dx = -2; dx <= 2; dx++) {
              const tx = p.pos.x + dx, ty = p.pos.y + dy;
              if (dx === 0 && dy === 0) { row.push('@'); continue; }
              if (ty < 0 || ty >= m.length || tx < 0 || tx >= m[0].length) { row.push('#'); continue; }
              const tile = m[ty][tx];
              if (!tile) { row.push('?'); continue; }
              const enemy = state.enemies?.find((e: any) => e.hp > 0 && e.pos.x === tx && e.pos.y === ty);
              if (enemy) { row.push('E'); continue; }
              if (tile.walkable) { row.push('.'); continue; }
              row.push(tile.type?.toString()?.slice(0, 3) ?? '?');
            }
            envSnap.push(row.join(''));
          }
        }
        result.errors.push(`F${state.currentFloor}: 超过${MAX_TURNS_PER_FLOOR}回合，强制结束`);
        result.bugs.push({
          severity: 'warning',
          category: 'AI卡死',
          detail: `F${state.currentFloor} 超过${MAX_TURNS_PER_FLOOR}回合未下楼 (phase=${state.phase})\nENV:\n${envSnap.join('\n')}\nTRACE:\n${actionTrace.join('\n')}`,
          turn: turnOnFloor,
          floor: state.currentFloor,
          lastAction: lastActionType,
        });
        break;
      }
    }

    // Record final floor if not already
    if (result.floors.length === 0 || result.floors[result.floors.length - 1].floor !== lastFloor) {
      result.floors.push(takeSnapshot(store.getState(), lastFloor, turnOnFloor, floorKills, floorDmgTaken, floorDmgDealt));
    }

  } catch (err: any) {
    const stackSnippet = err?.stack ? String(err.stack).split('\n').slice(0, 3).join(' ← ') : '';
    result.errors.push(`Fatal: ${String(err?.message ?? err).slice(0, 80)} | ${stackSnippet.slice(0, 80)}`);
    result.bugs.push({
      severity: 'critical',
      category: '致命错误',
      detail: String(err?.message ?? err).slice(0, 100),
      turn: undefined,
      floor: store.getState()?.currentFloor,
      lastAction: lastActionType,
    });
    if (!result.deathFloor) {
      result.deathFloor = store.getState().currentFloor;
      result.deathCause = `模拟错误: ${String(err?.message ?? err).slice(0, 50)}`;
    }
  }

  return result;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const runs = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] ?? String(RUNS_PER_CLASS));
  const maxFloor = parseInt(args.find(a => a.startsWith('--floors='))?.split('=')[1] ?? String(MAX_FLOOR));
  const classArg = args.find(a => a.startsWith('--class='))?.split('=')[1];
  const classes: CharacterClass[] = classArg ? classArg.split(',') as CharacterClass[] : CLASSES;
  const verbose = args.includes('--verbose');
  const jsonOutput = args.includes('--json');
  const useRandomSeed = args.includes('--seed=random');
  const seedArg = args.find(a => a.startsWith('--seed=') && a !== '--seed=random')?.split('=')[1];
  const baseSeed = seedArg ? parseInt(seedArg) : undefined;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  深渊回响 (Abyss Echo) — 自动化模拟测试 v3.0');
  console.log('  (地形交互 + Dijkstra路径 + 资源追踪 + JSON输出)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  职业: ${classes.join(', ')}`);
  console.log(`  每职业运行次数: ${runs}`);
  console.log(`  最大楼层: ${maxFloor}`);
  console.log(`  随机种子: ${useRandomSeed ? '随机' : (baseSeed ? baseSeed : '固定')}`);
  console.log(`  输出格式: ${jsonOutput ? 'JSON' : '文本'}`);
  console.log('');

  const allSummaries: ReturnType<typeof computeClassSummary>[] = [];

  for (const cls of classes) {
    console.log(`\n🎮 测试职业: ${cls} (${runs}次)...`);

    const results: RunResult[] = [];
    for (let i = 0; i < runs; i++) {
      process.stdout.write(`  #${i + 1}/${runs} `);

      const seed = useRandomSeed ? Math.floor(Math.random() * 1000000) : baseSeed ? baseSeed + i : undefined;
      const result = runSingleSimulation(cls, i, maxFloor, seed);
      results.push(result);

      if (result.deathFloor) {
        process.stdout.write(`💀 F${result.deathFloor} (${result.deathCause.slice(0, 25)})`);
      } else {
        const last = result.floors[result.floors.length - 1];
        process.stdout.write(`✅ 到达F${last?.floor ?? '?'} ${result.totalTurns}回合`);
      }
      if (result.errors.length > 0) process.stdout.write(` ⚠${result.errors.length}err`);
      if (result.bugs.length > 0) process.stdout.write(` 🐛${result.bugs.length}bug`);
      process.stdout.write('\n');

      if (verbose) {
        for (const f of result.floors) {
          console.log(`    F${f.floor}: HP=${f.hp}/${f.maxHp} MP=${f.mp}/${f.maxMp} G=${f.gold} Lv=${f.level} Kills=${f.enemiesKilled} EquipPow=${f.equipmentPower} DmgTaken=${f.damageTaken} Turn=${f.turnOnExit}`);
        }
        for (const err of result.errors) {
          console.log(`    ⚠ ${err}`);
        }
        for (const bug of result.bugs) {
          console.log(`    🐛 [${bug.severity}] ${bug.category}: ${bug.detail} (T${bug.turn ?? '?'} action=${bug.lastAction ?? '?'})`);
        }
      }
    }

    const summary = computeClassSummary(results, maxFloor);
    allSummaries.push(summary);
  }

  // Generate and print report
  const report = formatReport(allSummaries, maxFloor);
  console.log(report);

  // Save to file
  const fs = await import('fs');
  const path = await import('path');

  if (jsonOutput) {
    // JSON output: serialize summaries (convert Maps to objects)
    const jsonFriendly = allSummaries.map(s => ({
      ...s,
      avgHpByFloor: Object.fromEntries(s.avgHpByFloor),
      avgMpByFloor: Object.fromEntries(s.avgMpByFloor ?? []),
      avgGoldByFloor: Object.fromEntries(s.avgGoldByFloor),
      avgEquipPowerByFloor: Object.fromEntries(s.avgEquipPowerByFloor),
      survivalByFloor: Object.fromEntries(s.survivalByFloor ?? []),
      deathCauseCount: Object.fromEntries(s.deathCauseCount),
      deathFloorDistribution: Object.fromEntries(s.deathFloorDistribution),
      avgTurnsByFloor: Object.fromEntries(s.avgTurnsByFloor ?? []),
      avgLevelByFloor: Object.fromEntries(s.avgLevelByFloor ?? []),
      avgKillsByFloor: Object.fromEntries(s.avgKillsByFloor ?? []),
    }));
    const jsonPath = path.join(import.meta.dirname ?? '.', 'simulation-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonFriendly, null, 2), 'utf-8');
    console.log(`\n📄 JSON报告已保存至: ${jsonPath}`);
  } else {
    const reportPath = path.join(import.meta.dirname ?? '.', 'simulation-report.txt');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 报告已保存至: ${reportPath}`);
  }

  // Force exit (AudioManager scheduler may keep Node.js alive)
  process.exit(0);
}

main().catch(console.error);
