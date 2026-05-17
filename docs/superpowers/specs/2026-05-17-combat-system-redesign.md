# 深渊回响 — 战斗系统重设计 v3

## 研究参考

| 游戏 | 防御公式 | 特点 |
|------|----------|------|
| **PoE** | `DR% = Armour/(Armour + 5×Dmg)` | 递减，小伤减得多大伤减得少 |
| **DCSS** | `dmg - random(0, AC)` + GDR保底 | 纯减法，高AC随机减伤 |
| **Pixel Dungeon** | 武器[min,max] - 护甲roll | 伤害区间+护甲roll两次取均 |
| **Brogue** | `hitProb = acc × 0.987^def` | 纯闪避，无减伤 |
| **Angband** | `DR% = AC/400` | 纯百分比 |

**核心问题**：纯减法公式 `attack - defense` 在攻击远大于防御时防御毫无意义，防御≥攻击时伤害为0。乘算公式 `attack × K/(K+defense)` 更优：防御永远有效，但永远不会完全免疫。

---

## 一、核心公式 — 三层战斗流程

```
攻击流程：命中判定 → 伤害计算 → 暴击判定
       ↓miss      ↓hit       ↓crit
       0伤害      正常伤害    ×倍率伤害
```

### 第一层：命中与闪避

```
hitChance = attackerAccuracy / (attackerAccuracy + defenderEvasion)
hitChance = clamp(hitChance, 0.05, 0.95)
```

- 5%保底命中，95%命中上限——永远有风险，永远有希望
- **物理攻击**参与闪避判定
- **魔法攻击**（火球、闪电链、龙息、敌人特殊技能）**不参与闪避**，必中

### 第二层：伤害与减伤（乘算公式）

```
rawDamage = attackPower + random(-2, +2)
reducedDamage = max(1, floor(rawDamage × 20 / (20 + defense)))
```

- `K=20` 是减伤常数，决定防御的"软硬度"
- DEF=0 → 100%伤害穿透
- DEF=5 → ~80%穿透（减20%）
- DEF=10 → ~67%穿透（减33%）
- DEF=20 → ~50%穿透（减半）
- DEF=40 → ~33%穿透（减67%）
- **永远不会减到0**——即使重甲也不会无敌

### 第三层：暴击

```
critChance = baseCrit + DEX/300   (玩家)
critChance = enemyCritChance       (敌人)
critMultiplier = 1.5  (DeadlyStrike → 2.0)
```

暴击在减伤之后计算，避免"暴击被防御吃掉"的问题：

```
finalDamage = max(1, floor(reducedDamage × elementalMult))
if (crit) finalDamage = floor(finalDamage × critMultiplier)
```

---

## 二、玩家数值

### 攻击力（Attack Power）

```
meleePower = floor(STR / 2) + weaponDmg
magicPower = floor(INT × 1.5) + spellPower
```

### 命中值（Accuracy）

```
accuracy = 10 + floor(DEX / 3) + level
```

| 等级 | 战士(DEX≈10) | 法师(DEX≈10) | 盗贼(DEX≈16) |
|------|--------------|--------------|--------------|
| 1 | 14 | 14 | 16 |
| 5 | 18 | 18 | 20 |
| 10 | 23 | 23 | 25 |
| 15 | 28 | 28 | 30 |
| 20 | 33 | 33 | 35 |

### 闪避值（Evasion）

```
evasion = 5 + floor(DEX / 2) + armor.evasion
```

| 护甲 | evasion | 10级战士(DEX=14) | 10级盗贼(DEX=20) |
|------|---------|-------------------|-------------------|
| 无甲 | 0 | 12 | 15 |
| 布甲 | +3 | 15 | 18 |
| 皮甲 | +1 | 13 | 16 |
| 暗影长袍 | +4 | 16 | 19 |
| 锁子甲 | -2 | 10 | 13 |
| 板甲 | -3 | 9 | 12 |
| 龙鳞甲 | -2 | 10 | 13 |
| 虚空之铠 | -1 | 11 | 14 |

