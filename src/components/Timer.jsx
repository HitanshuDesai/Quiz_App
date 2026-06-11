import React from 'react';

export default function Timer({ remaining, total }) {
  if (remaining == null || !total) return null;
  const pct = Math.max(0, Math.min(1, remaining / total));
  const urgent = remaining <= 5;
  return (
    <div className={`timer ${urgent ? 'urgent' : ''}`} role="timer" aria-live="polite">
      <div className="timer-bar"><div className="timer-fill" style={{ width: `${pct * 100}%` }} /></div>
      <span className="timer-text">{Math.ceil(remaining)}s</span>
    </div>
  );
}
