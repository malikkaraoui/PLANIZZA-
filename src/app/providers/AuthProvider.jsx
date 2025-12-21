/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import { upsertUserProfile } from '../../lib/userProfile';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(isFirebaseConfigured && auth));

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      // Best-effort: on crée/maj un profil RTDB (email + photoURL Google, etc.)
      if (u) {
        upsertUserProfile(u).catch((err) => {
          console.warn('[PLANIZZA] Impossible de synchroniser le profil utilisateur:', err);
        });
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider />');
  return ctx;
}
