import { KITCHEN_STATUSES } from './orderTypes';

const TERMINAL_STATUSES = new Set(['DONE', 'CANCELED', 'EXPIRED']);

/**
 * Matrice 5.2 (hard-coded) — c'est notre source de vérité métier.
 *
 * Note: on force une matrice explicite (pas de "if" chaînés) pour éviter les trous.
 */
const ALLOWED = Object.freeze({
  NEW: Object.freeze(['QUEUED', 'CANCELED']),
  QUEUED: Object.freeze(['PREPPING', 'CANCELED']),
  PREPPING: Object.freeze(['READY', 'CANCELED']),
  READY: Object.freeze(['HANDOFF', 'CANCELED']),
  HANDOFF: Object.freeze(['DONE']),
  // Terminaux: aucun next
  DONE: Object.freeze([]),
  CANCELED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
});

function assertIso(iso, label) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) {
    throw new Error(`${label} doit être une date ISO valide`);
  }
}

/**
 * @param {import('./orderTypes').OrderV2} order
 * @param {import('./orderTypes').KitchenStatus} next
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function canTransition(order, next) {
  const from = order?.kitchenStatus;

  if (!from || !KITCHEN_STATUSES.includes(from)) {
    return { ok: false, reason: 'Statut cuisine invalide' };
  }
  if (!next || !KITCHEN_STATUSES.includes(next)) {
    return { ok: false, reason: 'Statut cible invalide' };
  }

  if (TERMINAL_STATUSES.has(from)) {
    return { ok: false, reason: 'Statut terminal' };
  }

  const allowedNext = ALLOWED[from] || [];
  if (!allowedNext.includes(next)) {
    return { ok: false, reason: 'Transition non autorisée' };
  }

  // Garde-fou paiement critique
  if (from === 'READY' && next === 'HANDOFF') {
    if (order.paymentStatus !== 'PAID' && !order.flags?.managerOverride) {
      return { ok: false, reason: 'Paiement requis avant remise' };
    }
  }

  // Invariant business (optionnel mais utile)
  if (next === 'DONE') {
    if (order.paymentStatus !== 'PAID' && !order.flags?.managerOverride) {
      return { ok: false, reason: 'Paiement requis avant clôture' };
    }
  }

  return { ok: true };
}

/**
 * Applique une transition en mettant à jour kitchenStatus + timestamps.*.
 * Ne modifie PAS paymentStatus.
 *
 * @param {import('./orderTypes').OrderV2} order
 * @param {import('./orderTypes').KitchenStatus} next
 * @param {{nowIso?: string}=} options
 * @returns {import('./orderTypes').OrderV2}
 */
export function applyTransition(order, next, options = {}) {
  const check = canTransition(order, next);
  if (!check.ok) {
    throw new Error(check.reason);
  }

  const nowIso = options.nowIso || new Date().toISOString();
  assertIso(nowIso, 'nowIso');

  /** @type {import('./orderTypes').OrderTimestamps} */
  const nextTimestamps = { ...(order.timestamps || {}) };

  const from = order.kitchenStatus;

  // Règles 5.3 (timestamps)
  if (from === 'NEW' && next === 'QUEUED') nextTimestamps.acceptedAt = nowIso;
  if (from === 'QUEUED' && next === 'PREPPING') nextTimestamps.startedAt = nowIso;
  if (from === 'PREPPING' && next === 'READY') nextTimestamps.readyAt = nowIso;
  if (from === 'READY' && next === 'HANDOFF') nextTimestamps.handedOffAt = nowIso;
  if (from === 'HANDOFF' && next === 'DONE') nextTimestamps.completedAt = nowIso;

  if (next === 'CANCELED') nextTimestamps.canceledAt = nowIso;
  if (next === 'EXPIRED') nextTimestamps.expiredAt = nowIso;

  return {
    ...order,
    kitchenStatus: next,
    timestamps: nextTimestamps,
  };
}

export const __internal = {
  ALLOWED,
  TERMINAL_STATUSES,
};
