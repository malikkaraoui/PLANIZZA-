import { useEffect, useState } from 'react';
import { kmBetween } from '../../../lib/geo';

const BADGES = ['Bio', 'Terroir', 'Sans gluten', 'Halal', 'Kasher', 'Sucré'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickMany(rng, arr, min, max) {
  const count = Math.max(min, Math.min(max, Math.floor(rng() * (max - min + 1)) + min));
  const copy = [...arr];
  const out = [];
  while (out.length < count && copy.length) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function genTrucks({ count = 10, seed = 1337 } = {}) {
  const rng = mulberry32(seed);

  const cities = [
    { name: 'Lyon', lat: 45.764, lng: 4.8357 },
    { name: 'Villeurbanne', lat: 45.7719, lng: 4.8902 },
    { name: 'Bron', lat: 45.739, lng: 4.913 },
    { name: 'Vénissieux', lat: 45.697, lng: 4.885 },
    { name: 'Caluire-et-Cuire', lat: 45.795, lng: 4.846 },
    { name: 'Oullins', lat: 45.714, lng: 4.807 },
    { name: 'Tassin-la-Demi-Lune', lat: 45.757, lng: 4.783 },
    { name: 'Écully', lat: 45.774, lng: 4.777 },
  ];

  const brandWords = [
    'Mamma',
    'Napoli',
    'Forno',
    'Partenza',
    'Sole',
    'Basilic',
    'Margherita',
    'Bottega',
    'Campione',
    'Trattoria',
    'Cuore',
    'Crocante',
  ];

  const heroPhotos = [
    'file:///Users/malik/.gemini/antigravity/brain/4667bdcc-f6c3-4a13-a6c5-008352cbb39e/modern_glass_pizza_truck_1_1766418239603.png',
    'file:///Users/malik/.gemini/antigravity/brain/4667bdcc-f6c3-4a13-a6c5-008352cbb39e/modern_glass_pizza_truck_2_1766418252608.png',
    'file:///Users/malik/.gemini/antigravity/brain/4667bdcc-f6c3-4a13-a6c5-008352cbb39e/modern_glass_pizza_truck_3_1766418271033.png',
  ];

  const trucks = [];
  for (let i = 0; i < count; i += 1) {
    const city = pick(rng, cities);

    // petit offset autour de la commune (≈ quelques km)
    const lat = city.lat + (rng() - 0.5) * 0.08;
    const lng = city.lng + (rng() - 0.5) * 0.1;

    const ratingAvg = round1(3.8 + rng() * 1.1); // 3.8 → 4.9
    const ratingCount = Math.floor(10 + rng() * 420); // 10 → 430

    const pizzaPerHour = Math.floor(20 + rng() * 80); // 20 → 100
    const minPerPizza = Math.max(1, Math.round(60 / Math.max(10, pizzaPerHour)));
    const estimatedPrepMin = Math.max(8, Math.min(30, Math.round(26 - pizzaPerHour / 6 + rng() * 6)));

    const isOpenNow = rng() > 0.35;
    const openingToday = isOpenNow ? 'Ouvert maintenant' : 'Service ce soir';

    const badges = pickMany(rng, BADGES, 1, 4);

    const name = `Pizza ${pick(rng, brandWords)} ${pick(rng, brandWords)}`.replace(/\s+/g, ' ').trim();

    trucks.push({
      id: `truck-${i + 1}`,
      name,
      city: city.name,
      location: { lat, lng },
      openingToday,
      isOpenNow,
      badges,
      // compat avec ancien code
      tags: badges,
      logoUrl: null,
      photos: [pick(rng, heroPhotos)],
      ratingAvg,
      ratingCount,
      capacity: { minPerPizza, pizzaPerHour },
      estimatedPrepMin,
    });
  }

  return trucks;
}

export function useTrucks(options = {}) {
  const query = (options.query || '').trim().toLowerCase();
  const locationText = (options.locationText || '').trim().toLowerCase();
  const position = options.position || null;
  const filters = options.filters || {};
  const mockCount = typeof options.mockCount === 'number' ? options.mockCount : 10;

  const [baseTrucks, setBaseTrucks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: brancher Firebase
    const t = setTimeout(() => {
      setBaseTrucks(genTrucks({ count: mockCount, seed: 1337 }));
      setLoading(false);
    }, 200);

    return () => clearTimeout(t);
  }, [mockCount]);

  const maxDistanceKm =
    filters.maxDistanceKm == null || filters.maxDistanceKm === ''
      ? null
      : Number(filters.maxDistanceKm);
  const minRating = filters.minRating == null || filters.minRating === '' ? null : Number(filters.minRating);
  const openNowOnly = Boolean(filters.openNowOnly);
  const selectedBadges = Array.isArray(filters.badges) ? filters.badges : [];
  const sortBy = filters.sortBy || 'distance';

  const withMeta = baseTrucks.map((t) => {
    const km = position ? kmBetween(position, t.location) : null;
    const distanceKm = km == null ? t.distanceKm : round1(km);

    const highlights = [];
    if (typeof distanceKm === 'number' && distanceKm <= 1) highlights.push('Proche');
    if (t.ratingAvg >= 4.5 && t.ratingCount >= 220) highlights.push('Populaire');
    if ((t.capacity?.pizzaPerHour ?? 0) >= 60) highlights.push('Rapide');
    if ((t.estimatedPrepMin ?? Infinity) <= 15) highlights.push('Prêt en moins de 15 min');

    return { ...t, distanceKm, highlights };
  });

  const trucks = withMeta
    .filter((t) => {
      if (!query) return true;
      const hay = `${t.name} ${t.city} ${(t.badges || t.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(query);
    })
    .filter((t) => {
      // Filtre "Où" (ville/adresse) : MVP => on matche la ville ou via position
      // Si position existe, on utilise maxDistanceKm pour filtrer
      // Sinon on cherche dans le nom de ville
      if (!locationText) return true;

      // Si on a une position GPS, on ne filtre pas par texte de ville
      // (le filtre de distance s'en charge)
      if (position) return true;

      // Sinon on cherche le texte dans le nom de ville (tolérant)
      return String(t.city || '').toLowerCase().includes(locationText);
    })
    .filter((t) => {
      if (!openNowOnly) return true;
      return Boolean(t.isOpenNow);
    })
    .filter((t) => {
      if (minRating == null || Number.isNaN(minRating)) return true;
      return (t.ratingAvg ?? 0) >= minRating;
    })
    .filter((t) => {
      if (maxDistanceKm == null || Number.isNaN(maxDistanceKm)) return true;
      if (t.distanceKm == null) return false;
      return t.distanceKm <= maxDistanceKm;
    })
    .filter((t) => {
      if (!selectedBadges.length) return true;
      const set = new Set(t.badges || t.tags || []);
      return selectedBadges.every((b) => set.has(b));
    })
    .sort((a, b) => {
      if (sortBy === 'note') {
        if ((b.ratingAvg ?? 0) !== (a.ratingAvg ?? 0)) return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
        return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
      }

      if (sortBy === 'popularite') {
        if ((b.ratingCount ?? 0) !== (a.ratingCount ?? 0)) return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
        return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
      }

      // default: distance
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });

  return { trucks, loading };
}
