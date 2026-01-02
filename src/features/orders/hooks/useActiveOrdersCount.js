import { useState, useEffect } from 'react';
import { ref, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import { db } from '../../../lib/firebase';

// Durée max avant de considérer une commande comme perdue (120 min après prise en charge)
const MAX_ORDER_DURATION = 120 * 60 * 1000;

export function useActiveOrdersCount(truckId) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!truckId) {
      setCount(0);
      setLoading(false);
      return;
    }

    const ordersRef = ref(db, 'orders');
    const ordersQuery = query(ordersRef, orderByChild('truckId'), equalTo(truckId));

    const unsubscribe = onValue(ordersQuery, (snapshot) => {
      if (snapshot.exists()) {
        const orders = snapshot.val();
        const now = Date.now();
        
        // Compter les commandes actives : received, accepted (pas delivered, cancelled, ni expirées)
        const activeCount = Object.values(orders).filter(order => {
          const status = order.status;
          const paymentStatus = order.payment?.paymentStatus;
          
          // Exclure les commandes perdues (>120min après prise en charge et pas livrées/annulées)
          const isExpired = order.timeline?.acceptedAt && 
                           !['delivered', 'cancelled'].includes(status) &&
                           (now - order.timeline.acceptedAt > MAX_ORDER_DURATION);
          
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

    return () => off(ordersRef, 'value', unsubscribe);
  }, [truckId]);

  return { count, loading };
}
