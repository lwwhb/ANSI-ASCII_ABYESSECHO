# 生物群系专属地牢生成设计

> 日期：2026-05-17
> 状态：已确认

## 概述

将当前统一的 BSP 地牢生成器替换为 5 种独立生成算法，每种对应一个生物群系。每个生物群系拥有独特的地图布局、地图大小、环境装饰、怪物配置、补给节奏和专属机制。

## 核心目标

1. **体验差异化**：5 个生物群系玩起来像 5 个不同的游戏
2. **非线性地图**：每个生成器都产生有岔路和回路的地图
3. **渐进难度**：地图大小、敌人强度、资源紧张度随楼层递增
4. **专属机制**：每个生物群系有独特的玩法规则

## 通用变更

### 循环走廊（所有生物群系）

当前 BSP 的 `connectRooms` 只连接每对子树中最近的一对房间，产生无环树。新增 `addLoopCorridors` 后处理步骤：

- 从所有房间中随机选取 2-3 对不相邻且距离 > 10 格的房间
- 用 `carveCorridor` 连接它们，形成回路
- 回路数量 = `Math.floor(rooms.length * 0.3)`，至少 1 条

### 地图大小按生物群系区分

| 生物群系 | 地图大小 | 楼层 |
|----------|----------|------|
| 石之地城 | 70×24 | 1-5F |
| 水晶洞窟 | 80×28 | 6-10F |
| 远古墓穴 | 70×30 | 11-15F |
| 熔岩核心 | 90×28 | 16-20F |
| 虚空深渊 | 100×32 | 21F+ |

---

## 生物群系1：石之地城 (Stone Dungeon, 1-5F)

### 定位

新手教学层，让玩家学会基础操作（移动、攻击、拾取、使用道具、上下楼），但不是无脑推图。有岔路和回路，但结构清晰。

### 生成算法：改良 BSP + 循环走廊

1. 运行现有 BSP 分割和房间生成（参数调整：MIN_ROOM_SIZE=5, MAX_ROOM_SIZE=10）
2. 运行现有 `connectRooms` 连接子树房间
3. **新增**：`addLoopCorridors`，添加 2-3 条循环走廊
4. 放置门、敌人、物品、特殊格子

### 地图参数

| 参数 | 值 |
|------|-----|
| MAP_WIDTH | 70 |
| MAP_HEIGHT | 24 |
| MIN_ROOM_SIZE | 5 |
| MAX_ROOM_SIZE | 10 |
| MIN_BSP_SIZE | 8 |
| 房间填充率 | 中等 |

### 环境装饰

- 30% 房间有水洼装饰（TileType.Water，可通行但减速）
- 门的概率 15%（较高，给新手明确的"进入新区域"感）
- 陷阱概率 3%（低，新手友好）

### 怪物配置

| ID | 名称 | HP | ATK | DEF | EXP | 速度 | 元素 | 弱点 | 特殊 |
|----|------|-----|-----|-----|-----|------|------|------|------|
| slime | 史莱姆 | 8 | 3 | 0 | 5 | 1 | Poison | Fire | — |
| rat | 巨鼠 | 6 | 4 | 0 | 4 | 2 | None | — | — |
| bat | 蝙蝠 | 5 | 3 | 1 | 4 | 2 | None | Lightning | — |
| goblin | 哥布林 | 12 | 5 | 1 | 8 | 1 | None | Fire | — |
| caveScorpion | 洞穴蝎 | 10 | 4 | 1 | 6 | 1 | Poison | Fire | 毒击：20%概率施加中毒(2伤害/3回合) |
| gargoyle | 石像鬼 | 16 | 3 | 4 | 10 | 0 | None | Fire | 玩家进入视野3格内才激活 |

- **gargoyle 速度0**：不会主动移动，激活前显示为石像（静态），激活后变为普通敌人
- Boss（5F）：哥布林王，不变

### 道具/补给节奏

| 项目 | 值 |
|------|-----|
| 地面物品基础数 | 5（从3提升） |
| 物品成长系数 | 1.2 × sqrt(floor) |
| 必保补给 | 每层至少1治疗药水 + 1食物 |
| 商店概率 | 20% |
| 事件概率 | 15% |
| 卷轴掉率 | +30% |

### 专属机制：回音 (Echo)

