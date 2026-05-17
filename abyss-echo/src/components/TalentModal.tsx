import React, { useState } from 'react';
import { GamePhase } from '../types';
import { useGameStore } from '../store/gameStore';
import { TALENT_DEFS } from '../constants';
import { SeededRandom } from '../utils/random';

const TalentModal: React.FC = () => {
  const player = useGameStore(s => s.player);
  const selectTalent = useGameStore(s => s.selectTalent);

  // Shuffle and pick 3 using SeededRandom (hook must be before early return)
  const [options] = useState(() => {
    const p = useGameStore.getState().player;
    if (!p) return [];
    const available = TALENT_DEFS.filter(t =>
      !p.talents.includes(t.id) &&
      (!t.classRequired || t.classRequired === p.class)
    );
    const seed = useGameStore.getState().seed + (p.level ?? 1) * 37;
    const rng = new SeededRandom(seed);
    const shuffled = [...available].sort(() => rng.next() - 0.5);
    return shuffled.slice(0, Math.min(3, shuffled.length));
  });

  if (!player) return null;

  if (options.length === 0) {
    // No talents available, skip
    useGameStore.getState().setPhase(GamePhase.LevelUp);
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        backgroundColor: '#0d0d1a',
        border: '2px solid #aa44ff',
        borderRadius: '8px',
        padding: '24px',
        width: '500px',
        fontFamily: '"Courier New", monospace',
        boxShadow: '0 0 30px rgba(170,68,255,0.2)',
      }}>
        <div style={{
          color: '#aa44ff',
          fontSize: '20px',
          textAlign: 'center',
          marginBottom: '8px',
          fontWeight: 'bold',
        }}>
          ✨ 天赋觉醒！
        </div>
        <div style={{
          color: '#aaaaaa',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          选择一个天赋
        </div>

        {options.map((talent) => (
          <div
            key={talent.id}
            onClick={() => selectTalent(talent.id)}
            style={{
              padding: '12px',
              marginBottom: '8px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #333355',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#aa44ff'; e.currentTarget.style.backgroundColor = '#222244'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333355'; e.currentTarget.style.backgroundColor = '#1a1a2e'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>{talent.icon}</span>
              <div>
                <div style={{ color: '#aa88cc', fontSize: '14px', fontWeight: 'bold' }}>{talent.nameZh}</div>
                <div style={{ color: '#888899', fontSize: '12px' }}>{talent.description}</div>
              </div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: '8px', textAlign: 'center', color: '#444455', fontSize: '11px' }}>
          点击选择一个天赋
        </div>
      </div>
    </div>
  );
};

export default TalentModal;
