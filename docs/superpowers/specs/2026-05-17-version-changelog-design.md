# 版本号显示 & 更新日志功能设计

## 目标

在游戏 UI 中显示当前版本号，并提供游戏内更新日志查看功能。

## 设计决策

- **版本号位置**：仅标题画面（CharacterCreation）底部
- **更新日志形式**：游戏内 Modal
- **数据来源**：TypeScript 常量，随代码打包

## 1. 版本号常量

在 `src/constants/index.ts` 中新增：

```typescript
export const GAME_VERSION = '1.3.1';
```

`src/store/gameStore.ts` 中的 `SAVE_VERSION` 改为从 constants 导入 `GAME_VERSION`，不再单独定义。

`CharacterCreation.tsx` 同样导入 `GAME_VERSION` 用于显示。

## 2. 标题画面布局

在 `CharacterCreation.tsx` 底部控制提示区域上方，新增一行：

```
v1.3.1  [📜 更新日志]
```

- `v1.3.1`：灰色小字（`#555566`，`11px`）
- `📜 更新日志`：可点击按钮，淡蓝色文字（`#4488ff`），hover 时高亮
- 两者在同一行，间距 `12px`

控制提示区域整体布局变为：

```
v1.3.1  📜 更新日志        ← 新增行
方向键/WASD/HJKL 移动 │ ...  ← 现有
Z/X/C 技能 │ ...             ← 现有
```

## 3. 更新日志 Modal

### 3.1 交互

- 标题画面点击「📜 更新日志」按钮 → 打开 Modal
- Modal 内点击 `×` 或按 ESC → 关闭
- 内容可滚动（`overflow-y: auto`）

### 3.2 布局

```
┌──────────────────────────────────────┐
│  📜 更新日志                     × │
├──────────────────────────────────────┤
│                                      │
│  v1.3.1  (2026-05-17)               │
│  ─────────────────────               │
│  ⚡ 修改:                            │
│    · 食物平衡性调整...               │
│  🐛 修复:                            │
│    · 修复 foodMultiplier 问题...     │
│                                      │
│  v1.3.0  (2026-05-16)               │
│  ─────────────────────               │
│  🆕 新增:                            │
│    · 新增每日挑战模式...             │
│  ...                                 │
│                                      │
└──────────────────────────────────────┘
```

### 3.3 样式

- 全屏半透明遮罩（`rgba(0,0,0,0.7)`）
- 居中面板：`maxWidth: 500px`, `maxHeight: 70vh`
- 背景：`#0d0d1a`，边框：`1px solid #333355`，圆角 `8px`
- 标题：`16px`，颜色 `#cccccc`
- 版本号：`14px`，颜色 `#4488ff`
- 日期：`11px`，颜色 `#666677`
- 变更条目：`12px`，颜色 `#aaaabb`
- 🆕新增 绿色 `#44cc44`，⚡修改 橙色 `#ffcc44`，🐛修复 蓝色 `#4488ff`
- 与 HelpOverlay / ManualOverlay 的遮罩和面板风格一致

### 3.4 组件

新建 `src/components/ChangelogModal.tsx`，Props：

```typescript
interface ChangelogModalProps {
  onClose: () => void;
}
```

Modal 内通过 `useState` 管理自身状态，无其他外部依赖。

## 4. 更新日志数据

新建 `src/constants/changelog.ts`：

```typescript
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    added?: string[];
    modified?: string[];
    fixed?: string[];
  };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.1',
    date: '2026-05-17',
    changes: {
      modified: [...],
      fixed: [...],
    },
  },
  // 更早版本...
];
```

初始数据内容：根据项目历史（食物平衡修复、ESLint 修复等）编写 1.3.1 条目。

## 5. 涉及文件

| 文件 | 操作 |
|------|------|
| `src/constants/index.ts` | 新增 `GAME_VERSION` 常量 |
| `src/constants/changelog.ts` | 新建，定义 `ChangelogEntry` 接口和 `CHANGELOG` 数据 |
| `src/store/gameStore.ts` | 删除 `SAVE_VERSION`，改为导入 `GAME_VERSION` |
| `src/components/CharacterCreation.tsx` | 导入 `GAME_VERSION` 和 `CHANGELOG`，新增版本行和 Modal 触发 |
| `src/components/ChangelogModal.tsx` | 新建，更新日志 Modal 组件 |

## 6. 验证

- `tsc --noEmit` 通过
- `npm run lint` 通过
- `npm run build` 通过
- 标题画面显示版本号和更新日志按钮
- 点击按钮弹出 Modal，ESC 关闭
- Modal 内容可滚动
