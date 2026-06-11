import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sessionExists } from '../lib/db';

export default function Home() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  async function join(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) return;
    setChecking(true);
    setError('');
    try {
      if (await sessionExists(c)) navigate(`/play/${c}`);
      else setError(`No game found with code ${c}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="page narrow center">
      <h1 className="hero-title">🎯 QuizNight</h1>
      <p className="muted">Weekly quiz nights with friends, anywhere in the world.</p>

      <form className="card join-card" onSubmit={join}>
        <h2>Join a game</h2>
        <input
          className="code-input"
          placeholder="ROOM CODE"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Room code"
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button className="btn primary big" type="submit" disabled={checking || code.trim().length < 4}>
          {checking ? 'Checking…' : 'Join'}
        </button>
      </form>

      <Link to="/host" className="btn ghost">I'm the host →</Link>
    </div>
  );
}