**设计意图**：轻甲=高闪避低减伤，重甲=低闪避高减伤，玩家需要二选一。

### 防御值（Defense）

```
defense = floor(DEX / 3) + armorDefense + talentBonuses
```

与当前计算方式一致，不变。

### 玩家属性成长参考

战士每级获得：+3属性点、+5 HP、+2 MP

| 等级 | STR | DEX | INT | VIT | HP | 典型武器 | 典型护甲 | DEF | Evasion | meleePower |
|------|-----|-----|-----|-----|-----|---------|---------|-----|---------|------------|
| 1 | 14 | 8 | 6 | 12 | 66 | 匕首(3) | 无(0) | 2 | 9 | 10 |
| 3 | 15 | 10 | 7 | 13 | 79 | 短剑(5) | 布甲(2) | 5 | 13 | 12 |
| 5 | 16 | 12 | 8 | 14 | 97 | 长剑(8) | 皮甲(4) | 8 | 12 | 16 |
| 8 | 18 | 13 | 9 | 15 | 110 | 长剑(8) | 锁子甲(6) | 10 | 12 | 17 |
| 10 | 20 | 14 | 10 | 16 | 123 | 雷霆锤(11) | 锁子甲(6) | 10 | 10 | 21 |
| 13 | 22 | 15 | 11 | 18 | 144 | 暗影匕首(12) | 板甲(9) | 14 | 10 | 23 |
| 15 | 24 | 16 | 12 | 19 | 157 | 毁灭斧(16) | 龙鳞甲(12) | 17 | 11 | 28 |
| 20 | 28 | 18 | 14 | 22 | 196 | 深渊之刃(20) | 虚空之铠(15) | 21 | 13 | 34 |

注：属性分配为参考值（偏重STR/VIT的战士典型分配），实际玩家可自由分配。

---

## 三、线性难度曲线设计

### 设计原则

1. **每生态威胁/回合线性增长**：每个生态的"危险度"比上一个增加约+2.0
2. **击杀时间稳步增长**：1-2击→2击→2-3击→3-4击→4-5击
3. **玩家存活时间稳步缩短**：体现挑战性递增
4. **无生态间跳跃或平台**：熔岩不应比陵墓更简单
5. **Boss难度与常规敌人同步线性增长**

### 难度曲线验证（调整前 vs 调整后）

**参考战士在各生态中段的"被击杀回合数"：**

| 生态 | 玩家HP | 调整前威胁/回合 | 调整前存活 | 调整后威胁/回合 | 调整后存活 |
|------|--------|----------------|-----------|----------------|-----------|
| 石窟 | 79 | 1.2 | 66 | 1.5 | 53 |
| 水晶 | 97 | 3.0 | 32 | 3.2 | 30 |
| 陵墓 | 123 | 4.2 | 29 | 5.1 | 24 |
| 熔岩 | 144 | 4.0 | 36 ← 反弹！ | 7.2 | 20 |
| 虚空 | 157 | 5.6 | 28 | 9.7 | 16 |

**调整后威胁/回合增长**：1.5 → 3.2 → 5.1 → 7.2 → 9.7（+1.7, +1.9, +2.1, +2.5）

**调整后击杀回合数增长**：53 → 30 → 24 → 20 → 16（每生态约-20%存活时间）

### 核心调整策略

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 水晶→陵墓跳跃过大 | 陵墓敌人ATK从8跳到12.5 | 适当提高水晶ATK，平滑过渡 |
| 陵墓→熔岩反而更安全 | 熔岩ATK仅+10% vs 玩家DEF+40% | 熔岩ATK大幅提升(+4~6) |
| 熔岩→虚空增长不足 | 虚空ATK增长不够覆盖DEF增长 | 虚空ATK提升(+6~8)，DEF提升 |
| 后期敌人accuracy过低 | 熔岩avg accuracy=12=水晶水平 | 每生态accuracy递增+2 |
| Boss后期无区分度 | 恶魔领主/深渊之王威胁相近 | 提高后期Boss ATK，降低HP减少磨蹭 |

