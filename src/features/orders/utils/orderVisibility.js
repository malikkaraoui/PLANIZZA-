/**
 * Règles de visibilité des commandes côté client.
 * Centralise la logique métier pour éviter les divergences UI.
 */

import { isOrderPaid } from './orderStatus';

export function isClientVisibleOrder(order) {
  if (!order) return false;

  // On exclut les brouillons.
  if (order.status === 'created') return false;

  // Si paiement en attente et pas encore reçu, on masque.
  if (order.payment?.paymentStatus === 'pending' && order.status !== 'received') return false;

  // Si pas payé, on n'affiche que certains statuts (cas legacy/retard Stripe).
  if (!isOrderPaid(order)) {
    return ['received', 'accepted', 'delivered'].includes(order.status);
  }

  return true;
}
