import { useState, useEffect } from 'react';
import { ref, onValue, get, set } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';

/**
 * Hook pour gérer le profil PIZZAIOLO uniquement.
 * Détecte si l'utilisateur connecté a un profil pro dans pizzaiolos/{uid}.
 */
export function usePizzaioloProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [truckId, setTruckId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPizzaiolo, setIsPizzaiolo] = useState(false);

  useEffect(() => {
    if (!user?.uid || !db) {
      setProfile(null);
      setTruckId(null);
      setIsPizzaiolo(false);
      setLoading(false);
      return;
    }

    const profileRef = ref(db, `pizzaiolos/${user.uid}`);
    
    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setProfile(data);
          setTruckId(data.truckId || null);
          setIsPizzaiolo(true);
        } else {
          setProfile(null);
          setTruckId(null);
          setIsPizzaiolo(false);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[usePizzaioloProfile] Error:', error);
        setProfile(null);
        setTruckId(null);
        setIsPizzaiolo(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /**
   * Créer un profil pizzaiolo
   */
  const createPizzaioloProfile = async (data = {}) => {
    if (!user?.uid || !db) return false;

    try {
      const profileData = {
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        phoneNumber: data.phoneNumber || '',
        truckId: data.truckId || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...data,
      };

      await set(ref(db, `pizzaiolos/${user.uid}`), profileData);
      return true;
    } catch (error) {
      console.error('[usePizzaioloProfile] Create error:', error);
      return false;
    }
  };

  return {
    profile,
    truckId,
    isPizzaiolo,
    loading,
    createPizzaioloProfile,
  };
}

export default usePizzaioloProfile;
