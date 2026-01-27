import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../lib/firebase';

/**
 * Hook pour récupérer le nombre de favoris d'un camion en temps réel.
 * @param {string} truckId - ID du camion
 * @returns {Object} { count: number, loading: boolean }
 */
export function useTruckFavoritesCount(truckId) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!truckId || !db) {
      setCount(0);
      setLoading(false);
      return;
    }

    const favoritesRef = ref(db, `public/trucks/${truckId}/favorites`);
    
    const unsubscribe = onValue(
      favoritesRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCount(0);
        } else {
          const favorites = snapshot.val();
          setCount(Object.keys(favorites).length);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[useTruckFavoritesCount] Error:', error);
        setCount(0);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [truckId]);

  return { count, loading };
}

export default useTruckFavoritesCount;
