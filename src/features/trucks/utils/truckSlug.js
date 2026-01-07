import { get, query, ref, orderByChild, equalTo } from 'firebase/database';

function slugifyTruckName(name) {
  if (!name || typeof name !== 'string') return 'TRUCK';

  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'TRUCK';
}

function randomAlnumUpper(length = 3) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function isSlugTaken({ db, slug, excludeTruckId }) {
  const q = query(ref(db, 'public/trucks'), orderByChild('slug'), equalTo(String(slug)));
  const snap = await get(q);

  if (!snap.exists()) return false;

  const entries = snap.val() && typeof snap.val() === 'object' ? Object.entries(snap.val()) : [];
  return entries.some(([id]) => id !== excludeTruckId);
}

/**
 * Génère un slug unique pour un camion.
 * - Base = slugify(name)
 * - Si conflit, ajoute un suffixe alphanum (3 chars) : BASE_ABC
 */
export async function generateUniqueTruckSlug({
  db,
  name,
  excludeTruckId,
  suffixLength = 3,
  maxAttempts = 12,
} = {}) {
  if (!db) throw new Error('generateUniqueTruckSlug: db requis');

  const base = slugifyTruckName(String(name || '').trim());

  // 1) Tenter la base directe
  if (!(await isSlugTaken({ db, slug: base, excludeTruckId }))) {
    return base;
  }

  // 2) Sinon suffixe random (3 chars demandé)
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = `${base}_${randomAlnumUpper(suffixLength)}`;
    if (!(await isSlugTaken({ db, slug: candidate, excludeTruckId }))) {
      return candidate;
    }
  }

  // 3) Ultime fallback (très improbable)
  return `${base}_${randomAlnumUpper(suffixLength)}`;
}

export const truckSlugUtils = {
  slugifyTruckName,
  randomAlnumUpper,
  isSlugTaken,
};
