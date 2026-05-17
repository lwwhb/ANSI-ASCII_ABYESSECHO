# 深渊回响 (Abyss Echo) - Roguelike Game Design

## Overview
A browser-based Roguelike game built with React + TypeScript, featuring ANSI/ASCII art visuals. The player descends through procedurally generated dungeon floors, fighting monsters, collecting items, and growing stronger. Permadeath means every run is unique.

## Core Gameplay
- **Goal**: Descend as deep as possible through the abyss
- **Movement**: Turn-based grid movement (WASD/vim keys/arrows)
- **Death**: Permanent — start over with a new character
- **Depth**: Infinite floors with increasing difficulty

## Roguelike Elements

### Procedural Generation
- BSP tree algorithm for dungeon layout
- 5 biomes: Stone Dungeon, Crystal Cavern, Ancient Crypt, Lava Core, Void Abyss
- Each biome has unique tile sets, enemy pools, and environmental hazards
- Biomes cycle every 10 floors with increasing difficulty modifiers

### Turn-Based System
- Player takes one action → all entities take one action
- Actions: move, attack, use item, cast spell, wait, interact

### Character System
- 3 Classes: Warrior (STR/HP), Mage (INT/MP), Rogue (DEX/Evasion)
- Stats: STR, DEX, INT, VIT
- Level up grants stat points to allocate
- HP = base + VIT*level, MP = base + INT*level

### Combat
- Melee: adjacent tiles, damage = STR + weapon - enemy DEF
- Ranged: line of sight within range, damage = DEX + weapon - enemy DEF/2
- Magic: costs MP, elemental types (Fire/Ice/Lightning/Poison)
- Elements have strengths/weaknesses vs enemy types

### Enemies (20+)
- Floor 1-5: Slime, Rat, Bat, Goblin
- Floor 6-10: Skeleton, Spider, Orc, Shadow
- Floor 11-15: Dark Knight, Wraith, Troll, Mimic
- Floor 16-20: Demon, Gorgon, Vampire, Lich
- Floor 21+: Dragon, Void Walker, Ancient One
- Boss every 5 floors with unique mechanics

### Items
- Weapons: Daggers, Swords, Axes, Staves, Bows
- Armor: Light/Medium/Heavy with tradeoffs
- Rings/Amulets: Stat bonuses, special effects
- Potions: Healing, Mana, various effects (unidentified until used/tested)
- Scrolls: Identify, Mapping, Teleport, etc. (unidentified until used)
- Food: Required to prevent starvation

### Rarity System
- Common (white), Good (green), Rare (blue), Epic (purple), Legendary (orange)
- Higher rarity = better stats + possible enchantments

### Environmental Hazards
- Traps: Spike, Fire, Teleport, Poison Gas
- Terrain: Lava (damage), Deep Water (slow), Poison Gas (DOT)
- Doors (open/close), Stairs (descend)

### Fog of War
- Vision radius based on light level
- Previously seen tiles shown dimmed
- Unseen tiles completely dark

### Hunger System
- Hunger decreases over time
- Starvation causes HP loss
- Food items restore hunger

## Visual Design
- Terminal-style dark background (#0a0a0a)
- ANSI 256-color palette via CSS
- ASCII characters: @ player, letters enemies, symbols items
- Block characters (█ ▄ ▀ ░ ▒ ▓) with background colors for terrain
- Layout: Map (left, 80x24) | Stats panel (right) | Message log (bottom)

## Technical Architecture

### Stack
- React 18 + TypeScript + Vite
- Zustand for game state management
- CSS Grid for layout, monospace font rendering
- localStorage for high scores and settings
- No backend required

### Key Modules
1. **Engine** (`src/engine/`): Game loop, turn processing, state management
2. **Generator** (`src/generator/`): Dungeon generation, BSP trees, biome config
3. **Entities** (`src/entities/`): Player, enemies, items, AI behaviors
4. **Combat** (`src/combat/`): Damage calculation, elemental system, effects
5. **Rendering** (`src/rendering/`): Tile rendering, FOV, color mapping
6. **UI** (`src/components/`): React components for game display

### State Shape (Zustand)
```typescript
interface GameState {
  player: Player;
  currentFloor: number;
  map: Tile[][];
  entities: Entity[];
  items: Item[];
  messages: Message[];
  gameOver: boolean;
  turn: number;
}
```

## Controls
- **Movement**: Arrow keys / WASD / HJKL (vim)
- **Inventory**: I key
- **Use item**: Number keys when inventory open
- **Wait**: Space / Period
- **Descend stairs**: > key on stairs
- **Pick up**: , key on item
