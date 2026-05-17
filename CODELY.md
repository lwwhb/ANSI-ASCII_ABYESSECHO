# ASCI&ASCII — Project Context

## Overview

This workspace contains **abyss-echo** (深渊回响), a browser-based roguelike dungeon crawler rendered in ANSI/ASCII art style with procedurally generated 8-bit chiptune music. The project is a single-page React+TypeScript application built with Vite. Current version: **v1.3.1**.

## Repository Structure

```
ASCI&ASCII/
├── abyss-echo/           # Main game project (Git repo)
│   ├── src/               # Application source
│   │   ├── audio/         #   Web Audio API engine (AudioManager, music/sfx data)
│   │   ├── components/    #   React UI components (15 files)
│   │   ├── constants/     #   Game data definitions (enemies, items, talents, skills)
│   │   ├── engine/        #   Combat.ts, FOV.ts — game logic & pathfinding
│   │   ├── entities/      #   Player.ts, Enemy.ts, Items.ts — entity factories
│   │   ├── generator/     #   DungeonGenerator.ts (router) + 5 biome generators
│   │   ├── store/         #   gameStore.ts — Zustand global state (~2250 lines)
│   │   ├── types/         #   index.ts — all TypeScript interfaces & enums
│   │   ├── utils/         #   random.ts — SeededRandom (Mulberry32 PRNG)
│   │   ├── App.tsx        #   (Vite template default — not used by game)
│   │   ├── main.tsx       #   Entry point
│   │   └── index.css      #   Global styles
│   ├── docs/              #   PLAYER_MANUAL.md + superpowers plans
│   ├── public/            #   Static assets
│   └── dist/              #   Build output
├── docs/                  # Workspace-level specs & plans
│   └── superpowers/
│       ├── plans/         #   Implementation plans
│       └── specs/         #   Design specifications
└── CODELY.md              # This file
```

## Tech Stack

- **Runtime:** Browser (ES2023 target)
- **Framework:** React 19 + TypeScript 6
- **Build:** Vite 8
- **State:** Zustand 5
- **Audio:** Web Audio API (procedural synthesis, no audio files)
- **Rendering:** Canvas API (MapView), HTML/CSS (UI panels)
- **RNG:** SeededRandom (Mulberry32) for deterministic generation

## Build & Run Commands

All commands run from `abyss-echo/`:

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |

**Verification before committing:** Always run both `tsc --noEmit` and `npm run build` after changes. The project has no unit test framework — verification is via type-checking and build only.

## Architecture & Key Patterns

### State Management
- Single Zustand store (`gameStore.ts`) holds all game state via `GameState` interface
- Actions are defined inline in the `create()` callback
- `processTurn()` is the core game loop — handles player input, enemy AI, status effects, hunger, trap triggers
- Persistence via `localStorage` for high scores, achievements, legacy items, and suspend save

### Deterministic RNG
- All randomness must go through `SeededRandom` (Mulberry32), never `Math.random()`
- The game seed is set at new game start; per-floor RNG derived from seed + floor number
- **Critical rule:** Any new random logic must accept/derive a `SeededRandom` instance

### Dynamic Map Dimensions
- Map size varies by biome: Stone 70×24, Crystal 80×28, Crypt 70×30, Lava 90×28, Void 100×32
- `GameState.width` and `GameState.height` store the current map dimensions
- **Critical rule:** NEVER use hardcoded `DEFAULT_MAP_WIDTH/HEIGHT` or `MAP_WIDTH/MAP_HEIGHT` for boundary checks — always use `state.width`/`state.height` or `map[0].length`/`map.length`
- FOV.ts and Combat.ts accept map dimensions as parameters or derive from the map array

### Type System
- All types in `src/types/index.ts` — enums for categories, interfaces for data structures
- Discriminated unions for items (`Item = WeaponItem | ArmorItem | ...`)
- `Item.type` discriminators (e.g., `ItemType.Weapon`) must be checked before casting

