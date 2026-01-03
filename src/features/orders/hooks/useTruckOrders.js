import { useState, useEffect } from 'react';
import { ref, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';

/**
 * Hook pour récupérer les commandes d'un camion spécifique
 * @param {string} truckId - ID du camion
 * @returns {object} { orders, loading, error }
 */
export function useTruckOrders(truckId) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !truckId) {
      setLoading(false);
      return;
    }

    const ordersRef = ref(db, 'orders');
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
            // ✅ FILTRER : Ne garder que les commandes VRAIMENT PAYÉES
            .filter((order) => {
              // Exclure les commandes non payées (created ou pending sans confirmation)
              if (order.status === 'created') return false;
              if (order.payment?.paymentStatus === 'pending' && order.status !== 'received') return false;
              return true;
            })
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Plus récentes en premier

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

    return () => {
      off(ordersQuery);
      if (unsubscribe) unsubscribe();
    };
  }, [truckId]);

  return { orders, loading, error };
}