- 当敌人在视野外但距离 ≤ 5 格时，小地图上显示一个微弱的闪烁点
- 闪烁点颜色与敌人元素相同（火=红，冰=蓝，毒=绿，无=灰）
- 不显示具体位置，只在敌人方向上显示一个模糊标记
- 实现方式：在 MiniMap 渲染中，遍历所有存活敌人，若距离 ≤ 5 且不在 visibleTiles 中，在敌人方向绘制半透明像素

---

## 生物群系2：水晶洞窟 (Crystal Cavern, 6-10F)

### 定位

探索与选择层。开放空间取代线性走廊，玩家需要判断哪些区域值得冒险。水域和光线折射增加战术深度。

### 生成算法：细胞自动机洞穴 (Cellular Automata)

1. 初始化地图：55% 概率为地板，45% 为墙壁
2. 运行 5 轮平滑规则：每个格子周围 8 格中墙壁 ≥ 5 则变墙，否则变地板
3. 洪水填充找到最大连通区域，其余填充为墙壁
4. 随机放置 3-5 个"水晶簇"（3×3 或 4×4 的房间状开阔空间）
5. 用短走廊连接不连通的水晶簇
6. 边缘区域（与墙壁相邻的地板）30% 填充为浅水（减速），5% 为深水（不可通行）

### 地图参数

| 参数 | 值 |
|------|-----|
| MAP_WIDTH | 80 |
| MAP_HEIGHT | 28 |
| CA_FILL_CHANCE | 0.55 |
| CA_SMOOTH_ROUNDS | 5 |
| CA_WALL_THRESHOLD | 5 |
| 水晶簇数量 | 3-5 |
| 水晶簇大小 | 3×3 到 4×4 |

### 环境装饰

- 不像 BSP 有明确"房间"，而是有机洞穴形态
- 水晶簇内道具/事件概率 +50%
- 20% 边缘区域为浅水（移动消耗 2 回合），5% 为深水（不可通行，视觉分隔）
- 水晶墙壁使用 BIOME_TILES 中独特的折射色（淡蓝/淡紫瓷砖）
- 陷阱概率 4%

### 怪物配置

| ID | 名称 | HP | ATK | DEF | EXP | 速度 | 元素 | 弱点 | 特殊 |
|----|------|-----|-----|-----|-----|------|------|------|------|
| skeleton | 骷髅 | 18 | 7 | 3 | 15 | 1 | None | Fire | — |
| spider | 巨蛛 | 15 | 8 | 2 | 12 | 1 | Poison | Fire | web |
| orc | 兽人 | 25 | 10 | 4 | 20 | 1 | None | — | — |
| shadow | 暗影 | 14 | 9 | 2 | 18 | 2 | Ice | Fire | — |
| crystalGuard | 水晶守卫 | 22 | 8 | 5 | 16 | 1 | None | Lightning | 反射：受到攻击时20%概率反弹50%伤害 |
| glowJelly | 荧光水母 | 10 | 6 | 0 | 10 | 1 | Poison | Fire | 发光：始终可见，进入视野3格内致盲玩家1回合 |

- **crystalGuard 反射**：在 `calculateMeleeDamage` 返回后，如果目标有反射能力且 `rng.chance(0.2)`，则攻击者受到 `floor(damage * 0.5)` 反弹伤害
- **glowJelly 致盲**：在 `updateFOV` 时，如果发光水母在玩家视野 3 格内，玩家下一回合的 FOV_RADIUS 临时降为 3
- Boss（10F）：蜘蛛女王，不变

### 道具/补给节奏

| 项目 | 值 |
|------|-----|
| 地面物品基础数 | 4 |
| 物品成长系数 | 1.2 × sqrt(floor) |
| 水晶簇内物品品质 | +1 稀有度 |
| 商店概率 | 25% |
| 事件概率 | 20% |
| 地图卷轴掉率 | +50% |

### 专属机制：折射 (Refraction)

- FOV 计算时，检查每个可见格子周围是否有水晶墙壁（BIOME_TILES 标记）
- 如果有，30% 概率将 FOV 向该方向延伸 1-2 格（绕过障碍物）
- 实现方式：在 `updateFOV` 中，对每个标记为水晶墙壁的格子，执行一次额外的短距离射线投射（长度 2），将命中的地板格子也标记为可见
- 折射看到的区域亮度略低（80%），用不同渲染区分

