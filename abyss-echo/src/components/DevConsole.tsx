import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { ENEMY_DEFS } from '../constants';

const COMMAND_HELP: Record<string, string> = {
  'goto <层>': '跳转到指定层',
  'hp <值>': '设置HP',
  'mp <值>': '设置MP',
  'hunger <值>': '设置饱食度',
  'gold <值>': '设置金币',
  'exp <值>': '增加经验',
  'level <值>': '设置等级',
  'god': '切换无敌模式',
  'reveal': '显示/关闭全地图（切换）',
  'give <类型>': '生成物品 (weapon/armor/food/potion/scroll)',
  'spawn <敌人ID>': '生成敌人',
  'skill': '重置技能冷却',
  'talent <天赋ID>': '解锁天赋',
  'killall': '消灭本层所有敌人',
  'help': '显示帮助',
};

function executeCommand(input: string): string {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const arg1 = parts[1];
  const store = useGameStore.getState();

  if (!store.player) return '⚠ 游戏未开始';

  switch (cmd) {
    case 'goto': {
      const floor = parseInt(arg1);
      if (isNaN(floor) || floor < 1) return '⚠ 用法: goto <层数>';
      store.devGoto(floor);
      return `→ 跳转到第 ${floor} 层`;
    }
    case 'hp': {
      const val = parseInt(arg1);
      if (isNaN(val)) return '⚠ 用法: hp <数值>';
      store.devSetHp(val);
      return `→ HP 设为 ${Math.max(1, Math.min(val, store.player.maxHp))}`;
    }
    case 'mp': {
      const val = parseInt(arg1);
      if (isNaN(val)) return '⚠ 用法: mp <数值>';
      store.devSetMp(val);
      return `→ MP 设为 ${Math.max(0, Math.min(val, store.player.maxMp))}`;
    }
    case 'hunger': {
      const val = parseInt(arg1);
      if (isNaN(val)) return '⚠ 用法: hunger <数值>';
      store.devSetHunger(val);
      return `→ 饱食度设为 ${Math.max(0, Math.min(val, store.player.maxHunger))}`;
    }
    case 'gold': {
      const val = parseInt(arg1);
      if (isNaN(val)) return '⚠ 用法: gold <数值>';
      store.devSetGold(val);
      return `→ 金币设为 ${Math.max(0, val)}`;
    }
    case 'exp': {
      const val = parseInt(arg1);
      if (isNaN(val)) return '⚠ 用法: exp <数值>';
      store.devAddExp(val);
      return `→ 经验 +${val}`;
    }
    case 'level': {
      const val = parseInt(arg1);
      if (isNaN(val) || val < 1) return '⚠ 用法: level <等级>';
      store.devSetLevel(val);
      return `→ 等级设为 ${val}`;
    }
    case 'god': {
      store.devToggleGod();
      return useGameStore.getState().devGodMode ? '🛡 无敌模式 ON' : '🛡 无敌模式 OFF';
    }
    case 'reveal': {
      const isRevealed = useGameStore.getState().devRevealed;
      if (isRevealed) {
        useGameStore.setState({ devRevealed: false });
        return '👁 全地图揭示已关闭';
      }
      store.devReveal();
      return '';
    }
    case 'give': {
      const valid = ['weapon', 'armor', 'food', 'potion', 'scroll'];
      if (!arg1 || !valid.includes(arg1)) return `⚠ 用法: give <${valid.join('/')}>`;
      store.devGiveItem(arg1);
      return `📦 生成 ${arg1}`;
    }
    case 'spawn': {
      const ids = ENEMY_DEFS.map(d => d.id);
      if (!arg1) {
        return `⚠ 用法: spawn <敌人ID>\n可用: ${ids.join(', ')}`;
      }
      const found = ENEMY_DEFS.find(d => d.id === arg1);
      if (!found) {
        return `⚠ 未知敌人ID: ${arg1}\n可用: ${ids.join(', ')}`;
      }
      store.devSpawnEnemy(arg1);
      return `👹 生成 ${found.name}(${arg1})`;
    }
    case 'skill': {
      store.devResetCooldowns();
      return '⚡ 技能冷却已重置';
    }
    case 'talent': {
      if (!arg1) return '⚠ 用法: talent <天赋ID>';
      store.devAddTalent(arg1);
      return `🌟 尝试解锁天赋 ${arg1}`;
    }
    case 'killall': {
      store.devKillAll();
      return '💀 本层所有敌人已消灭';
    }
    case 'help': {
      return Object.entries(COMMAND_HELP).map(([k, v]) => `  ${k.padEnd(20)} ${v}`).join('\n');
    }
    default:
      return `⚠ 未知命令: ${cmd}，输入 help 查看帮助`;
  }
}

interface HistoryEntry {
  input: string;
  output: string;
}

const DevConsoleInner: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    const output = executeCommand(input);
    setHistory(prev => [...prev, { input, output }]);
    setInput('');
    setHistoryIndex(-1);
  }, [input]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const inputs = history.filter(h => h.input).map(h => h.input);
      if (inputs.length > 0) {
        const newIdx = historyIndex === -1 ? inputs.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(inputs[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const inputs = history.filter(h => h.input).map(h => h.input);
      if (historyIndex >= 0) {
        const newIdx = historyIndex + 1;
        if (newIdx >= inputs.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIdx);
          setInput(inputs[newIdx]);
        }
      }
    }
  }, [handleSubmit, history, historyIndex]);

  // Sync devConsoleOpen to store so App.tsx can block game input
  useEffect(() => {
    useGameStore.setState({ devConsoleOpen: open });
  }, [open]);

  // Listen for ~ key to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(prev => !prev);
        setInput('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '240px',
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      borderTop: '2px solid #ff44ff',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
    }}>
      <div style={{
        padding: '4px 8px',
        color: '#ff44ff',
        borderBottom: '1px solid #333355',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>⚡ 开发者控制台 (按 ~ 关闭)</span>
        <span style={{ color: '#666688' }}>输入 help 查看命令</span>
      </div>

      <div ref={scrollRef} style={{
        flex: 1,
        overflow: 'auto',
        padding: '4px 8px',
      }}>
        {history.map((entry, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>
            <div style={{ color: '#ff44ff' }}>{`> ${entry.input}`}</div>
            <div style={{ color: '#aaaacc', whiteSpace: 'pre-wrap', paddingLeft: '12px' }}>{entry.output}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #333355' }}>
        <span style={{ color: '#ff44ff', padding: '4px 6px' }}>{'>'}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontFamily: '"Courier New", monospace',
            fontSize: '13px',
            outline: 'none',
            caretColor: '#ff44ff',
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

// Production: render nothing. Dev: render console.
export default __DEV__ ? DevConsoleInner : () => null;