---

## 四、敌人完整数值（线性调整后）

### EnemyDef 新增字段

```typescript
accuracy: number;    // 命中值，默认10
evasion: number;     // 闪避值，默认0
critChance?: number; // 暴击率，默认0.05
critMult?: number;   // 暴击倍率，默认1.3
```

### 第1-5层：石窟

| id | 名称 | char | HP | ATK | DEF | acc | eva | 设计意图 |
|----|------|------|-----|-----|-----|-----|-----|---------|
| slime | 史莱姆 | § | 8 | 4 | 0 | 10 | 2 | 慢但容易命中 |
| rat | 巨鼠 | Я | 6 | 4 | 0 | 8 | 8 | 快速但攻击不准 |
| bat | 蝙蝠 | ψ | 5 | 3 | 1 | 6 | 12 | 极难命中，弱攻击 |
| goblin | 哥布林 | ǥ | 12 | 6 | 1 | 12 | 5 | 石窟最强 |
| caveScorpion | 洞穴蝎 | π | 10 | 5 | 1 | 10 | 4 | 带毒刺 |
| gargoyle | 石像鬼 | Γ | 16 | 4 | 4 | 8 | 0 | 定点，闪避为0 |

> ATK调整：slime +1, goblin +1, caveScorpion +1, gargoyle +1
> 理由：原ATK=3-5范围让1级战士过于轻松，提升至3-6保持快速击杀感但减少白打回合

### 第6-10层：水晶洞穴

| id | 名称 | char | HP | ATK | DEF | acc | eva | 设计意图 |
|----|------|------|-----|-----|-----|-----|-----|---------|
| skeleton | 骷髅 | S | 18 | 8 | 3 | 12 | 3 | 稳健 |
| spider | 巨蛛 | ╳ | 15 | 9 | 2 | 10 | 0 | 定点带网 |
| orc | 兽人 | Ω | 25 | 10 | 4 | 14 | 2 | 强力但笨 |
| shadow | 暗影 | ω | 14 | 10 | 2 | 12 | 10 | 高闪避 |
| crystalGuard | 水晶守卫 | C | 22 | 9 | 5 | 12 | 3 | 反射型 |
| glowJelly | 荧光水母 | µ | 10 | 7 | 0 | 10 | 6 | 飘忽 |

> ATK调整：skeleton +1, spider +1, shadow +1, crystalGuard +1, glowJelly +1
> 理由：平滑石窟→水晶过渡，让水晶整体ATK区间6-10而非6-8

### 第11-15层：陵墓

| id | 名称 | char | HP | ATK | DEF | acc | eva | 设计意图 |
|----|------|------|-----|-----|-----|-----|-----|---------|
| darkKnight | 暗黑骑士 | Ķ | 35 | 14 | 8 | 16 | 4 | 精准重甲 |
| wraith | 怨灵 | R | 22 | 13 | 3 | 14 | 8 | 飘忽吸血 |
| troll | 巨魔 | T | 45 | 12 | 6 | 12 | 2 | 笨重再生 |
| mimic | 宝箱怪 | M | 30 | 14 | 5 | 14 | 0 | 定点突袭 |
| tombGuard | 守墓人 | Š | 40 | 12 | 8 | 14 | 3 | 稳健巡逻 |
| soulEater | 噬魂者 | Ψ | 22 | 14 | 2 | 14 | 10 | 高闪避穿透 |

> ATK调整：wraith +1, troll +1, mimic +1, tombGuard +2 (ATK), DEF -2
> SoulEater: HP +4, ATK -1, DEF +1 — 原来是玻璃大炮(HP=18/ATK=15/DEF=1)，调整为更平衡(HP=22/ATK=14/DEF=2)
> TombGuard: DEF 10→8，避免过度堆防导致玩家打不动
> 理由：陵墓→熔岩的平滑过渡需要ATK稳步增长到14范围

### 第16-20层：熔岩核心 ★关键调整

