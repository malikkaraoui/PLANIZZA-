import { useEffect, useRef } from 'react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';
import { notify } from '../../../lib/notifications';

/**
 * Hook global pour notifier le client des changements de statut de ses commandes.
 * À utiliser dans un provider global (App.jsx) pour que les notifications
 * fonctionnent même si l'utilisateur n'est pas sur la page OrderTracking.
 */
export function useOrderStatusNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const previousStatusesRef = useRef(new Map());
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user?.uid) {
      previousStatusesRef.current = new Map();
      isFirstLoadRef.current = true;
      return;
    }

    const ordersRef = ref(db, 'orders');
    const userOrdersQuery = query(ordersRef, orderByChild('userUid'), equalTo(user.uid));

    const unsubscribe = onValue(
      userOrdersQuery,
      (snapshot) => {
        if (!snapshot.exists()) {
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
          return;
        }

        const data = snapshot.val();
        const orders = Object.entries(data).map(([id, order]) => ({
          id,
          ...order,
        }));

        if (!isFirstLoadRef.current) {
          // Détecter les changements de statut
          for (const order of orders) {
            const prevStatus = previousStatusesRef.current.get(order.id);
            const currentStatus = order.status;

            if (prevStatus && prevStatus !== currentStatus) {
              const truckName = order.truckName || 'Le pizzaiolo';

              // Notifier uniquement les transitions importantes (statuts client V1)
              if (['received', 'accepted', 'delivered', 'cancelled'].includes(currentStatus)) {
                notify.orderStatusChanged(currentStatus, truckName, order.id, navigate);
              }
            }

            previousStatusesRef.current.set(order.id, currentStatus);
          }
        } else {
          // Premier chargement: mémoriser les statuts sans notifier
          for (const order of orders) {
            previousStatusesRef.current.set(order.id, order.status);
          }
          isFirstLoadRef.current = false;
        }
      },
      (error) => {
        console.error('[useOrderStatusNotifications] Erreur:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);
}

export default useOrderStatusNotifications;
