import { useEffect, useState } from 'react';
import { kmBetween } from '../../../lib/geo';

// MVP: données mockées — à remplacer par Firestore/RTDB
const MOCK_TRUCKS = [
  {
    id: 'truck-1',
    name: 'Pizza Mamma Mia',
    city: 'Lyon',
    location: { lat: 45.764, lng: 4.8357 },
    distanceKm: 1.2, // fallback si pas de position
    openingToday: '18:00–22:30',
    isOpenNow: true,
    tags: ['Napolitaine', 'Bois'],
    logoUrl: null,
    photos: [
      'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=1200&q=60',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=60',
    ],
  },
  {
    id: 'truck-2',
    name: 'La Partenza',
    city: 'Villeurbanne',
    location: { lat: 45.7719, lng: 4.8902 },
    distanceKm: 3.8, // fallback si pas de position
    openingToday: '19:00–23:00',
    isOpenNow: false,
    tags: ['Classiques'],
    logoUrl: null,
    photos: [
      'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=1200&q=60',
      'https://images.unsplash.com/photo-1604908554007-2d1bd3c8b536?auto=format&fit=crop&w=1200&q=60',
    ],
  },
];

export function useTrucks(options = {}) {
  const query = (options.query || '').trim().toLowerCase();
  const locationText = (options.locationText || '').trim().toLowerCase();
  const position = options.position || null;

  const [baseTrucks, setBaseTrucks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: brancher Firebase
    const t = setTimeout(() => {
      setBaseTrucks(MOCK_TRUCKS);
      setLoading(false);
    }, 200);

    return () => clearTimeout(t);
  }, []);

  const trucks = baseTrucks
    .map((t) => {
      const km = position ? kmBetween(position, t.location) : null;
      const distanceKm = km == null ? t.distanceKm : Math.round(km * 10) / 10;
      return { ...t, distanceKm };
    })
    .filter((t) => {
      if (!query) return true;
      const hay = `${t.name} ${t.city} ${(t.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(query);
    })
    .filter((t) => {
      // Filtre "Où" (ville/adresse) : MVP => on matche uniquement la ville
      if (!locationText) return true;
      return String(t.city || '').toLowerCase().includes(locationText);
    })
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return { trucks, loading };
}
