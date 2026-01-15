/**
 * Orders v2 (domain) — types / enums.
 *
 * Le codebase est en JS, donc on formalise via constantes + JSDoc.
 */

/** @type {readonly [
 *  'NEW',
 *  'QUEUED',
 *  'PREPPING',
 *  'READY',
 *  'HANDOFF',
 *  'DONE',
 *  'CANCELED',
 *  'EXPIRED'
 * ]} */
export const KITCHEN_STATUSES = Object.freeze([
  'NEW',
  'QUEUED',
  'PREPPING',
  'READY',
  'HANDOFF',
  'DONE',
  'CANCELED',
  'EXPIRED',
]);

/** @type {readonly ['PAID','UNPAID','ISSUE']} */
export const PAYMENT_STATUSES = Object.freeze(['PAID', 'UNPAID', 'ISSUE']);

/** @type {readonly ['PICKUP','DELIVERY']} */
export const FULFILLMENTS = Object.freeze(['PICKUP', 'DELIVERY']);

/** @type {readonly ['WEB','PHONE','ON_SITE','UBER']} */
export const CHANNELS = Object.freeze(['WEB', 'PHONE', 'ON_SITE', 'UBER']);

/**
 * @typedef {'NEW'|'QUEUED'|'PREPPING'|'READY'|'HANDOFF'|'DONE'|'CANCELED'|'EXPIRED'} KitchenStatus
 * @typedef {'PAID'|'UNPAID'|'ISSUE'} PaymentStatus
 * @typedef {'PICKUP'|'DELIVERY'} Fulfillment
 * @typedef {'WEB'|'PHONE'|'ON_SITE'|'UBER'} Channel
 *
 * @typedef {Object} OrderTimestamps
 * @property {string=} acceptedAt
 * @property {string=} startedAt
 * @property {string=} readyAt
 * @property {string=} handedOffAt
 * @property {string=} completedAt
 * @property {string=} canceledAt
 * @property {string=} expiredAt
 *
 * @typedef {Object} OrderFlags
 * @property {boolean=} managerOverride
 *
 * @typedef {Object} OrderV2
 * @property {string} id
 * @property {string} createdAt
 * @property {number=} createdAtMs
 * @property {string} promisedAt
 * @property {number=} promisedAtMs
 * @property {string=} updatedAt
 * @property {number=} updatedAtMs
 * @property {KitchenStatus} kitchenStatus
 * @property {PaymentStatus} paymentStatus
 * @property {Fulfillment} fulfillment
 * @property {Channel} channel
 * @property {Array<{name: string, qty: number, options?: string[]}>} items
 * @property {string=} notes
 * @property {{name?: string, phone?: string}=} customer
 * @property {OrderTimestamps} timestamps
 * @property {OrderFlags=} flags
 * @property {{orderId?: string, source?: 'v1'|'v2'}=} legacy
 */
