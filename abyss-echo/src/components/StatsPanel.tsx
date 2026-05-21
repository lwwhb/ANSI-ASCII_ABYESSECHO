import React from 'react';
import { Item, ItemType, WeaponItem, ArmorItem } from '../types';
import { useGameStore } from '../store/gameStore';
import { getEffectiveStats } from '../entities/Player';
import { CLASS_DEFS, RARITY_COLORS, SKILL_DEFS, TALENT_DEFS, BIOME_CONFIG, getBiomeForFloor } from '../constants';
import MiniMap from './MiniMap';

const StatsPanel: React.FC = () => {
  const player = useGameStore(s => s.player);
  const currentFloor = useGameStore(s => s.currentFloor);
  const turn = useGameStore(s => s.turn);

  if (!player) return null;

  const stats = getEffectiveStats(player);
  const classDef = CLASS_DEFS[player.class];
  const hpPercent = (player.hp / player.maxHp) * 100;
  const mpPercent = (player.mp / player.maxMp) * 100;
  const hungerPercent = (player.hunger / player.maxHunger) * 100;
  const expPercent = (player.exp / player.expToNext) * 100;
  const skills = SKILL_DEFS[player.class];

  return (
    <div style={{
      width: '260px',
      backgroundColor: '#0d0d1a',
      borderLeft: '1px solid #222244',
      padding: '12px',
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#aaaaaa',
      overflowY: 'auto',
    }}>
      {/* Name & Class */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: player.fg, fontSize: '16px', fontWeight: 'bold' }}>
          {player.name}
        </div>
        <div style={{ color: '#888899', fontSize: '12px' }}>
          {classDef.nameZh} Lv.{player.level}
        </div>
      </div>

      {/* HP Bar */}
      <Bar label="HP" current={player.hp} max={player.maxHp} percent={hpPercent} color="#cc2222" bgColor="#440000" />

      {/* MP Bar */}
      <Bar label="MP" current={player.mp} max={player.maxMp} percent={mpPercent} color="#2244cc" bgColor="#000044" />

      {/* Hunger Bar */}
      <Bar
        label="饱食"
        current={player.hunger}
        max={player.maxHunger}
        percent={hungerPercent}
        color={hungerPercent <= 0 ? '#ff2222' : hungerPercent < 5 ? '#ff4422' : hungerPercent < 15 ? '#cc6622' : hungerPercent < 25 ? '#cc8844' : '#44aa44'}
        bgColor="#223322"
      />

      {/* EXP Bar */}
      <Bar label="EXP" current={player.exp} max={player.expToNext} percent={expPercent} color="#ccaa22" bgColor="#332200" small />

      {/* Stats */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
        <StatLine label="STR" value={stats.str} color="#ff6644" />
        <StatLine label="DEX" value={stats.dex} color="#44ff66" />
        <StatLine label="INT" value={stats.int} color="#4488ff" />
        <StatLine label="VIT" value={stats.vit} color="#ffcc44" />
        {player.statPoints > 0 && (
          <div style={{ color: '#ffcc44', marginTop: '4px' }}>
            可分配点数: {player.statPoints}
          </div>
        )}
      </div>

      {/* Gold */}
      <div style={{ marginTop: '8px', color: '#ffcc44', fontSize: '12px' }}>
        💰 {player.gold} 金币
      </div>

      {/* Skills */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
        <div style={{ color: '#888899', marginBottom: '4px', fontSize: '11px' }}>技能:</div>
        {skills.map((skill, idx) => {
          const cd = player.skillCooldowns[idx];
          const canUse = cd <= 0 && player.mp >= skill.mpCost;
          return (
            <div key={skill.id} style={{
              fontSize: '10px',
              marginBottom: '2px',
              color: canUse ? '#cccccc' : '#444455',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{skill.icon} [{skill.key.toUpperCase()}] {skill.nameZh}</span>
              <span>{cd > 0 ? `CD:${cd}` : `${skill.mpCost}MP`}</span>
            </div>
          );
        })}
      </div>

      {/* Equipment */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
        <div style={{ color: '#888899', marginBottom: '4px' }}>装备:</div>
        {Object.entries(player.equipment).map(([slot, item]) => (
          <div key={slot} style={{ fontSize: '11px', marginBottom: '2px' }}>
            <span style={{ color: '#666677' }}>{slotLabel(slot)}:</span>{' '}
            {item ? (
              <span style={{ color: RARITY_COLORS[item.rarity] }}>
                {item.char} {item.name}
                {item.cursed && <span style={{ color: '#ff4444' }}> [咒]</span>}
                <span style={{ color: '#556677', fontSize: '10px' }}> {equipSummary(item)}</span>
              </span>
            ) : (
              <span style={{ color: '#444455' }}>空</span>
            )}
          </div>
        ))}
      </div>

      {/* Talents */}
      {player.talents.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
          <div style={{ color: '#888899', marginBottom: '4px' }}>天赋:</div>
          {player.talents.map(tId => {
            const t = TALENT_DEFS.find(td => td.id === tId);
            return t ? (
              <div key={tId} style={{ fontSize: '10px', color: '#aa88cc' }}>
                {t.icon} {t.nameZh}
              </div>
            ) : null;
          })}
        </div>
      )}

      {/* Floor & Turn Info */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
        <div>楼层: <span style={{ color: '#ffcc44' }}>B{currentFloor}F</span> <span style={{ color: '#888899', fontSize: '11px' }}>{BIOME_CONFIG[getBiomeForFloor(currentFloor)].nameZh}</span></div>
        <div>回合: <span style={{ color: '#888899' }}>{turn}</span></div>
        <div>击杀: <span style={{ color: '#ff4444' }}>{player.killCount}</span></div>
      </div>

      {/* Status Effects */}
      {player.statusEffects.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
          <div style={{ color: '#888899', marginBottom: '4px' }}>状态:</div>
          {player.statusEffects.map((effect, i) => (
            <div key={i} style={{ fontSize: '11px', color: effectColor(effect.type) }}>
              {effectLabel(effect.type)} ({effect.duration}回合)
            </div>
          ))}
        </div>
      )}

      {/* Minimap */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #222244', paddingTop: '8px' }}>
        <div style={{ color: '#888899', marginBottom: '4px' }}>小地图:</div>
        <MiniMap />
      </div>
    </div>
  );
};

const Bar: React.FC<{
  label: string; current: number; max: number; percent: number;
  color: string; bgColor: string; small?: boolean;
}> = ({ label, current, max, percent, color, bgColor, small }) => (
  <div style={{ marginBottom: small ? '6px' : '8px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: small ? '10px' : '11px', marginBottom: '2px' }}>
      <span style={{ color }}>{label}</span>
      <span style={{ color: '#888899' }}>{current}/{max}</span>
    </div>
    <div style={{
      height: small ? '6px' : '8px',
      backgroundColor: bgColor,
      borderRadius: '2px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, percent))}%`,
        height: '100%',
        backgroundColor: color,
        borderRadius: '2px',
        transition: 'width 0.15s ease',
      }} />
    </div>
  </div>
);

const StatLine: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
    <span style={{ color: '#666677' }}>{label}</span>
    <span style={{ color, fontWeight: 'bold' }}>{value}</span>
  </div>
);

function slotLabel(slot: string): string {
  const labels: Record<string, string> = {
    weapon: '武器',
    armor: '护甲',
    ring1: '戒指1',
    ring2: '戒指2',
    amulet: '护符',
  };
  return labels[slot] || slot;
}

function effectColor(type: string): string {
  const colors: Record<string, string> = {
    poison: '#44cc44',
    burn: '#ff6644',
    freeze: '#88aaff',
    bleed: '#cc4444',
    confusion: '#cccc44',
    defenseUp: '#44aaff',
    poisonBlade: '#44cc44',
  };
  return colors[type] || '#aaaaaa';
}

function effectLabel(type: string): string {
  const labels: Record<string, string> = {
    poison: '中毒',
    burn: '灼烧',
    freeze: '冰冻',
    bleed: '流血',
    confusion: '混乱',
    defenseUp: '防御增强',
    poisonBlade: '毒刃(待攻击)',
  };
  return labels[type] || type;
}

function equipSummary(item: Item): string {
  switch (item.type) {
    case ItemType.Weapon: {
      const w = item as WeaponItem;
      return `伤${w.damage}`;
    }
    case ItemType.Armor: {
      const a = item as ArmorItem;
      return `防${a.defense}/闪${a.evasion >= 0 ? '+' : ''}${a.evasion}`;
    }
    default:
      return item.description || '';
  }
}

export default StatsPanel;
