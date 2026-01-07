import { useState, useEffect, useRef } from 'react';
import { ref, push, set, remove, get, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../../../lib/firebase';

/**
 * Hook pour gérer une commande "live" (brouillon) avec sync Firebase temps réel
 * Utilisé pour les commandes manuelles en cours de création
 */
function storageKey(truckId, userId) {
  return `planizza.liveOrders.draftId.${truckId}.${userId}`;
}

export const useLiveOrder = (truckId, userId, cart, customerName, pickupTime) => {
  const liveOrderIdRef = useRef(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Restaurer l'ID de brouillon si l'utilisateur reload la page.
  // But: pouvoir supprimer le brouillon même après refresh / navigation.
  useEffect(() => {
    if (!truckId || !userId) return;
    if (liveOrderIdRef.current) return;

    try {
      const saved = localStorage.getItem(storageKey(truckId, userId));
      if (saved) {
        liveOrderIdRef.current = saved;
      }
    } catch {
      // localStorage peut être indisponible (privacy mode)
    }
  }, [truckId, userId]);

  const cleanupMyDrafts = async ({ keepId } = {}) => {
    if (!truckId || !userId) return;

    try {
      const q = query(ref(db, `liveOrders/${truckId}`), orderByChild('pizzaioloUid'), equalTo(userId));
      const snap = await get(q);
      if (!snap.exists()) return;

      const entries = snap.val() || {};
      const ids = Object.keys(entries);
      const deletions = ids
        .filter((id) => id && id !== keepId)
        .map((id) => remove(ref(db, `liveOrders/${truckId}/${id}`)));

      await Promise.allSettled(deletions);
    } catch (err) {
      console.error('[useLiveOrder] Erreur cleanup drafts:', err);
    }
  };

  // Supprimer les vieux brouillons orphelins (même utilisateur) dès l'ouverture,
  // en conservant le brouillon courant si on a un ID restauré.
  useEffect(() => {
    if (!truckId || !userId) return;
    cleanupMyDrafts({ keepId: liveOrderIdRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truckId, userId]);

  /**
   * Synchronise le panier actuel vers Firebase
   */
  useEffect(() => {
    if (!truckId || !userId) return;
    if (cart.length === 0 && !customerName && !pickupTime) return;

    const syncToFirebase = async () => {
      setIsSyncing(true);
      setSyncError(null);

      try {
        // Créer un ID unique pour cette commande en cours si pas déjà existant
        if (!liveOrderIdRef.current) {
          // Générer la clé sous le bon parent (plus cohérent et évite les surprises)
          liveOrderIdRef.current = push(ref(db, `liveOrders/${truckId}`)).key;

          try {
            if (liveOrderIdRef.current) {
              localStorage.setItem(storageKey(truckId, userId), liveOrderIdRef.current);
            }
          } catch {
            // ignore
          }
        }

        const totalCents = cart.reduce((sum, item) => sum + (item.priceCents * item.qty), 0);

        const liveOrderRef = ref(db, `liveOrders/${truckId}/${liveOrderIdRef.current}`);
        await set(liveOrderRef, {
          items: cart,
          customerName: customerName.trim(),
          pickupTime: pickupTime || null,
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
  }, [cart, customerName, pickupTime, truckId, userId]);

  /**
   * Supprime le brouillon de commande de Firebase
   */
  const clearLiveOrder = async ({ clearAllMyDrafts = false } = {}) => {
    if (!truckId || !userId) return;

    try {
      if (clearAllMyDrafts) {
        // Supprime tous les brouillons du pizzaiolo pour ce camion (passé et présent).
        await cleanupMyDrafts({ keepId: null });
      } else if (liveOrderIdRef.current) {
        const liveOrderRef = ref(db, `liveOrders/${truckId}/${liveOrderIdRef.current}`);
        await remove(liveOrderRef);
      }

      liveOrderIdRef.current = null;

      try {
        localStorage.removeItem(storageKey(truckId, userId));
      } catch {
        // ignore
      }

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
    clearLiveOrder,
    cleanupMyDrafts,
  };
};
