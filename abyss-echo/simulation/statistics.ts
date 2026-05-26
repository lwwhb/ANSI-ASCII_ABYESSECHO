// ============================================================
// Statistics collection and report generation
// ============================================================

export interface FloorSnapshot {
  floor: number;
  turnOnExit: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  hunger: number;
  inventorySize: number;
  equipmentPower: number;
  relics: string[];
  enemiesKilled: number;
  damageTaken: number;
  damageDealt: number;
  itemsFound: number;
  statPoints: number;
}

export interface BugReport {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  detail: string;
  turn?: number;
  floor?: number;
  lastAction?: string;
}

export interface RunResult {
  className: string;
  seed: number;
  deathFloor: number | null; // null = survived all floors
  deathCause: string;
  totalTurns: number;
  totalKills: number;
  totalGoldEarned: number;
  totalDamageTaken: number;
  totalDamageDealt: number;
  bossKills: number;
  floors: FloorSnapshot[];
  deathSnapshot: FloorSnapshot | null;
  errors: string[];
  bugs: BugReport[];
  // P2: new tracking fields
  skillsUsed: Record<string, number>;
  potionsUsed: Record<string, number>;
  scrollsUsed: Record<string, number>;
  hungerDeathTurns: number | null; // turn when hunger first reached 0
}

export interface ClassSummary {
  className: string;
  runs: number;
  avgDeathFloor: number;
  maxFloor: number;
  survivalRate: number; // % that survived all floors
  avgKillsPerRun: number;
  avgGoldPerRun: number;
  avgTotalDamageTaken: number;
  avgTotalDamageDealt: number;
  bossKillsPerRun: number;
  avgHpByFloor: Map<number, number>;
  avgMpByFloor: Map<number, number>;
  avgGoldByFloor: Map<number, number>;
  avgEquipPowerByFloor: Map<number, number>;
  survivalByFloor: Map<number, number>; // P3: % surviving past each floor
  deathCauseCount: Map<string, number>;
  deathFloorDistribution: Map<number, number>;
  skillsUsed: Record<string, number>;   // P2: aggregate skill usage
  potionsUsed: Record<string, number>;  // P2: aggregate potion usage
  scrollsUsed: Record<string, number>;  // P2: aggregate scroll usage
  errors: string[];
  bugs: BugReport[];
  // v4: new analytical metrics
  floorReachedPercentiles: { p25: number; p50: number; p75: number; p90: number };
  avgTurnsByFloor: Map<number, number>;
  avgLevelByFloor: Map<number, number>;
  avgKillsByFloor: Map<number, number>;
  avgDeathHpPercent: number;          // average HP% at moment of death
  hungerDeathRate: number;            // % of runs that died to hunger
  avgHungerZeroTurn: number | null;   // avg turn when hunger first hit 0
  damageEfficiency: number;           // avgTotalDamageDealt / avgTotalDamageTaken
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(p / 100 * sorted.length), sorted.length - 1);
  return sorted[idx];
}

