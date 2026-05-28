# 宝箱怪伪装机制 + 守墓犬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 宝箱怪伪装成地面物品（非食物），玩家拾取时现出原形并发动突袭，击杀后掉落稀有物品；同时为墓室新增"守墓犬"敌人替代宝箱怪在 enemyIds 中的位置。

**Architecture:** 在 `FloorItem` 上加 `isMimic` 标记，`enterFloor()` 生成物品后以 5% 概率将一个非食物物品标记为 mimic。`pickupItem()` 检测到 mimic 时删除假物品、在相邻可行走格 spawn 宝箱怪敌人、手动触发 surprise 突袭伤害。守墓犬使用 `CallAlly` 行为 + `howl` 特殊能力，发现玩家时嚎叫召唤1只额外敌人。

**Tech Stack:** React 19 + TypeScript + Zustand (no new dependencies)

---

## File Structure

| File | Change | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify `FloorItem` | 加 `isMimic?: boolean` 字段 |
| `src/constants/index.ts` | Modify mimic 定义 + 新增守墓犬 + biome enemyIds | 去掉 minFloor 限制，提高 dropChance；新增守墓犬；从 Crypt enemyIds 移除 mimic 加入守墓犬 |
| `src/store/gameStore.ts` | Modify `enterFloor()` + `pickupItem()` + 特殊能力 switch + 敌人击杀掉落 | 生成伪装物品（排除食物）、触发揭示、守墓犬嚎叫逻辑、保证稀有掉落 |
| `src/simulation/ai-player.ts` | 可选：无改动 | mimic 不再从 enemyIds 生成，AI 拾取时会自然触发揭示 |

---

### Task 1: FloorItem 加 `isMimic` 字段

**Files:**
- Modify: `src/types/index.ts:574`

- [ ] **Step 1: 给 FloorItem 接口加 `isMimic` 可选字段**

在 `src/types/index.ts` 的 `FloorItem` 接口中加一行：

```typescript
export interface FloorItem {
  item: Item;
  pos: Position;
  isMimic?: boolean;  // 伪装成物品的宝箱怪
}
```

- [ ] **Step 2: 验证类型检查通过**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit`
Expected: 无新增错误

---

### Task 2: 更新宝箱怪定义 + 新增守墓犬 + 更新 biome 配置

**Files:**
- Modify: `src/constants/index.ts:263` (mimic 定义)
- Modify: `src/constants/index.ts:716` (AncientCrypt enemyIds)
- Add new enemy definition after mimic line

- [ ] **Step 1: 更新 mimic 敌人定义**

将 mimic 定义从：

```typescript
{ id: 'mimic',     name: '宝箱怪',   char: 'M', fg: '#ccaa44', hp: 42, attack: 13, defense: 7,  exp: 32, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 11, speed: 1, dropChance: 0.5, alertRadius: 2, specialAbility: 'surprise', goldDrop: 25 },
```

改为：

```typescript
{ id: 'mimic',     name: '宝箱怪',   char: 'M', fg: '#ccaa44', hp: 42, attack: 13, defense: 7,  exp: 32, behavior: EnemyBehavior.Stationary,  element: Element.None,       weakness: Element.None,       resistance: Element.None,       minFloor: 1, speed: 1, dropChance: 0.8, alertRadius: 2, specialAbility: 'surprise', goldDrop: 40 },
```

变更：`minFloor: 11` → `1`，`dropChance: 0.5` → `0.8`，`goldDrop: 25` → `40`

- [ ] **Step 2: 在 mimic 行之后新增守墓犬定义**

在 mimic 行后插入：

```typescript
  { id: 'graveHound', name: '守墓犬',   char: 'Ð', fg: '#887744', hp: 38, attack: 14, defense: 5,  exp: 28, behavior: EnemyBehavior.CallAlly,     element: Element.None,       weakness: Element.Lightning,  resistance: Element.None,       minFloor: 11, speed: 2, dropChance: 0.35, alertRadius: 7, specialAbility: 'howl', goldDrop: 18 },
