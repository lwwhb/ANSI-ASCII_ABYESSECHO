import React from 'react';
import { useGameStore } from '../store/gameStore';
import { EquipmentSlot, GamePhase, WeaponItem, ArmorItem, RingItem, AmuletItem } from '../types';
import { ENHANCE_COSTS, ENHANCE_SUCCESS_RATES } from '../constants';
import { getRelicForgeCostModifier } from '../engine/RelicEffects';
import { getItemName } from '../entities/Items';

const EnhanceModal: React.FC = () => {
  const player = useGameStore(s => s.player);
  const enhanceEquipment = useGameStore(s => s.enhanceEquipment);
  const setPhase = useGameStore(s => s.setPhase);
  const gold = player?.gold ?? 0;

  if (!player) return null;

  const costMod = getRelicForgeCostModifier(player);

  const slots: { slot: EquipmentSlot; label: string }[] = [
    { slot: EquipmentSlot.Weapon, label: '武器' },
    { slot: EquipmentSlot.Armor, label: '护甲' },
    { slot: EquipmentSlot.Ring1, label: '戒指1' },
    { slot: EquipmentSlot.Ring2, label: '戒指2' },
    { slot: EquipmentSlot.Amulet, label: '护符' },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal enhance-modal">
        <h2>⚒️ 装备强化</h2>
        <p>当前金币: <span style={{ color: '#ffcc44' }}>{gold}</span></p>
        <div className="enhance-list">
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
            const levelColors = ['', '#44cc44', '#4488ff', '#aa44ff'];
            return (
              <div key={slot}
                   className={`enhance-item ${canAfford ? '' : 'enhance-disabled'}`}
                   onClick={() => canAfford && enhanceEquipment(slot)}>
                <span>{label}: {getItemName(equip)}
                  {level > 0 && <span style={{ color: levelColors[level] }}> +{level}</span>}
                </span>
                <span className="enhance-cost">{cost}金 ({rate}%)</span>
              </div>
            );
          })}
        </div>
        <button className="enhance-close" onClick={() => setPhase(GamePhase.Playing)}>
          关闭 (ESC)
        </button>
      </div>
    </div>
  );
};

export default EnhanceModal;
