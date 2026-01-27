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
    if (!user?.uid || !db) return false;

    try {
      const profileData = {
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        phoneNumber: data.phoneNumber || '',
        phoneVerified: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...data,
      };

      await set(ref(db, `users/${user.uid}`), profileData);
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
