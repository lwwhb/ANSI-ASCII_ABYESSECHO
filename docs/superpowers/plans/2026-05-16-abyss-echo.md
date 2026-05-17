# 深渊回响 (Abyss Echo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete browser-based Roguelike game with ANSI/ASCII art visuals using React + TypeScript

**Architecture:** Single-page React app with Zustand state management. Game engine drives turn-based loop. Dungeon generator creates floors via BSP algorithm. Rendering uses monospace font with ANSI color mapping via CSS.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, CSS Grid

---

## File Structure

```
abyss-echo/
├── public/
├── src/
│   ├── types/
│   │   └── index.ts              # All TypeScript types/interfaces
│   ├── constants/
│   │   └── index.ts              # Game constants, tile defs, color map
│   ├── utils/
│   │   └── random.ts             # Seeded RNG
│   ├── generator/
│   │   ├── DungeonGenerator.ts   # BSP dungeon generation
│   │   └── biomes.ts             # Biome configurations
│   ├── engine/
│   │   ├── FOV.ts                # Field of view / fog of war
│   │   └── Combat.ts            # Damage calc, elemental effects
│   ├── entities/
│   │   ├── Player.ts            # Player logic
│   │   ├── Enemy.ts             # Enemy definitions and AI
│   │   └── Items.ts             # Item definitions
│   ├── store/
│   │   └── gameStore.ts         # Zustand store
│   ├── components/
│   │   ├── App.tsx              # Root component
│   │   ├── GameScreen.tsx       # Main game layout
│   │   ├── MapView.tsx          # Tile map renderer
│   │   ├── StatsPanel.tsx       # Right stats panel
│   │   ├── MessageLog.tsx       # Bottom message log
│   │   ├── InventoryModal.tsx   # Inventory overlay
│   │   ├── CharacterCreation.tsx# Class selection screen
│   │   ├── GameOverScreen.tsx   # Death/high score screen
│   │   └── LevelUpModal.tsx     # Level up stat allocation
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `abyss-echo/` (Vite React TS project)

- [ ] **Step 1: Initialize Vite project**

```bash
cd /Users/haibowang/Desktop/ASCI\&ASCII && npm create vite@latest abyss-echo -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
cd abyss-echo && npm install && npm install zustand
```

- [ ] **Step 3: Clean boilerplate and verify dev server**

Remove default Vite boilerplate from App.tsx, App.css, index.css. Replace App.tsx with minimal component. Run `npm run dev` to verify.

- [ ] **Step 4: Initialize git and commit**

```bash
git init && git add -A && git commit -m "chore: scaffold vite + react + ts project"
```

---

### Task 2: Types and Constants

**Files:**
- Create: `src/types/index.ts`
- Create: `src/constants/index.ts`
- Create: `src/utils/random.ts`

- [ ] **Step 1: Create types/index.ts with all game types**

Define: Position, Tile, TileType, Biome, Entity, Player, Enemy, Item, ItemType, Rarity, ElementalType, StatusEffect, Message, GameState, CharacterClass, StatAllocation, EquipmentSlot.

- [ ] **Step 2: Create constants/index.ts with tile/color/enemy/item definitions**

Define: TILE_DEFS (character, fg, bg, walkable, transparent for each tile type), COLOR_MAP (ANSI color name to hex), ENEMY_DEFS, ITEM_DEFS, CLASS_DEFS.

- [ ] **Step 3: Create utils/random.ts with seeded RNG**

Implement a simple seeded PRNG (mulberry32) with methods: next(), nextInt(min, max), pick(array), shuffle(array).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add types, constants, and seeded RNG"
```

---

### Task 3: Dungeon Generation

**Files:**
- Create: `src/generator/DungeonGenerator.ts`
- Create: `src/generator/biomes.ts`

- [ ] **Step 1: Implement BSP dungeon generator**

BSP tree algorithm: split map recursively into partitions, create rooms inside partitions, connect with corridors. Place stairs down, distribute items and enemies based on floor number.

- [ ] **Step 2: Implement biome configurations**

5 biomes with different tile sets, enemy pools, item pools, and environmental characteristics. Biomes cycle every 10 floors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: implement BSP dungeon generator with biomes"
```

---

### Task 4: FOV and Visibility

**Files:**
- Create: `src/engine/FOV.ts`

- [ ] **Step 1: Implement recursive shadowcasting FOV**

Raycasting-based field of view calculation. Takes map and player position, returns set of visible tile positions. Respects wall transparency.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: implement FOV with recursive shadowcasting"
```

---

### Task 5: Combat System

**Files:**
- Create: `src/engine/Combat.ts`

- [ ] **Step 1: Implement combat calculations**

Melee damage: STR + weapon bonus - enemy DEF. Ranged: DEX + weapon - DEF/2. Magic: INT*spellPower, costs MP. Elemental modifiers (2x weak, 0.5x resist). Critical hits on high DEX.

