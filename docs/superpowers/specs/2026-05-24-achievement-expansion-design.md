# 成就系统扩展设计 — 最终版

## 设计理念

1. **发现驱动**：成就引导玩家探索游戏机制，而非无脑刷数
2. **记忆点**：每个成就都应该让玩家回想起一个游戏瞬间
3. **难度梯度**：自然可达 → 需要尝试 → 挑战性目标
4. **系统覆盖**：每个子系统至少2个成就

## 完整成就列表

---

### 一、深渊行迹（8个）— 楼层推进与生态

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 1 | `floor5` | 深入探索 | 到达第5层 | currentFloor >= 5 | 🪜 |
| 2 | `floor10` | 水晶探矿者 | 到达第10层 | currentFloor >= 10 | 💎 |
| 3 | `floor15` | 陵墓行者 | 到达第15层 | currentFloor >= 15 | ⚰ |
| 4 | `floor20` | 熔岩幸存者 | 到达第20层 | currentFloor >= 20 | 🌋 |
| 5 | `floor25` | 虚空触碰者 | 到达第25层 | currentFloor >= 25 | 🌀 |
| 6 | `floor30` | 深渊征服者 | 到达第30层 | currentFloor >= 30 | 💠 |
| 7 | `allBiomes` | 五行行者 | 在单局中穿越全部5种生态 | 到达过Stone+Crystal+Crypt+Lava+Void | 🗺 |
| 8 | `abyssHeartSlayer` | 终焉之刻 | 击败最终Boss深渊之心 | 击杀 abyssHeart | 👁 |

---

### 二、战斗印记（8个）— 击杀、Boss、战斗技巧

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 9 | `firstBlood` | 初次杀戮 | 击败第一个敌人 | killCount >= 1 | ⚔ |
| 10 | `bossSlayer` | Boss杀手 | 击败一个Boss | bossKillCount >= 1 | 👑 |
| 11 | `bossHunter` | Boss猎人 | 击败3个Boss | bossKillCount >= 3 | 🏆 |
| 12 | `bossCollector` | 图鉴完备 | 击败全部6种Boss | bossKillSet 包含6种boss defId | 📋 |
| 13 | `massacre` | 屠戮者 | 单局击杀100个敌人 | killCount >= 100 | 💀 |
| 14 | `lastStand` | 绝地反击 | 在1 HP时击杀一个敌人 | 击杀瞬间 player.hp === 1 | 🩸 |
| 15 | `pacifist10` | 和平主义者 | 不杀敌到达第10层 | floor >= 10 && killCount === 0 | 🕊 |
| 16 | `lowHpClear` | 刀尖起舞 | 血量低于20%时清除一层所有敌人 | 层内最后一个敌人死亡时 player.hp <= maxHp * 0.2 | 🗡 |

---

### 三、遗物追寻（6个）— 遗物收集与特殊效果

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 17 | `relicFirst` | 遗物初遇 | 获得第一件遗物 | relics.length >= 1 | 🏺 |
| 18 | `relicCollector` | 遗物收藏家 | 同时拥有5件遗物 | relics.length >= 5 | 🧿 |
| 19 | `relicHoarding` | 遗物囤积者 | 同时拥有8件遗物 | relics.length >= 8 | 🎭 |
| 20 | `voidHeartSaved` | 死里逃生 | 虚空之心触发复活 | voidHeartUsed === true | 💜 |
| 21 | `fateWeaverBlessed` | 命运编织 | 命运织布者一局内触发5次增益 | _fateWeaverCount >= 5 | 🔮 |
| 22 | `comboRingMaster` | 连击大师 | 利用连击戒指的1.5倍伤害击杀3个敌人 | comboRingKills >= 3 | 💍 |

---

### 四、元素奥秘（7个）— 元素连锁与反应

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 23 | `chainFirst` | 连锁反应 | 首次触发元素连锁 | chainReactionCount >= 1 | 🔗 |
| 24 | `chainStorm` | 元素风暴 | 触发10次元素连锁 | chainReactionCount >= 10 | 🌀 |
| 25 | `steamBurst` | 蒸汽爆破 | 触发蒸汽爆发反应（火+冰） | chainReactionTypes 包含 'steamBurst' | 💨 |
| 26 | `overload` | 雷电过载 | 触发过载反应（雷+雷） | chainReactionTypes 包含 'overload' | ⚡ |
| 27 | `corruptDischarge` | 腐化放电 | 触发腐化放电反应（雷+毒） | chainReactionTypes 包含 'corruptDischarge' | ☢ |
| 28 | `chainKill` | 元素绞杀 | 通过元素连锁伤害击杀敌人 | chainKillCount >= 1 | ☄ |
| 29 | `allChainTypes` | 元素百科 | 触发过3种以上不同连锁反应 | unique(chainReactionTypes).length >= 3 | 🌈 |

---