| id | 名称 | char | HP | ATK | DEF | acc | eva | 设计意图 |
|----|------|------|-----|-----|-----|-----|-----|---------|
| demon | 恶魔 | Δ | 50 | 22 | 10 | 18 | 4 | 强力火球 |
| gorgon | 蛇发女妖 | Φ | 55 | 20 | 12 | 16 | 6 | 石化威胁 |
| vampire | 吸血鬼 | √ | 40 | 20 | 8 | 18 | 8 | 快速高闪避 |
| lich | 巫妖 | L | 45 | 24 | 8 | 16 | 4 | 召唤+高伤 |
| lavaWorm | 熔岩虫 | ₩ | 35 | 18 | 6 | 14 | 6 | 熔岩穿梭 |
| obsidianGolem | 黑曜石巨人 | Θ | 70 | 14 | 16 | 12 | 0 | 定点铁壁 |

> **★ 核心调整**：ATK 全线提升 +4~6，DEF 提升 +2~3，accuracy 提升 +2~4
>
> 原因：这是难度曲线断裂的关键点。原熔岩ATK=8~18(avg 13.8)，几乎不比陵墓(ATK=10~15, avg 12.5)强，但玩家此时DEF从10跳到14（板甲），导致实际受伤反而更少。
> 
> 调整后ATK=14~24(avg 19.7)，配合accuracy从avg 12提升到avg 16，确保：
> - 熔岩比陵墓明显更危险（威胁 7.2 vs 5.1，+41%）
> - 单次伤害在10-15范围（对144HP战士约7-10%），有挑战性但不会秒杀
> - OBSIDIAN GOLEM保持低ATK高DEF定位，但ATK从8提到14避免毫无威胁

### 第21+层：虚空深渊 ★关键调整

| id | 名称 | char | HP | ATK | DEF | acc | eva | 设计意图 |
|----|------|------|------|-----|-----|-----|-----|---------|
| dragon | 巨龙 | Ð | 80 | 30 | 15 | 20 | 6 | 综合强+龙息 |
| voidWalker | 虚空行者 | Ø | 60 | 28 | 10 | 18 | 8 | 传送+高伤 |
| ancientOne | 远古存在 | A | 100 | 32 | 16 | 20 | 4 | 精准+克苏鲁 |
| voidWeaver | 虚空织者 | Λ | 55 | 26 | 10 | 16 | 8 | 高闪避+闪烁 |
| mirrorImage | 镜像体 | © | 1 | 0 | 0 | 6 | 14 | 极难命中但1HP |

> **★ 核心调整**：ATK 全线提升 +6~8，DEF 提升 +2~4，accuracy 提升 +2~4
>
> 原因：原虚空ATK=18~25(avg 21.3)看似高，但乘算减伤下被DEF=17的战士大幅削弱。调整后ATK=26~32(avg 29)，确保：
> - 虚空是游戏最危险的生态（威胁 9.7 vs 熔岩 7.2，+35%）
> - 单次伤害在13-18范围（对157HP战士约8-11%），有紧迫感
> - 远古存在不再是"和巨龙差不多"——ATK=32搭配acc=20成为最危险常规敌人

### Boss数值（线性调整后）

| id | 名称 | char | HP | ATK | DEF | acc | eva | 设计意图 |
|----|------|------|-----|-----|-----|-----|-----|---------|
| goblinKing | 哥布林王 | ₲ | 50 | 10 | 5 | 16 | 4 | 入门Boss |
| spiderQueen | 蜘蛛女王 | Q | 95 | 16 | 6 | 18 | 6 | 中期Boss |
| deathKnight | 死亡骑士 | Ҝ | 150 | 24 | 10 | 20 | 4 | 高难度Boss |
| demonLord | 恶魔领主 | & | 190 | 35 | 14 | 22 | 2 | 后期强Boss |
| abyssKing | 深渊之王 | Å | 200 | 45 | 14 | 24 | 4 | 终极DPS竞速 |

