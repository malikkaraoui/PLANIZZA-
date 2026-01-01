import { useState, useEffect } from 'react';
import { ref, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import { db } from '../../../lib/firebase';

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
        // Compter les commandes actives (pas ready, cancelled ou delivered)
        const activeCount = Object.values(orders).filter(order => {
          const status = order.status;
          return status !== 'ready' && status !== 'cancelled' && status !== 'delivered';
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