---

## 生物群系3：远古墓穴 (Ancient Crypt, 11-15F)

### 定位

压抑与危机层，但不至于痛苦。宽敞走廊+大型墓室+可控的毒气区域。资源开始紧张，需要精打细算。

### 生成算法：改良 BSP 墓室 + 宽走廊 + 循环路径

1. 运行 BSP 分割，参数调整使房间更大（5×5 到 7×7）但数量更少（6-8个）
2. 走廊宽度 2 格（`carveCorridor` 改为挖 2 格宽）
3. 走廊更长（连接距离更远的房间对）
4. 添加 15% 额外循环走廊
5. 随机 2-3 个墓室标记为"腐烂墓室"（充满毒气，入口有视觉提示）
6. 随机 10% 走廊墙壁格子为暗门（看起来是墙，但可推开）

### 地图参数

| 参数 | 值 |
|------|-----|
| MAP_WIDTH | 70 |
| MAP_HEIGHT | 30 |
| MIN_ROOM_SIZE | 5 |
| MAX_ROOM_SIZE | 7 |
| CORRIDOR_WIDTH | 2 |
| 循环走廊额外比例 | 0.15 |
| 腐烂墓室数量 | 2-3 |

### 环境装饰

- 走廊 2 格宽，两侧有墙壁装饰
- 腐烂墓室：整个墓室充满毒气（TileType.PoisonGas 密集），入口处有绿色雾效瓷砖作为视觉警告
- 10% 走廊交叉点有火把（纯装饰 + 提供 3 格永久小范围可见光）
- 暗门：外观与墙壁相同，但玩家走近 1 格内时显示"似乎可以推开"提示，按确认键推开
- 陷阱概率 6%
- 石棺：2-3 个墓室中有石棺，50% 开出好东西，50% 触发陷阱

### 怪物配置

| ID | 名称 | HP | ATK | DEF | EXP | 速度 | 元素 | 弱点 | 特殊 |
|----|------|-----|-----|-----|-----|------|------|------|------|
| darkKnight | 暗黑骑士 | 35 | 14 | 8 | 35 | 1 | None | Lightning | — |
| wraith | 怨灵 | 22 | 12 | 3 | 28 | 1 | Ice | Fire | drain |
| troll | 巨魔 | 45 | 11 | 6 | 30 | 1 | None | Fire | regenerate |
| mimic | 宝箱怪 | 30 | 13 | 5 | 32 | 1 | None | — | surprise |
| tombGuard | 守墓人 | 40 | 10 | 10 | 35 | 1 | None | Fire | 巡逻：固定路线来回走，发现玩家后速度+1 |
| soulEater | 噬魂者 | 18 | 15 | 1 | 30 | 3 | Ice | Fire | 幽灵移动：可穿过其他敌人，无视地形减速 |

- **tombGuard 巡逻**：初始化时生成巡逻路线（在出生墓室和相邻走廊间），未发现玩家时沿路线移动；发现玩家后速度+1并追击
- **soulEater 速度3**：每回合行动3次，但HP极低（18），是"玻璃大炮"
- Boss（15F）：死亡骑士，不变

### 道具/补给节奏

| 项目 | 值 |
|------|-----|
| 地面物品基础数 | 3 |
| 物品成长系数 | 1.0 × sqrt(floor) |
| 食物掉率 | -30%（墓穴里没东西吃） |
| 解咒/鉴定卷轴掉率 | ×2 |
| 商店概率 | 10% |
| 事件概率 | 25% |
| 石棺补给 | 主要补给来源 |

### 专属机制：诅咒之地 (Cursed Ground)

- 10% 地板格子是"诅咒地面"（TileType.CursedGround 新增）
- 踩上去时，玩家身上随机一个已装备物品获得诅咒标记（已诅咒则无事）
- 诅咒地面视觉：微弱暗紫色光效，仔细看能分辨
- 诅咒装备效果：该装备的主属性-50%（如武器伤害减半，防具防御减半）
- 解咒：使用解咒卷轴移除所有诅咒

---

## 生物群系4：熔岩核心 (Lava Core, 16-20F)

### 定位

风险与回报层。熔岩是致命但可预判的威胁，桥梁是战术咽喉。每场战斗都要考虑是否值得。