```

设计说明：
- `char: 'Ð'` — 獠牙犬齿造型（与巨龙 `Ð` 形近但颜色不同 `#887744` vs `#ff4422`，且墓室F11-15与巨龙F20+不重叠）
- `hp: 38, atk: 14, def: 5` — 脆皮高速型，比墓室其他怪低HP但高ATK，配合 speed=2 制造紧迫感
- `CallAlly` 行为 — 发现玩家时给同类加速（现有机制），同时 `howl` 能力额外召唤1只敌人
- `alertRadius: 7` — 大警戒范围，符合犬类敏锐嗅觉
- `weakness: Lightning` — 对应其快速但脆弱的特点

- [ ] **Step 3: 更新 AncientCrypt enemyIds**

```typescript
// 从：
['darkKnight', 'wraith', 'troll', 'mimic', 'tombGuard', 'soulEater', 'demon', 'gorgon'],
// 改为：
['darkKnight', 'wraith', 'troll', 'graveHound', 'tombGuard', 'soulEater', 'demon', 'gorgon'],
```

- [ ] **Step 4: 验证类型检查**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit`

---

### Task 3: enterFloor() 中生成伪装物品（排除食物）

**Files:**
- Modify: `src/store/gameStore.ts` (enterFloor 中 items 生成后，约 L1875)

- [ ] **Step 1: 在 enterFloor() 的 items 生成循环之后加 mimic 伪装逻辑**

需要在文件顶部确认 `ItemType` 已导入（已有，`import { ItemType }` 在 store 中使用）。

在 `enterFloor()` 函数中，找到创建 items 的 for 循环结束位置（约第 1875 行），在 hidden rooms 循环之前，插入：

```typescript
    // 宝箱怪伪装：5% 概率将一个非食物物品变成伪装宝箱怪
    if (items.length > 0 && rng.chance(0.05)) {
      const nonFoodIndices = items
        .map((fi, idx) => fi.item.type !== ItemType.Food ? idx : -1)
        .filter(idx => idx >= 0);
      if (nonFoodIndices.length > 0) {
        const mimicIdx = rng.pick(nonFoodIndices);
        items[mimicIdx] = { ...items[mimicIdx], isMimic: true };
      }
    }
```

关键：`nonFoodIndices` 过滤掉 `ItemType.Food` 的物品，确保宝箱怪只伪装成装备/药水/卷轴等，不会在拾取食物时出现。敌人掉落、商店、事件的物品不经过此代码，天然安全。

- [ ] **Step 2: 验证类型检查**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit`

---

### Task 4: pickupItem() 中处理宝箱怪揭示

**Files:**
- Modify: `src/store/gameStore.ts` pickupItem action (约 L3433-3470)

- [ ] **Step 1: 在 pickupItem 中检测 isMimic 并处理**

在 `pickupItem()` 的 for 循环内，找到 `if (items[i].pos.x === pos.x && items[i].pos.y === pos.y)` 分支，在 `if (player.inventory.length < getMaxInventorySize(player))` 判断**之前**插入 mimic 检测逻辑。

将原来的：

```typescript
for (let i = 0; i < items.length; i++) {
    if (items[i].pos.x === pos.x && items[i].pos.y === pos.y) {
      if (player.inventory.length < getMaxInventorySize(player)) {
```

改为：

