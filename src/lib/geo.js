// MVP geo helpers (placeholder)

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function kmBetween(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lon1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lon2 = Number(b.lng);
  if ([lat1, lon1, lat2, lon2].some((v) => Number.isNaN(v))) return null;

  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const aa = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

export async function getBrowserPosition() {
  if (!('geolocation' in navigator)) return null;

  // La géolocalisation est bloquée en contexte non sécurisé.
  // Exception: localhost est considéré comme "potentially trustworthy".
  const hostname = typeof window !== 'undefined' ? window.location?.hostname : '';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
    const err = new Error('GEO_INSECURE_CONTEXT');
    err.code = 'GEO_INSECURE_CONTEXT';
    err.origin = window.location?.origin;
    throw err;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}