> Boss调整逻辑：
> - **蜘蛛女王**：HP 80→95, ATK 14→16 — 原2阶Boss太脆，提升存活和威胁
> - **死亡骑士**：HP 120→150, ATK 20→24, DEF 12→10 — 用HP换DEF（减少"打不动"感），ATK大幅提升
> - **恶魔领主**：HP 160→190, ATK 25→35 — 原Boss威胁与死亡骑士差距太小，需拉开
> - **深渊之王**：HP 250→200, ATK 30→45, DEF 18→14 — 从"磨血型"改为"DPS竞速型"
>   原设计：高HP高DEF低ATK→磨很久但不危险→体验差
>   新设计：中HP低DEF超高ATK→必须快速击杀→紧张刺激
>   玩家有10回合左右击杀，Boss能在8-10回合内杀死玩家——资源管理关键

### Boss击杀与被击杀验证

| Boss | 玩家击杀回合 | Boss击杀玩家回合 | 体验 |
|------|--------------|-------------------|------|
| 哥布林王 | ~6 | ~18 | 安全教学 ✓ |
| 蜘蛛女王 | ~10 | ~14 | 需要注意血量 ✓ |
| 死亡骑士 | ~12 | ~11 | 压力对等 ✓ |
| 恶魔领主 | ~14 | ~9 | 需要治疗/技能 ✓ |
| 深渊之王 | ~13 | ~8 | DPS竞速，全资源投入 ✓ |

### 敌人暴击

| 类型 | critChance | critMult |
|------|-----------|----------|
| 普通敌人 | 0.05 | 1.3 |
| Boss | 0.10 | 1.5 |

---

## 五、护甲 evasion 调整

| 护甲 | 现有evasion | 新evasion | defense | 定位 |
|------|------------|-----------|---------|------|
| 布甲 | 0 | +3 | 2 | 闪避流 |
| 皮甲 | 2 | +1 | 4 | 平衡型 |
| 锁子甲 | 0 | -2 | 6 | 减伤型 |
| 板甲 | 0 | -3 | 9 | 纯减伤 |
| 暗影长袍 | 5 | +4 | 5 | 法师闪避 |
| 龙鳞甲 | 0 | -2 | 12 | 重型减伤 |
| 虚空之铠 | 0 | -1 | 15 | 终极护甲 |

---

## 六、难度曲线完整验证

### 参考战士在各生态的平均战斗体验

| 生态 | 等级 | HP | DEF | Evasion | 武器 | meleePower |
|------|------|-----|-----|---------|------|------------|
| 石窟 | 3 | 79 | 5 | 13 | 短剑(5) | 12 |
| 水晶 | 6 | 97 | 8 | 12 | 长剑(8) | 16 |
| 陵墓 | 10 | 123 | 10 | 10 | 雷霆锤(11) | 21 |
| 熔岩 | 13 | 144 | 14 | 10 | 暗影匕首(12) | 23 |
| 虚空 | 15 | 157 | 17 | 11 | 毁灭斧(16) | 28 |

### 防御方：敌人→玩家威胁

| 生态 | 平均ATK | 平均acc | 命中率 | 减伤后伤害 | 威胁/回合 | 存活回合 |
|------|---------|---------|--------|-----------|-----------|---------|
| 石窟 | 4.3 | 9 | 41% | 3.4 | 1.4 | 56 |
| 水晶 | 8.8 | 12 | 50% | 6.3 | 3.2 | 30 |
| 陵墓 | 13.2 | 14 | 58% | 8.8 | 5.1 | 24 |
| 熔岩 | 19.7 | 16 | 62% | 11.6 | 7.2 | 20 |
| 虚空 | 29.0 | 19 | 63% | 15.7 | 9.9 | 16 |

**威胁增长**：1.4 → 3.2 → 5.1 → 7.2 → 9.9 — 近似线性（+1.8, +1.9, +2.1, +2.7）

**存活缩短**：56 → 30 → 24 → 20 → 16 — 每生态约-20%存活时间

### 攻击方：玩家→敌人击杀速度

