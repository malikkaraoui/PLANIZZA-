import { useState } from 'react';
import { pizzaioloUpdateOrderStatus } from '../../../lib/ordersApi';

/**
 * Hook pour mettre à jour le statut d'une commande
 * @returns {object} { updateStatus, loading, error }
 */
export function useUpdateOrderStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateStatus = async (orderId, newStatus) => {
    console.log('[useUpdateOrderStatus] Début mise à jour:', { orderId, newStatus });

    if (!orderId) {
      const errorMsg = 'orderId manquant';
      console.error('[useUpdateOrderStatus]', errorMsg);
      setError(errorMsg);
      return { ok: false, error: errorMsg, status: 400 };
    }

    setLoading(true);
    setError(null);

    try {
      await pizzaioloUpdateOrderStatus({ orderId, newStatus });
      console.log('[useUpdateOrderStatus] ✅ Mise à jour réussie');
      setLoading(false);
      return { ok: true };
    } catch (err) {
      console.error('[useUpdateOrderStatus] ❌ Erreur:', err);
      console.error('[useUpdateOrderStatus] Détails erreur:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      const status = typeof err?.status === 'number' ? err.status : null;
      setError(err.message);
      setLoading(false);
      return { ok: false, error: err.message, status };
    }
  };

  return { updateStatus, loading, error };
}
