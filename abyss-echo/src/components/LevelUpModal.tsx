import React, { useEffect, useCallback } from 'react';
import { Stats } from '../types';
import { useGameStore } from '../store/gameStore';

const STAT_KEYS: (keyof Stats)[] = ['str', 'dex', 'int', 'vit'];
const STAT_NAMES: Record<string, string> = {
  str: '力量 (STR)',
  dex: '灵巧 (DEX)',
  int: '智慧 (INT)',
  vit: '活力 (VIT)',
};
const STAT_COLORS: Record<string, string> = {
  str: '#ff6644',
  dex: '#44ff66',
  int: '#4488ff',
  vit: '#ffcc44',
};
const STAT_KEY_MAP: Record<string, keyof Stats> = {
  '1': 'str', '2': 'dex', '3': 'int', '4': 'vit',
};

const LevelUpModal: React.FC = () => {
  const player = useGameStore(s => s.player);
  const allocateStat = useGameStore(s => s.allocateStat);
  const deallocateStat = useGameStore(s => s.deallocateStat);
  const resetAllocations = useGameStore(s => s.resetAllocations);
  const confirmLevelUp = useGameStore(s => s.confirmLevelUp);
  const pendingAllocations = useGameStore(s => s.pendingAllocations);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!player) return;
    if (STAT_KEY_MAP[e.key] && player.statPoints > 0) {
      e.stopPropagation();
      e.preventDefault();
      allocateStat(STAT_KEY_MAP[e.key]);
    }
    if (e.key === 'Enter' && player.statPoints === 0) {
      e.stopPropagation();
      e.preventDefault();
      confirmLevelUp();
    }
  }, [player, allocateStat, confirmLevelUp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!player) return null;

  const hasPending = Object.values(pendingAllocations).some(v => (v || 0) > 0);

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: '#0d0d1a',
        border: '2px solid #ffcc44',
        borderRadius: '8px',
        padding: '24px',
        width: '420px',
        fontFamily: '"Courier New", monospace',
        boxShadow: '0 0 30px rgba(255,204,68,0.2)',
      }}>
        <div style={{
          color: '#ffcc44',
          fontSize: '20px',
          textAlign: 'center',
          marginBottom: '8px',
          fontWeight: 'bold',
        }}>
          ⬆ 等级提升！
        </div>
        <div style={{
          color: '#ccccaa',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          Lv.{player.level - 1} → Lv.{player.level}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ color: '#ffcc44' }}>可分配属性点: {player.statPoints}</span>
        </div>

        {STAT_KEYS.map((stat, idx) => {
          const pending = pendingAllocations[stat] || 0;
          return (
            <div key={stat} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #111122',
            }}>
              <span style={{ color: '#444455', width: '20px', fontSize: '11px' }}>[{idx + 1}]</span>
              <span style={{ color: STAT_COLORS[stat], fontSize: '14px', width: '120px' }}>
                {STAT_NAMES[stat]}
              </span>
              <span style={{ color: '#cccccc', fontSize: '16px', fontWeight: 'bold', width: '40px', textAlign: 'center' }}>
                {player.stats[stat]}{pending > 0 && <span style={{ color: '#44cc44', fontSize: '12px' }}> (+{pending})</span>}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {pending > 0 && (
                  <button
                    onClick={() => deallocateStat(stat)}
                    style={{
                      backgroundColor: '#442222',
                      color: '#ff4444',
                      border: '1px solid #662222',
                      width: '30px',
                      height: '30px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontFamily: '"Courier New", monospace',
                    }}
                  >
                    -
                  </button>
                )}
                <button
                  onClick={() => allocateStat(stat)}
                  disabled={player.statPoints <= 0}
                  style={{
                    backgroundColor: player.statPoints > 0 ? STAT_COLORS[stat] : '#222244',
                    color: player.statPoints > 0 ? '#0a0a12' : '#444455',
                    border: 'none',
                    width: '30px',
                    height: '30px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: player.statPoints > 0 ? 'pointer' : 'not-allowed',
                    borderRadius: '4px',
                    fontFamily: '"Courier New", monospace',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {hasPending && (
            <button
              onClick={resetAllocations}
              style={{
                flex: 1,
                backgroundColor: '#332222',
                color: '#ff6644',
                border: '1px solid #553333',
                padding: '10px',
                fontSize: '13px',
                fontFamily: '"Courier New", monospace',
                fontWeight: 'bold',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ↩ 重置
            </button>
          )}
          <button
            onClick={confirmLevelUp}
            disabled={player.statPoints > 0}
            style={{
              flex: 1,
              backgroundColor: player.statPoints === 0 ? '#ffcc44' : '#222244',
              color: player.statPoints === 0 ? '#0a0a12' : '#444455',
              border: 'none',
              padding: '10px',
              fontSize: '14px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              borderRadius: '6px',
              cursor: player.statPoints === 0 ? 'pointer' : 'not-allowed',
            }}
          >
            {player.statPoints > 0 ? `还需分配 ${player.statPoints} 点` : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
