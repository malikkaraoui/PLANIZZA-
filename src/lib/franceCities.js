import { kmBetween } from './geo';

/**
 * Recherche des communes françaises via l’API officielle.
 * https://geo.api.gouv.fr
 */
export async function searchFrenchCities({ query, limit = 8 }) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const url = new URL('https://geo.api.gouv.fr/communes');
  url.searchParams.set('nom', q);
  url.searchParams.set('fields', 'nom,code,centre,population,codesPostaux,departement');
  url.searchParams.set('boost', 'population');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`geo.api.gouv.fr error (${res.status})`);
  }

  const data = await res.json();

  return (Array.isArray(data) ? data : [])
    .map((c) => {
      const coords = c?.centre?.coordinates;
      const lng = Array.isArray(coords) ? coords[0] : null;
      const lat = Array.isArray(coords) ? coords[1] : null;

      return {
        name: c?.nom ?? '',
        code: c?.code ?? null,
        departmentName: c?.departement?.nom ?? null,
        departmentCode: c?.departement?.code ?? null,
        postcodes: Array.isArray(c?.codesPostaux) ? c.codesPostaux : [],
        population: typeof c?.population === 'number' ? c.population : null,
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
      };
    })
    .filter((c) => c.name);
}

export function sortCitiesByProximity(cities, position) {
  if (!position) return cities;
  const withKm = cities.map((c) => {
    const km = c?.lat != null && c?.lng != null ? kmBetween(position, { lat: c.lat, lng: c.lng }) : null;
    return { ...c, distanceKm: km };
  });

  return withKm.sort((a, b) => {
    const ak = a.distanceKm == null ? Infinity : a.distanceKm;
    const bk = b.distanceKm == null ? Infinity : b.distanceKm;
    if (ak !== bk) return ak - bk;

    // fallback: villes plus peuplées d’abord
    const ap = a.population == null ? -1 : a.population;
    const bp = b.population == null ? -1 : b.population;
    return bp - ap;
  });
}