### 生成算法：岛屿 + 桥梁 (Islands + Bridges)

1. 初始化整张地图为熔岩（TileType.Lava，不可通行，每回合 8 伤害）
2. 随机放置 8-12 个"岛屿"：4×4 到 8×8 的矩形/不规则区域，材质为黑曜石地板
3. 每个岛屿至少 1 条 2 格宽的桥梁连接最近岛屿，确保连通
4. 额外添加 2-3 条"捷径桥"（1 格宽，较长），连接远距离岛屿
5. 最大岛屿放楼梯，次大岛屿放 Boss
6. 部分桥梁（20%）标记为"不稳定"——每 10 回合 20% 概率塌陷（塌陷后可绕路）
7. 岛屿边缘有冷却熔岩池（TileType.CooledLava，可踩但每回合 5 伤害）

### 地图参数

| 参数 | 值 |
|------|-----|
| MAP_WIDTH | 90 |
| MAP_HEIGHT | 28 |
| ISLAND_COUNT | 8-12 |
| ISLAND_MIN_SIZE | 4 |
| ISLAND_MAX_SIZE | 8 |
| BRIDGE_WIDTH | 2（主桥）/ 1（捷径桥） |
| UNSTABLE_BRIDGE_RATIO | 0.2 |

### 环境装饰

- 岛屿是黑曜石地板（深灰色，微红色边缘）
- 桥梁是石砖（比岛屿略浅）
- 熔岩有脉动动画效果（纯视觉，BIOME_TILES 中 Lava 瓦砖颜色微变）
- 冷却水晶：部分岛屿上有 1 个冷却水晶（踩上去消除 burn 状态）
- 1 格宽桥梁无法与敌人错身
- 陷阱概率 5%

### 怪物配置

| ID | 名称 | HP | ATK | DEF | EXP | 速度 | 元素 | 弱点 | 特殊 |
|----|------|-----|-----|-----|-----|------|------|------|------|
| demon | 恶魔 | 50 | 16 | 8 | 50 | 1 | Fire | Ice | fireball |
| gorgon | 蛇发女妖 | 55 | 14 | 10 | 55 | 1 | Poison | Fire | petrify |
| vampire | 吸血鬼 | 40 | 15 | 6 | 48 | 2 | None | Fire | drain |
| lich | 巫妖 | 45 | 18 | 5 | 60 | 1 | Ice | Fire | summon |
| lavaWorm | 熔岩虫 | 35 | 12 | 4 | 40 | 2 | Fire | Ice | 熔岩穿行：可在熔岩中移动，从熔岩中突袭 |
| obsidianGolem | 黑曜石巨人 | 70 | 8 | 15 | 55 | 0 | None | — | 守卫：站在桥梁入口，必须击败或绕路 |

- **lavaWorm 熔岩穿行**：可以进入 TileType.Lava 格子移动，每回合在熔岩中恢复 2HP；从熔岩格移动到岛屿格时，如果玩家相邻则自动攻击
- **obsidianGolem 守卫**：速度0，不移动，堵在桥梁关键位置；玩家必须击败或绕路（走冷却熔岩池）
- Boss（20F）：恶魔领主，不变

### 道具/补给节奏

| 项目 | 值 |
|------|-----|
| 地面物品基础数 | 3 |
| 物品成长系数 | 0.8 × sqrt(floor) |
| 火抗药水 | 新增掉落（5回合火焰免疫） |
| 冰属性武器/卷轴 | 掉率 +50% |
| 商店概率 | 15% |
| 事件概率 | 15% |
| 冷却水晶 | 岛屿上保底补给 |

### 专属机制：熔岩潮 (Lava Tide)

- 每 50 回合，熔岩水位上升：原来安全的边缘冷却区被淹没为 TileType.Lava
- 5 回合后退潮，恢复原状
- 小地图上熔岩潮有视觉提示（水位线变色，从暗红→亮红）
- 实现方式：在 `processTurn` 中，当 `turnCount % 50 === 0` 时，将所有 TileType.CooledLava 替换为 TileType.Lava；5 回合后恢复
- 效果：强迫玩家移动，不能长时间停留在一个岛屿

---

## 生物群系5：虚空深渊 (Void Abyss, 21F+)

### 定位

终极挑战层。空间规则被打破，传送、碎片化区域、高密度精英怪。每一层都是对玩家所有能力的综合考验。

