import { useMemo } from 'react';
import { useTrucks } from './useTrucks';

export function useTruck(truckId) {
  const { trucks, loading } = useTrucks();

  const truck = useMemo(() => trucks.find((t) => t.id === truckId), [trucks, truckId]);

  return { truck, loading };
}
