import { kmBetween } from './geo';

/**
 * Recherche des communes françaises via l’API officielle.
 * https://geo.api.gouv.fr
 */
export async function searchFrenchCities({ query, limit = 8 }) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const url = new URL('https://geo.api.gouv.fr/communes');

  // Tenter d'extraire un code postal (5 chiffres) du texte
  const pcMatch = q.match(/\d{5}/);
  const extractedPC = pcMatch ? pcMatch[0] : null;
  const cleanedName = q.replace(/\d{5}/, '').trim();

  if (extractedPC && !cleanedName) {
    // Cas où on n'a QUE le code postal
    url.searchParams.set('codePostal', extractedPC);
  } else if (cleanedName) {
    // Recherche par nom, avec optionnellement un filtre par code postal
    url.searchParams.set('nom', cleanedName);
    url.searchParams.set('boost', 'population');
    if (extractedPC) {
      url.searchParams.set('codePostal', extractedPC);
    }
  } else {
    // Fallback si rien de clair
    url.searchParams.set('nom', q);
  }

  url.searchParams.set('fields', 'nom,code,centre,population,codesPostaux,departement');
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

/**
 * Déduit la commune la plus probable depuis une position GPS (reverse geocoding).
 * API gratuite (France) : https://geo.api.gouv.fr
 */
export async function reverseGeocodeCommune({ lat, lng }) {
  const la = Number(lat);
  const lo = Number(lng);
  if ([la, lo].some((v) => Number.isNaN(v))) return null;

  // `lat`/`lon` sur geo.api.gouv.fr
  const url = new URL('https://geo.api.gouv.fr/communes');
  url.searchParams.set('lat', String(la));
  url.searchParams.set('lon', String(lo));
  url.searchParams.set('fields', 'nom,code,centre,codesPostaux,departement');
  url.searchParams.set('format', 'json');
  url.searchParams.set('geometry', 'centre');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`geo.api.gouv.fr reverse error (${res.status})`);
  }

  const data = await res.json();
  const first = Array.isArray(data) && data.length ? data[0] : null;
  if (!first?.nom) return null;

  const coords = first?.centre?.coordinates;
  const rLng = Array.isArray(coords) ? coords[0] : null;
  const rLat = Array.isArray(coords) ? coords[1] : null;

  return {
    name: first.nom,
    code: first.code ?? null,
    departmentName: first?.departement?.nom ?? null,
    departmentCode: first?.departement?.code ?? null,
    postcodes: Array.isArray(first?.codesPostaux) ? first.codesPostaux : [],
    lat: typeof rLat === 'number' ? rLat : null,
    lng: typeof rLng === 'number' ? rLng : null,
  };
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
