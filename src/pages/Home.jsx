import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import LocationSearch from '../components/ui/LocationSearch';
import BackButton from '../components/ui/BackButton';
import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { searchFrenchCities } from '../lib/franceCities';

const LS_WHERE = 'planizza.where';
const LS_POSITION = 'planizza.position';
const LS_CITY = 'planizza.city';

export default function Home() {
  const navigate = useNavigate();
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

  const submitWhere = async (whereText) => {
    const queryText = String(whereText || '').trim();
    // "Valider ma localisation" => on mémorise puis on affiche la liste.
    if (!queryText) {
      whereRef.current?.focus?.();
      return;
    }

    // Si la recherche est déclenchée depuis l'autocomplete (Enter), on s'aligne sur la valeur saisie.
    if (queryText !== where) setWhere(queryText);

    try {
      localStorage.setItem(LS_WHERE, queryText);
    } catch {
      // noop
    }

    // URL partageable: on préfère une position (centre de commune) si on peut la déduire.
    let nextWhere = queryText;
    let nextPos = position;
    let nextPc = null;

    if (!nextPos) {
      try {
        const candidates = await searchFrenchCities({ query: queryText, limit: 6 });
        const best = Array.isArray(candidates) && candidates.length ? candidates[0] : null;
        if (best?.name && typeof best.lat === 'number' && typeof best.lng === 'number') {
          nextWhere = best.name;
          nextPos = { lat: best.lat, lng: best.lng };
          nextPc = best?.postcodes?.[0] ? String(best.postcodes[0]) : null;

          setWhere(best.name);
          setPosition(nextPos);
          try {
            localStorage.setItem(LS_POSITION, JSON.stringify(nextPos));
            localStorage.setItem(LS_WHERE, best.name);
            localStorage.setItem(LS_CITY, JSON.stringify(best));
          } catch {
            // noop
          }
        }
      } catch {
        // noop (fallback sur texte)
      }
    } else {
      // On essaie de conserver un code postal si on a un city en cache
      try {
        const savedCity = localStorage.getItem(LS_CITY);
        if (savedCity) {
          const parsedCity = JSON.parse(savedCity);
          if (parsedCity?.postcodes?.[0]) nextPc = String(parsedCity.postcodes[0]);
        }
      } catch {
        // noop
      }
    }

    const params = new URLSearchParams();
    if (nextWhere) params.set('where', nextWhere);
    if (nextPos?.lat != null && nextPos?.lng != null) {
      params.set('lat', String(nextPos.lat));
      params.set('lng', String(nextPos.lng));
    }
    if (nextPc) params.set('pc', String(nextPc));

    navigate(`/explore?${params.toString()}`);
  };

  const onSubmit = (e) => {
    e?.preventDefault?.();
    return submitWhere(where);
  };

  return (
    <div className="bg-gray-50">
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-6 sm:pt-14 sm:pb-10">
        <BackButton className="mb-6" />
        <div className="text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
            Commandez votre pizza
          </h1>

          <div className="mt-12 mx-auto max-w-2xl">
            <LocationSearch
              variant="hero"
              value={where}
              onChange={setWhere}
              onSearch={submitWhere}
              placeholder="Où voulez-vous manger ?"
              inputRef={whereRef}
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
            />
          </div>
          <Button
            onClick={onSubmit}
            className="mt-6 w-full h-16 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            C'est parti !
          </Button>
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
