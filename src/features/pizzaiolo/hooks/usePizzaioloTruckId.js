import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { devLog, devWarn } from '../../../lib/devLog';

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
    const LOAD_TIMEOUT_MS = 8000;
    let finished = false;

    const finish = (next) => {
      if (cancelled || finished) return;
      finished = true;
      next();
    };

    if (!userId) {
      devLog('[usePizzaioloTruckId] no userId');
      setTruckId(null);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!isFirebaseConfigured || !db) {
      // Mode DEV sans Firebase (ou config manquante)
      devWarn('[usePizzaioloTruckId] firebase not configured');
      setTruckId(null);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    // IMPORTANT: ne pas différer ce setState.
    // Le callback initial de onValue peut arriver immédiatement et sinon on risque
    // de remettre loading=true après avoir déjà reçu le snapshot.
    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      finish(() => {
        devWarn('[usePizzaioloTruckId] timeout', { userId, path: rtdbPaths.pizzaiolo(userId) });
        setTruckId(null);
        setError(new Error('Timeout lors du chargement de votre camion (truckId).'));
        setLoading(false);
      });
    }, LOAD_TIMEOUT_MS);

    const pizzaioloRef = ref(db, rtdbPaths.pizzaiolo(userId));
    devLog('[usePizzaioloTruckId] subscribe', { userId, path: rtdbPaths.pizzaiolo(userId) });
    const unsub = onValue(
      pizzaioloRef,
      (snap) => {
        finish(() => {
          clearTimeout(timeoutId);
          const tid = snap.exists() ? snap.val()?.truckId ?? null : null;
          devLog('[usePizzaioloTruckId] snapshot', { exists: snap.exists(), truckId: tid });
          setTruckId(tid);
          setLoading(false);
        });
      },
      (err) => {
        finish(() => {
          clearTimeout(timeoutId);
          devWarn('[usePizzaioloTruckId] error', err);
          setTruckId(null);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        });
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsub();
    };
  }, [userId]);

  return { truckId, loading, error };
}
