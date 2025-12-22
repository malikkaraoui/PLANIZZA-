import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { getDatabase } from 'firebase/database';
// import { getAnalytics } from 'firebase/analytics'; // Lazy load si nécessaire

// Configuration Firebase depuis les variables d'environnement Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // Optionnel
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    firebaseConfig.databaseURL
);

// IMPORTANT:
// - En PROD, on échoue “fort” si Firebase n’est pas configuré.
// - En DEV, on permet de naviguer sur le site (UI) même sans Firebase.
export let app = null;
export let auth = null;
export let db = null;
export let functions = null;

if (!isFirebaseConfigured) {
  if (import.meta.env.PROD) {
    throw new Error(
      '❌ Configuration Firebase incomplète. Vérifiez votre fichier .env.local'
    );
  }

  console.warn(
    '[PLANIZZA] Firebase non configuré (mode DEV). Ajoutez vos variables dans .env.local pour activer Auth/RTDB/Functions.'
  );
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  functions = getFunctions(
    app,
    import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1'
  );
}

// Analytics en lazy-load (optionnel)
// export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