### 五、装备锻造（5个）— 强化、熔炉、装备

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 30 | `enhanceFirst` | 初次强化 | 成功强化装备至+1 | enhanceSuccessCount >= 1 | 🔨 |
| 31 | `enhanceMax` | 精工大师 | 将装备强化至+3 | 拥有 enhanceLevel === 3 的装备 | 💎 |
| 32 | `forgeSuccess` | 虚空锻造师 | 在虚空熔炉成功锻造 | voidForgeSuccessCount >= 1 | 🔥 |
| 33 | `forgeGambling` | 赌徒之锻 | 连续成功强化3次（不失败） | consecutiveEnhanceSuccess >= 3（峰值） | 🎲 |
| 34 | `legendaryFind` | 传说发现 | 获得一件传说级物品 | 拥有 Legendary 稀有度物品 | ✨ |

---

### 六、秘境探索（5个）— 主题房间

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 35 | `themedRoomFirst` | 秘境探索 | 首次进入主题房间 | themedRoomsVisited.length >= 1 | 🚪 |
| 36 | `themedRoomExplorer` | 万象探索者 | 进入3种不同主题的房间 | unique(themedRoomsVisited).length >= 3 | 🗺 |
| 37 | `themedRoomMaster` | 深渊百科 | 进入8种不同主题的房间 | unique(themedRoomsVisited).length >= 8 | 📚 |
| 38 | `lavaForgeRoom` | 熔炉之心 | 进入熔炉主题房间并强化装备 | themedRoomsVisited 包含 LavaForge 且在该层强化过 | 🛠 |
| 39 | `voidRiftRoom` | 虚空裂隙 | 进入虚空裂隙主题房间 | themedRoomsVisited 包含 VoidRift | ◎ |

---

### 七、命运抉择（5个）— 扩展事件

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 40 | `extEventFirst` | 奇遇 | 首次完成扩展事件 | extEventCount >= 1 | 📜 |
| 41 | `extEventVeteran` | 历练丰富 | 完成5个扩展事件 | extEventCount >= 5 | 📖 |
| 42 | `abyssGambler` | 命运赌徒 | 在深渊赌局中选择全押 | 在 abyssGamble 事件选择全押选项 | 🎰 |
| 43 | `soulFurnaceSacrifice` | 灵魂熔炉 | 在灵魂熔炉中献祭装备 | 在 soulFurnace 事件中献祭装备 | 🏭 |
| 44 | `riftHeartAccept` | 裂隙之心 | 在裂隙之心事件中选择接受虚空 | 在 riftHeart 事件中选择接受选项 | 💠 |

---

### 八、技艺精进（5个）— 技能、天赋

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 45 | `skillNovice` | 技能学徒 | 使用技能20次 | skillUseCount >= 20 | ⚡ |
| 46 | `skillMaster` | 技能大师 | 使用技能50次 | skillUseCount >= 50 | 🌩 |
| 47 | `talent3` | 天赋异禀 | 获得3个天赋 | talents.length >= 3 | 🌟 |
| 48 | `allClassClear` | 全职精通 | 三个职业各到达过第20层（跨局统计） | classReachedFloor 3种职业均 >= 20 | 🎓 |
| 49 | `scrollMaster` | 卷轴学者 | 使用10张卷轴 | scrollUseCount >= 10 | 📜 |

---

### 九、生存试炼（4个）— 饥饿、状态、极端情况

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 50 | `wellFed` | 丰衣足食 | 饱食度始终高于150到达5层 | floor >= 5 && hunger >= 150 | 🍖 |
| 51 | `statusSurvivor` | 诅咒缠身 | 同时承受3种以上负面状态仍存活 | player debuff count >= 3 | ☠ |
| 52 | `poisonKill` | 以毒攻毒 | 在中毒状态下击杀3个敌人 | poisonKillCount >= 3 | 🧪 |
| 53 | `hungerStrike` | 饥荒行者 | 饥饿值为0时存活20回合 | hungerZeroTurns >= 20 | 🦴 |

---

### 十、财富与交易（3个）— 金币、商店

| # | ID | 名称 | 描述 | 条件 | 图标 |
|---|-----|------|------|------|------|
| 54 | `goldHoarder` | 守财奴 | 单局累计拥有200金币 | gold >= 200 | 💰 |
| 55 | `shopper` | 精明买家 | 在商店购买5件物品 | shopBuyCount >= 5 | 🛒 |
| 56 | `bigSpender` | 一掷千金 | 单局在商店花费超过100金币 | totalGoldSpent >= 100 | 🤝 |

---

## 合计：56个成就

保留原16个中的13个（floor5-30共6个、firstBlood、bossSlayer、pacifist10、wellFed/glutton合并为wellFed、skillMaster、shopper、legendaryFind、talent3），升级3个（bossMaster→bossHunter+bossCollector、rich→goldHoarder 200金），新增37个。

---

## 新增 GameState 追踪字段

