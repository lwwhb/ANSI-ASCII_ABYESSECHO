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
  const confirmLevelUp = useGameStore(s => s.confirmLevelUp);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!player) return;
    if (STAT_KEY_MAP[e.key] && player.statPoints > 0) {
      allocateStat(STAT_KEY_MAP[e.key]);
    }
    if (e.key === 'Enter' && player.statPoints === 0) {
      confirmLevelUp();
    }
  }, [player, allocateStat, confirmLevelUp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!player) return null;

  return (
    <div style={{
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
        width: '400px',
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

        {STAT_KEYS.map((stat, idx) => (
          <div key={stat} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid #111122',
          }}>
            <span style={{ color: '#444455', width: '20px', fontSize: '11px' }}>[{idx + 1}]</span>
            <span style={{ color: STAT_COLORS[stat], fontSize: '14px', width: '130px' }}>
              {STAT_NAMES[stat]}
            </span>
            <span style={{ color: '#cccccc', fontSize: '16px', fontWeight: 'bold', width: '40px', textAlign: 'center' }}>
              {player.stats[stat]}
            </span>
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
        ))}

        <button
          onClick={confirmLevelUp}
          disabled={player.statPoints > 0}
          style={{
            width: '100%',
            marginTop: '16px',
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
  );
};

export default LevelUpModal;
