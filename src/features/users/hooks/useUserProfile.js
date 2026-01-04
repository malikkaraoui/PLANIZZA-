import { onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';

export function useUserProfile() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loadedUid, setLoadedUid] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !uid) return;

    // Évite les loaders infinis quand la connexion RTDB ne répond pas.
    // (ex: réseau coupé / websocket Firebase instable)
    const LOAD_TIMEOUT_MS = 8000;
    let finished = false;

    const userRef = ref(db, `users/${uid}`);
    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      setError(new Error('Timeout lors du chargement du profil utilisateur.'));
      setLoadedUid(uid);
    }, LOAD_TIMEOUT_MS);

    const unsub = onValue(
      userRef,
      (snap) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        setProfile(snap.exists() ? snap.val() : null);
        setError(null);
        setLoadedUid(uid);
      },
      (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        setError(err);
        setLoadedUid(uid);
      }
    );

    return () => {
      finished = true;
      clearTimeout(timeoutId);
      unsub();
    };
  }, [uid]);

  if (!isFirebaseConfigured || !db || !uid) {
    return { profile: null, loading: false, error: null };
  }

  const loading = loadedUid !== uid;
  const safeProfile = loadedUid === uid ? profile : null;
  const safeError = loadedUid === uid ? error : null;

  return { profile: safeProfile, loading, error: safeError };
}
