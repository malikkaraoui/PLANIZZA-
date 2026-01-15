import { CHANNELS, FULFILLMENTS, KITCHEN_STATUSES, PAYMENT_STATUSES } from './orderTypes';

function isIsoString(s) {
  if (typeof s !== 'string') return false;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms);
}

/**
 * Retourne la version ms d'une ISO ou null.
 * @param {string} iso
 */
export function isoToMs(iso) {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Valide le contrat v2 côté runtime.
 * @param {any} order
 * @returns {{ok: true} | {ok: false, errors: string[]}}
 */
export function validateOrderV2(order) {
  const errors = [];

  if (!order || typeof order !== 'object') {
    return { ok: false, errors: ['Order manquant'] };
  }

  if (typeof order.id !== 'string' || order.id.trim().length === 0) errors.push('id requis');

  if (!isIsoString(order.createdAt)) errors.push('createdAt (ISO) requis');
  if (!isIsoString(order.promisedAt)) errors.push('promisedAt (ISO) requis');

  if (!KITCHEN_STATUSES.includes(order.kitchenStatus)) errors.push('kitchenStatus invalide');
  if (!PAYMENT_STATUSES.includes(order.paymentStatus)) errors.push('paymentStatus invalide');
  if (!FULFILLMENTS.includes(order.fulfillment)) errors.push('fulfillment invalide');
  if (!CHANNELS.includes(order.channel)) errors.push('channel invalide');

  if (!Array.isArray(order.items)) errors.push('items doit être un tableau');

  if (!order.timestamps || typeof order.timestamps !== 'object') {
    errors.push('timestamps requis');
  }

  // Champs ms optionnels mais s'ils existent, ils doivent matcher l'ISO.
  if (typeof order.createdAtMs === 'number') {
    const ms = isoToMs(order.createdAt);
    if (ms != null && order.createdAtMs !== ms) errors.push('createdAtMs != createdAt');
  }
  if (typeof order.promisedAtMs === 'number') {
    const ms = isoToMs(order.promisedAt);
    if (ms != null && order.promisedAtMs !== ms) errors.push('promisedAtMs != promisedAt');
  }

  // Invariant: HANDOFF/DONE nécessitent PAID sauf override
  if ((order.kitchenStatus === 'HANDOFF' || order.kitchenStatus === 'DONE') && order.paymentStatus !== 'PAID') {
    if (!order.flags?.managerOverride) errors.push('HANDOFF/DONE requiert paymentStatus=PAID (sauf override)');
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Normalise un order v2: complète createdAtMs/promisedAtMs depuis les ISO.
 * Ne change pas la sémantique métier, juste des champs dérivés.
 *
 * @param {import('./orderTypes').OrderV2} order
 * @returns {import('./orderTypes').OrderV2}
 */
export function normalizeOrderV2(order) {
  const createdAtMs = typeof order.createdAtMs === 'number' ? order.createdAtMs : isoToMs(order.createdAt);
  const promisedAtMs = typeof order.promisedAtMs === 'number' ? order.promisedAtMs : isoToMs(order.promisedAt);

  return {
    ...order,
    createdAtMs: createdAtMs ?? undefined,
    promisedAtMs: promisedAtMs ?? undefined,
  };
}
