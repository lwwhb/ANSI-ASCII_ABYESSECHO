import React from 'react';
import { Item, ItemType, WeaponItem, ArmorItem, RingItem, AmuletItem, EquipmentSlot } from '../types';
import { useGameStore } from '../store/gameStore';
import { RARITY_COLORS } from '../constants';
import { getItemName } from '../entities/Items';
import { getMaxInventorySize } from '../entities/Player';

interface InventoryModalProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const ELEM_ZH: Record<string, string> = {
  none: '无', fire: '火', ice: '冰', lightning: '雷', poison: '毒',
};

const STAT_ZH: Record<string, string> = {
  str: '力量', dex: '灵巧', int: '智慧', vit: '体质',
};

function getItemStats(item: Item): string {
  if (!item.identified) return '未鉴定 — 按 U 使用以鉴定';
  switch (item.type) {
    case ItemType.Weapon: {
      const w = item as WeaponItem;
      let s = `伤害:${w.damage}`;
      if (w.element && w.element !== 'none') s += ` 属性:${ELEM_ZH[w.element] || w.element}`;
      if (w.bonusStats) s += ' ' + formatBonus(w.bonusStats);
      return s;
    }
    case ItemType.Armor: {
      const a = item as ArmorItem;
      let s = `防御:${a.defense} 闪避:${a.evasion >= 0 ? '+' : ''}${a.evasion}`;
      if (a.bonusStats) s += ' ' + formatBonus(a.bonusStats);
      return s;
    }
    case ItemType.Ring:
    case ItemType.Amulet: {
      const r = item as RingItem | AmuletItem;
      return formatBonus(r.bonusStats) + (r.specialEffect ? ` ${r.specialEffect}` : '');
    }
    case ItemType.Potion:
      return item.description;
    case ItemType.Scroll:
      return item.description || '使用以发动效果';
    case ItemType.Food:
      return (item as { nutrition: number }).nutrition ? `饱食度+${(item as { nutrition: number }).nutrition}` : item.description;
  }
}

