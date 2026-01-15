/**
 * Orders v2 — automatisations.
 */

/**
 * Auto-expire: PICKUP + UNPAID + kitchenStatus actif + now > promisedAt + 60min.
 *
 * Fonction pure: retourne l'ordre mis à jour + un flag.
 *
 * @param {import('./orderTypes').OrderV2} order
 * @param {{ now: Date }} params
 * @returns {{ changed: false, order: import('./orderTypes').OrderV2 } | { changed: true, order: import('./orderTypes').OrderV2 }}
 */
export function autoExpire(order, { now }) {
  if (order.fulfillment !== 'PICKUP') return { changed: false, order };
  if (order.paymentStatus !== 'UNPAID') return { changed: false, order };
  if (!['NEW', 'QUEUED', 'PREPPING', 'READY'].includes(order.kitchenStatus)) {
    return { changed: false, order };
  }

  const promisedMs = new Date(order.promisedAt).getTime();
  if (!Number.isFinite(promisedMs)) return { changed: false, order };

  const deadlineMs = promisedMs + 60 * 60 * 1000;
  if (now.getTime() <= deadlineMs) return { changed: false, order };

  const nowIso = now.toISOString();

  return {
    changed: true,
    order: {
      ...order,
      kitchenStatus: 'EXPIRED',
      timestamps: {
        ...(order.timestamps || {}),
        expiredAt: nowIso,
      },
    },
  };
}
