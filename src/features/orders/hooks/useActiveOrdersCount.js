import { useState, useEffect } from 'react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { toMs } from '../../../lib/timestamps';
import { getServerNowMs, startServerTimeSync } from '../../../lib/serverTime';

// Durée max avant de considérer une commande comme perdue (120 min après prise en charge)
const MAX_ORDER_DURATION = 120 * 60 * 1000;

export function useActiveOrdersCount(truckId) {
  const enabled = Boolean(truckId);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    // Best-effort: démarrer la synchro du temps serveur pour des calculs cohérents.
    startServerTimeSync();

    // Reset asynchrone pour éviter le setState synchrone dans l'effect.
    queueMicrotask(() => {
      setCount(0);
      setLoading(true);
    });

    const ordersRef = ref(db, rtdbPaths.ordersRoot());
    const ordersQuery = query(ordersRef, orderByChild('truckId'), equalTo(truckId));

    const unsubscribe = onValue(ordersQuery, (snapshot) => {
      if (snapshot.exists()) {
        const orders = snapshot.val();
        const now = getServerNowMs();
        
        // Compter les commandes actives : received, accepted (pas delivered, cancelled, ni expirées)
        const activeCount = Object.values(orders).filter(order => {
          const status = order.status;
          const paymentStatus = order.payment?.paymentStatus;
          
          // Exclure les commandes perdues (>120min après prise en charge et pas livrées/annulées)
          const acceptedAtMs = toMs(order.timeline?.acceptedAt);
          const isExpired = Boolean(acceptedAtMs) &&
                           !['delivered', 'cancelled'].includes(status) &&
                           (now - acceptedAtMs > MAX_ORDER_DURATION);
          
          // Ne compter que les commandes payées, pas encore livrées/annulées, et pas expirées
          return paymentStatus === 'paid' && 
                 (status === 'received' || status === 'accepted') &&
                 !isExpired;
        }).length;
        
        setCount(activeCount);
      } else {
        setCount(0);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [enabled, truckId]);

  return enabled ? { count, loading } : { count: 0, loading: false };
}
