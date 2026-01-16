/**
 * Formate une "taille" boisson en label de volume lisible.
 * Exemples: 33cl -> 33cL, 1.5l -> 1,5L
 */
export function formatDrinkVolumeLabel(size) {
  if (!size) return null;

  const raw = String(size).trim().toLowerCase();

  const map = {
    '25cl': '25cL',
    '33cl': '33cL',
    '50cl': '50cL',
    '75cl': '75cL',
    '1l': '1L',
    '1L': '1L',
    '1.5l': '1,5L',
    '1.5L': '1,5L',
  };

  if (map[raw]) return map[raw];

  // fallback: garder une forme proche mais lisible
  // - 33CL -> 33cL
  // - 2L -> 2L
  if (raw.endsWith('cl')) return raw.replace('cl', 'cL');
  if (raw.endsWith('l')) return raw.toUpperCase();

  return null;
}
