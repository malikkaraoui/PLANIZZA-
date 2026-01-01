import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../../lib/firebase';

export function useTruckPause(truckId) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  const togglePause = async (currentIsPaused) => {
    if (!truckId || isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      const truckRef = ref(db, `public/trucks/${truckId}`);
      await update(truckRef, {
        isPaused: !currentIsPaused,
        updatedAt: Date.now()
      });
      
      return !currentIsPaused;
    } catch (err) {
      console.error('[useTruckPause] Erreur:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return { togglePause, isUpdating, error };
}