```typescript
// 成就追踪 — 计数器
chainReactionCount: number;          // 元素连锁总触发次数
chainKillCount: number;              // 元素连锁击杀数
enhanceSuccessCount: number;         // 强化成功次数
voidForgeSuccessCount: number;       // 虚空熔炉成功次数
extEventCount: number;               // 扩展事件完成次数
poisonKillCount: number;            // 中毒状态下击杀数
hungerZeroTurns: number;             // 饥饿值为0的回合数
totalGoldSpent: number;              // 商店总花费
comboRingKills: number;              // 连击戒指击杀数
scrollUseCount: number;              // 卷轴使用次数
consecutiveEnhanceSuccess: number;   // 连续强化成功次数（失败时重置为0）
maxConsecutiveEnhance: number;       // 历史最高连续强化次数

// 成就追踪 — 集合
themedRoomsVisited: RoomTheme[];     // 进入过的主题房间
chainReactionTypes: string[];        // 触发过的连锁反应类型ID
bossKillSet: string[];               // 击杀过的Boss defId集合

// 跨局统计（独立 localStorage key: 'abyss-echo-class-progress'）
classReachedFloor: Record<string, number>; // 各职业到达最高层
```

### 旧存档兼容

loadGame 时所有新字段提供 `?? 0` / `?? []` / `?? {}` 默认值回退。

### 递增位置

| 字段 | 递增/设置位置 |
|------|--------------|
| `chainReactionCount` | executeChainReaction() 返回后 |
| `chainKillCount` | executeChainReaction() 返回后，检查是否造成击杀 |
| `chainReactionTypes` | executeChainReaction() 返回后，push reaction.id（去重） |
| `enhanceSuccessCount` | enhanceEquipment/enhanceInventoryItem 成功时 |
| `voidForgeSuccessCount` | 虚空熔炉锻造成功时 |
| `extEventCount` | 扩展事件选择处理完成后 |
| `poisonKillCount` | 击杀敌人时检查 player 有 Poison 状态 |
| `hungerZeroTurns` | processTurn 中 hunger <= 0 时 |
| `totalGoldSpent` | 商店购买时累加 |
| `comboRingKills` | ComboRing 1.5x 伤害击杀时 |
| `scrollUseCount` | 使用卷轴时 |
| `consecutiveEnhanceSuccess` | 强化成功时 +1，失败时重置为 0 |
| `maxConsecutiveEnhance` | 更新时 Math.max(existing, consecutiveEnhanceSuccess) |
| `themedRoomsVisited` | enterFloor() 检测玩家位于主题房间时 |
| `bossKillSet` | 击杀 Boss 时 push enemy.defId（去重） |
| `classReachedFloor` | enterFloor() 时更新当前职业最高层 |

### 跨局统计

`classReachedFloor` 存储在独立 localStorage key `'abyss-echo-class-progress'`：
- 每次到达新楼层时，若 `currentFloor > classReachedFloor[playerClass]`，更新并保存
- `allClassClear` 成就在 checkAchievements 中检查此数据
- 通关/死亡不影响此数据（永久累计）

---

## 检查逻辑

### checkAchievements() 批量检查（~40个）

每回合末尾执行，检查所有基于状态阈值的成就。

### Inline 检查（~16个）

在特定动作发生时立即检查并解锁：
- `lastStand`：击杀敌人时检查 player.hp === 1
- `lowHpClear`：层内最后一个敌人死亡时
- `voidHeartSaved`：VoidHeart 复活触发时
- `enhanceFirst` / `enhanceMax` / `forgeSuccess` / `forgeGambling`：强化/锻造成功时
- `legendaryFind`：传说物品获得时
- `lavaForgeRoom` / `voidRiftRoom`：进入特定主题房间时
- `abyssGambler` / `soulFurnaceSacrifice` / `riftHeartAccept`：事件选项时
- `chainKill`：连锁击杀时
- `comboRingMaster`：连击击杀时
- `bossCollector`：Boss 击杀时
- `statusSurvivor`：状态变化时
- `allClassClear`：楼层更新时

---

## UI 更新

- GameOverScreen 成就计数从 16 更新为实际总数
- 成就面板按10个分类展示
- 未解锁成就显示图标 + 名称（描述隐藏，保持发现感）
- 已解锁成就显示完整描述

## 删除/合并的旧成就

| 旧ID | 处理 | 原因 |
|-------|------|------|
| `bossMaster` | 升级为 `bossHunter` | bossKillCount >= 3，改中文名 |
| `rich` | 升级为 `goldHoarder` | 阈值从100→200，增加难度 |
| `glutton` | 合并为 `wellFed` | 与原 glutton 条件相同，统一命名 |

保留的旧成就（13个）：floor5, floor10, floor15, floor20, floor25, floor30, firstBlood, bossSlayer, pacifist10, skillMaster, shopper, legendaryFind, talent3
