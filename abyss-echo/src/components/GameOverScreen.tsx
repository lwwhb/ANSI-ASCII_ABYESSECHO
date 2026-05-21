import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { CLASS_DEFS, ACHIEVEMENT_DEFS } from '../constants';

const GameOverScreen: React.FC = () => {
  const player = useGameStore(s => s.player);
  const currentFloor = useGameStore(s => s.currentFloor);
  const turn = useGameStore(s => s.turn);
  const highScores = useGameStore(s => s.highScores);
  const achievements = useGameStore(s => s.achievements);
  const isDailyChallenge = useGameStore(s => s.isDailyChallenge);
  const deathCause = useGameStore(s => s.deathCause);
  const restartGame = useGameStore(s => s.restartGame);

  const [showAchievements, setShowAchievements] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);

  if (!player) return null;

  const unlockedAchievements = ACHIEVEMENT_DEFS.filter(a => achievements.includes(a.id));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0a12',
      color: '#cccccc',
      fontFamily: '"Courier New", monospace',
      padding: '20px',
    }}>
      <pre style={{
        color: '#cc2222',
        fontSize: '12px',
        lineHeight: '1.2',
        marginBottom: '16px',
        textShadow: '0 0 10px rgba(204,34,34,0.3)',
      }}>
{`██████╗ ██╗███████╗
██╔══██╗██║██╔════╝
██║  ██║██║█████╗  
██║  ██║██║██╔══╝  
██████╔╝██║███████╗
╚═════╝ ╚═╝╚══════╝`}
      </pre>

      <div style={{
        color: '#ff4444',
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '24px',
      }}>
        你倒在了深渊的第 {currentFloor} 层
      </div>

      {deathCause && (
        <div style={{
          color: '#cc6644',
          fontSize: '14px',
          marginBottom: '20px',
          fontStyle: 'italic',
        }}>
          ☠️ {deathCause}
        </div>
      )}

      {/* Stats Summary */}
      <div style={{
        backgroundColor: '#0d0d1a',
        border: '1px solid #222244',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '16px',
        minWidth: '300px',
      }}>
        <div style={{ color: '#ffcc44', fontSize: '16px', marginBottom: '12px', textAlign: 'center' }}>
          冒险总结
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
          <div style={{ color: '#888899' }}>角色:</div>
          <div style={{ color: player.fg }}>{player.name} ({CLASS_DEFS[player.class].nameZh})</div>
          <div style={{ color: '#888899' }}>等级:</div>
          <div>{player.level}</div>
          <div style={{ color: '#888899' }}>到达楼层:</div>
          <div style={{ color: '#ffcc44' }}>B{currentFloor}F</div>
          <div style={{ color: '#888899' }}>击杀数:</div>
          <div style={{ color: '#ff4444' }}>{player.killCount}</div>
          <div style={{ color: '#888899' }}>存活回合:</div>
          <div>{turn}</div>
          <div style={{ color: '#888899' }}>累计金币:</div>
          <div style={{ color: '#ffcc44' }}>💰 {player.gold}</div>
          <div style={{ color: '#888899' }}>天赋数:</div>
          <div style={{ color: '#aa88cc' }}>{player.talents.length}</div>
        </div>
        {isDailyChallenge && (
          <div style={{ color: '#ff8844', textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>
            📅 每日挑战
          </div>
        )}
      </div>

      {/* Toggle buttons for Achievements and High Scores */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <button
          onClick={() => { setShowAchievements(!showAchievements); setShowHighScores(false); }}
          style={{
            backgroundColor: showAchievements ? '#222244' : '#0d0d1a',
            color: '#ffcc44',
            border: `1px solid ${showAchievements ? '#ffcc44' : '#222244'}`,
            padding: '8px 16px',
            fontSize: '13px',
            fontFamily: '"Courier New", monospace',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🏆 成就 ({unlockedAchievements.length}/{ACHIEVEMENT_DEFS.length})
        </button>
        <button
          onClick={() => { setShowHighScores(!showHighScores); setShowAchievements(false); }}
          style={{
            backgroundColor: showHighScores ? '#222244' : '#0d0d1a',
            color: '#ffcc44',
            border: `1px solid ${showHighScores ? '#ffcc44' : '#222244'}`,
            padding: '8px 16px',
            fontSize: '13px',
            fontFamily: '"Courier New", monospace',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📊 排行榜
        </button>
      </div>

      {/* Achievements panel */}
      {showAchievements && unlockedAchievements.length > 0 && (
        <div style={{
          backgroundColor: '#0d0d1a',
          border: '1px solid #222244',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          minWidth: '300px',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
            {unlockedAchievements.map((a) => (
              <span key={a.id} style={{ fontSize: '16px' }} title={`${a.nameZh}: ${a.description}`}>{a.icon}</span>
            ))}
          </div>
        </div>
      )}

      {/* High Scores panel */}
      {showHighScores && highScores.length > 0 && (
        <div style={{
          backgroundColor: '#0d0d1a',
          border: '1px solid #222244',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          minWidth: '300px',
        }}>
          {highScores.slice(0, 5).map((score, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              padding: '4px 0',
              borderBottom: '1px solid #111122',
            }}>
              <span style={{ color: '#ffcc44' }}>#{i + 1}</span>
              <span style={{ color: '#aaaaaa' }}>{score.name}</span>
              <span style={{ color: '#ff8844' }}>B{score.floor}F</span>
              <span style={{ color: '#888899' }}>Lv.{score.level}</span>
            </div>
          ))}
        </div>
      )}

      {/* Legacy info */}
      <div style={{
        color: '#666677',
        fontSize: '12px',
        marginBottom: '8px',
        textAlign: 'center',
      }}>
        ♻️ 你的装备将被传承给下一个角色...
      </div>

      {/* Save deleted notice */}
      <div style={{
        color: '#884444',
        fontSize: '11px',
        marginBottom: '16px',
        textAlign: 'center',
      }}>
        ☠️ 永久死亡 — 存档已删除，无法回溯
      </div>

      {/* Restart Button */}
      <button
        onClick={restartGame}
        style={{
          backgroundColor: '#cc2222',
          color: '#ffffff',
          border: 'none',
          padding: '12px 40px',
          fontSize: '16px',
          fontFamily: '"Courier New", monospace',
          fontWeight: 'bold',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        再 入 深 渊
      </button>
    </div>
  );
};

export default GameOverScreen;
