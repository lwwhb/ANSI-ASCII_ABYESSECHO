import React, { useState, useEffect } from 'react';
import { CharacterClass } from '../types';
import { useGameStore } from '../store/gameStore';
import { CLASS_DEFS } from '../constants';
import { getItemName } from '../entities/Items';
import { AudioManager } from '../audio/AudioManager';

const CharacterCreation: React.FC = () => {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [isDaily, setIsDaily] = useState(false);
  const [canContinue, setCanContinue] = useState(() => useGameStore.getState().hasSaveGame());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const newGame = useGameStore(s => s.newGame);
  const legacyItem = useGameStore(s => s.legacyItem);
  const musicEnabled = useGameStore(s => s.musicEnabled);
  const sfxEnabled = useGameStore(s => s.sfxEnabled);

  // Play title BGM on mount
  useEffect(() => {
    AudioManager.updateContext('characterCreation', 0, false, '');
  }, []);

  // 首次点击页面任意位置恢复 AudioContext（浏览器要求用户手势才能播放音频）
  useEffect(() => {
    const resume = () => {
      AudioManager.ensureResumed();
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
    };
    document.addEventListener('click', resume);
    document.addEventListener('touchstart', resume);
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
    };
  }, []);

  const handleStart = () => {
    if (!name.trim() || !selectedClass) return;
    AudioManager.ensureResumed();
    newGame(name.trim(), selectedClass, isDaily);
  };

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
      <div className="title-frame">
        <pre className="title-border-top">{
`  ░░▒▒▓▓████████████████████████████████████████████████████████████████████▓▓▒▒░░`
        }</pre>
        <div className="title-body">
          <div className="title-deco">◆ ─────── ◆ ─────── ◆</div>
          <div className="title-zh">深 渊 回 响</div>
          <div className="title-deco">◆ ─────── ◆ ─────── ◆</div>
          <pre className="title-ascii">{
`█████╗ ██████╗ ██╗   ██╗███████╗███████╗    ███████╗ ██████╗██╗  ██╗ ██████╗
██╔══██╗██╔══██╗╚██╗ ██╔╝██╔════╝██╔════╝    ██╔════╝██╔════╝██║  ██║██╔═══██╗
███████║██████╔╝ ╚████╔╝ ███████╗███████╗    █████╗  ██║     ███████║██║   ██║
██╔══██║██╔══██╗  ╚██╔╝  ╚════██║╚════██║    ██╔══╝  ██║     ██╔══██║██║   ██║
██║  ██║██████╔╝   ██║   ███████║███████║    ███████╗╚██████╗██║  ██║╚██████╔╝
╚═╝  ╚═╝╚═════╝    ╚═╝   ╚══════╝╚══════╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝`
          }</pre>
        </div>
        <pre className="title-border-bot">{
`  ░░▒▒▓▓████████████████████████████████████████████████████████████████████▓▓▒▒░░`
        }</pre>
      </div>

      <div style={{ color: '#888899', marginBottom: '24px', fontSize: '14px' }}>
        在无尽的深渊中，你将何去何从？
      </div>

      {/* Legacy item info */}
      {legacyItem && (
        <div style={{
          backgroundColor: '#1a1a2e',
          border: '1px solid #ff8844',
          borderRadius: '6px',
          padding: '10px 16px',
          marginBottom: '16px',
          fontSize: '12px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#ff8844', marginBottom: '4px' }}>♻️ 传承物品</div>
          <div style={{ color: '#cccccc' }}>
            上次冒险的 <span style={{ color: '#ff8844' }}>{getItemName(legacyItem)}</span> 将传承给你
          </div>
        </div>
      )}

      {/* Name Input */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ color: '#aaaaaa', display: 'block', marginBottom: '6px' }}>
          角色名称:
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          placeholder="输入你的名字..."
          style={{
            backgroundColor: '#111122',
            border: '1px solid #333355',
            color: '#cccccc',
            padding: '8px 12px',
            fontSize: '14px',
            fontFamily: '"Courier New", monospace',
            borderRadius: '4px',
            width: '200px',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#ffcc44'; }}
          onBlur={(e) => e.target.style.borderColor = '#333355'}
        />
      </div>

      {/* Class Selection */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {Object.values(CharacterClass).map((cls) => {
          const def = CLASS_DEFS[cls];
          const isSelected = selectedClass === cls;
          return (
            <div
              key={cls}
              onClick={() => setSelectedClass(cls)}
              style={{
                backgroundColor: isSelected ? '#1a1a2e' : '#0d0d1a',
                border: `2px solid ${isSelected ? def.fg : '#222244'}`,
                borderRadius: '8px',
                padding: '16px',
                width: '180px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 0 15px ${def.fg}33` : 'none',
              }}
            >
              <div style={{ fontSize: '24px', color: def.fg, textAlign: 'center', marginBottom: '8px' }}>
                {def.char}
              </div>
              <div style={{ fontSize: '16px', color: def.fg, textAlign: 'center', marginBottom: '8px', fontWeight: 'bold' }}>
                {def.nameZh}
              </div>
              <div style={{ fontSize: '11px', color: '#888899', textAlign: 'center', marginBottom: '8px' }}>
                {def.description}
              </div>
              <div style={{ fontSize: '10px', color: '#666677', textAlign: 'center' }}>
                STR:{def.baseStats.str} DEX:{def.baseStats.dex} INT:{def.baseStats.int} VIT:{def.baseStats.vit}
              </div>
              <div style={{ fontSize: '10px', color: '#666677', textAlign: 'center', marginTop: '2px' }}>
                HP:{def.baseHp} MP:{def.baseMp}
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily Challenge Toggle */}
      <div
        onClick={() => setIsDaily(!isDaily)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '24px',
          cursor: 'pointer',
          fontSize: '13px',
          color: isDaily ? '#ffcc44' : '#666677',
        }}
      >
        <span style={{
          width: '18px',
          height: '18px',
          border: `2px solid ${isDaily ? '#ffcc44' : '#444455'}`,
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDaily ? '#ffcc44' : 'transparent',
          color: isDaily ? '#0a0a12' : 'transparent',
          fontSize: '12px',
          fontWeight: 'bold',
        }}>
          {isDaily ? '✓' : ''}
        </span>
        📅 每日挑战模式 (固定种子，与全球玩家竞争)
      </div>

      {/* Music & SFX Toggles */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div
          onClick={() => useGameStore.getState().toggleMusic()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', fontSize: '12px',
            color: musicEnabled ? '#44cc44' : '#444455',
          }}
        >
          <span style={{
            width: '16px', height: '16px',
            border: `2px solid ${musicEnabled ? '#44cc44' : '#444455'}`,
            borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: musicEnabled ? '#44cc44' : 'transparent',
            color: musicEnabled ? '#0a0a12' : 'transparent', fontSize: '10px', fontWeight: 'bold',
          }}>
            {musicEnabled ? '✓' : ''}
          </span>
          🎵 音乐
        </div>
        <div
          onClick={() => useGameStore.getState().toggleSfx()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', fontSize: '12px',
            color: sfxEnabled ? '#44cc44' : '#444455',
          }}
        >
          <span style={{
            width: '16px', height: '16px',
            border: `2px solid ${sfxEnabled ? '#44cc44' : '#444455'}`,
            borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: sfxEnabled ? '#44cc44' : 'transparent',
            color: sfxEnabled ? '#0a0a12' : 'transparent', fontSize: '10px', fontWeight: 'bold',
          }}>
            {sfxEnabled ? '✓' : ''}
          </span>
          🔊 音效
        </div>
      </div>

      {/* Save Notice */}
      {saveNotice && (
        <div style={{
          color: '#ff8844',
          fontSize: '12px',
          marginBottom: '12px',
          textAlign: 'center',
        }}>
          ⚠️ {saveNotice}
        </div>
      )}

      {/* Continue Game Button */}
      {canContinue && (
        <button
          onClick={() => {
            AudioManager.ensureResumed();
            const success = useGameStore.getState().loadGame();
            if (!success) {
              setCanContinue(false);
              setSaveNotice('存档损坏或已丢失，无法恢复');
            } else {
              setSaveNotice(null);
            }
          }}
          style={{
            backgroundColor: '#4488ff',
            color: '#ffffff',
            border: 'none',
            padding: '10px 36px',
            fontSize: '15px',
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '12px',
            transition: 'all 0.2s ease',
            boxShadow: '0 0 12px rgba(68,136,255,0.3)',
          }}
        >
          ⏎ 继 续 冒 险
        </button>
      )}

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={!name.trim() || !selectedClass}
        style={{
          backgroundColor: name.trim() && selectedClass ? '#ffcc44' : '#222244',
          color: name.trim() && selectedClass ? '#0a0a12' : '#555566',
          border: 'none',
          padding: '12px 40px',
          fontSize: '16px',
          fontFamily: '"Courier New", monospace',
          fontWeight: 'bold',
          borderRadius: '6px',
          cursor: name.trim() && selectedClass ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        进 入 深 渊
      </button>

      {/* Controls hint */}
      <div style={{ marginTop: '24px', fontSize: '11px', color: '#444466', textAlign: 'center' }}>
        <div>方向键/WASD/HJKL 移动 │ 空格 等待 │ , 拾取 │ &gt; 下楼 │ I 背包</div>
        <div style={{ marginTop: '4px' }}>Z/X/C 技能 │ P 商店 │ ? 帮助 │ M 手册</div>
      </div>
    </div>
  );
};

export default CharacterCreation;
