import { useEffect, useState } from 'react';

// MVP: menu mocké par camion
const MOCK_MENU = {
  'truck-1': [
    { id: 'm1', name: 'Margherita', priceCents: 900, available: true },
    { id: 'm2', name: 'Diavola', priceCents: 1190, available: true },
    { id: 'm3', name: 'Quatre Fromages', priceCents: 1290, available: false },
  ],
  'truck-2': [
    { id: 'm4', name: 'Reine', priceCents: 1190, available: true },
    { id: 'm5', name: 'Végétarienne', priceCents: 1250, available: true },
  ],
};

function makeMargherita(truckId) {
  return {
    id: `${truckId}-margherita`,
    name: 'Margherita',
    priceCents: 900,
    available: true,
  };
}

function withMargherita(truckId, items) {
  const base = Array.isArray(items) ? items : [];
  const withoutExisting = base.filter(
    (it) => String(it?.name || '').trim().toLowerCase() !== 'margherita'
  );
  return [makeMargherita(truckId), ...withoutExisting];
}

export function useMenu(truckId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: brancher Firebase
    const t = setTimeout(() => {
      setItems(withMargherita(truckId, MOCK_MENU[truckId] || []));
      setLoading(false);
    }, 150);

    return () => clearTimeout(t);
  }, [truckId]);

  return { items, loading };
}
