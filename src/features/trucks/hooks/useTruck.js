import { useMemo } from 'react';
import { useTrucks } from './useTrucks';

export function useTruck(truckId) {
  // Générer suffisamment de trucks pour couvrir tous les IDs possibles
  const { trucks, loading } = useTrucks({ mockCount: 100 });

  const truck = useMemo(() => trucks.find((t) => t.id === truckId), [trucks, truckId]);

  return { truck, loading };
}
