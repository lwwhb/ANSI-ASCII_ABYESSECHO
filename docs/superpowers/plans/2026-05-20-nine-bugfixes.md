# Nine Bugfixes & Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 reported issues: ring equip, ring/amulet rarity scaling, identify scroll targeting, inventory detail visibility, crystal cave variety, cursed item selling, warning SFX frequency, level-up stat undo, death screen layout.

**Architecture:** Each fix is independent — they touch different files and subsystems. All changes follow existing code patterns.

**Tech Stack:** React 19 + TypeScript, Zustand 5, Vite 8

---

### Task 1: Ring equip — always defaults to Ring1 when Ring1 occupied

**Files:**
- Modify: `abyss-echo/src/store/gameStore.ts:1628-1645`
- Modify: `abyss-echo/src/components/InventoryModal.tsx:56-65`

**Problem:** When Ring1 is occupied and Ring2 is empty, equipping a ring correctly goes to Ring2 via `canEquipItem`. But when BOTH ring slots are occupied, `canEquipItem` always returns `Ring1`, so the user can never replace the Ring2 slot. Also, the InventoryModal comparison only shows comparison against one slot.

**Fix:** Add a ring slot selection mechanism — when both ring slots are occupied, show which slot will be replaced and allow the user to toggle. For the store, accept an optional slot parameter.

- [ ] **Step 1:** In `gameStore.ts`, modify `equipItem` action to accept an optional `targetSlot` parameter. When provided, validate and use it instead of `canEquipItem` result.

- [ ] **Step 2:** In `InventoryModal.tsx`, when the selected item is a ring and both ring slots are occupied, show a slot toggle (Ring1/Ring2) so the user can pick which to replace.

---

### Task 2: Ring/Amulet stats scale with rarity

**Files:**
- Modify: `abyss-echo/src/entities/Items.ts:119-157`

**Problem:** Ring `bonusValue` is `rng.nextInt(1, 2 + floor/10)` — no rarity multiplier. Amulet same. A Legendary ring has the same stats as a Common ring.

**Fix:** Apply `rarityMult` to `bonusValue` for both rings and amulets, same as weapons/armor.

- [ ] **Step 1:** In `Items.ts`, after computing `bonusValue` for rings, multiply by `rarityMult` (using the same lookup table as weapons: `{ common: 1, good: 1.2, rare: 1.4, epic: 1.7, legendary: 2.2 }`). Do the same for amulets. Update `value` calculation accordingly.

---

### Task 3: Identify scroll — let user pick target

**Files:**
- Modify: `abyss-echo/src/store/gameStore.ts:1450-1460`
- Modify: `abyss-echo/src/store/gameStore.ts` (add `pendingIdentify` state + action)
- Modify: `abyss-echo/src/types/index.ts` (add `pendingIdentify` to GameState)
- Modify: `abyss-echo/src/components/InventoryModal.tsx`

**Problem:** Identify scroll always picks `unidentified[0]` — the first unidentified item in inventory. User has no control.

**Fix:** When Identify scroll is used, enter an "identify" mode. The InventoryModal highlights unidentified items and the user clicks one to identify.

- [ ] **Step 1:** Add `pendingIdentify: boolean` to `GameState` in `types/index.ts`.

- [ ] **Step 2:** In `gameStore.ts`, change Identify scroll handler: instead of auto-picking, set `pendingIdentify: true` and open inventory phase. Add a `confirmIdentify(index)` action that identifies the item and clears `pendingIdentify`.

- [ ] **Step 3:** In `InventoryModal.tsx`, when `pendingIdentify` is true, highlight unidentified items and allow clicking them to identify (instead of normal use/equip actions).

---

### Task 4: Inventory detail panel hidden when full

**Files:**
- Modify: `abyss-echo/src/components/InventoryModal.tsx:28-30, 94-117`

**Problem:** Entire modal is a single scrollable area. When inventory is full, the detail panel at the bottom gets pushed off-screen.

**Fix:** Split layout: inventory list scrolls, detail panel is fixed at bottom.

- [ ] **Step 1:** Restructure InventoryModal: make the item list a scrollable container with `flex: 1; overflowY: auto`, and keep the detail panel as a fixed-height section at the bottom (not inside the scroll area). The outer container should use `display: flex; flexDirection: column` with constrained height.

