import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';

/**
 * Hook pour récupérer les avis d'un camion
 * @param {string} truckId - ID du camion
 * @param {number} limit - Nombre max d'avis à récupérer (défaut: 10)
 */
export function useReviews(truckId, limit = 10) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!truckId || !isFirebaseConfigured || !db) {
      setReviews([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const reviewsRef = ref(db, `public/trucks/${truckId}/reviews`);

    const unsubscribe = onValue(
      reviewsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setReviews([]);
          setLoading(false);
          return;
        }

        const data = snapshot.val();
        const list = Object.entries(data)
          .map(([id, review]) => ({
            id,
            ...review,
          }))
          // Trier par date décroissante (plus récent en premier)
          .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
          // Limiter le nombre d'avis
          .slice(0, limit);

        setReviews(list);
        setLoading(false);
      },
      (error) => {
        console.error('[useReviews] Error:', error);
        setReviews([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [truckId, limit]);

  return { reviews, loading };
}