```typescript
for (let i = 0; i < items.length; i++) {
    if (items[i].pos.x === pos.x && items[i].pos.y === pos.y) {
      // 宝箱怪伪装揭示
      if (items[i].isMimic) {
        const mimicPos = items[i].pos;
        items.splice(i, 1);

        // 在相邻可行走格寻找 spawn 位置
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        let spawnPos: Position | null = null;
        for (const [dx, dy] of dirs) {
          const sx = mimicPos.x + dx;
          const sy = mimicPos.y + dy;
          if (sy >= 0 && sy < state.map.length && sx >= 0 && sx < state.map[0].length
              && state.map[sy][sx].walkable
              && !state.enemies.some(e => e.hp > 0 && e.pos.x === sx && e.pos.y === sy)) {
            spawnPos = { x: sx, y: sy };
            break;
          }
        }

        if (spawnPos) {
          // Spawn 宝箱怪敌人
          const mimic = createEnemy('mimic', spawnPos, false, state.currentFloor);
          if (mimic) {
            const updatedEnemies = [...state.enemies, mimic];
            // 立即触发 surprise 突袭
            const surpriseDamage = Math.floor(mimic.attack * 2);
            const defense = player.stats.vit + (player.equipment.armor?.defense ?? 0);
            const actualDamage = Math.max(1, Math.floor(surpriseDamage * 20 / (20 + defense)));
            const shield = applyManaShield(player, actualDamage);
            player.hp -= shield.hpDamage;
            player.mp -= shield.mpAbsorbed;

            addMessages([msg('宝箱怪现出原形！', MessageCategory.Combat, '#ff4444')]);
            addFloatingText(spawnPos.x, spawnPos.y, '宝箱怪!', '#ccaa44', 'crit');
            addFloatingText(player.pos.x, player.pos.y, `-${shield.hpDamage}`, '#ff4444', 'damage');
            if (shield.mpAbsorbed > 0) addFloatingText(player.pos.x, player.pos.y, `-${shield.mpAbsorbed}MP`, '#4488ff', 'status');
            addMessages([msg(`宝箱怪突然袭击！造成 ${shield.hpDamage} 点伤害！${shield.mpAbsorbed > 0 ? ` 法力护盾吸收${shield.mpAbsorbed}点！` : ''}`, MessageCategory.Combat, '#ff4444')]);
            flashScreen('#ff440033');
            AudioManager.playSFX('trap');

            set({ player, items, enemies: updatedEnemies });
            processTurn();
            return;
          }
        } else {
          // 无相邻空格：宝箱怪咬了就跑（当陷阱处理）
          const baseDamage = 26; // mimic base attack 13 × 2
          const defense = player.stats.vit + (player.equipment.armor?.defense ?? 0);
          const actualDamage = Math.max(1, Math.floor(baseDamage * 20 / (20 + defense)));
          const shield = applyManaShield(player, actualDamage);
          player.hp -= shield.hpDamage;
          player.mp -= shield.mpAbsorbed;

          addMessages([msg('宝箱怪咬了你一口就消失了！', MessageCategory.Combat, '#ff4444')]);
          addFloatingText(player.pos.x, player.pos.y, `-${shield.hpDamage}`, '#ff4444', 'damage');
          flashScreen('#ff440033');
          AudioManager.playSFX('trap');

          set({ player, items });
          processTurn();
          return;
        }
      }

      if (player.inventory.length < getMaxInventorySize(player)) {
```

- [ ] **Step 2: 验证类型检查和构建**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit && npm run build`

---

### Task 5: 守墓犬"嚎叫"特殊能力实现

**Files:**
- Modify: `src/store/gameStore.ts` 特殊能力 switch (约 L1460-1490 附近，`case 'summon'` 同级)

- [ ] **Step 1: 在特殊能力 switch 中添加 `howl` case**

在 `case 'summon': { ... break; }` 之后、`case 'breath':` 之前，添加：

```typescript
      case 'howl': {
        const state = get();
        const biome = getBiomeForFloor(state.currentFloor);
        const config = BIOME_CONFIG[biome];
        const safeEnemyIds = config.enemyIds.filter(id => {
          const def = ENEMY_DEFS.find(d => d.id === id);
          return !def || def.specialAbility !== 'howl';
        });
        const pool = safeEnemyIds.length > 0 ? safeEnemyIds : config.enemyIds;
        const defId = rng.pick(pool);
        const offset = { x: rng.nextInt(-2, 2), y: rng.nextInt(-2, 2) };
        const spawnPos = { x: enemy.pos.x + offset.x, y: enemy.pos.y + offset.y };
        let actualSummoned = 0;
        if (spawnPos.x >= 0 && spawnPos.x < state.width && spawnPos.y >= 0 && spawnPos.y < state.height && state.map[spawnPos.y][spawnPos.x].walkable) {
          const summoned = createEnemy(defId, spawnPos, false, state.currentFloor);
          if (summoned) { enemies.push(summoned); actualSummoned++; }
        }
        messages.push(msg(`${enemy.name}发出凄厉的嚎叫！${actualSummoned > 0 ? '唤来了1个援军！' : ''}`, MessageCategory.Combat, '#ff8844'));
        AudioManager.playSFX('alarm');
        break;
      }
```

设计说明：
- 与 `summon` 类似但只召唤1只（非1-2只），避免墓室敌人数量失控
- 排除自身 `howl` 能力的敌人，防止嚎叫链式递归
- 使用 `alarm` SFX（急促高频音效，与嚎叫氛围匹配）

- [ ] **Step 2: 验证类型检查**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit`

---

### Task 6: 宝箱怪保证 Rare+ 掉落