| 生态 | 平均HP | 平均DEF | 伤害/击 | 命中率 | 击杀回合 |
|------|--------|---------|---------|--------|---------|
| 石窟 | 9.5 | 1.0 | 11.4 | 76% | 1.1 |
| 水晶 | 17.3 | 2.8 | 14.0 | 83% | 1.5 |
| 陵墓 | 31.7 | 5.3 | 16.6 | 83% | 2.3 |
| 熔岩 | 49.2 | 10.0 | 13.3 | 85% | 4.3 |
| 虚空 | 73.8 | 12.8 | 17.2 | 81% | 5.3 |

**击杀增长**：1.1 → 1.5 → 2.3 → 4.3 → 5.3 — 稳步增长，战斗越来越有份量

### 三职业对比（10级时，陵墓生态）

| 职业 | HP | DEF | Evasion | vs暗黑骑士存活 | vs暗黑骑士击杀 |
|------|-----|-----|---------|---------------|---------------|
| 战士 | 123 | 10 | 10 | 24回合 | 2.3回合 |
| 法师 | 93 | 8 | 16 | 14回合 | 1.5回合（魔法必中） |
| 盗贼 | 112 | 9 | 16 | 18回合 | 2.6回合 |

- 战士：最安全（24回合存活），中等击杀速度
- 法师：最危险（14回合存活），最快击杀（远程+魔法必中）
- 盗贼：中等安全（18回合存活），最慢击杀（依赖暴击）

### 三职业对比（15级时，虚空生态 vs 巨龙）

| 职业 | HP | DEF | Evasion | vs巨龙存活 | vs巨龙击杀 |
|------|-----|-----|---------|-----------|-----------|
| 战士 | 157 | 17 | 11 | 10回合 | 4.2回合 |
| 法师 | 93 | 10 | 15 | 5.8回合 | 2.3回合 |
| 盗贼 | 112 | 13 | 18 | 7.5回合 | 4.8回合 |

- 虚空生态对法师极其危险——必须保持距离，依赖火球/闪链秒杀
- 盗贼靠闪避和暗影步爆发生存
- 战士依然最稳，但10回合存活意味着需要合理使用药水和技能

---

## 七、伤害公式汇总

### 近战伤害（玩家 → 敌人）

```
attackPower = floor(STR / 2) + weaponDmg
rawDamage = attackPower + rng.nextInt(-2, 2)
reducedDamage = max(1, floor(rawDamage × 20 / (20 + enemy.defense)))
elementalDamage = floor(reducedDamage × elementalMult)  // 1.0 / 1.5 / 0.5
if (crit) elementalDamage = floor(elementalDamage × critMultiplier)
// 天赋加成叠加...
```

### 近战伤害（敌人 → 玩家）

```
attackPower = enemy.attack
rawDamage = attackPower + rng.nextInt(-2, 2)
totalDefense = getPlayerDefense(player) + talentBonuses
reducedDamage = max(1, floor(rawDamage × 20 / (20 + totalDefense)))
if (crit) reducedDamage = floor(reducedDamage × enemyCritMult)
```

### 魔法伤害（玩家 → 敌人，必中）

```
attackPower = floor(INT × 1.5) + spellPower
effectiveDefense = hasSpellPenetration ? floor(defense × 0.5) : defense
reducedDamage = max(1, floor(attackPower × 20 / (20 + effectiveDefense)))
elementalDamage = floor(reducedDamage × elementalMult)
```

**注意**：魔法防御效率更高（直接用 defense 而非 ×0.6），因为魔法本身已必中。

### 敌人特殊技能（必中）

```
damage = floor(enemy.attack × skillMultiplier)
reducedDamage = max(1, floor(damage × 20 / (20 + totalPlayerDefense)))
```

- 技能倍率不变（fireball 1.5×, drain 0.8×, breath 1.8×, surprise 2×, etc.）
- 特殊技能现在也受防御减伤，而非之前直接穿透

### 技能伤害

