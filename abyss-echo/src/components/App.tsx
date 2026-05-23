import React, { useState, useEffect, useCallback } from 'react';
import { GamePhase } from '../types';
import { useGameStore } from '../store/gameStore';
import MapView from './MapView';
import StatsPanel from './StatsPanel';
import MessageLog from './MessageLog';
import CharacterCreation from './CharacterCreation';
import GameOverScreen from './GameOverScreen';
import InventoryModal from './InventoryModal';
import LevelUpModal from './LevelUpModal';
import HelpOverlay from './HelpOverlay';
import ManualOverlay from './ManualOverlay';
import TalentModal from './TalentModal';
import ShopModal from './ShopModal';
import EventModal from './EventModal';
import BossBlessingModal from './BossBlessingModal';
import SkillBar from './SkillBar';
import RelicBar from './RelicBar';
import EnhanceModal from './EnhanceModal';

const GameScreen: React.FC = () => {
  const phase = useGameStore(s => s.phase);
  const movePlayer = useGameStore(s => s.movePlayer);
  const waitTurn = useGameStore(s => s.waitTurn);
  const pickupItem = useGameStore(s => s.pickupItem);
  const descendStairs = useGameStore(s => s.descendStairs);
  const toggleInventory = useGameStore(s => s.toggleInventory);
  const applyItem = useGameStore(s => s.useItem);
  const equipItem = useGameStore(s => s.equipItem);
  const dropItem = useGameStore(s => s.dropItem);
  const applySkill = useGameStore(s => s.useSkill);
  const pendingForge = useGameStore(s => s.pendingForge);
  const setPhase = useGameStore(s => s.setPhase);
  const [showHelp, setShowHelp] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [selectedInvIndex, setSelectedInvIndex] = useState(-1);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showManual) {
      if (e.key === 'm' || e.key === 'M' || e.key === 'Escape') setShowManual(false);
      return;
    }
    if (showHelp) {
      if (e.key === '?' || e.key === 'Escape') setShowHelp(false);
      return;
    }

    if (phase === GamePhase.LevelUp) return;
    if (phase === GamePhase.TalentSelection) return;
    if (phase === GamePhase.Shop) {
      if (e.key === 'Escape') useGameStore.getState().closeShop();
      return;
    }
    if (phase === GamePhase.Event) return;
    if (pendingForge) {
      if (e.key === 'Escape') setPhase(GamePhase.Playing);
      return;
    }

    if (phase === GamePhase.Inventory) {
      const player = useGameStore.getState().player;
      if (!player) return;

      switch (e.key) {
        case 'i':
        case 'Escape':
          toggleInventory();
          setSelectedInvIndex(-1);
          break;
        case 'ArrowUp':
          setSelectedInvIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown':
          setSelectedInvIndex(i => Math.min(player.inventory.length - 1, i + 1));
          break;
        case 'u':
        case 'U':
          if (selectedInvIndex >= 0) { applyItem(selectedInvIndex); setSelectedInvIndex(-1); }
          break;
        case 'e':
        case 'E':
          if (selectedInvIndex >= 0) { equipItem(selectedInvIndex); setSelectedInvIndex(-1); }
          break;
        case 'd':
        case 'D':
          if (selectedInvIndex >= 0) { dropItem(selectedInvIndex); setSelectedInvIndex(-1); }
          break;
      }
      return;
    }

    if (phase !== GamePhase.Playing) return;

    // ESC in playing phase → suspend confirm
    if (e.key === 'Escape') {
      setShowSuspendConfirm(true);
      return;
    }

    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'h', 'j', 'k', 'l', ' '];
    if (gameKeys.includes(e.key)) e.preventDefault();

    switch (e.key) {
      case 'ArrowUp':    movePlayer(0, -1); break;
      case 'ArrowDown':  movePlayer(0, 1); break;
      case 'ArrowLeft':  movePlayer(-1, 0); break;
      case 'ArrowRight': movePlayer(1, 0); break;
      case 'w': movePlayer(0, -1); break;
      case 's': movePlayer(0, 1); break;
      case 'a': movePlayer(-1, 0); break;
      case 'd': movePlayer(1, 0); break;
      case 'h': movePlayer(-1, 0); break;
      case 'j': movePlayer(0, 1); break;
      case 'k': movePlayer(0, -1); break;
      case 'l': movePlayer(1, 0); break;
      case ' ':
      case '.':
        waitTurn();
        break;
      case ',':
        pickupItem();
        break;
      case '>':
        descendStairs();
        break;
      case 'i':
        toggleInventory();
        setSelectedInvIndex(-1);
        break;
      case '?':
        setShowHelp(true);
        break;
      case 'm':
      case 'M':
        setShowManual(true);
        break;
      // Skills
      case 'z': applySkill(0); break;
      case 'x': applySkill(1); break;
      case 'c': applySkill(2); break;
      // Shop
      case 'p': {
        const state = useGameStore.getState();
        const tile = state.player ? state.map[state.player.pos.y]?.[state.player.pos.x] : null;
        if (tile?.type === 'shop' && state.shopItems.length > 0) {
          useGameStore.getState().setPhase(GamePhase.Shop);
        }
        break;
      }
    }
  }, [phase, movePlayer, waitTurn, pickupItem, descendStairs, toggleInventory, applyItem, equipItem, dropItem, applySkill, showHelp, showManual, selectedInvIndex, pendingForge, setPhase]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const screenFlash = useGameStore(s => s.screenFlash);
  const warningPulse = useGameStore(s => s.warningPulse);
  const bossBlessingPending = useGameStore(s => s.bossBlessingPending);
  const musicEnabled = useGameStore(s => s.musicEnabled);
  const sfxEnabled = useGameStore(s => s.sfxEnabled);
  const toggleMusic = useGameStore(s => s.toggleMusic);
  const toggleSfx = useGameStore(s => s.toggleSfx);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#0a0a12',
      position: 'relative',
    }}>
      {/* Screen flash overlay */}
      {screenFlash && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: screenFlash,
          pointerEvents: 'none',
          zIndex: 1000,
          animation: 'fadeOut 0.15s ease-out forwards',
        }} />
      )}
      <style>{`@keyframes fadeOut { from { opacity: 0.3; } to { opacity: 0; } }`}</style>

      {/* Warning pulse overlay (low HP / hunger) */}
      {warningPulse !== 'none' && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          zIndex: 999,
          animation: 'borderPulse 1.5s ease-in-out infinite',
          boxShadow: warningPulse === 'lowHp'
            ? 'inset 0 0 40px 10px rgba(255,0,0,0.4)'
            : warningPulse === 'hunger'
              ? 'inset 0 0 40px 10px rgba(255,170,0,0.3)'
              : 'inset 0 0 40px 10px rgba(255,80,0,0.4)',
        }} />
      )}
      <style>{`@keyframes borderPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>

      {/* Audio controls HUD */}
      <div style={{
        position: 'absolute',
        top: '4px',
        right: '270px',
        display: 'flex',
        gap: '4px',
        zIndex: 50,
      }}>
        <button
          onClick={toggleMusic}
          style={{
            backgroundColor: musicEnabled ? '#1a1a2e' : '#0a0a12',
            border: `1px solid ${musicEnabled ? '#44cc44' : '#333355'}`,
            color: musicEnabled ? '#44cc44' : '#444455',
            padding: '2px 6px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '3px',
            fontFamily: '"Courier New", monospace',
          }}
        >
          🎵
        </button>
        <button
          onClick={toggleSfx}
          style={{
            backgroundColor: sfxEnabled ? '#1a1a2e' : '#0a0a12',
            border: `1px solid ${sfxEnabled ? '#44cc44' : '#333355'}`,
            color: sfxEnabled ? '#44cc44' : '#444455',
            padding: '2px 6px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '3px',
            fontFamily: '"Courier New", monospace',
          }}
        >
          🔊
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MapView />
        </div>
        <StatsPanel />
      </div>
      <SkillBar />
      <MessageLog />
      <RelicBar />
      {phase === GamePhase.Inventory && <InventoryModal selectedIndex={selectedInvIndex} onSelect={setSelectedInvIndex} />}
      {phase === GamePhase.LevelUp && <LevelUpModal />}
      {phase === GamePhase.TalentSelection && <TalentModal />}
      {phase === GamePhase.Shop && <ShopModal />}
      {phase === GamePhase.Event && <EventModal />}
      {bossBlessingPending && <BossBlessingModal />}
      {pendingForge && <EnhanceModal />}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      {showManual && <ManualOverlay onClose={() => setShowManual(false)} />}
      {showSuspendConfirm && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            backgroundColor: '#1a1a2e', border: '2px solid #4488ff',
            borderRadius: '8px', padding: '24px 32px', textAlign: 'center',
            fontFamily: '"Courier New", monospace',
          }}>
            <div style={{ color: '#cccccc', fontSize: '16px', marginBottom: '16px' }}>
              暂停并退出？
            </div>
            <div style={{ color: '#888899', fontSize: '12px', marginBottom: '20px' }}>
              游戏进度将保存，下次可继续
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => { setShowSuspendConfirm(false); useGameStore.getState().suspendAndQuit(); }}
                style={{
                  backgroundColor: '#4488ff', color: '#ffffff', border: 'none',
                  padding: '8px 20px', fontSize: '14px', borderRadius: '4px',
                  cursor: 'pointer', fontFamily: '"Courier New", monospace',
                }}
              >
                保存并退出
              </button>
              <button
                onClick={() => setShowSuspendConfirm(false)}
                style={{
                  backgroundColor: '#222244', color: '#cccccc', border: '1px solid #444466',
                  padding: '8px 20px', fontSize: '14px', borderRadius: '4px',
                  cursor: 'pointer', fontFamily: '"Courier New", monospace',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const phase = useGameStore(s => s.phase);

  switch (phase) {
    case GamePhase.Title:
    case GamePhase.CharacterCreation:
      return <CharacterCreation />;
    case GamePhase.GameOver:
      return <GameOverScreen />;
    default:
      return <GameScreen />;
  }
};

export default App;
