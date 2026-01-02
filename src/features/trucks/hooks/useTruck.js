import { useMemo } from 'react';
import { useTrucks } from './useTrucks';

export function useTruck(slugOrId) {
  // Générer suffisamment de trucks pour couvrir tous les IDs possibles
  const { trucks, loading } = useTrucks({ mockCount: 100 });

  const truck = useMemo(() => {
    // Chercher d'abord par slug, puis par id pour rétrocompatibilité
    return trucks.find((t) => t.slug === slugOrId || t.id === slugOrId);
  }, [trucks, slugOrId]);

  return { truck, loading };
}
