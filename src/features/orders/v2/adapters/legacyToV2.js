import { toMs } from '../../../../lib/timestamps';
import {
  mapLegacyPaymentStatusToPaymentStatus,
  mapLegacyStatusToKitchenStatus,
  mapLegacyToChannel,
  mapLegacyToFulfillment,
} from './legacyMapping';

/**
 * Adapter (compat) : convertir une commande legacy (v1) stockée dans RTDB
 * vers une vue Order v2.
 *
 * Objectif : permettre un "dual-read" pendant la migration (sans modifier la DB).
 *
 * Note importante : les heuristiques ici ne doivent pas devenir la source de vérité.
 * La source de vérité v2 sera créée/maintenue par Functions.
 */

function toIsoOrNull(v) {
  const ms = toMs(v);
  if (!ms) return null;
  return new Date(ms).toISOString();
}

// Les mappings legacy -> v2 sont centralisés dans legacyMapping.js

function inferPromisedAtIso(legacy, createdAtIso, fulfillment) {
  // 1) Si legacy a pickupTime "HH:MM", on le projette sur le jour de createdAt.
  const pickupTime = legacy?.pickupTime;
  if (typeof pickupTime === 'string' && /^\d{2}:\d{2}$/.test(pickupTime)) {
    const base = new Date(createdAtIso);
    const [hh, mm] = pickupTime.split(':').map(Number);
    const projected = new Date(base);
    projected.setHours(hh, mm, 0, 0);
    // Si ça tombe "avant" createdAt (ex: minuit, fuseau), on ne force pas.
    if (Number.isFinite(projected.getTime()) && projected.getTime() >= base.getTime() - 6 * 60 * 60 * 1000) {
      return projected.toISOString();
    }
  }

  // 2) Fallback: lead time.
  const createdMs = new Date(createdAtIso).getTime();
  const leadMin = fulfillment === 'DELIVERY' ? 40 : 20;
  return new Date(createdMs + leadMin * 60 * 1000).toISOString();
}

/**
 * @param {{id: string, legacy: any}} params
 * @returns {import('../domain/orderTypes').OrderV2}
 */
export function legacyToOrderV2({ id, legacy }) {
  const createdAtIso =
    toIsoOrNull(legacy?.createdAt) ||
    toIsoOrNull(legacy?.createdAtClient) ||
    new Date().toISOString();

  const createdAtMs = new Date(createdAtIso).getTime();

  const fulfillment = mapLegacyToFulfillment(legacy);
  const promisedAtIso = inferPromisedAtIso(legacy, createdAtIso, fulfillment);

  const promisedAtMs = new Date(promisedAtIso).getTime();

  const kitchenStatus = mapLegacyStatusToKitchenStatus(legacy?.status);
  const paymentStatus = mapLegacyPaymentStatusToPaymentStatus(legacy?.payment?.paymentStatus);

  /** @type {import('../domain/orderTypes').OrderV2} */
  const order = {
    id,
    createdAt: createdAtIso,
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : undefined,
    promisedAt: promisedAtIso,
    promisedAtMs: Number.isFinite(promisedAtMs) ? promisedAtMs : undefined,
    kitchenStatus,
    paymentStatus,
    fulfillment,
    channel: mapLegacyToChannel(legacy),
    items: Array.isArray(legacy?.items)
      ? legacy.items.map((it) => ({
          name: String(it?.name || 'Article'),
          qty: Number(it?.qty || 1),
          options: Array.isArray(it?.options) ? it.options.map(String) : undefined,
        }))
      : [],
    notes: typeof legacy?.notes === 'string' ? legacy.notes : undefined,
    customer: {
      name: typeof legacy?.customerName === 'string' ? legacy.customerName : undefined,
      phone: typeof legacy?.phoneNumber === 'string' ? legacy.phoneNumber : undefined,
    },
    timestamps: {
      acceptedAt: toIsoOrNull(legacy?.timeline?.acceptedAt) || undefined,
      startedAt:
        toIsoOrNull(legacy?.timeline?.prepAt) ||
        toIsoOrNull(legacy?.timeline?.cookAt) ||
        toIsoOrNull(legacy?.timeline?.acceptedAt) ||
        undefined,
      readyAt: toIsoOrNull(legacy?.timeline?.readyAt) || undefined,
      completedAt: toIsoOrNull(legacy?.timeline?.deliveredAt) || undefined,
      canceledAt: legacy?.status === 'cancelled' ? new Date().toISOString() : undefined,
      expiredAt: undefined,
      handedOffAt: undefined,
    },
    flags: undefined,
    legacy: {
      orderId: id,
      source: 'v1',
    },
  };

  return order;
}
