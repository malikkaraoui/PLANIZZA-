import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { getBrowserPosition } from '../lib/geo';

export default function Trucks() {
  const [searchParams] = useSearchParams();
  const q = useMemo(() => (searchParams.get('q') || '').trim(), [searchParams]);
  const where = useMemo(() => (searchParams.get('where') || '').trim(), [searchParams]);

  const [position, setPosition] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const { trucks, loading } = useTrucks({ query: q, locationText: where, position });

  const enableNearMe = async () => {
    setGeoLoading(true);
    try {
      const pos = await getBrowserPosition();
      setPosition(pos);
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Camions</h1>
          <p className="text-gray-600">Trouvez un pizzaiolo, consultez le menu, commandez en retrait.</p>
          {q && (
            <p className="mt-1 text-sm text-gray-500">
              Résultats pour <span className="font-semibold text-gray-700">“{q}”</span>
            </p>
          )}
          {where && (
            <p className="mt-1 text-sm text-gray-500">
              Localisation : <span className="font-semibold text-gray-700">“{where}”</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={enableNearMe} disabled={geoLoading}>
            {position ? 'Position activée' : geoLoading ? 'Localisation…' : 'Près de moi'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Chargement…</div>
      ) : (
        <>
          {trucks.length === 0 ? (
            <div className="text-gray-600">Aucun camion trouvé.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {trucks.map((t) => (
                <TruckCard key={t.id} truck={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
