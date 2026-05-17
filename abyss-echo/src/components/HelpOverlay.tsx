import React from 'react';

const HelpOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  }}
    onClick={onClose}
  >
    <div style={{
      backgroundColor: '#0d0d1a',
      border: '2px solid #ffcc44',
      borderRadius: '8px',
      padding: '24px',
      width: '520px',
      fontFamily: '"Courier New", monospace',
      color: '#cccccc',
    }}>
      <div style={{ color: '#ffcc44', fontSize: '20px', textAlign: 'center', marginBottom: '16px' }}>
        操控指南
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', fontSize: '13px' }}>
        <span style={{ color: '#888899' }}>移动:</span>
        <span>方向键 / WASD / HJKL</span>

        <span style={{ color: '#888899' }}>普通攻击:</span>
        <span style={{ color: '#ff6644' }}>朝敌人方向移动即可</span>

        <span style={{ color: '#888899' }}>等待:</span>
        <span>空格 / .</span>

        <span style={{ color: '#888899' }}>拾取物品:</span>
        <span>, (走到物品上时按)</span>

        <span style={{ color: '#888899' }}>下楼:</span>
        <span>&gt; (站在楼梯上时)</span>

        <span style={{ color: '#888899' }}>背包:</span>
        <span>I</span>

        <span style={{ color: '#888899' }}>技能:</span>
        <span>Z / X / C (消耗法力)</span>

        <span style={{ color: '#888899' }}>商店:</span>
        <span>P (站在商人旁)</span>

        <span style={{ color: '#888899' }}>使用物品:</span>
        <span>U (在背包中)</span>

        <span style={{ color: '#888899' }}>装备物品:</span>
        <span>E (在背包中)</span>

        <span style={{ color: '#888899' }}>丢弃物品:</span>
        <span>D (在背包中)</span>

        <span style={{ color: '#888899' }}>帮助:</span>
        <span>?</span>

        <span style={{ color: '#888899' }}>手册:</span>
        <span>M</span>
      </div>

      <div style={{ marginTop: '14px', borderTop: '1px solid #222244', paddingTop: '12px', fontSize: '12px' }}>
        <div style={{ marginBottom: '6px', color: '#ffcc44' }}>⚔️ 战斗</div>
        <div style={{ color: '#aaaacc', lineHeight: '1.6' }}>
          朝敌人方向移动 = 普通攻击（不消耗法力）<br/>
          Z/X/C = 技能（消耗法力，威力更大）
        </div>
      </div>

      <div style={{ marginTop: '10px', borderTop: '1px solid #222244', paddingTop: '12px', fontSize: '12px' }}>
        <div style={{ marginBottom: '6px', color: '#44cc44' }}>💊 恢复</div>
        <div style={{ color: '#aaaacc', lineHeight: '1.6' }}>
          ! 治疗药水 = 恢复HP &nbsp; ! 魔力药水 = 恢复MP<br/>
          % 面包/肉干 = 恢复饱食度 &nbsp; 饱食度归零会持续掉血！
        </div>
      </div>

      <div style={{ marginTop: '10px', borderTop: '1px solid #222244', paddingTop: '12px', fontSize: '12px' }}>
        <div style={{ marginBottom: '6px', color: '#4488ff' }}>📦 物品</div>
        <div style={{ color: '#aaaacc', lineHeight: '1.6' }}>
          ? 卷轴 = 未鉴定，按U使用后自动鉴定并发动效果<br/>
          ! 药水 = 同上，使用后鉴定<br/>
          按 I 打开背包 → 选中物品可查看属性和装备对比
        </div>
      </div>

      <div style={{ marginTop: '10px', borderTop: '1px solid #222244', paddingTop: '12px', fontSize: '12px', color: '#666677' }}>
        <div style={{ marginBottom: '6px', color: '#aaaaaa' }}>符号说明:</div>
        <div>@ = 你 &nbsp; s/r/b/g = 低级怪物 &nbsp; S/O/K = 高级怪物</div>
        <div>/ = 武器 &nbsp; [ = 护甲 &nbsp; ! = 药水 &nbsp; ? = 卷轴 &nbsp; % = 食物</div>
        <div>= = 戒指 &nbsp; " = 护符 &nbsp; ▼ = 下楼梯 &nbsp; ▓ = 门</div>
      </div>

      <div style={{ marginTop: '12px', textAlign: 'center', color: '#444455', fontSize: '11px' }}>
        按 ? 或点击任意处关闭
      </div>
    </div>
  </div>
);

export default HelpOverlay;
