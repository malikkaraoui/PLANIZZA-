import { describe, expect, it } from 'vitest';
import { legacyToOrderV2 } from './legacyToV2';

function baseLegacy(overrides = {}) {
  return {
    status: 'received',
    deliveryMethod: 'pickup',
    payment: { provider: 'stripe', paymentStatus: 'paid' },
    createdAt: 1705312800000, // 2024-01-15T10:00:00.000Z (arbitraire)
    items: [{ name: 'Pizza', qty: 2 }],
    timeline: { acceptedAt: 1705313100000 },
    ...overrides,
  };
}

describe('legacyToOrderV2', () => {
  it('mappe status=received vers kitchenStatus=NEW', () => {
    const v2 = legacyToOrderV2({ id: 'o1', legacy: baseLegacy({ status: 'received' }) });
    expect(v2.kitchenStatus).toBe('NEW');
  });

  it('mappe status=accepted vers kitchenStatus=PREPPING', () => {
    const v2 = legacyToOrderV2({ id: 'o1', legacy: baseLegacy({ status: 'accepted' }) });
    expect(v2.kitchenStatus).toBe('PREPPING');
  });

  it('mappe paymentStatus=pending vers UNPAID', () => {
    const v2 = legacyToOrderV2({
      id: 'o1',
      legacy: baseLegacy({ payment: { provider: 'manual', paymentStatus: 'pending' } }),
    });
    expect(v2.paymentStatus).toBe('UNPAID');
  });

  it('remplit createdAtMs/promisedAtMs et legacy.source', () => {
    const v2 = legacyToOrderV2({ id: 'o1', legacy: baseLegacy() });
    expect(typeof v2.createdAtMs).toBe('number');
    expect(typeof v2.promisedAtMs).toBe('number');
    expect(v2.legacy?.source).toBe('v1');
  });
});
