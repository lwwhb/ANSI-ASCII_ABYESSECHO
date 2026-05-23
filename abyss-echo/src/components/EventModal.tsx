import React from 'react';
import { useGameStore } from '../store/gameStore';
import { EventOptionDef, EventCondition, Player } from '../types';

// Function to check if a condition is met
function isConditionMet(condition: EventCondition | undefined, player: Player): boolean {
  if (!condition) return true;
  switch (condition.type) {
    case 'stat':
      return (player.stats[condition.stat] ?? 0) >= condition.min;
    case 'resource':
      if (condition.resource === 'gold') return player.gold >= condition.minPercent;
      if (condition.resource === 'hp') return player.hp >= player.maxHp * condition.minPercent / 100;
      if (condition.resource === 'mp') return player.mp >= player.maxMp * condition.minPercent / 100;
      return false;
    case 'relicCount':
      return player.relics.length >= condition.min;
    case 'bossKillCount':
      return player.bossKillCount >= condition.min;
    case 'inscriptionCount':
      return player.inscriptionCount >= condition.min;
    default:
      return false;
  }
}

const EventModal: React.FC = () => {
  const currentEvent = useGameStore(s => s.currentEvent);
  const player = useGameStore(s => s.player);
  const chooseEventChoice = useGameStore(s => s.chooseEventChoice);

  if (!currentEvent || !player) return null;

  // Check if event uses new format (options) or old format (choices)
  const isNewFormat = 'options' in currentEvent;
  const options = isNewFormat
    ? (currentEvent as { options: EventOptionDef[] }).options
    : (currentEvent as { choices: Array<{ textZh: string; effectId: string }> }).choices.map((choice, idx: number) => ({
        id: String(idx),
        textZh: choice.textZh,
        effectId: choice.effectId,
      }));

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
        width: '460px',
        fontFamily: '"Courier New", monospace',
        boxShadow: '0 0 30px rgba(170,68,255,0.2)',
      }}>
        <div style={{
          color: '#aa44ff',
          fontSize: '18px',
          textAlign: 'center',
          marginBottom: '12px',
          fontWeight: 'bold',
        }}>
          ♣ {currentEvent.nameZh}
        </div>

        <div style={{
          color: '#bbbbcc',
          fontSize: '13px',
          lineHeight: '1.7',
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: '#111122',
          borderRadius: '6px',
          border: '1px solid #222244',
        }}>
          {currentEvent.description}
        </div>

        {options.map((option: EventOptionDef & { id: string }, idx: number) => {
          const isRare = option.isRare;
          const conditionMet = isConditionMet(option.condition, player);
          const baseStyle = {
            padding: '10px 12px',
            marginBottom: '6px',
            backgroundColor: isRare ? '#1a1030' : '#1a1a2e',
            border: isRare ? '1px solid #aa44ff' : '1px solid #333355',
            borderRadius: '6px',
            cursor: conditionMet ? 'pointer' : 'not-allowed',
            color: '#cccccc',
            fontSize: '13px',
            transition: 'all 0.15s',
            opacity: conditionMet ? 1 : 0.4,
          };
          const hoverStyle = conditionMet
            ? { borderColor: isRare ? '#aa44ff' : '#aa44ff', backgroundColor: '#222244' }
            : {};

          return (
            <div
              key={option.id}
              onClick={() => conditionMet && chooseEventChoice(idx)}
              style={baseStyle}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, hoverStyle);
              }}
              onMouseLeave={(e) => {
                Object.assign(e.currentTarget.style, baseStyle);
              }}
            >
              <span style={{ color: isRare ? '#aa44ff' : '#cccccc' }}>
                {isRare ? '🔮 ' : ''}[{idx + 1}] {option.textZh}
              </span>
              {!conditionMet && (
                <span style={{ color: '#ff4444', marginLeft: '8px' }}>🔒 未满足条件</span>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: '12px', textAlign: 'center', color: '#444455', fontSize: '11px' }}>
          点击选择你的行动
        </div>
      </div>
    </div>
  );
};

export default EventModal;
