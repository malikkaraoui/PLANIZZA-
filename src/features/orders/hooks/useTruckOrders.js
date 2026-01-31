import { useState, useEffect } from 'react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { coalesceMs } from '../../../lib/timestamps';
import { devLog } from '../../../lib/devLog';

/**
 * Hook pour récupérer les commandes d'un camion spécifique
 * @param {string} truckId - ID du camion
 * @returns {object} { orders, loading, error }
 */
export function useTruckOrders(truckId) {
  const enabled = Boolean(isFirebaseConfigured && db && truckId);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      devLog('[useTruckOrders] not enabled, skipping');
      return;
    }

    devLog('[useTruckOrders] effect start, setting loading=true');
    setLoading(true);
    setError(null);

    // Timeout de sécurité pour éviter un loading infini
    const LOAD_TIMEOUT_MS = 10000;
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      devLog('[useTruckOrders] timeout reached, setting loading=false');
      setLoading(false);
      setError(new Error('Timeout lors du chargement des commandes.'));
    }, LOAD_TIMEOUT_MS);

    const ordersRef = ref(db, rtdbPaths.ordersRoot());
    const ordersQuery = query(ordersRef, orderByChild('truckId'), equalTo(truckId));

    const unsubscribe = onValue(
      ordersQuery,
      (snapshot) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        devLog('[useTruckOrders] snapshot received');
        if (snapshot.exists()) {
          const data = snapshot.val();
          const ordersArray = Object.entries(data)
            .map(([id, order]) => ({
              id,
              ...order,
            }))
            // Filtrage minimal: on exclut uniquement les brouillons (création non finalisée).
            // IMPORTANT (UI /pro/commandes temps-driven): on doit pouvoir afficher aussi les UNPAID
            // (badge + garde-fou), donc on ne filtre pas par paymentStatus ici.
            .filter((order) => order?.status !== 'created')
            .sort((a, b) => {
              const aMs = coalesceMs(a.createdAt, a.createdAtClient, 0) || 0;
              const bMs = coalesceMs(b.createdAt, b.createdAtClient, 0) || 0;
              return bMs - aMs;
            }); // Plus récentes en premier

          setOrders(ordersArray);
        } else {
          setOrders([]);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        console.error('[useTruckOrders] Erreur:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [enabled, truckId]);

  // DEBUG
  devLog('[useTruckOrders] return:', { enabled, loading, ordersCount: orders.length, truckId });

  return enabled ? { orders, loading, error } : { orders: [], loading: false, error: null };
}
