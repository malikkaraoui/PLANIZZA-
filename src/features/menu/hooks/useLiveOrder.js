import { useState, useEffect, useRef } from 'react';
import { ref, push, set, remove } from 'firebase/database';
import { db } from '../../../lib/firebase';

/**
 * Hook pour gérer une commande "live" (brouillon) avec sync Firebase temps réel
 * Utilisé pour les commandes manuelles en cours de création
 */
export const useLiveOrder = (truckId, userId, cart, customerName) => {
  const liveOrderIdRef = useRef(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  /**
   * Synchronise le panier actuel vers Firebase
   */
  useEffect(() => {
    if (!truckId || !userId) return;
    if (cart.length === 0 && !customerName) return;

    const syncToFirebase = async () => {
      setIsSyncing(true);
      setSyncError(null);

      try {
        // Créer un ID unique pour cette commande en cours si pas déjà existant
        if (!liveOrderIdRef.current) {
          liveOrderIdRef.current = push(ref(db, 'liveOrders')).key;
        }

        const totalCents = cart.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);

        const liveOrderRef = ref(db, `liveOrders/${truckId}/${liveOrderIdRef.current}`);
        await set(liveOrderRef, {
          items: cart,
          customerName: customerName.trim(),
          totalCents,
          truckId,
          pizzaioloUid: userId,
          updatedAt: Date.now(),
          status: 'draft'
        });

        console.log('[useLiveOrder] Synced to Firebase:', liveOrderIdRef.current);
      } catch (err) {
        console.error('[useLiveOrder] Erreur sync Firebase:', err);
        setSyncError(err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Debounce pour éviter trop d'écritures
    const timer = setTimeout(syncToFirebase, 500);
    return () => clearTimeout(timer);
  }, [cart, customerName, truckId, userId]);

  /**
   * Supprime le brouillon de commande de Firebase
   */
  const clearLiveOrder = async () => {
    if (!liveOrderIdRef.current || !truckId) return;

    try {
      const liveOrderRef = ref(db, `liveOrders/${truckId}/${liveOrderIdRef.current}`);
      await remove(liveOrderRef);
      liveOrderIdRef.current = null;
      console.log('[useLiveOrder] Cleared from Firebase');
    } catch (err) {
      console.error('[useLiveOrder] Erreur suppression:', err);
      throw err;
    }
  };

  return {
    liveOrderId: liveOrderIdRef.current,
    isSyncing,
    syncError,
    clearLiveOrder
  };
};