function formatBonus(bonus: Partial<{ str: number; dex: number; int: number; vit: number }>): string {
  return Object.entries(bonus)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${STAT_ZH[k] || k}${v >= 0 ? '+' : ''}${v}`)
    .join(' ');
}

function getEquipComparison(item: Item, equipment: Record<EquipmentSlot, Item | null>): string | null {
  let slot: EquipmentSlot;
  switch (item.type) {
    case ItemType.Weapon: slot = EquipmentSlot.Weapon; break;
    case ItemType.Armor: slot = EquipmentSlot.Armor; break;
    case ItemType.Ring: {
      if (!equipment[EquipmentSlot.Ring1]) slot = EquipmentSlot.Ring1;
      else if (!equipment[EquipmentSlot.Ring2]) slot = EquipmentSlot.Ring2;
      else slot = EquipmentSlot.Ring1;
      break;
    }
    case ItemType.Amulet: slot = EquipmentSlot.Amulet; break;
    default: return null;
  }
  const current = equipment[slot];
  if (!current) return null;
  // Build comparison for weapon/armor
  if (item.type === ItemType.Weapon && current.type === ItemType.Weapon) {
    const nw = item as WeaponItem, ow = current as WeaponItem;
    const diff = nw.damage - ow.damage;
    if (diff === 0) return `当前: ${ow.name}(伤害${ow.damage}) — 相同`;
    return diff > 0
      ? `当前: ${ow.name}(伤害${ow.damage}) → 伤害+${diff}`
      : `当前: ${ow.name}(伤害${ow.damage}) → 伤害${diff}`;
  }
  if (item.type === ItemType.Armor && current.type === ItemType.Armor) {
    const na = item as ArmorItem, oa = current as ArmorItem;
    const dDef = na.defense - oa.defense;
    const dEva = na.evasion - oa.evasion;
    return `当前: ${oa.name}(防${oa.defense}/闪${oa.evasion}) → 防${dDef >= 0 ? '+' : ''}${dDef}/闪${dEva >= 0 ? '+' : ''}${dEva}`;
  }
  return `当前: ${getItemName(current)}`;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ selectedIndex, onSelect }) => {
  const player = useGameStore(s => s.player);
  const applyItem = useGameStore(s => s.useItem);
  const equipItem = useGameStore(s => s.equipItem);
  const dropItem = useGameStore(s => s.dropItem);
  const toggleInventory = useGameStore(s => s.toggleInventory);

  if (!player) return null;

  const inventory = player.inventory;
  const maxInv = getMaxInventorySize(player);
  const selectedItem = selectedIndex >= 0 ? inventory[selectedIndex] : null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) toggleInventory(); }}
    >
      <div style={{
        backgroundColor: '#0d0d1a',
        border: '1px solid #333355',
        borderRadius: '8px',
        padding: '20px',
        width: '640px',
        maxHeight: '80vh',
        overflowY: 'auto',
        fontFamily: '"Courier New", monospace',
      }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
          borderBottom: '1px solid #222244',
          paddingBottom: '8px',
        }}>
          <span style={{ color: '#ffcc44', fontSize: '18px' }}>背包 ({inventory.length}/{maxInv})</span>
          <span style={{ color: '#666677', fontSize: '14px', cursor: 'pointer' }} onClick={toggleInventory}>
            [I/ESC] 关闭
          </span>
        </div>

        {/* Gold display */}
        <div style={{ color: '#ffcc44', fontSize: '12px', marginBottom: '12px' }}>
          💰 {player.gold} 金币
        </div>

        {inventory.length === 0 ? (
          <div style={{ color: '#444455', textAlign: 'center', padding: '20px' }}>
            背包空空如也...
          </div>
        ) : (
          <div>
            {selectedIndex < 0 && (
              <div style={{
                color: '#556677',
                fontSize: '12px',
                textAlign: 'center',
                padding: '4px 0 8px',
                borderBottom: '1px solid #151528',
              }}>
                ↑↓ 或 点击选择物品查看详情
              </div>
            )}
            {inventory.map((item, index) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                index={index}
                selected={index === selectedIndex}
                onSelect={() => onSelect(index)}
                onUse={() => { applyItem(index); onSelect(-1); }}
                onEquip={() => { equipItem(index); onSelect(-1); }}
                onDrop={() => { dropItem(index); onSelect(-1); }}
              />
            ))}
          </div>
        )}

        {/* Selected item detail panel */}
        {selectedItem && (
          <div style={{
            marginTop: '10px',
            padding: '10px 12px',
            backgroundColor: '#0a0a18',
            border: '1px solid #222244',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.6',
          }}>
            <div style={{ color: RARITY_COLORS[selectedItem.rarity], fontWeight: 'bold', marginBottom: '4px' }}>
              {selectedItem.char} {getItemName(selectedItem)}
              {selectedItem.cursed && <span style={{ color: '#ff4444', marginLeft: '6px' }}>[受咒 — 无法卸下]</span>}
            </div>
            <div style={{ color: '#aaaacc' }}>{getItemStats(selectedItem)}</div>
            {getEquipComparison(selectedItem, player.equipment) && (
              <div style={{ color: '#8888aa', marginTop: '4px' }}>{getEquipComparison(selectedItem, player.equipment)}</div>
            )}
          </div>
        )}

        <div style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid #222244',
          fontSize: '11px',
          color: '#556677',
          textAlign: 'center',
          lineHeight: '1.6',
        }}>
          ↑↓ 选择 │ U 使用(药水/卷轴/食物) │ E 装备(武器/防具/饰品) │ D 丢弃 │ I/ESC 关闭
        </div>
      </div>
    </div>
  );
};

const InventoryItemRow: React.FC<{
  item: Item;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onUse: () => void;
  onEquip: () => void;
  onDrop: () => void;
}> = ({ item, index, selected, onSelect, onUse, onEquip, onDrop }) => {
  const name = getItemName(item);
  const color = RARITY_COLORS[item.rarity];

  const canUse = item.type === ItemType.Potion || item.type === ItemType.Scroll || item.type === ItemType.Food;
  const canEquip = item.type === ItemType.Weapon || item.type === ItemType.Armor ||
                   item.type === ItemType.Ring || item.type === ItemType.Amulet;

  // Action hints: always visible, dimmed when not selected, bright + clickable when selected
  const actionHints: { label: string; onClick?: () => void; color: string }[] = [];
  if (canUse) actionHints.push({ label: 'U使用', onClick: selected ? onUse : undefined, color: '#44cc44' });
  if (canEquip) actionHints.push({ label: 'E装备', onClick: selected ? onEquip : undefined, color: '#4488ff' });
  if (!item.cursed) actionHints.push({ label: 'D丢弃', onClick: selected ? onDrop : undefined, color: '#ff4444' });

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid #111122',
        fontSize: '13px',
        backgroundColor: selected ? '#1a1a2e' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: '#444455', width: '20px' }}>{index + 1}.</span>
      <span style={{ color: item.fg, width: '20px' }}>{item.char}</span>
      <span style={{ color, flex: 1 }}>
        {name}
        {item.cursed && <span style={{ color: '#ff4444', marginLeft: '4px' }}>[咒]</span>}
      </span>
      <span style={{ color: '#444455', fontSize: '11px', marginRight: '8px' }}>
        {item.identified ? item.type : '???'}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {actionHints.map(hint => (
          <ActionBtn
            key={hint.label}
            label={hint.label}
            onClick={hint.onClick}
            color={hint.color}
            active={selected}
          />
        ))}
      </div>
    </div>
  );
};

const ActionBtn: React.FC<{ label: string; onClick?: () => void; color: string; active: boolean }> = ({ label, onClick, color, active }) => (
  <button
    onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : (e) => e.stopPropagation()}
    style={{
      backgroundColor: 'transparent',
      border: `1px solid ${active ? color : '#333355'}`,
      color: active ? color : '#444455',
      padding: '2px 6px',
      fontSize: '11px',
      fontFamily: '"Courier New", monospace',
      cursor: active ? 'pointer' : 'default',
      borderRadius: '3px',
    }}
  >
    {label}
  </button>
);

export default InventoryModal;