### Audio System
- `AudioManager` singleton in `src/audio/AudioManager.ts` (~650 lines)
- Step sequencer with lookahead scheduling (200ms ahead, 50ms interval)
- 9 BGM tracks + 12 SFX defined in `musicData.ts` / `sfxData.ts`
- Context-aware: auto-switches BGM based on floor biome, boss state, shop, game over
- Features: crossfade (0.3s), boss overlay, SFX ducking (BGM volume drops during SFX)
- Mute toggles synced to `GameState.musicEnabled` / `GameState.sfxEnabled`

### Component Architecture
- `CharacterCreation.tsx` — title screen + class selection + "继续冒险" button + audio toggles
- `App.tsx` (game) — main game UI in `components/App.tsx`, handles keyboard input, ESC suspend confirm dialog, HUD with audio controls
- `MapView.tsx` — Canvas-based map renderer with position index (Map<string, T>) for O(1) entity lookup
- `MessageLog.tsx` — scrollable message log with smart auto-scroll (pauses on user scroll, resumes when scrolled to bottom)
- `GameOverScreen.tsx` — death screen showing floor number and death cause
- Modal components: `InventoryModal`, `TalentModal`, `ShopModal`, `EventModal`, `LevelUpModal`, `ManualOverlay`

### Save System (Suspend Save)
- `saveGame()` serializes only `GameState` fields (excludes computed `visibleTiles`/`rememberedMap`) to `localStorage`
- Auto-saves on `enterFloor()` completion
- `loadGame()` restores state, rebuilds FOV via `updateFOV()`, then **immediately deletes save** (anti save-scumming)
- `deleteSave(reason)` called on: load, death (`handlePlayerDeath`), corruption (parse failure)
- `suspendAndQuit()` — ESC key → confirm → save → return to title
- Save data includes `version: "1.3.1"` field for future migration
- `deathCause: string` in `GameState` — composed at death time, displayed on GameOverScreen; reset on restart/load
- `GameState` fields are all JSON-serializable (no Maps/Sets/functions); `visibleTiles`/`rememberedMap` are in `GameStore` but not `GameState`, rebuilt on load

### Game Constants
- `src/constants/index.ts` — class definitions (`CLASS_DEFS`), enemy definitions (`ENEMY_DEFS`), skill definitions (`SKILL_DEFS`), talent definitions (`TALENT_DEFS`), achievement definitions, biome configs, game events
- Biome progression by floor: Stone (1-5) → Crystal (6-10) → Crypt (11-15) → Lava (16-20) → Void (21+)
- `BIOME_CONFIG[biome].mapWidth/mapHeight` define per-biome map sizes
- `getMapSizeForBiome()` returns `{ width, height }` for a given floor

## Coding Conventions

- **Language:** UI text and comments are primarily in Chinese (简体中文); code identifiers in English
- **No test framework:** Changes verified by `tsc --noEmit` + `vite build` only
- **No `as any`:** Avoid `as any` casts — extend `GameState` interface instead
- **No `Math.random()`:** Always use `SeededRandom` for game logic
- **Immutable array updates:** Use spread/push on shallow copies, not `splice` on state arrays
- **ESLint config:** `typescript-eslint` recommended + React hooks + React refresh plugins; `dist/` globally ignored
- **TypeScript config:** `noUnusedLocals: false`, `noUnusedParameters: false` (unused params prefixed with `_`)
- **File size:** `gameStore.ts` is ~2250 lines — the largest file; most others are under 500 lines

## Combat System

### Multiplicative Defense Formula
- Both player melee attacks and enemy attacks use: `max(1, floor(rawDamage × 20 / (20 + defense)))`
- K=20 constant: DEF 5 = 20% reduction, DEF 10 = 33%, DEF 15 = 43%, DEF 20 = 50%
- Replaces old additive formula (`rawDamage - floor(def × 0.6)`) which made defense irrelevant at high attack values
- Defined in `src/engine/Combat.ts`, applied in `gameStore.ts` for both player→enemy and enemy→player damage

### Enemy Scaling
- Per-floor stat multiplier: regular enemies +12%/floor, bosses +15%/floor
- Base stats tuned per biome with linear threat growth (~+2 threat/turn per biome tier)
- Enemy accuracy scales +2 per biome tier (Stone avg 8 → Void avg 16)

