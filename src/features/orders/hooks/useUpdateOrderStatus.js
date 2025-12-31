import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';

/**
 * Hook pour mettre à jour le statut d'une commande
 * @returns {object} { updateStatus, loading, error }
 */
export function useUpdateOrderStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateStatus = async (orderId, newStatus) => {
    console.log('[useUpdateOrderStatus] Début mise à jour:', { orderId, newStatus });
    
    if (!isFirebaseConfigured || !db || !orderId) {
      const errorMsg = 'Configuration Firebase manquante ou orderId manquant';
      console.error('[useUpdateOrderStatus]', errorMsg);
      setError(errorMsg);
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const orderRef = ref(db, `orders/${orderId}`);
      const now = Date.now();
      
      const updates = {
        status: newStatus,
        updatedAt: now,
      };

      // Ajouter le timestamp correspondant dans la timeline
      if (newStatus === 'received') {
        updates['timeline/receivedAt'] = now;
      } else if (newStatus === 'accepted') {
        updates['timeline/acceptedAt'] = now;
      } else if (newStatus === 'prep') {
        updates['timeline/prepAt'] = now;
      } else if (newStatus === 'cook') {
        updates['timeline/cookAt'] = now;
      } else if (newStatus === 'ready') {
        updates['timeline/readyAt'] = now;
      } else if (newStatus === 'delivered') {
        updates['timeline/deliveredAt'] = now;
      }

      console.log('[useUpdateOrderStatus] Tentative update:', { orderRef: `orders/${orderId}`, updates });
      
      await update(orderRef, updates);
      
      console.log('[useUpdateOrderStatus] ✅ Mise à jour réussie');
      setLoading(false);
      return true;
    } catch (err) {
      console.error('[useUpdateOrderStatus] ❌ Erreur:', err);
      console.error('[useUpdateOrderStatus] Détails erreur:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      setError(err.message);
      setLoading(false);
      return false;
    }
  };

  return { updateStatus, loading, error };
}