**Files:**
- Modify: `src/store/gameStore.ts` 敌人击杀掉落逻辑 (约 L2675-2681)

- [ ] **Step 1: 在敌人击杀掉落处加 mimic 特殊处理**

当前代码：

```typescript
          // Drop item
          const dropChance = getTalentModifiedDropChance(player, enemy.dropChance);
          if (rng.chance(dropChance)) {
            const luckBonus = hasTalent(player, 'lucky') ? 0.05 : 0;
            const droppedItem = createRandomItem(state.currentFloor, rng, true, luckBonus, BIOME_CONFIG[getBiomeForFloor(state.currentFloor)].foodDropMultiplier);
```

替换为：

```typescript
          // Drop item
          const dropChance = getTalentModifiedDropChance(player, enemy.dropChance);
          if (rng.chance(dropChance)) {
            const luckBonus = hasTalent(player, 'lucky') ? 0.05 : 0;
            // 宝箱怪保底 Rare+ 稀有度掉落
            const mimicBonus = enemy.defId === 'mimic' ? 0.15 : 0;
            const droppedItem = createRandomItem(state.currentFloor, rng, true, luckBonus + mimicBonus, BIOME_CONFIG[getBiomeForFloor(state.currentFloor)].foodDropMultiplier);
```

`luckBonus + 0.15` 会使 `rollRarity()` 中 Rare 阈值从 `0.15 + floorBonus` 提升到 `0.30 + floorBonus`，确保在 floor ≥ 3 时掉落 Rare+ 品质。

- [ ] **Step 2: 验证构建**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit && npm run build`

---

### Task 7: 最终验证

**Files:** 无文件修改

- [ ] **Step 1: 运行完整类型检查 + 构建**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npx tsc --noEmit && npm run build`

- [ ] **Step 2: 验证存档兼容性**

`FloorItem.isMimic?: boolean` 是可选字段：
- 旧存档没有此字段 → 反序列化后 `isMimic` 为 `undefined`（falsy），不会触发 mimic 逻辑 ✅
- 新存档有此字段 → 正常序列化/反序列化 ✅
- 无需修改 save/load 代码

- [ ] **Step 3: 验证渲染兼容**

MapView 中物品渲染只读取 `itemHere.item.char` 和 `itemHere.item.fg`，不读取 `isMimic`，所以伪装物品和普通物品渲染完全一致 ✅

- [ ] **Step 4: 验证敌人掉落物品安全**

敌人击杀掉落（L2675-2681）、商店购买、事件奖励等来源的 FloorItem 不经过 `enterFloor()` 的 mimic 标记代码，永远不会被标记为 `isMimic` ✅

- [ ] **Step 5: 运行 ESLint**

Run: `cd /Users/haibowang/Desktop/ANSI-ASCII_ABYESSECHO/abyss-echo && npm run lint`

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ 伪装机制：FloorItem.isMimic + pickupItem 检测
- ✅ 排除食物：nonFoodIndices 过滤
- ✅ 稀有出现：5% 概率/层
- ✅ 所有地图可用：minFloor 改为 1
- ✅ 跳到相邻格：pickupItem 中查找相邻可行走格
- ✅ 无空格 fallback：咬了就跑的陷阱模式
- ✅ 稀有掉落：mimicBonus 0.15 保证 Rare+
- ✅ 从 placeEnemies 移除：AncientCrypt enemyIds 中移除 mimic
- ✅ 守墓犬替代：graveHound 定义 + howl 能力 + Crypt enemyIds 加入
- ✅ 仅地图初始物品：只有 enterFloor() 标记，敌人掉落/商店/事件不经过

**2. Placeholder scan:** 无 TBD/TODO/placeholder

**3. Type consistency:**
- `FloorItem.isMimic?: boolean` — 定义和使用处一致
- `createEnemy('mimic', pos, false, floor)` — 参数类型匹配
- `applyManaShield(player, damage)` — 返回 `{ hpDamage, mpAbsorbed }`，与使用处一致
- `spawnPos: Position | null` — 类型正确
- `rng.pick(nonFoodIndices)` — `nonFoodIndices` 为 `number[]`，`pick` 返回 `number`，用作数组索引正确
- 守墓犬 `char: 'Ð'` — 与巨龙同字符但 `fg` 不同且楼层不重叠（F11-15 vs F20+）