### Boss Design Philosophy
- DPS race design: later bosses have lower DEF but much higher ATK, creating urgency
- Abyss King: ATK 38, DEF 10 — player must kill in ~13 turns or die

## Known Design Notes

- `src/App.tsx` at root is the Vite template default (not used by the game); the game's main component is `src/components/App.tsx`
- **Unicode enemy symbols:** All enemies use distinctive Unicode characters (e.g., 巨鼠 `Я`, 蝙蝠 `ψ`, 骷髅 `☠`, 巨龙 `Ð`) instead of ASCII lowercase letters which were nearly invisible at game font size
- **Dungeon start/stairs randomization:** `pickStartAndStairs()` in `DungeonGenerator.ts` randomly selects start and stairs rooms with Manhattan distance > 30% of map diagonal, replacing the old BSP in-order left-top → right-bottom pattern
- **MessageLog smart scroll:** Uses `useLayoutEffect` + `shouldAutoScroll` ref; auto-scrolls to bottom on new messages, pauses when user scrolls up, resumes when user scrolls within 40px of bottom
- **Death cause:** `deathCause: string` in `GameState` — set by `handlePlayerDeath`, displayed on GameOverScreen; values like `被${enemy.name}击杀`, `因中毒致死`, `饥饿致死`; reset on restart/load
- The `processTurn` function does not deep-copy the map for BFS — it passes a local `currentMap` variable that may differ from `state.map` after lava tide changes
- Skill crit system: base `skillCritChance = 0.05 + DEX/300`, modified by DeadlyStrike talent
- Lucky talent gives both +5% drop chance AND +5% item rarity bonus
- `unequipItem` blocks unequipping when inventory is full (prevents item loss)
- Fast enemies (speed > 1): inner loop re-reads `enemies[i]` each action to get updated position
- Poison blade / toxic blade: status effects must be propagated from modified local `enemy` object into `enemies.map()`, not from original `state.enemies`
- Sarcophagus interaction: `walkable: false`, handled in `!tile.walkable` branch alongside Door — player tries to step on it → interaction triggers → becomes floor → player stays in place
- ShallowWater: movement costs 2 turns (implemented via `extraTurnCost` state field)
- FireResist status: reduces CooledLava damage from 5→1, fire trap damage by 2/3
- CrystalGuard reflect: 20% chance to reflect 50% melee damage back to player
- MirrorImage uses char '©' (not '@') to avoid confusion with player character
- TombGuard uses char 'Š' (not 'T') to avoid collision with Troll
- Lava Tide: every 50 turns in Lava Core, CooledLava→Lava for 5 turns, then reverts
- Void Corruption: every 20 turns in Void Abyss, random stat -1 (resets on floor change)
- Portal: teleports player to a random other portal; shows feedback if no destination exists
- CreatePortal scroll: checks for StairsDown tile under player — fails with message and does NOT consume the scroll if on stairs
- Stationary enemies (Spider, ObsidianGolem, Mimic, dormant Gargoyle): can attack when player is adjacent (dist===1), previously only returned 'wait'
- Confusion on enemies: `getEnemyAction` checks `isConfused()` — confused enemies move in random directions, 50% chance to attack if adjacent
- bossKillCount: Player field tracking total Boss kills; used by bossSlayer/bossMaster achievements since dead enemies are filtered before checkAchievements runs
- Altar MP sacrifice: deducts 10 MP from player (previously gave INT+1 for free); shows error if MP insufficient
- SpellPenetration talent: implemented via `hasSpellPenetration` parameter in `calculateMagicDamage()`, reduces enemy defense by 50% for magic damage calculation
- AoE kill tracking: scroll/skill AoE kills use `aliveBefore`/`hitIds` Sets to avoid double-counting already-dead enemies for exp/gold/bossKillCount
- Scroll kill rewards: Fireball/IceStorm/Lightning scrolls now grant gold drops and talent-modified exp (previously only granted raw exp + killCount)
