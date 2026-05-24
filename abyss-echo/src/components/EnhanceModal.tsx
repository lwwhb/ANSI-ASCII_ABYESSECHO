import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { EquipmentSlot, GamePhase, WeaponItem, ArmorItem, RingItem, AmuletItem } from '../types';
import { ENHANCE_COSTS, ENHANCE_SUCCESS_RATES } from '../constants';
import { getRelicForgeCostModifier } from '../engine/RelicEffects';
import { getItemName } from '../entities/Items';

const EnhanceModal: React.FC = () => {
  const player = useGameStore(s => s.player);
  const enhanceEquipment = useGameStore(s => s.enhanceEquipment);
  const enhanceInventoryItem = useGameStore(s => s.enhanceInventoryItem);
  const setPhase = useGameStore(s => s.setPhase);
  const gold = player?.gold ?? 0;
  const [feedback, setFeedback] = useState<{ key: string; success: boolean } | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  if (!player) return null;

  const costMod = getRelicForgeCostModifier(player);

  const slots: { slot: EquipmentSlot; label: string }[] = [
    { slot: EquipmentSlot.Weapon, label: '武器' },
    { slot: EquipmentSlot.Armor, label: '护甲' },
    { slot: EquipmentSlot.Ring1, label: '戒指1' },
    { slot: EquipmentSlot.Ring2, label: '戒指2' },
    { slot: EquipmentSlot.Amulet, label: '护符' },
  ];

  const handleEnhance = (slot: EquipmentSlot) => {
    const item = player.equipment[slot];
    if (!item || !('enhanceLevel' in item)) return;
    const level = (item as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0;
    if (level >= 3) return;
    const baseCost = ENHANCE_COSTS[level];
    const cost = Math.floor(baseCost * costMod);
    const isVoidForge = useGameStore.getState().currentFloor >= 21;
    const finalCost = isVoidForge ? Math.floor(cost / 2) : cost;
    if (gold < finalCost) return;
    const preLevel = level;
    enhanceEquipment(slot);
    const updatedPlayer = useGameStore.getState().player;
    const updatedItem = updatedPlayer?.equipment[slot];
    const newLevel = updatedItem && 'enhanceLevel' in updatedItem ? (updatedItem as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0 : preLevel;
    setFeedback({ key: slot, success: newLevel > preLevel });
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 1200);
  };

  const handleEnhanceInventory = (index: number) => {
    const item = player.inventory[index];
    if (!item || !('enhanceLevel' in item)) return;
    const level = (item as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0;
    if (level >= 3) return;
    const baseCost = ENHANCE_COSTS[level];
    const cost = Math.floor(baseCost * costMod);
    const isVoidForge = useGameStore.getState().currentFloor >= 21;
    const finalCost = isVoidForge ? Math.floor(cost / 2) : cost;
    if (gold < finalCost) return;
    const preLevel = level;
    enhanceInventoryItem(index);
    const updatedPlayer = useGameStore.getState().player;
    const updatedItem = updatedPlayer?.inventory[index];
    const newLevel = updatedItem && 'enhanceLevel' in updatedItem ? (updatedItem as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0 : preLevel;
    setFeedback({ key: `inv-${index}`, success: newLevel > preLevel });
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 1200);
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="modal enhance-modal">
        <h2>⚒️ 装备强化</h2>
        <p>当前金币: <span style={{ color: '#ffcc44' }}>{gold}</span></p>
        <div className="enhance-list">
          {slots.every(({ slot }) => {
            const item = player.equipment[slot];
            return !item || !('enhanceLevel' in item) || ((item as WeaponItem | ArmorItem | RingItem | AmuletItem).enhanceLevel ?? 0) >= 3;
          }) && (
            <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
              没有可强化的装备<br/>
              <span style={{ fontSize: '11px' }}>装备武器和护甲后可在此强化</span>
            </div>
          )}
          {slots.map(({ slot, label }) => {
            const item = player.equipment[slot];
            if (!item || !('enhanceLevel' in item)) return null;
            const equip = item as WeaponItem | ArmorItem | RingItem | AmuletItem;
            const level = equip.enhanceLevel ?? 0;
            if (level >= 3) {
              return (
                <div key={slot} className="enhance-item enhance-max">
                  <span>{label}: {getItemName(equip)} (已满级)</span>
                </div>
              );
            }
            const baseCost = ENHANCE_COSTS[level];
            const cost = Math.floor(baseCost * costMod);
            const rate = Math.floor(ENHANCE_SUCCESS_RATES[level] * 100);
            const canAfford = gold >= cost;
            const levelColors: Record<number, string> = { 0: '#888888', 1: '#44cc44', 2: '#4488ff', 3: '#aa44ff' };
            const isFeedback = feedback?.key === slot;
            const feedbackStyle = isFeedback
              ? (feedback.success
                ? { border: '1px solid #44cc44', boxShadow: '0 0 8px #44cc4444' }
                : { border: '1px solid #ff4444', boxShadow: '0 0 8px #ff444444' })
              : {};
            return (
              <div key={slot}
                   className={`enhance-item ${canAfford ? '' : 'enhance-disabled'}`}
                   style={feedbackStyle}
                   onClick={() => canAfford && handleEnhance(slot)}>
                <span>{label}: {getItemName(equip)}
                  {level > 0 && <span style={{ color: levelColors[level] ?? '#888' }}> +{level}</span>}
                </span>
                <span className="enhance-cost">{cost}金 ({rate}%)</span>
              </div>
            );
          })}
        </div>
        {/* Inventory items that can be enhanced */}
        {player.inventory.some(inv => 'enhanceLevel' in inv) && (
          <>
            <h3 style={{ color: '#8888aa', fontSize: '12px', marginTop: '8px' }}>背包物品</h3>
            <div className="enhance-list">
              {player.inventory.map((inv, idx) => {
                if (!('enhanceLevel' in inv)) return null;
                const invItem = inv as WeaponItem | ArmorItem | RingItem | AmuletItem;
                const invLevel = invItem.enhanceLevel ?? 0;
                if (invLevel >= 3) return null;
                const invBaseCost = ENHANCE_COSTS[invLevel];
                const invCost = Math.floor(invBaseCost * costMod);
                const invRate = Math.floor(ENHANCE_SUCCESS_RATES[invLevel] * 100);
                const invCanAfford = gold >= invCost;
                const invLevelColors: Record<number, string> = { 0: '#888888', 1: '#44cc44', 2: '#4488ff', 3: '#aa44ff' };
                const invFeedback = feedback?.key === `inv-${idx}`;
                const invFeedbackStyle = invFeedback
                  ? (feedback.success
                    ? { border: '1px solid #44cc44', boxShadow: '0 0 8px #44cc4444' }
                    : { border: '1px solid #ff4444', boxShadow: '0 0 8px #ff444444' })
                  : {};
                return (
                  <div key={`inv-${idx}`}
                       className={`enhance-item ${invCanAfford ? '' : 'enhance-disabled'}`}
                       style={invFeedbackStyle}
                       onClick={() => invCanAfford && handleEnhanceInventory(idx)}>
                    <span>背包: {getItemName(invItem)}
                      {invLevel > 0 && <span style={{ color: invLevelColors[invLevel] ?? '#888' }}> +{invLevel}</span>}
                    </span>
                    <span className="enhance-cost">{invCost}金 ({invRate}%)</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <button className="enhance-close" onClick={() => setPhase(GamePhase.Playing)}>
          关闭 (ESC)
        </button>
      </div>
    </div>
  );
};

export default EnhanceModal;
