import React from 'react';
import { useGameStore } from '../store/gameStore';
import { RELIC_DEFS } from '../constants/relics';
import { RelicId } from '../types';

const RelicBar: React.FC = () => {
  const relics = useGameStore(s => s.player?.relics ?? []);

  if (relics.length === 0) return null;

  return (
    <div className="relic-bar">
      {relics.map((relicId: RelicId) => {
        const def = RELIC_DEFS[relicId];
        if (!def) return null;
        return (
          <div key={relicId} className="relic-item" title={`${def.name}: ${def.description}`}>
            <span className="relic-icon">{def.icon}</span>
          </div>
        );
      })}
    </div>
  );
};

export default RelicBar;
