export const VALID_TRANSITION_ACTIONS = new Set([
  'ACCEPT',
  'START',
  'READY',
  'HANDOFF',
  'DONE',
  'CANCEL',
]);

export function assertValidTransitionPayload(payload) {
  const errors = [];
  const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid transition payload: payload must be an object');
  }

  if ('nextKitchenStatus' in payload) {
    throw new Error('Invalid transition payload: nextKitchenStatus is forbidden (use action)');
  }

  if (!payload.orderId || typeof payload.orderId !== 'string') {
    errors.push('orderId');
  }

  if (!payload.action || typeof payload.action !== 'string' || !VALID_TRANSITION_ACTIONS.has(payload.action)) {
    errors.push('action');
  }

  if (
    typeof payload.expectedUpdatedAtMs !== 'undefined' &&
    (typeof payload.expectedUpdatedAtMs !== 'number' || !Number.isFinite(payload.expectedUpdatedAtMs))
  ) {
    errors.push('expectedUpdatedAtMs');
  }

  if (
    typeof payload.managerOverride !== 'undefined' &&
    typeof payload.managerOverride !== 'boolean'
  ) {
    errors.push('managerOverride');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid transition payload: ${errors.join(', ')} (keys: ${keys.join(', ')})`
    );
  }
}
