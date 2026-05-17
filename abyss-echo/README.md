# 深渊回响 (Abyss Echo)

> *在无尽的深渊中，你将何去何从？*

一款基于浏览器的 Roguelike 地牢探险游戏，使用 ANSI/ASCII 艺术风格渲染，配以程序化生成的 8-bit 芯片音乐。

![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue)
![React](https://img.shields.io/badge/React-19.x-61dafb)
![Vite](https://img.shields.io/badge/Vite-8.x-646cff)

---

## 🎮 游戏特色

- **5大生态群落** — 每个生物群系拥有独立的地牢生成算法、地图大小和专属机制
- **30+种敌人 + 5个Boss** — 每个敌人拥有独特的AI行为和特殊能力（反射、熔岩穿行、爆炸等）
- **完整物品系统** — 武器、护甲、戒指、护符、药水、卷轴、食物，含鉴定与诅咒机制
- **3种职业** — 战士/法师/游侠，各有专属技能与天赋
- **程序化生成** — 5种独立算法（BSP+循环走廊/细胞自动机/宽走廊BSP/岛屿桥梁/碎片传送门），每次游戏独一无二
- **8-bit 芯片音乐** — 9首场景BGM + 12种增强音效，程序化生成，无需音频文件
- **天赋系统** — 每3级选择一个天赋，深度定制角色成长
- **生物群系专属机制** — 回音、折射、诅咒地面、熔岩潮、虚空侵蚀
- **商店与随机事件** — 探索中的意外惊喜与交易
- **成就与传承** — 解锁成就，死亡后装备传承给下一个角色
- **暂停存档** — 每层自动保存，可暂停退出后继续，但死亡即删档

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

---

## 🏗️ 项目结构

```
src/
├── audio/              # 音频系统
│   ├── AudioManager.ts # 核心音频引擎（BGM序列器 + SFX播放 + 避让）
│   ├── musicData.ts    # 9首BGM音符序列定义
│   └── sfxData.ts      # 12种增强音效定义
├── components/         # React 组件
│   ├── App.tsx         # 主界面 + 键盘处理
│   ├── MapView.tsx     # 地图渲染（Canvas）
│   ├── StatsPanel.tsx  # 状态面板 + 小地图
│   ├── SkillBar.tsx    # 技能栏
│   ├── InventoryModal.tsx
│   ├── TalentModal.tsx
│   ├── ShopModal.tsx
│   ├── EventModal.tsx
│   ├── MiniMap.tsx
│   └── ...
├── constants/          # 游戏常量
│   └── index.ts        # 职业定义、敌人定义、物品定义、天赋、技能等
├── entities/           # 实体工厂
│   ├── Player.ts       # 玩家创建与装备逻辑
│   ├── Enemy.ts        # 敌人创建
│   └── Items.ts        # 物品创建与随机生成
├── engine/             # 游戏引擎
│   ├── Combat.ts       # 战斗计算、状态效果、BFS寻路AI
│   └── FOV.ts          # 视野计算
├── generator/          # 地牢生成
│   ├── DungeonGenerator.ts  # 路由器 + 共享工具函数
│   ├── StoneDungeonGenerator.ts    # BSP+循环走廊 (1-5F, 70×24)
│   ├── CrystalCaveGenerator.ts     # 细胞自动机洞穴 (6-10F, 80×28)
│   ├── CryptGenerator.ts           # 宽走廊BSP+墓室 (11-15F, 70×30)
│   ├── LavaCoreGenerator.ts        # 岛屿+桥梁 (16-20F, 90×28)
│   └── VoidAbyssGenerator.ts       # 碎片+传送门 (21F+, 100×32)
├── store/              # 状态管理
│   └── gameStore.ts    # Zustand 全局状态
├── types/              # 类型定义
│   └── index.ts        # 所有TypeScript接口与枚举
└── utils/              # 工具函数
    └── random.ts       # SeededRandom（Mulberry32 PRNG）
```

---

## 🎵 音频系统

游戏使用 **Web Audio API** 程序化生成所有音频，无需任何外部音频文件。

### BGM 系统
基于步进序列器（Step Sequencer）实现，使用 `OscillatorNode` 实时合成8-bit风格音乐：

| 场景 | 曲目 | BPM | 调式 | 波形 | 氛围 |
|------|------|-----|------|------|------|
| 标题画面 | `title` | 90 | C小调 | 方波 | 神秘琶音 |
| 石质地牢 1-5F | `stoneDungeon` | 120 | C小调 | 方波 | 行进节奏+鼓点 |
| 水晶溶洞 6-10F | `crystalCavern` | 110 | E小调 | 三角波 | 空灵流动 |
| 远古陵墓 11-15F | `ancientCrypt` | 100 | D小调 | 锯齿波 | 肃穆阴暗 |
| 熔岩核心 16-20F | `lavaCore` | 130 | E弗里吉亚 | 方波 | 激烈驱赶+鼓点 |
| 虚空深渊 21F+ | `voidAbyss` | 80 | C减调 | 方波+锯齿波 | 诡异不谐 |
| Boss战 | `boss` | 140 | C小调 | 方波 | 快速琶音+密集鼓点 |
| 商店 | `shop` | 100 | F大调 | 三角波 | 轻快愉悦 |
| 死亡 | `gameOver` | 60 | C小调 | 三角波 | 缓慢哀伤 |

**特性：**
- 场景自动切换：进入新楼层、进入商店、Boss出现、死亡等自动切换BGM
- 0.3秒交叉淡化
- Boss战叠加：进入Boss战时切换为Boss BGM，击败后恢复生态群落BGM
- SFX避让（Ducking）：播放音效时自动降低BGM音量

### SFX 系统
12种多阶段增强音效，使用频率扫描和包络线：

| 音效 | 描述 |
|------|------|
| `attack` | 下行扫频 + 低音冲击 |
| `hit` | 锯齿波低音撞击 |
| `critical` | 上升琶音爆发 |
| `levelup` | C大调琶音上行 |
| `pickup` | 双音叮当 |
| `door` | 木门敲击 |
| `death` | 长下行音 |
| `skill` | 上升扫频 |
| `coin` | 高频双击 |
| `trap` | 不谐和刺音 |
| `heal` | 上行闪烁 |
| `bossAppear` | 低频隆隆 + 上升音 |

---

## 🎹 操作

| 按键 | 功能 |
|------|------|
| `↑↓←→` / `WASD` / `HJKL` | 移动 |
| `空格` / `.` | 等待一回合 |
| `,` | 拾取物品 |
| `>` | 下楼 |
| `I` | 背包 |
| `Z` / `X` / `C` | 技能1/2/3 |
| `P` | 商店（在商店格上） |
| `?` | 帮助 |
| `M` | 手册 |
| `ESC` | 暂停并退出（保存进度） |

---

## 🛠️ 技术栈

- **React 19** + **TypeScript 6**
- **Vite 8** 构建
- **Zustand 5** 状态管理
- **Web Audio API** 音频合成
- **Canvas API** 地图渲染
- **SeededRandom** (Mulberry32) 确定性随机数
- **localStorage** 暂停存档（Suspend Save，加载即删档）

---

## 📄 License

MIT