- [ ] **Step 2: Implement status effects**

Poison (DOT), Burn (DOT + reduced DEF), Freeze (skip turn), Bleed (DOT). Each has duration and tick logic.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: implement combat system with elements and effects"
```

---

### Task 6: Entities

**Files:**
- Create: `src/entities/Player.ts`
- Create: `src/entities/Enemy.ts`
- Create: `src/entities/Items.ts`

- [ ] **Step 1: Implement Player factory**

Create player with class-based stats, HP/MP calculation, level up logic, stat allocation, equipment slots, inventory management, hunger system.

- [ ] **Step 2: Implement Enemy definitions and AI**

20+ enemy types with stats, behavior (aggressive, cowardly, patrolling, stationary, boss). AI: move toward player if visible, patrol if not, flee if low HP for cowardly types.

- [ ] **Step 3: Implement Item definitions**

All item types: weapons, armor, rings, amulets, potions, scrolls, food. Rarity tiers with random enchantments. Identification system for potions/scrolls.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: implement player, enemies, and items"
```

---

### Task 7: Game Store and Engine

**Files:**
- Create: `src/store/gameStore.ts`

- [ ] **Step 1: Implement Zustand game store**

Full game state: player, map, entities, items, messages, floor number, turn, game phase (creation/playing/inventory/levelup/gameover). Actions: movePlayer, attackEnemy, pickupItem, useItem, equipItem, descendStairs, newGame, allocateStats, etc.

- [ ] **Step 2: Implement turn processing logic**

When player acts: process player action → process enemy AI → tick effects → update FOV → check death → add messages.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: implement game store with turn processing"
```

---

### Task 8: UI Components - Core Rendering

**Files:**
- Create: `src/components/MapView.tsx`
- Create: `src/components/StatsPanel.tsx`
- Create: `src/components/MessageLog.tsx`
- Create: `src/components/GameScreen.tsx`
- Modify: `src/components/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Implement MapView component**

Render game map as a grid of monospace characters. Each tile = one character cell. Use inline styles for ANSI colors. Apply FOV visibility (bright visible, dim remembered, dark unseen). Show entities and items on top of tiles.

- [ ] **Step 2: Implement StatsPanel component**

Display: player name/class/level, HP/MP bars, hunger bar, STR/DEX/INT/VIT stats, equipped items, floor number, turn count.

- [ ] **Step 3: Implement MessageLog component**

Scrolling list of recent game messages with color coding. Auto-scroll to bottom.

- [ ] **Step 4: Implement GameScreen layout**

CSS Grid layout: MapView (left, ~80x24 chars), StatsPanel (right), MessageLog (bottom). Keyboard input handler for all game controls.

- [ ] **Step 5: Style index.css**

Dark theme, monospace font, tile sizing, scrollbar styling, animation for damage flashes.

- [ ] **Step 6: Wire up App.tsx**

App switches between CharacterCreation → GameScreen → GameOverScreen based on game phase.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: implement core UI components and game layout"
```

---

### Task 9: Game Flow Screens

**Files:**
- Create: `src/components/CharacterCreation.tsx`
- Create: `src/components/GameOverScreen.tsx`
- Create: `src/components/InventoryModal.tsx`
- Create: `src/components/LevelUpModal.tsx`

- [ ] **Step 1: Implement CharacterCreation screen**

ANSI art title, 3 class choices with descriptions and stat previews. Name input. Start button.

- [ ] **Step 2: Implement GameOverScreen**

Death message with ANSI art skull. Show stats: floor reached, enemies killed, turns survived. High scores from localStorage. Restart button.

- [ ] **Step 3: Implement InventoryModal**

Grid of inventory items with icons, names, descriptions. Equip/Use/Drop actions. Equipment slots display. Toggle with I key.

- [ ] **Step 4: Implement LevelUpModal**

Stat allocation UI. Show current stats and available points. + buttons for each stat. Confirm button.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: implement game flow screens"
```

---

### Task 10: Integration and Polish

**Files:**
- Modify: various files for polish and bug fixes

- [ ] **Step 1: Full integration test - play through 5 floors**

Manual testing: create character, move through dungeon, fight enemies, pick up items, use potions, descend stairs, encounter boss on floor 5.

- [ ] **Step 2: Fix bugs found during integration test**

- [ ] **Step 3: Add keyboard shortcut help overlay**

Press ? to show controls help.

- [ ] **Step 4: Add sound-like visual feedback**

Screen flash on damage, color pulse on level up, highlight on item pickup.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "feat: integration, polish, and game complete"
```

---

### Task 11: Player Manual

**Files:**
- Create: `docs/PLAYER_MANUAL.md`

- [ ] **Step 1: Write comprehensive player manual**

Controls, classes, stats, combat, items, enemies, biomes, tips and strategies.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "docs: add player manual"
```