---

### Task 5: Crystal Cavern rooms lack variety

**Files:**
- Modify: `abyss-echo/src/generator/CrystalCaveGenerator.ts:58-68, 86-89`

**Problem:** All clusters are 3-6x3-6 rectangles. No large chambers, no varied shapes, no long corridors. Result: every floor looks the same.

**Fix:** Add variety — some clusters should be larger (8-12), some should be cross/plus shapes, vary corridor widths.

- [ ] **Step 1:** In CrystalCaveGenerator, modify cluster generation to include: (1) 1-2 "large chambers" (8-14 width/height), (2) some L-shaped or plus-shaped rooms, (3) wider corridors (2-tile wide) between some clusters.

---

### Task 6: Allow selling cursed items

**Files:**
- Modify: `abyss-echo/src/store/gameStore.ts:1670-1682`
- Modify: `abyss-echo/src/components/ShopModal.tsx:90-95`

**Problem:** Cursed items can't be sold — sell button hidden in UI, backend rejects.

**Fix:** Allow selling cursed items at a reduced price (1/4 instead of 1/2). They're cursed, not worthless — merchants will buy them at a deep discount.

- [ ] **Step 1:** In `gameStore.ts` `sellItem`, remove the `if (item.cursed)` block. Instead, calculate sell price as `Math.floor(item.value / 4)` for cursed items, `Math.floor(item.value / 2)` for normal.

- [ ] **Step 2:** In `ShopModal.tsx`, show the sell button for cursed items too, with the discounted price.

---

### Task 7: Warning SFX every turn

**Files:**
- Modify: `abyss-echo/src/store/gameStore.ts:786-795`

**Problem:** Current code plays heartbeat every 2 turns (every turn at <15% HP), stomachGrowl every 2 turns. User wants every turn.

**Fix:** Remove all modulo checks — play heartbeat every turn when low HP, play stomachGrowl every turn when starving.

- [ ] **Step 1:** Remove the `if (isCriticalHp || newTurn % 2 === 0)` check and the `newTurn % 2 === 0` check for stomachGrowl. Play both SFX every turn when conditions are met. Do the same for the extra turn path.

---

### Task 8: Level-up stat points can be undone

**Files:**
- Modify: `abyss-echo/src/components/LevelUpModal.tsx`
- Modify: `abyss-echo/src/store/gameStore.ts` (add `deallocateStat` action or modify `allocateStat`)
- Modify: `abyss-echo/src/types/index.ts` (add `pendingStatAllocations` or similar to track per-level allocations)

**Problem:** Once allocated, stat points can't be taken back. User should be able to reallocate within the current level before confirming.

**Fix:** Track per-level stat allocations. Add "-" buttons. Add a "Reset" button to undo all allocations for current level. Only commit on confirm.

- [ ] **Step 1:** Add `pendingAllocations: Partial<Stats>` to `GameState` (tracks allocations made during current level-up). Initialize to `{str:0, dex:0, int:0, vit:0}` on level-up.

- [ ] **Step 2:** Modify `allocateStat` to increment `pendingAllocations[stat]` and `player.stats[stat]`, decrement `statPoints`. Add `deallocateStat(stat)` that does the reverse (only if `pendingAllocations[stat] > 0`).

- [ ] **Step 3:** Modify `confirmLevelUp` to clear `pendingAllocations`. Modify level-up entry to reset `pendingAllocations`.

- [ ] **Step 4:** In `LevelUpModal.tsx`, add "-" buttons next to "+" buttons (only visible when `pendingAllocations[stat] > 0`). Add "重置" (Reset) button that undoes all pending allocations.

---

### Task 9: Death screen button off-screen

**Files:**
- Modify: `abyss-echo/src/components/GameOverScreen.tsx`

**Problem:** Content grows tall (stats + achievements + high scores), pushing the "再入深渊" button off-screen. No scroll handling.

**Fix:** Make the container scrollable with the button always visible. Use a fixed footer for the restart button.

- [ ] **Step 1:** Restructure GameOverScreen: use `height: 100vh; overflowY: auto` on the main container. Place the restart button in a fixed footer that stays at the bottom of the viewport, or use `position: sticky; bottom: 0`.

---
