import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';

/**
 * Récupère le truckId associé à un pizzaiolo.
 * Objectif : éviter de dupliquer la logique "ref(db, pizzaiolos/{uid}) + get()" dans chaque page pro.
 *
 * @param {string|null|undefined} userId
 * @returns {{ truckId: string|null, loading: boolean, error: Error|null }}
 */
export function usePizzaioloTruckId(userId) {
  const [truckId, setTruckId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const schedule = (fn) => {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(fn);
        return;
      }
      Promise.resolve().then(fn);
    };

    if (!userId) {
      schedule(() => {
        setTruckId(null);
        setError(null);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    if (!isFirebaseConfigured || !db) {
      // Mode DEV sans Firebase (ou config manquante)
      schedule(() => {
        setTruckId(null);
        setError(null);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    schedule(() => {
      setLoading(true);
      setError(null);
    });

    const pizzaioloRef = ref(db, rtdbPaths.pizzaiolo(userId));
    const unsub = onValue(
      pizzaioloRef,
      (snap) => {
        if (cancelled) return;
        const tid = snap.exists() ? snap.val()?.truckId ?? null : null;
        setTruckId(tid);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setTruckId(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [userId]);

  return { truckId, loading, error };
}
