import React from 'react';
import { useGameStore } from '../store/gameStore';
import { SKILL_DEFS } from '../constants';

const SkillBar: React.FC = () => {
  const player = useGameStore(s => s.player);
  const phase = useGameStore(s => s.phase);

  if (!player || phase !== 'playing') return null;

  const skills = SKILL_DEFS[player.class];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '4px 8px',
      backgroundColor: '#08081a',
      borderTop: '1px solid #222244',
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
    }}>
      {skills.map((skill, idx) => {
        const cd = player.skillCooldowns[idx];
        const canUse = cd <= 0 && player.mp >= skill.mpCost && phase === 'playing';
        return (
          <div
            key={skill.id}
            style={{
              padding: '3px 8px',
              backgroundColor: canUse ? '#1a1a2e' : '#0a0a12',
              border: `1px solid ${canUse ? '#333355' : '#1a1a22'}`,
              borderRadius: '3px',
              color: canUse ? '#cccccc' : '#444455',
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{skill.icon}</span>
            <span style={{ fontSize: '10px' }}>[{skill.key.toUpperCase()}]</span>
            <span style={{ fontSize: '10px' }}>{skill.nameZh}</span>
            {cd > 0 ? (
              <span style={{ color: '#ff4444', fontSize: '10px' }}>CD:{cd}</span>
            ) : (
              <span style={{ color: '#4488ff', fontSize: '10px' }}>{skill.mpCost}MP</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SkillBar;
