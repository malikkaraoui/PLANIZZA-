import { describe, expect, it } from 'vitest';
import { canTransition, applyTransition } from './stateMachine';
import { autoExpire } from './automation';

function baseOrder(overrides = {}) {
  return {
    id: 'o_1',
    createdAt: '2026-01-15T10:00:00.000Z',
    promisedAt: '2026-01-15T10:20:00.000Z',
    kitchenStatus: 'NEW',
    paymentStatus: 'UNPAID',
    fulfillment: 'PICKUP',
    channel: 'ON_SITE',
    items: [{ name: 'Margherita', qty: 1 }],
    timestamps: {},
    ...overrides,
  };
}

describe('orders v2 state machine', () => {
  it('bloque READY -> HANDOFF si UNPAID', () => {
    const order = baseOrder({ kitchenStatus: 'READY', paymentStatus: 'UNPAID' });
    expect(canTransition(order, 'HANDOFF')).toEqual({
      ok: false,
      reason: 'Paiement requis avant remise',
    });
  });

  it('autorise READY -> HANDOFF si PAID', () => {
    const order = baseOrder({ kitchenStatus: 'READY', paymentStatus: 'PAID' });
    expect(canTransition(order, 'HANDOFF')).toEqual({ ok: true });
  });

  it('autorise READY -> HANDOFF si override manager', () => {
    const order = baseOrder({
      kitchenStatus: 'READY',
      paymentStatus: 'UNPAID',
      flags: { managerOverride: true },
    });
    expect(canTransition(order, 'HANDOFF')).toEqual({ ok: true });
  });

  it('applique NEW -> QUEUED et écrit acceptedAt', () => {
    const order = baseOrder({ kitchenStatus: 'NEW', paymentStatus: 'PAID' });
    const nowIso = '2026-01-15T10:05:00.000Z';

    const next = applyTransition(order, 'QUEUED', { nowIso });
    expect(next.kitchenStatus).toBe('QUEUED');
    expect(next.timestamps.acceptedAt).toBe(nowIso);
  });

  it('refuse un saut NEW -> READY', () => {
    const order = baseOrder({ kitchenStatus: 'NEW', paymentStatus: 'PAID' });
    expect(canTransition(order, 'READY')).toEqual({
      ok: false,
      reason: 'Transition non autorisée',
    });
  });
});

describe('orders v2 automation', () => {
  it('autoExpire déclenche uniquement pour PICKUP + UNPAID + now > promisedAt + 60min', () => {
    const order = baseOrder({
      kitchenStatus: 'READY',
      paymentStatus: 'UNPAID',
      promisedAt: '2026-01-15T10:00:00.000Z',
    });

    const tooEarly = autoExpire(order, { now: new Date('2026-01-15T10:59:59.000Z') });
    expect(tooEarly.changed).toBe(false);

    const ok = autoExpire(order, { now: new Date('2026-01-15T11:00:01.000Z') });
    expect(ok.changed).toBe(true);
    expect(ok.order.kitchenStatus).toBe('EXPIRED');
    expect(ok.order.timestamps.expiredAt).toBe('2026-01-15T11:00:01.000Z');
  });

  it('autoExpire ne déclenche pas en DELIVERY', () => {
    const order = baseOrder({
      fulfillment: 'DELIVERY',
      kitchenStatus: 'READY',
      paymentStatus: 'UNPAID',
      promisedAt: '2026-01-15T10:00:00.000Z',
    });

    const res = autoExpire(order, { now: new Date('2026-01-15T12:00:00.000Z') });
    expect(res.changed).toBe(false);
  });
});
