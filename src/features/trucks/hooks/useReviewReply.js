import { useState } from 'react';
import { ref, set, update } from 'firebase/database';
import { db } from '../../../lib/firebase';

/**
 * Hook pour soumettre ou modifier une reponse a un avis client
 * @param {string} truckId - ID du camion
 */
export function useReviewReply(truckId) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submitReply = async (reviewId, replyText) => {
    if (!truckId || !reviewId || !replyText?.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const replyRef = ref(db, `public/trucks/${truckId}/reviews/${reviewId}/reply`);
      await set(replyRef, {
        text: replyText.trim(),
        repliedAt: Date.now(),
      });
    } catch (err) {
      console.error('[useReviewReply] Erreur:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submitReply, isSubmitting, error };
}