### 生成算法：混沌碎片 + 传送门 (Void Fragments + Portals)

1. 生成 4-6 个碎片区域，每个用不同的小型生成器：
   - 2 个用 BSP 生成的小型地牢片段（5×5 到 8×8）
   - 1-2 个用细胞自动机生成的小洞穴（6×6 到 10×8）
   - 1 个手工模板的"虚空圣所"（7×7，中央有祭坛）
2. 碎片之间不物理连通，完全被虚空墙（TileType.VoidWall 新增）隔开
3. 每个碎片有 1-2 个传送门（TileType.Portal 新增），踩上传送到另一个碎片
4. 传送门是双向的，但目标碎片随机（不是固定映射）
5. 玩家起点在第一个碎片，楼梯在虚空圣所碎片中
6. 5% 虚空墙格子是"裂隙"——外观相同但踩上去可穿越到相邻碎片

### 地图参数

| 参数 | 值 |
|------|-----|
| MAP_WIDTH | 100 |
| MAP_HEIGHT | 32 |
| FRAGMENT_COUNT | 4-6 |
| FRAGMENT_MIN_SIZE | 5 |
| FRAGMENT_MAX_SIZE | 10 |
| PORTALS_PER_FRAGMENT | 1-2 |
| RIFT_CHANCE | 0.05 |

### 环境装饰

- 碎片内部是正常的地牢/洞穴，但很小
- 碎片之间被深紫色虚空墙包围
- 传送门有脉动光效（紫/蓝色交替）
- 虚空圣所：深紫色瓷砖，中央虚空祭坛（可互动）
- 裂隙：外观与虚空墙相同，但走近 1 格内有微弱提示
- 陷阱概率 7%

### 怪物配置

| ID | 名称 | HP | ATK | DEF | EXP | 速度 | 元素 | 弱点 | 特殊 |
|----|------|-----|-----|-----|-----|------|------|------|------|
| dragon | 巨龙 | 80 | 22 | 12 | 100 | 1 | Fire | Ice | breath |
| voidWalker | 虚空行者 | 60 | 20 | 8 | 80 | 2 | Lightning | — | teleport |
| ancientOne | 远古存在 | 100 | 25 | 15 | 150 | 1 | Poison | Fire | eldritch |
| voidWeaver | 虚空织者 | 55 | 18 | 6 | 70 | 2 | None | Fire | 传送：每3回合传送到玩家视野内随机位置 |
| mirrorImage | 镜像体 | 1 | 玩家ATK×0.5 | 0 | 5 | 等同玩家 | None | — | 复制：玩家进入碎片时生成，模仿玩家外观，死亡时爆炸造成15伤害 |

- **voidWeaver 传送**：每 3 回合检查，如果 `rng.chance(0.5)` 则传送到玩家可见范围内随机可通行格子
- **mirrorImage 复制**：玩家首次进入碎片时，在碎片入口对面生成 1 个镜像体，使用玩家外观和名称；HP=1 一击即死，但死亡时对 3 格范围内造成 15 伤害
- Boss（25F）：深渊之王，不变
- Boss（30F+循环）：深渊之王属性按 +15% 每 5 层缩放

### 道具/补给节奏

| 项目 | 值 |
|------|-----|
| 地面物品基础数 | 2 |
| 物品成长系数 | 0.6 × sqrt(floor) |
| 碎片入口保底 | 1 补给品（药水或食物） |
| 虚空祭坛 | 献祭1件装备换取完全恢复（HP/MP/饱食度全满），装备永久消失 |
| 商店概率 | 5% |
| 事件概率 | 10% |
| 传送门卷轴 | 新增掉落：使用后在当前位置创建临时传送门 |

### 专属机制：虚空侵蚀 (Void Corruption)

- 在虚空碎片中每待 20 回合，随机一项属性临时 -1
- 属性选择概率：力量/灵巧/智力/体质各 25%
- 离开碎片（通过传送门）时侵蚀暂停计数
- 回到已探索过的碎片时侵蚀重置为 0
- 侵蚀造成的属性降低是临时的，下楼（enterFloor）时自动恢复
- 实现方式：在 GameState 中新增 `voidCorruption: { str: number; dex: number; int: number; vit: number }` 字段，每 20 回合检查并增加；`enterFloor` 时重置为 0

