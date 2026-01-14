import { useState } from 'react';
import { ref, update } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbServerTimestamp } from '../../../lib/timestamps';

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
      
      const updates = {
        status: newStatus,
        updatedAt: rtdbServerTimestamp(),
      };

      // Ajouter le timestamp correspondant dans la timeline
      if (newStatus === 'received') {
        updates['timeline/receivedAt'] = rtdbServerTimestamp();
      } else if (newStatus === 'accepted') {
        updates['timeline/acceptedAt'] = rtdbServerTimestamp();
      } else if (newStatus === 'prep') {
        updates['timeline/prepAt'] = rtdbServerTimestamp();
      } else if (newStatus === 'cook') {
        updates['timeline/cookAt'] = rtdbServerTimestamp();
      } else if (newStatus === 'ready') {
        updates['timeline/readyAt'] = rtdbServerTimestamp();
      } else if (newStatus === 'delivered') {
        updates['timeline/deliveredAt'] = rtdbServerTimestamp();
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
