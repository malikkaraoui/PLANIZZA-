import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import CityAutocomplete from '../components/ui/CityAutocomplete';
import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';

const LS_WHERE = 'planizza.where';
const LS_POSITION = 'planizza.position';
const LS_CITY = 'planizza.city';

export default function Home() {
  const [where, setWhere] = useState(() => {
    // Restaurer la dernière localisation (sans setState dans un effect)
    try {
      const savedWhere = localStorage.getItem(LS_WHERE) || '';
      if (savedWhere) return savedWhere;

      const savedCity = localStorage.getItem(LS_CITY);
      if (savedCity) {
        const parsedCity = JSON.parse(savedCity);
        if (parsedCity?.name) return parsedCity.name;
      }
    } catch {
      // noop
    }
    return '';
  });

  const [position, setPosition] = useState(() => {
    try {
      const savedPos = localStorage.getItem(LS_POSITION);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return parsed;
      }

      // Fallback: si une ville est enregistrée, on réutilise son centre
      const savedCity = localStorage.getItem(LS_CITY);
      if (savedCity) {
        const parsedCity = JSON.parse(savedCity);
        if (typeof parsedCity?.lat === 'number' && typeof parsedCity?.lng === 'number') {
          return { lat: parsedCity.lat, lng: parsedCity.lng };
        }
      }
    } catch {
      // noop
    }
    return null;
  });

  const whereRef = useRef(null);
  const didAutofocusRef = useRef(false);

  useEffect(() => {
    // Première visite => focus sur “Où” comme Planity
    if (didAutofocusRef.current) return;
    if (!where && !position) {
      didAutofocusRef.current = true;
      setTimeout(() => whereRef.current?.focus?.(), 50);
    }
  }, [where, position]);

  // On affiche les 2 camions mock en dessous (toujours), triés par proximité si on a une position.
  const { trucks, loading } = useTrucks({ locationText: where, position });
  const topTrucks = useMemo(() => trucks.slice(0, 2), [trucks]);

  const onSubmit = (e) => {
    e.preventDefault();
    // "Valider ma localisation" => on mémorise puis on affiche la liste.
    if (!where.trim()) {
      whereRef.current?.focus?.();
      return;
    }

    try {
      localStorage.setItem(LS_WHERE, where.trim());
    } catch {
      // noop
    }
  };

  return (
    <div className="bg-gray-50">
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
            Commandez votre pizza
          </h1>

          <form onSubmit={onSubmit} className="mt-8 mx-auto max-w-3xl text-left">
            <div className="text-sm font-semibold text-gray-800">Où</div>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="submit" className="sm:w-auto">
                Recherche
              </Button>

              <div className="flex-1">
                <CityAutocomplete
                  inputRef={whereRef}
                  value={where}
                  onChange={(next) => setWhere(next)}
                  onSelect={(city) => {
                    setWhere(city.name);

                    if (typeof city.lat === 'number' && typeof city.lng === 'number') {
                      const pos = { lat: city.lat, lng: city.lng };
                      setPosition(pos);
                      try {
                        localStorage.setItem(LS_POSITION, JSON.stringify(pos));
                      } catch {
                        // noop
                      }
                    }

                    try {
                      localStorage.setItem(LS_WHERE, city.name);
                      localStorage.setItem(LS_CITY, JSON.stringify(city));
                    } catch {
                      // noop
                    }
                  }}
                  placeholder="Adresse, ville...."
                  ariaLabel="Où"
                  position={position}
                  inputClassName="text-base placeholder:font-bold placeholder:text-gray-900"
                />
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="mt-2">
          {loading ? (
            <div className="text-gray-600">Chargement…</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {topTrucks.map((t) => (
                <TruckCard key={t.id} truck={t} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
