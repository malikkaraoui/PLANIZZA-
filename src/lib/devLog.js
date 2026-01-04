/**
 * Logging helper pour éviter les console.log en production.
 *
 * Usage:
 *   import { devLog, devWarn, devError } from '../lib/devLog';
 */

export const isDev = import.meta.env.DEV;

export function devLog(...args) {
  if (!isDev) return;
  console.log(...args);
}

export function devWarn(...args) {
  if (!isDev) return;
  console.warn(...args);
}

export function devError(...args) {
  if (!isDev) return;
  console.error(...args);
}
