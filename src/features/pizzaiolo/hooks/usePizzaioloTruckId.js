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
  const [state, setState] = useState({ truckId: null, loading: true, error: null });

  useEffect(() => {
    // Pas de userId : arrêter le chargement
    if (!userId) {
      devLog('[usePizzaioloTruckId] no userId');
      setState({ truckId: null, loading: false, error: null });
      return;
    }

    // Firebase non configuré : arrêter le chargement
    if (!isFirebaseConfigured || !db) {
      devWarn('[usePizzaioloTruckId] firebase not configured');
      setState({ truckId: null, loading: false, error: null });
      return;
    }

    // Remettre en loading quand userId change
    setState(prev => ({ ...prev, loading: true }));

    // Variables de contrôle
    let cancelled = false;
    const LOAD_TIMEOUT_MS = 8000;

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      devWarn('[usePizzaioloTruckId] timeout', { userId });
      setState({
        truckId: null,
        loading: false,
        error: new Error('Timeout lors du chargement de votre camion (truckId).')
      });
    }, LOAD_TIMEOUT_MS);

    const pizzaioloRef = ref(db, rtdbPaths.pizzaiolo(userId));
    devLog('[usePizzaioloTruckId] subscribe', { userId });

    const unsub = onValue(
      pizzaioloRef,
      (snap) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        const tid = snap.exists() ? snap.val()?.truckId ?? null : null;
        devLog('[usePizzaioloTruckId] snapshot', { exists: snap.exists(), truckId: tid });
        setState({ truckId: tid, loading: false, error: null });
      },
      (err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        devWarn('[usePizzaioloTruckId] error', err);
        setState({
          truckId: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err))
        });
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsub();
    };
  }, [userId]);

  return state;
}
