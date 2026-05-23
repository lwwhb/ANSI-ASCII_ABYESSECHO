import React from 'react';
import { useGameStore } from '../store/gameStore';
import { BossBlessingDef, BOSS_BLESSING_OPTIONS } from '../constants';

const BossBlessingModal: React.FC = () => {
  const bossBlessingPending = useGameStore(s => s.bossBlessingPending);
  const lastBossDefId = useGameStore(s => s.lastBossDefId);
  const player = useGameStore(s => s.player);
  const chooseBossBlessing = useGameStore(s => s.chooseBossBlessing);

  if (!bossBlessingPending || !lastBossDefId || !player) return null;

  const options = BOSS_BLESSING_OPTIONS[lastBossDefId];
  if (!options) return null;

  return (
    <div className="modal-overlay">
      <div className="modal boss-blessing-modal">
        <h2>🏆 Boss祝福</h2>
        <p>击败了强大的敌人！选择一项永久祝福：</p>
        <div className="blessing-options">
          {options.map((opt: BossBlessingDef) => (
            <button
              key={opt.id}
              className="blessing-option"
              onClick={() => chooseBossBlessing(opt.id)}
            >
              <span className="blessing-icon">{opt.icon}</span>
              <div className="blessing-text">
                <span className="blessing-name">{opt.nameZh}</span>
                <span className="blessing-desc">{opt.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BossBlessingModal;
