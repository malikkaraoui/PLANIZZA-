import { useEffect, useState } from 'react';
import { kmBetween } from '../../../lib/geo';
import { generateSlug } from '../../../lib/utils';
import { devError } from '../../../lib/devLog';
import { rtdbPaths } from '../../../lib/rtdbPaths';
import { isFirebaseConfigured } from '../../../lib/firebase';

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
    // Annecy et environs (beaucoup plus)
    { name: 'Annecy', lat: 45.8992, lng: 6.1294 },
    { name: 'Annecy-le-Vieux', lat: 45.9186, lng: 6.1447 },
    { name: 'Seynod', lat: 45.8906, lng: 6.0895 },
    { name: 'Cran-Gevrier', lat: 45.9019, lng: 6.1056 },
    { name: 'Meythet', lat: 45.9153, lng: 6.0942 },
    { name: 'Annecy-le-Vieux', lat: 45.9186, lng: 6.1447 },
    { name: 'Epagny', lat: 45.9342, lng: 6.0814 },
    { name: 'Pringy', lat: 45.9389, lng: 6.1194 },
    // Lyon et environs
    { name: 'Lyon', lat: 45.764, lng: 4.8357 },
    { name: 'Villeurbanne', lat: 45.7719, lng: 4.8902 },
    { name: 'Bron', lat: 45.739, lng: 4.913 },
    { name: 'Vénissieux', lat: 45.697, lng: 4.885 },
    { name: 'Caluire-et-Cuire', lat: 45.795, lng: 4.846 },
    { name: 'Oullins', lat: 45.714, lng: 4.807 },
    // Paris et environs
    { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { name: 'Boulogne-Billancourt', lat: 48.8333, lng: 2.25 },
    { name: 'Montreuil', lat: 48.8611, lng: 2.4419 },
    { name: 'Saint-Denis', lat: 48.9356, lng: 2.3539 },
    // Marseille et environs
    { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
    { name: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474 },
    // Autres grandes villes
    { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
    { name: 'Nice', lat: 43.7102, lng: 7.262 },
    { name: 'Nantes', lat: 47.2184, lng: -1.5536 },
    { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
    { name: 'Lille', lat: 50.6292, lng: 3.0573 },
    { name: 'Rennes', lat: 48.1173, lng: -1.6778 },
    { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
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
    '/images/trucks/truck_neon.png',
    '/images/trucks/truck_vintage.png',
    '/images/trucks/truck_cyber.png',
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
    const ovenType = pick(rng, ['Bois', 'Gaz', 'Électrique']);

    const name = `Pizza ${pick(rng, brandWords)} ${pick(rng, brandWords)}`.replace(/\s+/g, ' ').trim();
    
    // Générer le slug en collectant les slugs existants
    const existingSlugs = trucks.map(t => t.slug);
    const slug = generateSlug(name, existingSlugs);

    trucks.push({
      id: `truck-${i + 1}`,
      slug,
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
      ovenType,
      capacity: { minPerPizza, pizzaPerHour },
      estimatedPrepMin,
    });
  }

  return trucks;
}

import { db } from '../../../lib/firebase';
import { ref, onValue, set, get } from 'firebase/database';

export function useTrucks(options = {}) {
  const query = (options.query || '').trim().toLowerCase();
  const locationText = (options.locationText || '').trim().toLowerCase();
  const position = options.position || null;
  const filters = options.filters || {};
  const mockCount = typeof options.mockCount === 'number' ? options.mockCount : 50;

  const [baseTrucks, setBaseTrucks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      const t = setTimeout(() => {
        setBaseTrucks(genTrucks({ count: mockCount, seed: 1337 }));
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    let unsubscribe = null;

    const normalizeTruck = (id, val) => {
      const badgesArray = val.badges && typeof val.badges === 'object'
        ? Object.entries(val.badges)
            .filter(([_, v]) => v === true)
            .map(([k, _]) => {
              const map = {
                bio: 'Bio',
                terroir: 'Terroir',
                sansGluten: 'Sans gluten',
                halal: 'Halal',
                kasher: 'Kasher',
                sucre: 'Sucré',
              };
              return map[k] || k;
            })
        : [];

      return {
        ...val,
        // IMPORTANT: on force l'id = clé RTDB (ne pas laisser un éventuel val.id = null écraser).
        id,
        badges: badgesArray,
        tags: badgesArray,
        isOpenNow: val.isOpenNow ?? true,
        openingToday: val.openingToday || 'Ouvert maintenant',
        photos: val.photoUrl ? [val.photoUrl] : [],
        estimatedPrepMin: val.estimatedPrepMin || 15,
        capacity: val.capacity || { minPerPizza: 10, pizzaPerHour: 30 },
        distanceKm: val.distanceKm,
      };
    };

    const initTrucks = async () => {
      const trucksRef = ref(db, rtdbPaths.publicTrucksRoot());

      try {
        // Vérifier d'abord si la DB contient des données (one-shot)
        const snapshot = await get(trucksRef);
        if (cancelled) return;

        if (!snapshot.exists()) {
          // DB vide (ou lecture non autorisée / path absent).
          // Tentative de seed (best-effort). Si ça échoue (règles), on fallback en local.
          const initialTrucks = genTrucks({ count: mockCount, seed: 1337 });
          const updates = {};
          initialTrucks.forEach((t) => {
            updates[t.id] = t;
          });

          try {
            await set(trucksRef, updates);
          } catch (err) {
            devError('[useTrucks] Seed DB impossible (fallback local):', err);
          }

          if (!cancelled) {
            setBaseTrucks(initialTrucks);
            setLoading(false);
          }
        }

        // Maintenant on écoute les changements
        unsubscribe = onValue(
          trucksRef,
          (snap) => {
            if (cancelled) return;

            if (snap.exists()) {
              const data = snap.val();
              const list = Object.entries(data).map(([id, val]) => normalizeTruck(id, val));
              setBaseTrucks(list);
            } else {
              setBaseTrucks([]);
            }

            setLoading(false);
          },
          (err) => {
            if (cancelled) return;
            devError('[useTrucks] RTDB onValue error:', err);
            setBaseTrucks([]);
            setLoading(false);
          }
        );
      } catch (err) {
        if (cancelled) return;
        devError('[useTrucks] RTDB init error (fallback local):', err);
        setBaseTrucks(genTrucks({ count: mockCount, seed: 1337 }));
        setLoading(false);
      }
    };

    initTrucks();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
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
      const locationQuery = String(locationText || '').toLowerCase().trim();

      // Si on n'a rien saisi, on laisse tout passer (le tri par distance fera le reste si position)
      if (!locationQuery) return true;

      // Si on a une position GPS (coordonnées exactes), on ne filtre PAS par ville
      // car le tri par distance est prioritaire. L'utilisateur peut être à Annecy
      // mais voir des camions d'Annecy-le-Vieux ou villages voisins.
      if (position) {
        return true;
      }

      // Si pas de position (saisie clavier pure), on filtre strictement par ville ou code postal
      const truckCity = String(t.city || t.description || '').toLowerCase();
      const truckZip = String(t.zipCode || '').toLowerCase();

      return truckCity.includes(locationQuery) || truckZip.includes(locationQuery);
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
      if (t.distanceKm == null) return true; // Pas de position = on garde le camion
      return t.distanceKm <= maxDistanceKm;
    })
    .filter((t) => {
      if (!selectedBadges.length) return true;
      const set = new Set(t.badges || t.tags || []);
      return selectedBadges.every((b) => set.has(b));
    })
    .filter((t) => {
      const selectedOvenTypes = Array.isArray(filters.ovenTypes) ? filters.ovenTypes : [];
      if (!selectedOvenTypes.length) return true;
      return selectedOvenTypes.includes(t.ovenType);
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
