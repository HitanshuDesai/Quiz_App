import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.databaseURL);

let app = null;
let authInstance = null;
let dbInstance = null;

if (firebaseConfigured) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getDatabase(app);
}

export const auth = authInstance;
export const db = dbInstance;

// Resolves with the anonymous user's uid (signs in if needed).
export function ensureSignedIn() {
  if (!firebaseConfigured) return Promise.reject(new Error('Firebase is not configured'));
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub();
        resolve(user.uid);
      } else {
        signInAnonymously(auth).catch((e) => {
          unsub();
          reject(e);
        });
      }
    });
  });
}