| 技能 | 公式 | 参与闪避 |
|------|------|---------|
| 盾击 | `floor(STR × 0.5)` | ✓ 近战 |
| 旋风斩 | `floor(weaponDmg × 1.5 + STR × 0.5)` | ✓ 近战 |
| 火球术 | `20 + floor(INT × 0.5)` | ✗ 魔法必中 |
| 闪电链 | `18 + floor(INT × 0.3)` | ✗ 魔法必中 |
| 暗影步 | `floor((weaponDmg × 2 + STR) × critMult / 1.5)` | ✓ 近战 |
| 扇刃 | `10 + floor(DEX × 0.5)` | ✓ 近战 |

---

## 八、战斗流程详解

### 玩家近战攻击敌人

```
Step 1: 闪避判定
  accuracy = getPlayerAccuracy(player)
  evasion = enemy.evasion
  hitChance = clamp(accuracy / (accuracy + evasion), 0.05, 0.95)
  if (!rng.chance(hitChance)) → MISS，消息："你攻击了巨鼠，但未命中！" (#888899)

Step 2: 基础伤害
  attackPower = floor(STR / 2) + weaponDmg
  rawDamage = attackPower + rng.nextInt(-2, 2)

Step 3: 防御减伤（乘算）
  reducedDamage = max(1, floor(rawDamage × 20 / (20 + enemy.defense)))

Step 4: 元素倍率
  reducedDamage = floor(reducedDamage × elementalMult)

Step 5: 暴击
  critChance = 0.05 + DEX / 300
  if (rng.chance(critChance))
    reducedDamage = floor(reducedDamage × critMult)  // 1.5× or 2.0×
    消息："暴击！对巨鼠造成{n}点伤害！" (#ffcc44)

Step 6: 天赋加成
  - BloodFury: +floor(STR × 0.3 × (1 - hp/maxHp))
  - ElementalAffinity: ×1.2 if weapon has element
  - PoisonBlade/ToxicBlade: apply status

Step 7: 应用伤害
  enemy.hp -= finalDamage
  消息："你攻击了巨鼠，造成{n}点伤害！" (#cccccc)
```

### 敌人近战攻击玩家

```
Step 1: 闪避判定
  hitChance = clamp(enemy.accuracy / (enemy.accuracy + playerEvasion), 0.05, 0.95)
  if (!rng.chance(hitChance)) → MISS，消息："巨鼠攻击了你，但你闪避了！" (#44cc44)

Step 2: 基础伤害
  rawDamage = enemy.attack + rng.nextInt(-2, 2)

Step 3: 防御减伤（乘算）
  totalDefense = getPlayerDefense(player) + talentBonuses
  reducedDamage = max(1, floor(rawDamage × 20 / (20 + totalDefense)))

Step 4: 暴击
  if (rng.chance(enemyCritChance))
    reducedDamage = floor(reducedDamage × enemyCritMult)
    消息："巨鼠暴击！造成{n}点伤害！" (#ff2222)

Step 5: 应用伤害
  player.hp -= reducedDamage
  消息："巨鼠攻击了你，造成{n}点伤害！" (#ff4444)
```

---

## 九、战斗日志消息

| 事件 | 消息 | 颜色 |
|------|------|------|
| 玩家 miss | "你攻击了{enemy}，但未命中！" | #888899 |
| 玩家命中 | "你攻击了{enemy}，造成{n}点伤害！" | #cccccc |
| 玩家暴击 | "暴击！对{enemy}造成{n}点伤害！" | #ffcc44 |
| 敌人 miss | "{enemy}攻击了你，但你闪避了！" | #44cc44 |
| 敌人命中 | "{enemy}攻击了你，造成{n}点伤害！" | #ff4444 |
| 敌人暴击 | "{enemy}暴击！造成{n}点伤害！" | #ff2222 |

---

## 十、数值变更汇总

### ENEMY_DEFS 变更（相比当前代码）

