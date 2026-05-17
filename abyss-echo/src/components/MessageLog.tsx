import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

const MessageLog: React.FC = () => {
  const messages = useGameStore(s => s.messages);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages.length]);

  const recentMessages = messages.slice(-50);

  return (
    <div
      ref={logRef}
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
