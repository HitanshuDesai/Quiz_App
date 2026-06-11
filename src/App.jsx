import React, { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { firebaseConfigured, ensureSignedIn } from './lib/firebase';
import { useTheme } from './lib/hooks';
import Home from './pages/Home';
import HostDashboard from './pages/HostDashboard';
import QuizBuilder from './pages/QuizBuilder';
import HostGame from './pages/HostGame';
import PlayerGame from './pages/PlayerGame';

function NotConfigured() {
  return (
    <div className="page narrow">
      <div className="card">
        <h1>QuizNight needs configuration</h1>
        <p>
          Firebase environment variables are missing. Copy <code>.env.example</code> to{' '}
          <code>.env</code>, fill in your Firebase project values, and restart the dev
          server. See <code>docs/SETUP.md</code> for the full walkthrough.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useTheme();
  // Everyone (hosts and players) signs in anonymously before any database
  // access — the security rules require it.
  const [authState, setAuthState] = useState('pending'); // pending | ready | error
  useEffect(() => {
    if (!firebaseConfigured) return;
    ensureSignedIn()
      .then(() => setAuthState('ready'))
      .catch(() => setAuthState('error'));
  }, []);

  if (!firebaseConfigured) return <NotConfigured />;
  if (authState === 'error') {
    return (
      <div className="page narrow">
        <div className="card">
          <h1>Could not sign in</h1>
          <p>
            Enable <strong>Anonymous</strong> sign-in in your Firebase project
            (Authentication → Sign-in method) and make sure this domain is listed under
            Authentication → Settings → Authorized domains. See <code>docs/SETUP.md</code>.
          </p>
        </div>
      </div>
    );
  }
  if (authState === 'pending') {
    return <div className="page narrow center"><p className="muted">Connecting…</p></div>;
  }
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">🎯 QuizNight</Link>
        <button
          className="btn ghost small"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/host/quiz/:quizId" element={<QuizBuilder />} />
        <Route path="/host/game/:code" element={<HostGame />} />
        <Route path="/play/:code" element={<PlayerGame />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
