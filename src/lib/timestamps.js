import { serverTimestamp } from 'firebase/database';

/**
 * RTDB server timestamp placeholder.
 * La valeur sera résolue en nombre (ms) par Firebase côté serveur.
 */
export function rtdbServerTimestamp() {
  return serverTimestamp();
}

/**
 * Convertit une valeur timestamp RTDB en millisecondes (number).
 * Retourne null si la valeur n'est pas exploitable.
 */
export function toMs(value) {
  if (value == null) return null;

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  // Parfois une date sérialisée ou un number en string
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const d = new Date(value);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  // Placeholder RTDB server timestamp: { '.sv': 'timestamp' }
  if (typeof value === 'object') {
    const maybeSv = value['.sv'] ?? value.sv;
    if (maybeSv === 'timestamp') return null;
  }

  return null;
}

export function coalesceMs(...values) {
  for (const v of values) {
    const ms = toMs(v);
    if (typeof ms === 'number') return ms;
  }
  return null;
}
