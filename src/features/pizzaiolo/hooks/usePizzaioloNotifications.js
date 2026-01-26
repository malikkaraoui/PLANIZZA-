import { useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { notifyPizzaiolo } from '../../../lib/notifications';

/**
 * Hook pour notifier le pizzaiolo des nouveaux avis sur son camion.
 * À utiliser dans le Dashboard pizzaiolo.
 * @param {string} truckId - ID du camion
 */
export function usePizzaioloReviewNotifications(truckId) {
  const previousReviewIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!truckId || !isFirebaseConfigured || !db) {
      previousReviewIdsRef.current = new Set();
      isFirstLoadRef.current = true;
      return;
    }

    const reviewsRef = ref(db, `public/trucks/${truckId}/reviews`);

    const unsubscribe = onValue(
      reviewsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
          return;
        }

        const data = snapshot.val();
        const reviews = Object.entries(data).map(([id, review]) => ({
          id,
          ...review,
        }));

        if (!isFirstLoadRef.current) {
          // Détecter les nouveaux avis
          for (const review of reviews) {
            if (!previousReviewIdsRef.current.has(review.id)) {
              // Nouvel avis !
              const score = review.score || 0;
              const hasComment = Boolean(review.comment);
              notifyPizzaiolo.newReview(score, hasComment);
            }
          }
        }

        // Mettre à jour la liste des IDs connus
        previousReviewIdsRef.current = new Set(reviews.map((r) => r.id));
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
      },
      (error) => {
        console.error('[usePizzaioloReviewNotifications] Error:', error);
      }
    );

    return () => unsubscribe();
  }, [truckId]);
}

export default usePizzaioloReviewNotifications;
