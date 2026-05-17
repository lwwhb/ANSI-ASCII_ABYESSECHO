import React from 'react';
import { useGameStore } from '../store/gameStore';

const EventModal: React.FC = () => {
  const currentEvent = useGameStore(s => s.currentEvent);
  const chooseEventChoice = useGameStore(s => s.chooseEventChoice);

  if (!currentEvent) return null;

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

        {currentEvent.choices.map((choice, idx) => (
          <div
            key={idx}
            onClick={() => chooseEventChoice(idx)}
            style={{
              padding: '10px 12px',
              marginBottom: '6px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #333355',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#cccccc',
              fontSize: '13px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#aa44ff'; e.currentTarget.style.backgroundColor = '#222244'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333355'; e.currentTarget.style.backgroundColor = '#1a1a2e'; }}
          >
            [{idx + 1}] {choice.textZh}
          </div>
        ))}

        <div style={{ marginTop: '12px', textAlign: 'center', color: '#444455', fontSize: '11px' }}>
          点击选择你的行动
        </div>
      </div>
    </div>
  );
};

export default EventModal;
