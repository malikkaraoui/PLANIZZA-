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

    const userRef = ref(db, `users/${uid}`);
    const unsub = onValue(
      userRef,
      (snap) => {
        setProfile(snap.exists() ? snap.val() : null);
        setError(null);
        setLoadedUid(uid);
      },
      (err) => {
        setError(err);
        setLoadedUid(uid);
      }
    );

    return () => {
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
