import { useState, useEffect, useRef } from 'react';
import { ref, query, orderByChild, equalTo, onValue } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { coalesceMs } from '../../../lib/timestamps';
import { notifyPizzaiolo } from '../../../lib/notifications';
import { devLog } from '../../../lib/devLog';

/**
 * Hook pour récupérer les commandes d'un camion spécifique
 * @param {string} truckId - ID du camion
 * @param {object} [options] - Options du hook
 * @param {Function} [options.navigate] - Fonction de navigation (pour notifications cliquables)
 * @returns {object} { orders, loading, error }
 */
export function useTruckOrders(truckId, options = {}) {
  const { navigate } = options;
  const enabled = Boolean(isFirebaseConfigured && db && truckId);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const previousOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

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

          // Détecter les nouvelles commandes (pas au premier chargement)
          if (!isFirstLoadRef.current) {
            const currentIds = new Set(ordersArray.map((o) => o.id));
            for (const order of ordersArray) {
              if (!previousOrderIdsRef.current.has(order.id) && order.status === 'received') {
                // Nouvelle commande !
                const customerName = order.customerName || 'Client';
                const total = ((order.totalCents || 0) / 100).toFixed(2);
                notifyPizzaiolo.newOrder(customerName, total, order.id, navigate);
              }
            }
            previousOrderIdsRef.current = currentIds;
          } else {
            // Premier chargement: mémoriser les IDs existants sans notifier
            previousOrderIdsRef.current = new Set(ordersArray.map((o) => o.id));
            isFirstLoadRef.current = false;
          }

          setOrders(ordersArray);
        } else {
          setOrders([]);
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
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