---

## 新增 TileType

| TileType | 用途 | 可通行 | 透明 | 伤害 |
|-----------|------|--------|------|------|
| ShallowWater | 浅水区（水晶洞窟） | 是 | 是 | 移动消耗2回合（减速） |
| CursedGround | 诅咒地面（墓穴） | 是 | 是 | 30%几率诅咒随机装备 |
| CooledLava | 冷却熔岩池（熔岩核心） | 是 | 是 | 5/回合（火抗减免至1） |
| VoidWall | 虚空墙壁（虚空深渊） | 否 | 否 | — |
| Portal | 传送门（虚空深渊） | 是 | 是 | — |
| Sarcophagus | 石棺（墓穴，可互动） | 否 | 否 | — |
| Torch | 火把（墓穴，装饰+照明） | 否 | 是 | — |

## 新增 ENEMY_DEFS

### caveScorpion（石之地城）
```typescript
{
  id: 'caveScorpion', name: '洞穴蝎', char: 's', fg: '#88aa44',
  hp: 10, attack: 4, defense: 1, exp: 6, speed: 1,
  element: Element.Poison, weakness: Element.Fire, resistance: Element.Poison,
  special: 'poisonSting', alertRadius: 5, behavior: 'aggressive',
  minFloor: 1, dropChance: 0.25, goldDrop: 3,
}
```

### gargoyle（石之地城）
```typescript
{
  id: 'gargoyle', name: '石像鬼', char: 'G', fg: '#888888',
  hp: 16, attack: 3, defense: 4, exp: 10, speed: 0,
  element: Element.None, weakness: Element.Fire, resistance: Element.None,
  special: 'dormant', alertRadius: 3, behavior: 'stationary',
  minFloor: 1, dropChance: 0.35, goldDrop: 8,
}
```

### crystalGuard（水晶洞窟）
```typescript
{
  id: 'crystalGuard', name: '水晶守卫', char: 'C', fg: '#88ccff',
  hp: 22, attack: 8, defense: 5, exp: 16, speed: 1,
  element: Element.None, weakness: Element.Lightning, resistance: Element.None,
  special: 'reflect', alertRadius: 6, behavior: 'aggressive',
  minFloor: 6, dropChance: 0.3, goldDrop: 12,
}
```

### glowJelly（水晶洞窟）
```typescript
{
  id: 'glowJelly', name: '荧光水母', char: 'j', fg: '#aaffcc',
  hp: 10, attack: 6, defense: 0, exp: 10, speed: 1,
  element: Element.Poison, weakness: Element.Fire, resistance: Element.Poison,
  special: 'glare', alertRadius: 4, behavior: 'aggressive',
  minFloor: 6, dropChance: 0.2, goldDrop: 5,
}
```

### tombGuard（远古墓穴）
```typescript
{
  id: 'tombGuard', name: '守墓人', char: 'Š', fg: '#887766',
  hp: 40, attack: 10, defense: 10, exp: 35, speed: 1,
  element: Element.None, weakness: Element.Fire, resistance: Element.None,
  special: 'patrol', alertRadius: 5, behavior: 'aggressive',
  minFloor: 11, dropChance: 0.3, goldDrop: 15,
}
```

### soulEater（远古墓穴）
```typescript
{
  id: 'soulEater', name: '噬魂者', char: 'W', fg: '#aa66ff',
  hp: 18, attack: 15, defense: 1, exp: 30, speed: 3,
  element: Element.Ice, weakness: Element.Fire, resistance: Element.Ice,
  special: 'phaseThrough', alertRadius: 7, behavior: 'aggressive',
  minFloor: 11, dropChance: 0.25, goldDrop: 12,
}
```

### lavaWorm（熔岩核心）
```typescript
{
  id: 'lavaWorm', name: '熔岩虫', char: 'w', fg: '#ff6622',
  hp: 35, attack: 12, defense: 4, exp: 40, speed: 2,
  element: Element.Fire, weakness: Element.Ice, resistance: Element.Fire,
  special: 'lavaSwim', alertRadius: 6, behavior: 'aggressive',
  minFloor: 16, dropChance: 0.3, goldDrop: 18,
}
```

