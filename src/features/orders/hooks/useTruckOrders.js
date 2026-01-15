import { useState, useEffect } from 'react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { coalesceMs } from '../../../lib/timestamps';

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
    if (!enabled) return;

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    const ordersRef = ref(db, rtdbPaths.ordersRoot());
    const ordersQuery = query(ordersRef, orderByChild('truckId'), equalTo(truckId));

    const unsubscribe = onValue(
      ordersQuery,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const ordersArray = Object.entries(data)
            .map(([id, order]) => ({
              id,
              ...order,
            }))
            // ✅ FILTRER : Ne garder que les commandes VRAIMENT PAYÉES OU EN COURS
            .filter((order) => {
              // Exclure les commandes en création (status 'created' sans paiement)
              if (order.status === 'created') return false;
              
              // Pour les commandes manuelles, on garde tout sauf 'created'
              if (order.payment?.provider === 'manual') return true;
              
              // Pour les commandes en ligne, on garde si payée (legacy ou v2)
              const isPaid = order.payment?.paymentStatus === 'paid' || order.v2?.paymentStatus === 'PAID';
              if (order.payment?.provider === 'stripe' && isPaid) return true;
              
              // Sinon, on exclut
              return false;
            })
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
        console.error('[useTruckOrders] Erreur:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled, truckId]);

  return enabled ? { orders, loading, error } : { orders: [], loading: false, error: null };
}
