import React from 'react';
import { useGameStore } from '../store/gameStore';
import { RARITY_COLORS } from '../constants';
import { getItemName } from '../entities/Items';
import { getMaxInventorySize } from '../entities/Player';

const ShopModal: React.FC = () => {
  const player = useGameStore(s => s.player);
  const shopItems = useGameStore(s => s.shopItems);
  const buyShopItem = useGameStore(s => s.buyShopItem);
  const sellItem = useGameStore(s => s.sellItem);
  const closeShop = useGameStore(s => s.closeShop);

  if (!player) return null;

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
      onClick={(e) => { if (e.target === e.currentTarget) closeShop(); }}
    >
      <div style={{
        backgroundColor: '#0d0d1a',
        border: '1px solid #ffcc44',
        borderRadius: '8px',
        padding: '20px',
        width: '600px',
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
          <span style={{ color: '#ffcc44', fontSize: '18px' }}>🏪 流浪商人</span>
          <span style={{ color: '#ffcc44', fontSize: '14px' }}>💰 {player.gold} 金币</span>
        </div>

        {/* Items for sale */}
        <div style={{ color: '#888899', fontSize: '12px', marginBottom: '8px' }}>出售的物品:</div>
        {shopItems.map((item, index) => (
          <div key={item.id} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            borderBottom: '1px solid #111122',
            fontSize: '13px',
          }}>
            <span style={{ color: item.fg, width: '20px' }}>{item.char}</span>
            <span style={{ color: RARITY_COLORS[item.rarity], flex: 1 }}>{getItemName(item)}</span>
            <span style={{ color: '#ffcc44', marginRight: '12px', fontSize: '12px' }}>{item.value}💰</span>
            <button
              onClick={() => buyShopItem(index)}
              disabled={player.gold < item.value || player.inventory.length >= getMaxInventorySize(player)}
              style={{
                backgroundColor: player.gold >= item.value && player.inventory.length < getMaxInventorySize(player) ? '#44cc44' : '#222244',
                color: player.gold >= item.value && player.inventory.length < getMaxInventorySize(player) ? '#0a0a12' : '#444455',
                border: 'none',
                padding: '4px 10px',
                fontSize: '11px',
                fontFamily: '"Courier New", monospace',
                cursor: player.gold >= item.value && player.inventory.length < getMaxInventorySize(player) ? 'pointer' : 'not-allowed',
                borderRadius: '3px',
              }}
            >
              购买
            </button>
          </div>
        ))}

        {/* Sell items from inventory */}
        {player.inventory.length > 0 && (
          <>
            <div style={{ color: '#888899', fontSize: '12px', marginTop: '16px', marginBottom: '8px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
              出售你的物品 (半价):
            </div>
            {player.inventory.map((item, index) => {
              const sellPrice = Math.floor(item.value / 2);
              return (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderBottom: '1px solid #111122',
                  fontSize: '12px',
                }}>
                  <span style={{ color: item.fg, width: '20px' }}>{item.char}</span>
                  <span style={{ color: RARITY_COLORS[item.rarity], flex: 1 }}>{getItemName(item)}</span>
                  <span style={{ color: '#ccaa44', marginRight: '12px', fontSize: '11px' }}>{sellPrice}💰</span>
                  {!item.cursed && (
                    <button
                      onClick={() => sellItem(index)}
                      style={{
                        backgroundColor: '#aa8844',
                        color: '#0a0a12',
                        border: 'none',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontFamily: '"Courier New", monospace',
                        cursor: 'pointer',
                        borderRadius: '3px',
                      }}
                    >
                      出售
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div style={{
          marginTop: '12px',
          paddingTop: '8px',
          borderTop: '1px solid #222244',
          textAlign: 'center',
        }}>
          <button
            onClick={closeShop}
            style={{
              backgroundColor: '#333355',
              color: '#cccccc',
              border: 'none',
              padding: '8px 24px',
              fontSize: '13px',
              fontFamily: '"Courier New", monospace',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            离开商店 [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShopModal;