### obsidianGolem（熔岩核心）
```typescript
{
  id: 'obsidianGolem', name: '黑曜石巨人', char: 'O', fg: '#443344',
  hp: 70, attack: 8, defense: 15, exp: 55, speed: 0,
  element: Element.None, weakness: Element.None, resistance: Element.None,
  special: 'blockade', alertRadius: 3, behavior: 'stationary',
  minFloor: 16, dropChance: 0.4, goldDrop: 25,
}
```

### voidWeaver（虚空深渊）
```typescript
{
  id: 'voidWeaver', name: '虚空织者', char: 'V', fg: '#cc44ff',
  hp: 55, attack: 18, defense: 6, exp: 70, speed: 2,
  element: Element.None, weakness: Element.Fire, resistance: Element.None,
  special: 'blink', alertRadius: 8, behavior: 'aggressive',
  minFloor: 21, dropChance: 0.35, goldDrop: 22,
}
```

### mirrorImage（虚空深渊）
```typescript
{
  id: 'mirrorImage', name: '镜像体', char: '©', fg: '#ff44ff',
  hp: 1, attack: 0, defense: 0, exp: 5, speed: 1,
  element: Element.None, weakness: Element.None, resistance: Element.None,
  special: 'mirrorExplode', alertRadius: 10, behavior: 'aggressive',
  minFloor: 21, dropChance: 0, goldDrop: 0,
}
```

## 新增物品

### 火抗药水（熔岩核心掉落）
```typescript
{ id: 'fireResistPotion', name: '火抗药水', effect: 'FireResist', power: 5, rarity: 'Rare' }
```
- 使用后 5 回合内大幅减免火焰伤害（冷却熔岩5→1，火焰陷阱减免2/3）

### 传送门卷轴（虚空深渊掉落）
```typescript
{ id: 'portalScroll', name: '传送门卷轴', effect: 'CreatePortal', power: 1, rarity: 'Epic' }
```
- 使用后在当前位置创建一个临时传送门，连接到当前楼层的一个随机碎片

## 新增事件

### 虚空祭坛（虚空深渊专属）
```typescript
{
  id: 'voidAltar', name: '虚空祭坛',
  choices: [
    { text: '献祭装备', effect: 'sacrificeEquip' },   // 移除1件装备，完全恢复HP/MP/饱食度
    { text: '献祭生命', effect: 'sacrificeHP' },       // -30HP，+3随机属性
    { text: '离开', effect: 'leave' },
  ]
}
```

## GameState 新增字段

```typescript
// 虚空侵蚀计数
voidCorruption: {
  str: number;  // 默认0
  dex: number;  // 默认0
  int: number;  // 默认0
  vit: number;  // 默认0
};

// 当前碎片中已过回合数（用于侵蚀计算）
currentFragmentTurns: number;  // 默认0

// 熔岩潮状态
lavaTideActive: boolean;  // 默认false
lavaTideTurnsRemaining: number;  // 默认0
lavaTideTiles: { x: number; y: number }[];  // 默认[]

// 额外回合消耗（浅水减速等）
extraTurnCost: number;  // 默认0
```

## 文件变更概览

### 新增文件
- `src/generator/StoneDungeonGenerator.ts` — BSP + 循环走廊
- `src/generator/CrystalCaveGenerator.ts` — 细胞自动机洞穴
- `src/generator/CryptGenerator.ts` — 宽走廊 BSP + 墓室
- `src/generator/LavaCoreGenerator.ts` — 岛屿 + 桥梁
- `src/generator/VoidAbyssGenerator.ts` — 碎片 + 传送门

### 修改文件
- `src/constants/index.ts` — MAP 宽高改为函数、新增 ENEMY_DEFS、新增 TileType、新增物品
- `src/types/index.ts` — 新增 TileType 枚举值、GameState 字段、Enemy special 类型
- `src/generator/DungeonGenerator.ts` — 改为路由到各生物群系生成器
- `src/store/gameStore.ts` — 新机制逻辑（回音、折射、诅咒、熔岩潮、侵蚀）
- `src/components/MiniMap.tsx` — 回音闪烁点渲染
- `src/components/MapView.tsx` — 新 TileType 渲染
- `src/engine/Combat.ts` — 反射伤害、镜像体爆炸
- `src/engine/FOV.ts` — 折射机制
- `src/entities/Items.ts` — 新物品类型
- `src/entities/Enemy.ts` — 新敌人特殊能力