| id | 字段 | 当前值 | 新值 | 变更 |
|----|------|--------|------|------|
| **石窟** |||||
| slime | attack | 3 | 4 | +1 |
| goblin | attack | 5 | 6 | +1 |
| caveScorpion | attack | 4 | 5 | +1 |
| gargoyle | attack | 3 | 4 | +1 |
| **水晶** |||||
| skeleton | attack | 7 | 8 | +1 |
| spider | attack | 8 | 9 | +1 |
| shadow | attack | 9 | 10 | +1 |
| crystalGuard | attack | 8 | 9 | +1 |
| glowJelly | attack | 6 | 7 | +1 |
| **陵墓** |||||
| wraith | attack | 12 | 13 | +1 |
| troll | attack | 11 | 12 | +1 |
| mimic | attack | 13 | 14 | +1 |
| tombGuard | attack | 10 | 12 | +2 |
| tombGuard | defense | 10 | 8 | -2 |
| soulEater | hp | 18 | 22 | +4 |
| soulEater | attack | 15 | 14 | -1 |
| soulEater | defense | 1 | 2 | +1 |
| **熔岩 ★** |||||
| demon | attack | 16 | 22 | +6 |
| demon | defense | 8 | 10 | +2 |
| gorgon | attack | 14 | 20 | +6 |
| gorgon | defense | 10 | 12 | +2 |
| vampire | attack | 15 | 20 | +5 |
| vampire | defense | 6 | 8 | +2 |
| lich | attack | 18 | 24 | +6 |
| lich | defense | 5 | 8 | +3 |
| lavaWorm | attack | 12 | 18 | +6 |
| lavaWorm | defense | 4 | 6 | +2 |
| obsidianGolem | attack | 8 | 14 | +6 |
| obsidianGolem | defense | 15 | 16 | +1 |
| **虚空 ★** |||||
| dragon | attack | 22 | 30 | +8 |
| dragon | defense | 12 | 15 | +3 |
| voidWalker | attack | 20 | 28 | +8 |
| voidWalker | defense | 8 | 10 | +2 |
| ancientOne | attack | 25 | 32 | +7 |
| ancientOne | defense | 15 | 16 | +1 |
| voidWeaver | attack | 18 | 26 | +8 |
| voidWeaver | defense | 6 | 10 | +4 |

### BOSS_DEFS 变更

| id | 字段 | 当前值 | 新值 | 变更 |
|----|------|--------|------|------|
| spiderQueen | hp | 80 | 95 | +15 |
| spiderQueen | attack | 14 | 16 | +2 |
| deathKnight | hp | 120 | 150 | +30 |
| deathKnight | attack | 20 | 24 | +4 |
| deathKnight | defense | 12 | 10 | -2 |
| demonLord | hp | 160 | 190 | +30 |
| demonLord | attack | 25 | 35 | +10 |
| abyssKing | hp | 250 | 200 | -50 |
| abyssKing | attack | 30 | 45 | +15 |
| abyssKing | defense | 18 | 14 | -4 |

### 新增 accuracy / evasion 值

所有敌人新增 accuracy 和 evasion 字段（见第四节各表）。

---

## 十一、涉及文件

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | EnemyDef 新增 accuracy, evasion, critChance?, critMult? |
| `src/constants/index.ts` | 所有 ENEMY_DEFS 添加 accuracy/evasion/critChance/critMult + ATK/DEF/HP调整；BOSS_DEFS 调整；ARMOR_DEFS 调整 evasion |
| `src/engine/Combat.ts` | 重写 calculateMeleeDamage 为三层流程；新增 calculateHitChance()；敌人暴击支持；乘算减伤公式 |
| `src/entities/Player.ts` | 新增 getPlayerAccuracy()、getPlayerEvasion() |
| `src/entities/Enemy.ts` | createEnemy() 读取新字段 |
| `src/store/gameStore.ts` | 玩家攻击加入闪避判定；敌人攻击加入闪避+暴击+乘算减伤；技能伤害改乘算减伤；特殊技能改乘算减伤；更新所有战斗消息 |
| `src/components/ManualOverlay.tsx` | 更新战斗系统说明 |