export function computeClassSummary(results: RunResult[], maxFloor: number): ClassSummary {
  const className = results[0]?.className ?? 'unknown';
  const runs = results.length;
  let totalDeathFloor = 0;
  let maxReached = 0;
  let survived = 0;
  let totalKills = 0;
  let totalGold = 0;
  let totalDmgTaken = 0;
  let totalDmgDealt = 0;
  let totalBossKills = 0;
  const hpByFloor = new Map<number, number[]>();
  const goldByFloor = new Map<number, number[]>();
  const equipPowerByFloor = new Map<number, number[]>();
  const deathCauses = new Map<string, number>();
  const deathFloorDist = new Map<number, number>();
  const allErrors: string[] = [];
  const allBugs: BugReport[] = [];
  const mpByFloor = new Map<number, number[]>();
  const aggregateSkills: Record<string, number> = {};
  const aggregatePotions: Record<string, number> = {};
  const aggregateScrolls: Record<string, number> = {};

  // v4: new metric accumulators
  const floorsReached: number[] = [];
  const deathHpPercents: number[] = [];
  let hungerDeathCount = 0;
  const hungerZeroTurns: number[] = [];
  const turnsByFloor = new Map<number, number[]>();
  const levelByFloor = new Map<number, number[]>();
  const killsByFloor = new Map<number, number[]>();

  for (const r of results) {
    totalKills += r.totalKills;
    totalGold += r.totalGoldEarned;
    totalDmgTaken += r.totalDamageTaken;
    totalDmgDealt += r.totalDamageDealt;
    totalBossKills += r.bossKills;
    allErrors.push(...r.errors);
    allBugs.push(...r.bugs);

    // Aggregate skill/potion/scroll usage
    for (const [k, v] of Object.entries(r.skillsUsed ?? {})) aggregateSkills[k] = (aggregateSkills[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.potionsUsed ?? {})) aggregatePotions[k] = (aggregatePotions[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.scrollsUsed ?? {})) aggregateScrolls[k] = (aggregateScrolls[k] ?? 0) + v;

    const reachedFloor = r.deathFloor ?? maxFloor;
    floorsReached.push(reachedFloor);

    if (r.deathFloor === null) {
      survived++;
      totalDeathFloor += maxFloor;
    } else {
      totalDeathFloor += r.deathFloor;
      deathCauses.set(r.deathCause, (deathCauses.get(r.deathCause) ?? 0) + 1);
      deathFloorDist.set(r.deathFloor, (deathFloorDist.get(r.deathFloor) ?? 0) + 1);
    }
    if (reachedFloor > maxReached) maxReached = reachedFloor;

    // v4: death HP% (clamp HP to 0 to avoid negative percentages from overkill)
    if (r.deathSnapshot && r.deathSnapshot.maxHp > 0) {
      deathHpPercents.push(Math.round(Math.max(0, r.deathSnapshot.hp) / r.deathSnapshot.maxHp * 100));
    }

    // v4: hunger stress
    if (r.deathCause?.includes('饥饿')) hungerDeathCount++;
    if (r.hungerDeathTurns != null) hungerZeroTurns.push(r.hungerDeathTurns);

    // Per-floor aggregation (existing + new)
    for (const f of r.floors) {
      if (!hpByFloor.has(f.floor)) hpByFloor.set(f.floor, []);
      if (!goldByFloor.has(f.floor)) goldByFloor.set(f.floor, []);
      if (!equipPowerByFloor.has(f.floor)) equipPowerByFloor.set(f.floor, []);
      if (!mpByFloor.has(f.floor)) mpByFloor.set(f.floor, []);
      if (!turnsByFloor.has(f.floor)) turnsByFloor.set(f.floor, []);
      if (!levelByFloor.has(f.floor)) levelByFloor.set(f.floor, []);
      if (!killsByFloor.has(f.floor)) killsByFloor.set(f.floor, []);
      hpByFloor.get(f.floor)!.push(f.hp);
      goldByFloor.get(f.floor)!.push(f.gold);
      equipPowerByFloor.get(f.floor)!.push(f.equipmentPower);
      mpByFloor.get(f.floor)!.push(f.mp);
      turnsByFloor.get(f.floor)!.push(f.turnOnExit);
      levelByFloor.get(f.floor)!.push(f.level);
      killsByFloor.get(f.floor)!.push(f.enemiesKilled);
    }
  }

  const avgHpByFloor = new Map<number, number>();
  const avgMpByFloor = new Map<number, number>();
  const avgGoldByFloor = new Map<number, number>();
  const avgEquipPowerByFloor = new Map<number, number>();
  for (const [floor, hps] of hpByFloor) avgHpByFloor.set(floor, hps.reduce((a, b) => a + b, 0) / hps.length);
  for (const [floor, mps] of mpByFloor) avgMpByFloor.set(floor, mps.reduce((a, b) => a + b, 0) / mps.length);
  for (const [floor, golds] of goldByFloor) avgGoldByFloor.set(floor, golds.reduce((a, b) => a + b, 0) / golds.length);
  for (const [floor, powers] of equipPowerByFloor) avgEquipPowerByFloor.set(floor, powers.reduce((a, b) => a + b, 0) / powers.length);

  // v4: avg turns / level / kills per floor
  const avgTurnsByFloor = new Map<number, number>();
  const avgLevelByFloor = new Map<number, number>();
  const avgKillsByFloorMap = new Map<number, number>();
  for (const [floor, turns] of turnsByFloor) avgTurnsByFloor.set(floor, turns.reduce((a, b) => a + b, 0) / turns.length);
  for (const [floor, levels] of levelByFloor) avgLevelByFloor.set(floor, levels.reduce((a, b) => a + b, 0) / levels.length);
  for (const [floor, kills] of killsByFloor) avgKillsByFloorMap.set(floor, kills.reduce((a, b) => a + b, 0) / kills.length);

  // P3: Survival rate by floor
  const survivalByFloor = new Map<number, number>();
  for (let f = 1; f <= maxFloor; f++) {
    const alive = results.filter(r => (r.deathFloor ?? maxFloor + 1) > f).length;
    survivalByFloor.set(f, (alive / runs) * 100);
  }

  // v4: floor reached percentiles
  const sortedFloors = [...floorsReached].sort((a, b) => a - b);
  const floorReachedPercentiles = {
    p25: percentile(sortedFloors, 25),
    p50: percentile(sortedFloors, 50),
    p75: percentile(sortedFloors, 75),
    p90: percentile(sortedFloors, 90),
  };

  return {
    className,
    runs,
    avgDeathFloor: totalDeathFloor / runs,
    maxFloor: maxReached,
    survivalRate: (survived / runs) * 100,
    avgKillsPerRun: totalKills / runs,
    avgGoldPerRun: totalGold / runs,
    avgTotalDamageTaken: totalDmgTaken / runs,
    avgTotalDamageDealt: totalDmgDealt / runs,
    bossKillsPerRun: totalBossKills / runs,
    avgHpByFloor,
    avgMpByFloor,
    avgGoldByFloor,
    avgEquipPowerByFloor,
    survivalByFloor,
    deathCauseCount: deathCauses,
    deathFloorDistribution: deathFloorDist,
    skillsUsed: aggregateSkills,
    potionsUsed: aggregatePotions,
    scrollsUsed: aggregateScrolls,
    errors: allErrors,
    bugs: allBugs,
    // v4: new metrics
    floorReachedPercentiles,
    avgTurnsByFloor,
    avgLevelByFloor,
    avgKillsByFloor: avgKillsByFloorMap,
    avgDeathHpPercent: deathHpPercents.length > 0 ? deathHpPercents.reduce((a, b) => a + b, 0) / deathHpPercents.length : 0,
    hungerDeathRate: (hungerDeathCount / runs) * 100,
    avgHungerZeroTurn: hungerZeroTurns.length > 0 ? Math.round(hungerZeroTurns.reduce((a, b) => a + b, 0) / hungerZeroTurns.length) : null,
    damageEfficiency: totalDmgTaken > 0 ? totalDmgDealt / totalDmgTaken : 0,
  };
}

