import React, { useRef, useLayoutEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

const SCROLL_THRESHOLD = 40; // px from bottom to consider "at bottom"

const MessageLog: React.FC = () => {
  const messages = useGameStore(s => s.messages);
  const logRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  useLayoutEffect(() => {
    if (shouldAutoScroll.current && logRef.current) {
      const el = logRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
    shouldAutoScroll.current = atBottom;
  }, []);

  const recentMessages = messages.slice(-50);

  return (
    <div
      ref={logRef}
      onScroll={handleScroll}
      style={{
        height: '120px',
        backgroundColor: '#08081a',
        borderTop: '1px solid #222244',
        padding: '6px 8px',
        fontFamily: '"Courier New", monospace',
        fontSize: '12px',
        overflowY: 'auto',
        lineHeight: '1.5',
      }}
    >
      {recentMessages.map(m => (
        <div key={m.id} style={{ color: m.fg }}>
          {m.text}
        </div>
      ))}
    </div>
  );
};

export default MessageLog;
