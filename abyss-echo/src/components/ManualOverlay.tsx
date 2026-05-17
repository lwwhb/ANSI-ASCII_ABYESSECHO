import React, { useState, useRef, useEffect } from 'react';

interface Section {
  id: string;
  title: string;
}

const sections: Section[] = [
  { id: 'intro', title: '📖 游戏简介' },
  { id: 'controls', title: '🎹 操控指南' },
  { id: 'classes', title: '⚔️ 职业选择' },
  { id: 'stats', title: '📊 属性系统' },
  { id: 'combat', title: '⚔️ 战斗系统' },
  { id: 'items', title: '🎒 物品系统' },
  { id: 'enemies', title: '👾 敌人图鉴' },
  { id: 'terrain', title: '🌍 地形与生态' },
  { id: 'hunger', title: '🍖 饥饿系统' },
  { id: 'strategy', title: '💡 策略指南' },
];

const ManualOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('intro');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.getElementById(`section-${activeSection}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    marginBottom: '12px',
  };

  const thStyle: React.CSSProperties = {
    borderBottom: '1px solid #333355',
    padding: '6px 8px',
    textAlign: 'left',
    color: '#ffcc44',
    fontWeight: 'normal',
  };

  const tdStyle: React.CSSProperties = {
    borderBottom: '1px solid #1a1a2e',
    padding: '5px 8px',
    color: '#bbbbcc',
  };

  const h2Style: React.CSSProperties = {
    color: '#ffcc44',
    fontSize: '16px',
    marginTop: '20px',
    marginBottom: '10px',
    paddingBottom: '4px',
    borderBottom: '1px solid #222244',
  };

  const h3Style: React.CSSProperties = {
    color: '#aaaacc',
    fontSize: '14px',
    marginTop: '14px',
    marginBottom: '8px',
  };

  const pStyle: React.CSSProperties = {
    color: '#999aab',
    fontSize: '12px',
    lineHeight: '1.7',
    margin: '6px 0',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0d0d1a',
          border: '2px solid #ffcc44',
          borderRadius: '8px',
          width: '860px',
          maxWidth: '95vw',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Courier New", monospace',
          color: '#cccccc',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #222244',
            flexShrink: 0,
          }}
        >
          <div style={{ color: '#ffcc44', fontSize: '18px' }}>
            📖 深渊回响 - 玩家手册
          </div>
          <div style={{ color: '#555566', fontSize: '12px' }}>
            按 M / ESC / 点击外部关闭
          </div>
        </div>

        {/* Nav tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px',
            padding: '8px 16px',
            borderBottom: '1px solid #1a1a2e',
            flexShrink: 0,
          }}
        >
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              style={{
                background: activeSection === s.id ? '#222244' : 'transparent',
                border: activeSection === s.id ? '1px solid #ffcc44' : '1px solid transparent',
                borderRadius: '4px',
                color: activeSection === s.id ? '#ffcc44' : '#666688',
                padding: '3px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: '"Courier New", monospace',
                transition: 'all 0.15s',
              }}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            lineHeight: '1.6',
          }}
        >
          {/* 游戏简介 */}
          <div id="section-intro">
            <h2 style={h2Style}>📖 游戏简介</h2>
            <p style={pStyle}>
              <strong style={{ color: '#ffcc44' }}>深渊回响</strong> 是一款基于浏览器的 Roguelike 游戏，使用 ANSI/ASCII 艺术风格渲染。
              你扮演一名坠入无尽深渊的探险者，在程序生成的地牢中不断向下深入。死亡即终局，每次都是全新的旅程。
            </p>
            <p style={pStyle}>
              <strong style={{ color: '#aaaaaa' }}>核心目标：</strong>尽可能深入深渊，击败强大的Boss，在排行榜上留下你的名字。
            </p>
          </div>

          {/* 操控指南 */}
          <div id="section-controls">
            <h2 style={h2Style}>🎹 操控指南</h2>

            <h3 style={h3Style}>移动</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>按键</th><th style={thStyle}>功能</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>↑↓←→ / WASD / HJKL</td><td style={tdStyle}>移动</td></tr>
                <tr><td style={tdStyle}>空格 / .</td><td style={tdStyle}>等待一回合</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>交互</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>按键</th><th style={thStyle}>功能</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>,</td><td style={tdStyle}>拾取脚下物品</td></tr>
                <tr><td style={tdStyle}>&gt;</td><td style={tdStyle}>在楼梯上下楼</td></tr>
                <tr><td style={tdStyle}>I</td><td style={tdStyle}>打开/关闭背包</td></tr>
                <tr><td style={tdStyle}>M</td><td style={tdStyle}>打开/关闭手册</td></tr>
                <tr><td style={tdStyle}>?</td><td style={tdStyle}>显示快捷帮助</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>背包内操作</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>按键</th><th style={thStyle}>功能</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>↑↓</td><td style={tdStyle}>选择物品</td></tr>
                <tr><td style={tdStyle}>U</td><td style={tdStyle}>使用物品</td></tr>
                <tr><td style={tdStyle}>E</td><td style={tdStyle}>装备物品</td></tr>
                <tr><td style={tdStyle}>D</td><td style={tdStyle}>丢弃物品</td></tr>
                <tr><td style={tdStyle}>I / ESC</td><td style={tdStyle}>关闭背包</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>升级时</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>按键</th><th style={thStyle}>功能</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>1-4</td><td style={tdStyle}>分配属性点到 STR/DEX/INT/VIT</td></tr>
                <tr><td style={tdStyle}>Enter</td><td style={tdStyle}>确认（点数用完后）</td></tr>
              </tbody>
            </table>
          </div>

          {/* 职业选择 */}
          <div id="section-classes">
            <h2 style={h2Style}>⚔️ 职业选择</h2>

            <div style={{ border: '1px solid #441111', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
              <h3 style={{ ...h3Style, color: '#ff4444' }}>🗡️ 战士 (Warrior)</h3>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>核心属性：</strong>高STR、高VIT</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>初始HP：</strong>30 + VIT×3 | <strong style={{ color: '#aaaaaa' }}>初始MP：</strong>5 + INT×2</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>定位：</strong>近战肉盾，高伤害高血量</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>适合：</strong>新手玩家，正面冲锋型打法</p>
            </div>

            <div style={{ border: '1px solid #111144', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
              <h3 style={{ ...h3Style, color: '#4488ff' }}>🔮 法师 (Mage)</h3>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>核心属性：</strong>高INT</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>初始HP：</strong>15 + VIT×3 | <strong style={{ color: '#aaaaaa' }}>初始MP：</strong>25 + INT×2</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>定位：</strong>魔法输出，高MP但身躯脆弱</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>适合：</strong>喜欢策略性打法的玩家</p>
            </div>

            <div style={{ border: '1px solid #114411', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
              <h3 style={{ ...h3Style, color: '#44cc44' }}>🏹 游侠 (Rogue)</h3>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>核心属性：</strong>高DEX</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>初始HP：</strong>20 + VIT×3 | <strong style={{ color: '#aaaaaa' }}>初始MP：</strong>10 + INT×2</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>定位：</strong>闪避暴击，攻守兼备</p>
              <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>适合：</strong>喜欢灵活走位的玩家</p>
            </div>
          </div>

          {/* 属性系统 */}
          <div id="section-stats">
            <h2 style={h2Style}>📊 属性系统</h2>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>属性</th><th style={thStyle}>全称</th><th style={thStyle}>效果</th></tr></thead>
              <tbody>
                <tr><td style={{ ...tdStyle, color: '#ff6644' }}>STR</td><td style={tdStyle}>力量</td><td style={tdStyle}>增加近战伤害，每点+1伤害</td></tr>
                <tr><td style={{ ...tdStyle, color: '#44cc44' }}>DEX</td><td style={tdStyle}>灵巧</td><td style={tdStyle}>增加闪避率和暴击率</td></tr>
                <tr><td style={{ ...tdStyle, color: '#4488ff' }}>INT</td><td style={tdStyle}>智慧</td><td style={tdStyle}>增加魔法伤害和MP上限</td></tr>
                <tr><td style={{ ...tdStyle, color: '#ffcc44' }}>VIT</td><td style={tdStyle}>活力</td><td style={tdStyle}>增加HP上限，每点+3HP</td></tr>
              </tbody>
            </table>
            <p style={pStyle}>升级时获得3点属性点，可自由分配。<strong style={{ color: '#ff6644' }}>分配后不可撤回！</strong></p>
          </div>

          {/* 战斗系统 */}
          <div id="section-combat">
            <h2 style={h2Style}>⚔️ 战斗系统</h2>

            <h3 style={h3Style}>基础规则</h3>
            <p style={pStyle}>• <strong style={{ color: '#aaaaaa' }}>回合制：</strong>你行动一步，所有敌人也行动一步</p>
            <p style={pStyle}>• <strong style={{ color: '#aaaaaa' }}>近战：</strong>走向敌人自动攻击，伤害 = STR + 武器 - 敌人DEF</p>
            <p style={pStyle}>• <strong style={{ color: '#aaaaaa' }}>暴击：</strong>5% + DEX/200 的概率，造成1.5倍伤害</p>
            <p style={pStyle}>• <strong style={{ color: '#aaaaaa' }}>防御：</strong>减少 DEX/3 + 护甲DEF 的伤害</p>

            <h3 style={h3Style}>元素系统</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>元素</th><th style={thStyle}>克制</th><th style={thStyle}>被克</th></tr></thead>
              <tbody>
                <tr><td style={{ ...tdStyle, color: '#ff4444' }}>🔥 火</td><td style={tdStyle}>克制冰、毒</td><td style={tdStyle}>被冰克制</td></tr>
                <tr><td style={{ ...tdStyle, color: '#44ccff' }}>❄️ 冰</td><td style={tdStyle}>克制火</td><td style={tdStyle}>被火克制</td></tr>
                <tr><td style={{ ...tdStyle, color: '#ffcc44' }}>⚡ 雷</td><td style={tdStyle}>克制无弱点敌人</td><td style={tdStyle}>—</td></tr>
                <tr><td style={{ ...tdStyle, color: '#44cc44' }}>🟢 毒</td><td style={tdStyle}>—</td><td style={tdStyle}>被火克制</td></tr>
              </tbody>
            </table>
            <p style={pStyle}><strong style={{ color: '#aaaaaa' }}>元素克制：</strong>1.5倍伤害 | <strong style={{ color: '#aaaaaa' }}>抵抗：</strong>0.5倍伤害</p>

            <h3 style={h3Style}>状态效果</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>效果</th><th style={thStyle}>持续</th><th style={thStyle}>效果</th></tr></thead>
              <tbody>
                <tr><td style={{ ...tdStyle, color: '#44cc44' }}>🟢 中毒</td><td style={tdStyle}>每回合</td><td style={tdStyle}>持续受到毒素伤害</td></tr>
                <tr><td style={{ ...tdStyle, color: '#ff4444' }}>🔴 灼烧</td><td style={tdStyle}>每回合</td><td style={tdStyle}>受到火焰伤害，降低防御</td></tr>
                <tr><td style={{ ...tdStyle, color: '#4488ff' }}>🔵 冰冻</td><td style={tdStyle}>跳过回合</td><td style={tdStyle}>无法行动</td></tr>
                <tr><td style={{ ...tdStyle, color: '#cc4444' }}>🩸 流血</td><td style={tdStyle}>每回合</td><td style={tdStyle}>持续受到流血伤害</td></tr>
              </tbody>
            </table>
          </div>

          {/* 物品系统 */}
          <div id="section-items">
            <h2 style={h2Style}>🎒 物品系统</h2>

            <h3 style={h3Style}>物品类型</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>类型</th><th style={thStyle}>说明</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>/</td><td style={tdStyle}>武器</td><td style={tdStyle}>增加近战伤害</td></tr>
                <tr><td style={tdStyle}>[</td><td style={tdStyle}>护甲</td><td style={tdStyle}>增加防御，影响闪避</td></tr>
                <tr><td style={tdStyle}>=</td><td style={tdStyle}>戒指</td><td style={tdStyle}>提供属性加成</td></tr>
                <tr><td style={tdStyle}>"</td><td style={tdStyle}>护符</td><td style={tdStyle}>提供属性加成</td></tr>
                <tr><td style={tdStyle}>!</td><td style={tdStyle}>药水</td><td style={tdStyle}>即时效果，需鉴定</td></tr>
                <tr><td style={tdStyle}>?</td><td style={tdStyle}>卷轴</td><td style={tdStyle}>即时效果，需鉴定</td></tr>
                <tr><td style={tdStyle}>%</td><td style={tdStyle}>食物</td><td style={tdStyle}>恢复饱食度</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>稀有度</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>稀有度</th><th style={thStyle}>颜色</th><th style={thStyle}>说明</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>普通</td><td style={{ ...tdStyle, color: '#cccccc' }}>⬜ 白色</td><td style={tdStyle}>基础属性</td></tr>
                <tr><td style={tdStyle}>优良</td><td style={{ ...tdStyle, color: '#44cc44' }}>🟩 绿色</td><td style={tdStyle}>1.2倍属性</td></tr>
                <tr><td style={tdStyle}>稀有</td><td style={{ ...tdStyle, color: '#4488ff' }}>🟦 蓝色</td><td style={tdStyle}>1.4倍属性</td></tr>
                <tr><td style={tdStyle}>史诗</td><td style={{ ...tdStyle, color: '#aa44ff' }}>🟪 紫色</td><td style={tdStyle}>1.7倍属性+额外加成</td></tr>
                <tr><td style={tdStyle}>传说</td><td style={{ ...tdStyle, color: '#ff8800' }}>🟧 橙色</td><td style={tdStyle}>2.2倍属性+强力加成</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>鉴定系统</h3>
            <p style={pStyle}>• 拾取的<strong style={{ color: '#aaaaaa' }}>药水</strong>和<strong style={{ color: '#aaaaaa' }}>卷轴</strong>初始未鉴定</p>
            <p style={pStyle}>• 未鉴定物品显示为"红色药水"、"灼热的纸卷"等</p>
            <p style={pStyle}>• <strong style={{ color: '#aaaaaa' }}>使用</strong>该物品即可鉴定，效果也会同时生效</p>
            <p style={pStyle}>• ⚠️ 未鉴定的药水可能是有毒的！</p>
            <p style={pStyle}>• 鉴定卷轴(<code style={{ color: '#ffcc44' }}>?</code>)可以安全鉴定一个未鉴定物品</p>

            <h3 style={h3Style}>药水效果</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>名称</th><th style={thStyle}>颜色</th><th style={thStyle}>效果</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>治疗药水</td><td style={{ ...tdStyle, color: '#ff4444' }}>红色</td><td style={tdStyle}>恢复15HP</td></tr>
                <tr><td style={tdStyle}>魔力药水</td><td style={{ ...tdStyle, color: '#4488ff' }}>蓝色</td><td style={tdStyle}>恢复12MP</td></tr>
                <tr><td style={tdStyle}>力量药水</td><td style={{ ...tdStyle, color: '#ff8800' }}>橙色</td><td style={tdStyle}>STR+2（永久）</td></tr>
                <tr><td style={tdStyle}>灵巧药水</td><td style={{ ...tdStyle, color: '#44cc44' }}>绿色</td><td style={tdStyle}>DEX+2（永久）</td></tr>
                <tr><td style={tdStyle}>智慧药水</td><td style={{ ...tdStyle, color: '#aa44ff' }}>紫色</td><td style={tdStyle}>INT+2（永久）</td></tr>
                <tr><td style={tdStyle}>剧毒药水</td><td style={{ ...tdStyle, color: '#888888' }}>浑浊</td><td style={tdStyle}>受到8点毒伤！</td></tr>
                <tr><td style={tdStyle}>麻痹药水</td><td style={{ ...tdStyle, color: '#cccc44' }}>黄色</td><td style={tdStyle}>被麻痹3回合！</td></tr>
                <tr><td style={tdStyle}>完全治疗药水</td><td style={{ ...tdStyle, color: '#ffffff' }}>白色</td><td style={tdStyle}>完全恢复HP和MP</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>卷轴效果</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>名称</th><th style={thStyle}>效果</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>鉴定卷轴</td><td style={tdStyle}>鉴定一个未鉴定物品</td></tr>
                <tr><td style={tdStyle}>地图卷轴</td><td style={tdStyle}>揭示整个地图</td></tr>
                <tr><td style={tdStyle}>传送卷轴</td><td style={tdStyle}>随机传送到地图某处</td></tr>
                <tr><td style={tdStyle}>火球卷轴</td><td style={tdStyle}>对周围3格内敌人造成20点火伤</td></tr>
                <tr><td style={tdStyle}>冰风暴卷轴</td><td style={tdStyle}>对周围3格内敌人造成18点冰伤+冻结</td></tr>
                <tr><td style={tdStyle}>闪电卷轴</td><td style={tdStyle}>对最近的敌人造成22点雷伤</td></tr>
                <tr><td style={tdStyle}>附魔卷轴</td><td style={tdStyle}>给当前武器伤害+2</td></tr>
                <tr><td style={tdStyle}>解咒卷轴</td><td style={tdStyle}>移除诅咒</td></tr>
              </tbody>
            </table>
          </div>

          {/* 敌人图鉴 */}
          <div id="section-enemies">
            <h2 style={h2Style}>👾 敌人图鉴</h2>

            <h3 style={{ ...h3Style, color: '#888899' }}>第1-5层：石质地牢</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>名称</th><th style={thStyle}>特点</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>s</td><td style={tdStyle}>史莱姆</td><td style={tdStyle}>弱小但数量多，弱火</td></tr>
                <tr><td style={tdStyle}>r</td><td style={tdStyle}>巨鼠</td><td style={tdStyle}>速度快（2倍行动），弱雷</td></tr>
                <tr><td style={tdStyle}>b</td><td style={tdStyle}>蝙蝠</td><td style={tdStyle}>胆小，低HP时逃跑，弱雷</td></tr>
                <tr><td style={tdStyle}>g</td><td style={tdStyle}>哥布林</td><td style={tdStyle}>巡逻型，弱火</td></tr>
              </tbody>
            </table>
            <p style={pStyle}>🧑‍👑 <strong style={{ color: '#ff8800' }}>Boss: 哥布林王</strong> (第5层) — 会召唤小弟！</p>

            <h3 style={{ ...h3Style, color: '#4488ff' }}>第6-10层：水晶溶洞</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>名称</th><th style={thStyle}>特点</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>S</td><td style={tdStyle}>骷髅</td><td style={tdStyle}>高防御，弱火</td></tr>
                <tr><td style={tdStyle}>s</td><td style={tdStyle}>巨蛛</td><td style={tdStyle}>定点守卫，会吐丝</td></tr>
                <tr><td style={tdStyle}>O</td><td style={tdStyle}>兽人</td><td style={tdStyle}>高攻击力</td></tr>
                <tr><td style={tdStyle}>W</td><td style={tdStyle}>暗影</td><td style={tdStyle}>速度快，弱火</td></tr>
              </tbody>
            </table>
            <p style={pStyle}>👸 <strong style={{ color: '#ff8800' }}>Boss: 蜘蛛女王</strong> (第10层) — 吐丝冰冻你！</p>

            <h3 style={{ ...h3Style, color: '#aa44ff' }}>第11-15层：远古陵墓</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>名称</th><th style={thStyle}>特点</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>K</td><td style={tdStyle}>暗黑骑士</td><td style={tdStyle}>高攻高防，弱雷</td></tr>
                <tr><td style={tdStyle}>W</td><td style={tdStyle}>怨灵</td><td style={tdStyle}>会吸取生命</td></tr>
                <tr><td style={tdStyle}>T</td><td style={tdStyle}>巨魔</td><td style={tdStyle}>会自我恢复</td></tr>
                <tr><td style={tdStyle}>M</td><td style={tdStyle}>宝箱怪</td><td style={tdStyle}>伪装成物品，突然袭击</td></tr>
              </tbody>
            </table>
            <p style={pStyle}>⚔️ <strong style={{ color: '#ff8800' }}>Boss: 死亡骑士</strong> (第15层) — 吸取生命力！</p>

            <h3 style={{ ...h3Style, color: '#ff4444' }}>第16-20层：熔岩核心</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>名称</th><th style={thStyle}>特点</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>D</td><td style={tdStyle}>恶魔</td><td style={tdStyle}>会火球术，弱冰</td></tr>
                <tr><td style={tdStyle}>G</td><td style={tdStyle}>蛇发女妖</td><td style={tdStyle}>会石化凝视</td></tr>
                <tr><td style={tdStyle}>V</td><td style={tdStyle}>吸血鬼</td><td style={tdStyle}>速度快，吸取生命</td></tr>
                <tr><td style={tdStyle}>L</td><td style={tdStyle}>巫妖</td><td style={tdStyle}>会召唤，弱火</td></tr>
              </tbody>
            </table>
            <p style={pStyle}>👹 <strong style={{ color: '#ff8800' }}>Boss: 恶魔领主</strong> (第20层) — 火球术大范围！</p>

            <h3 style={{ ...h3Style, color: '#1a1a3e' }}>第21+层：虚空深渊</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>名称</th><th style={thStyle}>特点</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>D</td><td style={tdStyle}>巨龙</td><td style={tdStyle}>龙息攻击，弱冰</td></tr>
                <tr><td style={tdStyle}>V</td><td style={tdStyle}>虚空行者</td><td style={tdStyle}>会瞬间移动</td></tr>
                <tr><td style={tdStyle}>A</td><td style={tdStyle}>远古存在</td><td style={tdStyle}>不可名状的力量</td></tr>
              </tbody>
            </table>
            <p style={pStyle}>👑 <strong style={{ color: '#ff8800' }}>Boss: 深渊之王</strong> (第25层) — 终极挑战！</p>
          </div>

          {/* 地形与生态 */}
          <div id="section-terrain">
            <h2 style={h2Style}>🌍 地形与生态</h2>

            <h3 style={h3Style}>五大生态群落</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>楼层</th><th style={thStyle}>生态</th><th style={thStyle}>特点</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>1-5</td><td style={tdStyle}>石质地牢</td><td style={tdStyle}>基础环境，陷阱稀少</td></tr>
                <tr><td style={tdStyle}>6-10</td><td style={tdStyle}>水晶溶洞</td><td style={tdStyle}>有水池，敌人更强</td></tr>
                <tr><td style={tdStyle}>11-15</td><td style={tdStyle}>远古陵墓</td><td style={tdStyle}>毒气弥漫，陷阱增多</td></tr>
                <tr><td style={tdStyle}>16-20</td><td style={tdStyle}>熔岩核心</td><td style={tdStyle}>岩浆遍地，高危高回报</td></tr>
                <tr><td style={tdStyle}>21+</td><td style={tdStyle}>虚空深渊</td><td style={tdStyle}>岩浆+毒气，极度危险</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>地形符号</h3>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>符号</th><th style={thStyle}>地形</th><th style={thStyle}>说明</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>█</td><td style={tdStyle}>墙壁</td><td style={tdStyle}>不可通过，阻挡视线</td></tr>
                <tr><td style={tdStyle}>·</td><td style={tdStyle}>地面</td><td style={tdStyle}>可通过</td></tr>
                <tr><td style={tdStyle}>▓</td><td style={tdStyle}>关闭的门</td><td style={tdStyle}>走上去自动开门</td></tr>
                <tr><td style={tdStyle}>░</td><td style={tdStyle}>打开的门</td><td style={tdStyle}>可通过</td></tr>
                <tr><td style={tdStyle}>▼</td><td style={tdStyle}>下楼梯</td><td style={tdStyle}>按 &gt; 下楼</td></tr>
                <tr><td style={{ ...tdStyle, color: '#4488ff' }}>≈ 🔵</td><td style={tdStyle}>水</td><td style={tdStyle}>不可通过</td></tr>
                <tr><td style={{ ...tdStyle, color: '#ff4444' }}>≈ 🔴</td><td style={tdStyle}>岩浆</td><td style={tdStyle}>不可通过</td></tr>
                <tr><td style={{ ...tdStyle, color: '#44cc44' }}>░ 🟢</td><td style={tdStyle}>毒气</td><td style={tdStyle}>可通过，30%几率中毒</td></tr>
              </tbody>
            </table>

            <h3 style={h3Style}>陷阱</h3>
            <p style={pStyle}>陷阱在地面上<strong style={{ color: '#ff6644' }}>不可见</strong>，踩上去才会触发！</p>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>陷阱</th><th style={thStyle}>效果</th></tr></thead>
              <tbody>
                <tr><td style={tdStyle}>尖刺</td><td style={tdStyle}>8点伤害</td></tr>
                <tr><td style={tdStyle}>火焰</td><td style={tdStyle}>12点伤害+灼烧3回合</td></tr>
                <tr><td style={tdStyle}>毒气</td><td style={tdStyle}>6点伤害+中毒5回合</td></tr>
                <tr><td style={tdStyle}>传送</td><td style={tdStyle}>随机传送到地图某处</td></tr>
              </tbody>
            </table>
          </div>

          {/* 饥饿系统 */}
          <div id="section-hunger">
            <h2 style={h2Style}>🍖 饥饿系统</h2>
            <p style={pStyle}>• 饱食度每回合减少1</p>
            <p style={pStyle}>• 初始饱食度：<strong style={{ color: '#ffcc44' }}>200</strong></p>
            <p style={pStyle}>• 饱食度低于30时会出现<strong style={{ color: '#ff6644' }}>警告</strong></p>
            <p style={pStyle}>• 饱食度降为0时，每回合<strong style={{ color: '#ff4444' }}>损失3HP</strong></p>
            <p style={pStyle}>• <strong style={{ color: '#aaaaaa' }}>保持食物充足！</strong>这是你持续深入的基础</p>
          </div>

          {/* 策略指南 */}
          <div id="section-strategy">
            <h2 style={h2Style}>💡 策略指南</h2>

            <h3 style={{ ...h3Style, color: '#44cc44' }}>🆕 新手建议</h3>
            <p style={pStyle}>1. <strong style={{ color: '#aaaaaa' }}>选战士开局</strong> — 高HP容错率大，适合熟悉游戏机制</p>
            <p style={pStyle}>2. <strong style={{ color: '#aaaaaa' }}>优先拾取食物</strong> — 饥饿比敌人更致命</p>
            <p style={pStyle}>3. <strong style={{ color: '#aaaaaa' }}>不要贪心</strong> — HP低时及时用药水，不要冒险</p>
            <p style={pStyle}>4. <strong style={{ color: '#aaaaaa' }}>开门小心</strong> — 门后可能有敌人埋伏</p>
            <p style={pStyle}>5. <strong style={{ color: '#aaaaaa' }}>注意鉴定</strong> — 使用前先想想药水可能是毒药</p>

            <h3 style={{ ...h3Style, color: '#4488ff' }}>🏅 进阶技巧</h3>
            <p style={pStyle}>1. <strong style={{ color: '#aaaaaa' }}>利用走廊</strong> — 在窄道中1v1，避免被包围</p>
            <p style={pStyle}>2. <strong style={{ color: '#aaaaaa' }}>元素克制</strong> — 火焰武器对冰/毒系敌人效果拔群</p>
            <p style={pStyle}>3. <strong style={{ color: '#aaaaaa' }}>节约药水</strong> — 完全治疗药水留到Boss战</p>
            <p style={pStyle}>4. <strong style={{ color: '#aaaaaa' }}>合理分配属性</strong> — 战士优先STR/VIT，法师优先INT，游侠优先DEX</p>
            <p style={pStyle}>5. <strong style={{ color: '#aaaaaa' }}>善用卷轴</strong> — 地图卷轴可以帮助规划路线</p>

            <h3 style={{ ...h3Style, color: '#aa44ff' }}>🐉 高手心得</h3>
            <p style={pStyle}>1. <strong style={{ color: '#aaaaaa' }}>BOSS战术</strong> — Boss每5层出现一次，确保满状态再下楼</p>
            <p style={pStyle}>2. <strong style={{ color: '#aaaaaa' }}>装备搭配</strong> — 戒指+护符的属性加成可以叠加</p>
            <p style={pStyle}>3. <strong style={{ color: '#aaaaaa' }}>伤害计算</strong> — 高DEX带来暴击，运气好可以秒杀</p>
            <p style={pStyle}>4. <strong style={{ color: '#aaaaaa' }}>饥饿管理</strong> — 仙馔(200饱食度)是稀有但强大的资源</p>
            <p style={pStyle}>5. <strong style={{ color: '#aaaaaa' }}>附魔卷轴</strong> — 给传说武器附魔，伤害爆炸</p>

            <div style={{ marginTop: '20px', borderTop: '1px solid #222244', paddingTop: '12px', textAlign: 'center', color: '#555566', fontSize: '13px', fontStyle: 'italic' }}>
              "深渊在回响，冒险永不停歇。"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualOverlay;
