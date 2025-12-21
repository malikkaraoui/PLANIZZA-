import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
};

// Validation : s'assurer que les clés critiques sont présentes
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    '❌ Configuration Firebase incomplète. Vérifiez votre fichier .env.local'
  );
}

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Exporter les services Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics en lazy-load (optionnel)
// export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
