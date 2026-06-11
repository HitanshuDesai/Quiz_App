import { useEffect, useRef, useState } from 'react';
import { ensureSignedIn, firebaseConfigured } from './firebase';
import { subscribeSession, subscribeServerTimeOffset } from './db';

export function useAuthUid() {
  const [uidState, setUid] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!firebaseConfigured) return;
    ensureSignedIn().then(setUid).catch((e) => setError(e.message));
  }, []);
  return { uid: uidState, error };
}

export function useSession(code) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = not found
  useEffect(() => {
    if (!code || !firebaseConfigured) return undefined;
    return subscribeSession(code.toUpperCase(), setSession);
  }, [code]);
  return session;
}

// Offset between the client clock and Firebase's server clock, in ms.
export function useServerTimeOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return subscribeServerTimeOffset(setOffset);
  }, []);
  return offset;
}

export function serverNow(offset) {
  return Date.now() + offset;
}

// Seconds remaining for the current question (null when no limit). Ticks 4x/s.
export function useCountdown(startedAt, timeLimit, offset, active) {
  const [remaining, setRemaining] = useState(null);
  const raf = useRef(null);
  useEffect(() => {
    if (!active || !startedAt || !timeLimit) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => {
      const elapsed = (serverNow(offset) - startedAt) / 1000;
      setRemaining(Math.max(0, timeLimit - elapsed));
    };
    tick();
    raf.current = setInterval(tick, 250);
    return () => clearInterval(raf.current);
  }, [startedAt, timeLimit, offset, active]);
  return remaining;
}

// Persistent per-browser player identity, namespaced by session code.
export function usePlayerIdentity(code) {
  const key = `quiznight_player_${code}`;
  const [identity, setIdentityState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  });
  const setIdentity = (value) => {
    setIdentityState(value);
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  };
  return [identity, setIdentity];
}

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('quiznight_theme') || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('quiznight_theme', theme);
  }, [theme]);
  return [theme, setTheme];
}
