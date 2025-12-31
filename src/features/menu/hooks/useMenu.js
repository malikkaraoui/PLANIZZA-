import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../lib/firebase';

export function useMenu(truckId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!truckId) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (!db) {
      // Mode dev sans Firebase
      setItems([]);
      setLoading(false);
      return;
    }

    const menuRef = ref(db, `public/trucks/${truckId}/menu/items`);
    const unsub = onValue(menuRef, (snapshot) => {
      console.log('[PLANIZZA] useMenu - Snapshot exists:', snapshot.exists(), 'truckId:', truckId);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('[PLANIZZA] useMenu - Raw data:', data);
        
        const itemsList = Object.entries(data).map(([id, item]) => ({
          id,
          ...item,
          // Convertir les prix en centimes si nécessaire
          priceCents: item.priceCents || (item.prices?.classic || 0),
          available: item.available !== false
        }));
        
        console.log('[PLANIZZA] useMenu - Items list:', itemsList);
        setItems(itemsList);
      } else {
        console.log('[PLANIZZA] useMenu - Aucun menu trouvé pour:', truckId);
        setItems([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [truckId]);

  return { items, loading };
}