export function formatReport(summaries: ClassSummary[], maxFloor: number): string {
  const lines: string[] = [];
  const sep = '═'.repeat(80);

  lines.push('');
  lines.push(sep);
  lines.push('  深渊回响 (Abyss Echo) — 模拟游玩测试报告');
  lines.push(sep);
  lines.push('');

  for (const s of summaries) {
    lines.push(`┌${'─'.repeat(78)}┐`);
    lines.push(`│ ${(s.className + ' — 综合统计').padEnd(76)} │`);
    lines.push(`├${'─'.repeat(78)}┤`);
    lines.push(`│ 运行次数: ${s.runs}`.padEnd(79) + '│');
    lines.push(`│ 平均死亡楼层: ${s.avgDeathFloor.toFixed(1)}`.padEnd(79) + '│');
    lines.push(`│ 最高到达楼层: ${s.maxFloor}`.padEnd(79) + '│');
    const fp = s.floorReachedPercentiles;
    lines.push(`│ 楼层到达: P25=F${fp.p25}, P50=F${fp.p50}, P75=F${fp.p75}, P90=F${fp.p90}`.padEnd(79) + '│');
    lines.push(`│ 全程存活率: ${s.survivalRate.toFixed(1)}%`.padEnd(79) + '│');
    lines.push(`│ 平均击杀数: ${s.avgKillsPerRun.toFixed(1)}`.padEnd(79) + '│');
    lines.push(`│ 平均Boss击杀: ${s.bossKillsPerRun.toFixed(1)}`.padEnd(79) + '│');
    lines.push(`│ 平均获得金币: ${s.avgGoldPerRun.toFixed(0)}`.padEnd(79) + '│');
    lines.push(`│ 平均受到伤害: ${s.avgTotalDamageTaken.toFixed(0)}`.padEnd(79) + '│');
    lines.push(`│ 平均造成伤害: ${s.avgTotalDamageDealt.toFixed(0)}`.padEnd(79) + '│');
    lines.push(`│ 伤害效率: ${s.damageEfficiency.toFixed(2)}x (造成/受到)`.padEnd(79) + '│');
    // deathHpPercents is computed in computeClassSummary; if avgDeathHpPercent is 0
    // it could mean "no data" (never died) or "always overkilled to 0HP"
    // We use deathFloorDistribution.size > 0 as proxy for "has deaths"
    const hasDeaths = s.deathFloorDistribution.size > 0;
    const deathHpLabel = hasDeaths ? `${s.avgDeathHpPercent.toFixed(0)}%` : '—';
    const deathStyle = !hasDeaths ? '' : s.avgDeathHpPercent > 30 ? '(多为消耗战)' : s.avgDeathHpPercent > 10 ? '(猝死风险高)' : '(极易被秒杀)';
    lines.push(`│ 死亡时平均HP: ${deathHpLabel} ${deathStyle}`.padEnd(79) + '│');
    const hungerLabel = s.avgHungerZeroTurn != null ? `饥饿归零 T${s.avgHungerZeroTurn}` : '未触发';
    lines.push(`│ 饥饿压力: 饿死率${s.hungerDeathRate.toFixed(0)}%, ${hungerLabel}`.padEnd(79) + '│');

    // Death cause distribution
    if (s.deathCauseCount.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 死因统计:`.padEnd(79) + '│');
      const sorted = [...s.deathCauseCount.entries()].sort((a, b) => b[1] - a[1]);
      for (const [cause, count] of sorted) {
        lines.push(`│   ${cause}: ${count}次 (${(count / s.runs * 100).toFixed(0)}%)`.padEnd(79) + '│');
      }
    }

    // Death floor distribution
    if (s.deathFloorDistribution.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 死亡楼层分布:`.padEnd(79) + '│');
      const sorted = [...s.deathFloorDistribution.entries()].sort((a, b) => a[0] - b[0]);
      for (const [floor, count] of sorted) {
        const bar = '█'.repeat(Math.min(count * 2, 50));
        lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${count}次`.padEnd(79) + '│');
      }
    }

    // HP by floor
    lines.push(`├${'─'.repeat(78)}┤`);
    lines.push(`│ 每层平均HP曲线:`.padEnd(79) + '│');
    const hpFloors = [...s.avgHpByFloor.keys()].sort((a, b) => a - b);
    for (const floor of hpFloors) {
      const hp = s.avgHpByFloor.get(floor)!;
      const barLen = Math.max(0, Math.min(Math.floor(hp / 5), 50));
      const bar = '█'.repeat(barLen);
      lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${hp.toFixed(0)}HP`.padEnd(79) + '│');
    }

    // Gold by floor
    lines.push(`├${'─'.repeat(78)}┤`);
    lines.push(`│ 每层平均金币:`.padEnd(79) + '│');
    const goldFloors = [...s.avgGoldByFloor.keys()].sort((a, b) => a - b);
    for (const floor of goldFloors) {
      const gold = s.avgGoldByFloor.get(floor)!;
      const barLen = Math.max(0, Math.min(Math.floor(gold / 10), 50));
      const bar = '█'.repeat(barLen);
      lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${gold.toFixed(0)}G`.padEnd(79) + '│');
    }

    // Equipment power by floor
    lines.push(`├${'─'.repeat(78)}┤`);
    lines.push(`│ 每层平均装备强度:`.padEnd(79) + '│');
    const epFloors = [...s.avgEquipPowerByFloor.keys()].sort((a, b) => a - b);
    for (const floor of epFloors) {
      const ep = s.avgEquipPowerByFloor.get(floor)!;
      const barLen = Math.max(0, Math.min(Math.floor(ep / 2), 50));
      const bar = '█'.repeat(barLen);
      lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${ep.toFixed(0)}EP`.padEnd(79) + '│');
    }

    // P3: MP curve by floor
    if (s.avgMpByFloor.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 每层平均MP:`.padEnd(79) + '│');
      const mpFloors = [...s.avgMpByFloor.keys()].sort((a, b) => a - b);
      for (const floor of mpFloors) {
        const mp = s.avgMpByFloor.get(floor)!;
        const barLen = Math.max(0, Math.min(Math.floor(mp / 3), 50));
        const bar = '█'.repeat(barLen);
        lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${mp.toFixed(0)}MP`.padEnd(79) + '│');
      }
    }

    // P3: Survival rate by floor
    if (s.survivalByFloor.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 每层存活率:`.padEnd(79) + '│');
      const svFloors = [...s.survivalByFloor.keys()].sort((a, b) => a - b);
      for (const floor of svFloors) {
        const rate = s.survivalByFloor.get(floor)!;
        const barLen = Math.max(0, Math.min(Math.floor(rate / 2), 50));
        const bar = '█'.repeat(barLen);
        lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${rate.toFixed(0)}%`.padEnd(79) + '│');
      }
    }

    // v4: Avg turns per floor
    if (s.avgTurnsByFloor.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 每层平均回合:`.padEnd(79) + '│');
      const tFloors = [...s.avgTurnsByFloor.keys()].sort((a, b) => a - b);
      for (const floor of tFloors) {
        const turns = s.avgTurnsByFloor.get(floor)!;
        const barLen = Math.max(0, Math.min(Math.floor(turns / 5), 50));
        const bar = '█'.repeat(barLen);
        lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${turns.toFixed(0)}回合`.padEnd(79) + '│');
      }
    }

    // v4: Avg level per floor
    if (s.avgLevelByFloor.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 每层平均等级:`.padEnd(79) + '│');
      const lFloors = [...s.avgLevelByFloor.keys()].sort((a, b) => a - b);
      for (const floor of lFloors) {
        const level = s.avgLevelByFloor.get(floor)!;
        const barLen = Math.max(0, Math.min(Math.floor(level * 2), 50));
        const bar = '█'.repeat(barLen);
        lines.push(`│   F${String(floor).padStart(2)}: ${bar} Lv${level.toFixed(1)}`.padEnd(79) + '│');
      }
    }

    // v4: Avg kills per floor
    if (s.avgKillsByFloor.size > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 每层平均击杀:`.padEnd(79) + '│');
      const kFloors = [...s.avgKillsByFloor.keys()].sort((a, b) => a - b);
      for (const floor of kFloors) {
        const kills = s.avgKillsByFloor.get(floor)!;
        const barLen = Math.max(0, Math.min(Math.floor(kills), 50));
        const bar = '█'.repeat(barLen);
        lines.push(`│   F${String(floor).padStart(2)}: ${bar} ${kills.toFixed(1)}杀`.padEnd(79) + '│');
      }
    }

    // P2: Skill/potion/scroll usage
    const hasUsage = Object.keys(s.skillsUsed ?? {}).length + Object.keys(s.potionsUsed ?? {}).length + Object.keys(s.scrollsUsed ?? {}).length > 0;
    if (hasUsage) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ 资源消耗统计:`.padEnd(79) + '│');
      const skillEntries = Object.entries(s.skillsUsed ?? {}).sort((a, b) => b[1] - a[1]);
      if (skillEntries.length > 0) {
        lines.push(`│   技能使用:`.padEnd(79) + '│');
        for (const [name, count] of skillEntries.slice(0, 6)) {
          lines.push(`│     ${name}: ${count}次`.slice(0, 78).padEnd(79) + '│');
        }
      }
      const potionEntries = Object.entries(s.potionsUsed ?? {}).sort((a, b) => b[1] - a[1]);
      if (potionEntries.length > 0) {
        lines.push(`│   药水使用:`.padEnd(79) + '│');
        for (const [name, count] of potionEntries.slice(0, 4)) {
          lines.push(`│     ${name}: ${count}次`.slice(0, 78).padEnd(79) + '│');
        }
      }
      const scrollEntries = Object.entries(s.scrollsUsed ?? {}).sort((a, b) => b[1] - a[1]);
      if (scrollEntries.length > 0) {
        lines.push(`│   卷轴使用:`.padEnd(79) + '│');
        for (const [name, count] of scrollEntries.slice(0, 4)) {
          lines.push(`│     ${name}: ${count}次`.slice(0, 78).padEnd(79) + '│');
        }
      }
    }

    // Errors
    if (s.errors.length > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);
      lines.push(`│ ⚠ 运行错误:`.padEnd(79) + '│');
      for (const err of [...new Set(s.errors)]) {
        lines.push(`│   - ${err}`.slice(0, 78).padEnd(79) + '│');
      }
    }

    // Bug reports
    if (s.bugs.length > 0) {
      lines.push(`├${'─'.repeat(78)}┤`);

      // Deduplicate and count bugs by category+severity
      const bugCounts = new Map<string, { count: number; example: BugReport }>();
      for (const b of s.bugs) {
        const key = `${b.severity}:${b.category}:${b.detail.slice(0, 50)}`;
        const existing = bugCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          bugCounts.set(key, { count: 1, example: b });
        }
      }

      const criticalBugs = [...bugCounts.values()].filter(b => b.example.severity === 'critical');
      const warningBugs = [...bugCounts.values()].filter(b => b.example.severity === 'warning');

      if (criticalBugs.length > 0) {
        lines.push(`│ 🔴 严重Bug (${criticalBugs.length}类):`.padEnd(79) + '│');
        for (const b of criticalBugs.sort((a, b) => b.count - a.count)) {
          const ex = b.example;
          const loc = ex.floor !== undefined ? `F${ex.floor}T${ex.turn ?? '?'}` : '';
          const action = ex.lastAction ? `[${ex.lastAction}]` : '';
          lines.push(`│   ×${b.count} ${ex.category}: ${ex.detail.slice(0, 50)} ${loc}${action}`.slice(0, 78).padEnd(79) + '│');
        }
      }

      if (warningBugs.length > 0) {
        lines.push(`│ 🟡 警告 (${warningBugs.length}类):`.padEnd(79) + '│');
        for (const b of warningBugs.sort((a, b) => b.count - a.count)) {
          const ex = b.example;
          const loc = ex.floor !== undefined ? `F${ex.floor}T${ex.turn ?? '?'}` : '';
          const action = ex.lastAction ? `[${ex.lastAction}]` : '';
          lines.push(`│   ×${b.count} ${ex.category}: ${ex.detail.slice(0, 50)} ${loc}${action}`.slice(0, 78).padEnd(79) + '│');
        }
      }
    }

    lines.push(`└${'─'.repeat(78)}┘`);
    lines.push('');
  }

  // Balance analysis
  lines.push(sep);
  lines.push('  数值平衡分析');
  lines.push(sep);
  lines.push('');

  if (summaries.length >= 2) {
    const hpRanges = summaries.map(s => {
      const hps = [...s.avgHpByFloor.values()];
      return { name: s.className, min: Math.min(...hps), max: Math.max(...hps) };
    });
    lines.push('  HP范围:');
    for (const h of hpRanges) {
      lines.push(`    ${h.name}: ${h.min.toFixed(0)} - ${h.max.toFixed(0)}`);
    }
    lines.push('');

    const survivalRates = summaries.map(s => ({ name: s.className, rate: s.survivalRate }));
    lines.push('  存活率对比:');
    for (const sr of survivalRates) {
      lines.push(`    ${sr.name}: ${sr.rate.toFixed(1)}%`);
    }
    lines.push('');

    // P3: Cross-class HP comparison by floor
    const allFloors = new Set<number>();
    for (const s of summaries) for (const f of s.avgHpByFloor.keys()) allFloors.add(f);
    const sortedFloors = [...allFloors].sort((a, b) => a - b);
    lines.push('  同层HP对比 (关键层):');
    for (const floor of sortedFloors.filter(f => [1, 5, 10, 15, 20, 25].includes(f))) {
      const parts = summaries.map(s => `${s.className}: ${s.avgHpByFloor.get(floor)?.toFixed(0) ?? '?'}`).join(' | ');
      lines.push(`    F${floor}: ${parts}`);
    }
    lines.push('');

    // P3: Cross-class survival rate comparison by floor
    lines.push('  同层存活率对比:');
    for (const floor of [1, 3, 5, 10, 15, 20]) {
      const parts = summaries.map(s => `${s.className}: ${s.survivalByFloor.get(floor)?.toFixed(0) ?? '?'}%`).join(' | ');
      lines.push(`    F${floor}: ${parts}`);
    }
    lines.push('');

    // P3: Resource efficiency
    lines.push('  资源效率:');
    for (const s of summaries) {
      const efficiency = s.avgKillsPerRun > 0 ? (s.avgGoldPerRun / s.avgKillsPerRun).toFixed(1) : '0';
      lines.push(`    ${s.className}: ${(s.avgGoldPerRun / s.runs).toFixed(0)}金/次, ${s.avgKillsPerRun.toFixed(1)}杀/次, ${efficiency}金/杀`);
    }
    lines.push('');

    // v4: Floor reached percentiles comparison
    lines.push('  楼层到达百分位对比:');
    for (const s of summaries) {
      const fp = s.floorReachedPercentiles;
      lines.push(`    ${s.className}: P50=F${fp.p50}, P75=F${fp.p75}, P90=F${fp.p90}`);
    }
    lines.push('');

    // v4: Death HP% comparison
    lines.push('  死亡时HP%对比 (猝死程度):');
    for (const s of summaries) {
      lines.push(`    ${s.className}: ${s.avgDeathHpPercent.toFixed(0)}%`);
    }
    lines.push('');

    // v4: Damage efficiency comparison
    lines.push('  伤害效率对比 (造成/受到):');
    for (const s of summaries) {
      lines.push(`    ${s.className}: ${s.damageEfficiency.toFixed(2)}x`);
    }
    lines.push('');

    // v4: Hunger stress comparison
    lines.push('  饥饿压力对比:');
    for (const s of summaries) {
      const hz = s.avgHungerZeroTurn != null ? `归零T${s.avgHungerZeroTurn}` : '未触发';
      lines.push(`    ${s.className}: 饿死率${s.hungerDeathRate.toFixed(0)}%, ${hz}`);
    }
    lines.push('');

    // Flag imbalances
    const maxSurvival = Math.max(...summaries.map(s => s.survivalRate));
    const minSurvival = Math.min(...summaries.map(s => s.survivalRate));
    if (maxSurvival - minSurvival > 30) {
      lines.push('  ⚠ 职业间存活率差异过大 (>30%)，建议调整弱势职业');
    }

    for (const s of summaries) {
      if (s.avgDeathFloor < 5 && s.survivalRate < 30) {
        lines.push(`  ⚠ ${s.className} 平均死亡楼层过低 (${s.avgDeathFloor.toFixed(1)})，可能需要加强`);
      }
      if (s.avgDeathHpPercent > 0 && s.avgDeathHpPercent < 15) {
        lines.push(`  ⚠ ${s.className} 死亡时平均HP极低 (${s.avgDeathHpPercent.toFixed(0)}%)，可能存在被秒杀问题`);
      }
      if (s.hungerDeathRate > 30) {
        lines.push(`  ⚠ ${s.className} 饿死率过高 (${s.hungerDeathRate.toFixed(0)}%)，饥饿压力过大`);
      }
    }

    const maxDmgEff = Math.max(...summaries.map(s => s.damageEfficiency));
    const minDmgEff = Math.min(...summaries.map(s => s.damageEfficiency));
    if (maxDmgEff > 0 && minDmgEff / maxDmgEff < 0.5) {
      lines.push('  ⚠ 职业间伤害效率差异过大 (>2x)，建议调整弱势职业输出');
    }
  }

  // Global bug summary
  const allBugs = summaries.flatMap(s => s.bugs);
  if (allBugs.length > 0) {
    lines.push('');
    lines.push(sep);
    lines.push('  🐛 Bug检测汇总');
    lines.push(sep);
    lines.push('');

    const byCategory = new Map<string, BugReport[]>();
    for (const b of allBugs) {
      const key = `${b.severity}|${b.category}`;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(b);
    }

    const sorted = [...byCategory.entries()].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const sa = severityOrder[a[1][0].severity] ?? 3;
      const sb = severityOrder[b[1][0].severity] ?? 3;
      if (sa !== sb) return sa - sb;
      return b[1].length - a[1].length;
    });

    for (const [key, bugs] of sorted) {
      const [severity, category] = key.split('|');
      const icon = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`  ${icon} [${category}] ×${bugs.length}次`);
      // Show up to 3 unique examples
      const uniqueDetails = [...new Set(bugs.map(b => b.detail))];
      for (const detail of uniqueDetails.slice(0, 3)) {
        const example = bugs.find(b => b.detail === detail)!;
        const loc = example.floor !== undefined ? ` (F${example.floor}T${example.turn ?? '?'})` : '';
        const action = example.lastAction ? ` [${example.lastAction}]` : '';
        lines.push(`      → ${detail.slice(0, 60)}${loc}${action}`);
      }
      if (uniqueDetails.length > 3) {
        lines.push(`      → ... 还有${uniqueDetails.length - 3}条`);
      }
      lines.push('');
    }
  }

  lines.push('');
  lines.push(sep);
  return lines.join('\n');
}
