import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';

/**
 * Hook pour gérer le profil CLIENT uniquement.
 * Détecte si l'utilisateur connecté a un profil client dans users/{uid}.
 */
export function useClientProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) {
      setProfile(null);
      setIsClient(false);
      setLoading(false);
      return;
    }

    const profileRef = ref(db, `users/${user.uid}`);
    
    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        console.log('[useClientProfile] Snapshot:', { 
          exists: snapshot.exists(), 
          uid: user.uid,
          path: `users/${user.uid}`,
          data: snapshot.val() 
        });
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          setProfile(data);
          setIsClient(true);
        } else {
          setProfile(null);
          setIsClient(false);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[useClientProfile] Error:', error);
        setProfile(null);
        setIsClient(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Créer un profil client
   */
  const createClientProfile = async (data = {}) => {
    // Utiliser auth.currentUser directement au lieu de user du hook
    const currentUser = user || (await import('../../../lib/firebase').then(m => m.auth.currentUser));
    if (!currentUser?.uid || !db) {
      console.error('[useClientProfile] No user or db:', { currentUser, db });
      return false;
    }

    try {
      const profileData = {
        displayName: currentUser.displayName || data.displayName || '',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || '',
        phoneNumber: data.phoneNumber || '',
        phoneVerified: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...data,
      };

      console.log('[useClientProfile] Creating profile for:', currentUser.uid, profileData);
      await set(ref(db, `users/${currentUser.uid}`), profileData);
      console.log('[useClientProfile] Profile created successfully');
      return true;
    } catch (error) {
      console.error('[useClientProfile] Create error:', error);
      return false;
    }
  };

  return {
    profile,
    isClient,
    loading,
    createClientProfile,
  };
}

export default useClientProfile;
