/**
 * Mapping officiel v1 (legacy) -> v2.
 *
 * Objectif : centraliser les correspondances et éviter les heuristiques dispersées.
 * Ce fichier ne touche pas la DB : c'est un "dual-read" helper.
 */

/**
 * @typedef {'created'|'received'|'accepted'|'prep'|'cook'|'ready'|'delivered'|'cancelled'} LegacyOrderStatus
 * @typedef {'paid'|'pending'|'failed'|string} LegacyPaymentStatus
 */

/**
 * @param {LegacyOrderStatus | undefined | null} status
 * @returns {import('../domain/orderTypes').KitchenStatus}
 */
export function mapLegacyStatusToKitchenStatus(status) {
  // Mapping v1 → v2 aligné avec le serveur (functions/index.js)
  switch (status) {
    case 'created':
    case 'received':
      return 'NEW';
    case 'accepted':
      return 'QUEUED';
    case 'prep':
    case 'cook':
      return 'PREPPING';
    case 'ready':
      return 'READY';
    case 'delivered':
      return 'DONE';
    case 'cancelled':
      return 'CANCELED';
    default:
      // Fallback conservateur
      return 'NEW';
  }
}

/**
 * @param {LegacyPaymentStatus | undefined | null} paymentStatus
 * @returns {import('../domain/orderTypes').PaymentStatus}
 */
export function mapLegacyPaymentStatusToPaymentStatus(paymentStatus) {
  // v1: paid | pending
  if (paymentStatus === 'paid') return 'PAID';
  if (paymentStatus === 'pending') return 'UNPAID';
  if (paymentStatus === 'failed') return 'ISSUE';
  return 'UNPAID';
}

/**
 * @param {any} legacy
 * @returns {import('../domain/orderTypes').Fulfillment}
 */
export function mapLegacyToFulfillment(legacy) {
  return legacy?.deliveryMethod === 'delivery' ? 'DELIVERY' : 'PICKUP';
}

/**
 * @param {any} legacy
 * @returns {import('../domain/orderTypes').Channel}
 */
export function mapLegacyToChannel(legacy) {
  if (legacy?.payment?.provider === 'stripe') return 'WEB';
  if (legacy?.source === 'manual' || legacy?.payment?.provider === 'manual') return 'ON_SITE';
  return 'WEB';
}
