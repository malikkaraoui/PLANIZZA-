import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import CityAutocomplete from '../components/ui/CityAutocomplete';
import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { getBrowserPosition } from '../lib/geo';

const LS_WHERE = 'planizza.where';
const LS_POSITION = 'planizza.position';
const LS_CITY = 'planizza.city';

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState(''); // “Que cherchez-vous ?”
  const [where, setWhere] = useState(''); // “Où”
  const [position, setPosition] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const whereRef = useRef(null);

  useEffect(() => {
    // Restaurer la dernière localisation
    try {
      const savedWhere = localStorage.getItem(LS_WHERE) || '';
      const savedPos = localStorage.getItem(LS_POSITION);
      const savedCity = localStorage.getItem(LS_CITY);
      if (savedWhere) setWhere(savedWhere);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setPosition(parsed);
        }
      }

      if (!savedWhere && savedCity) {
        const parsedCity = JSON.parse(savedCity);
        if (parsedCity?.name) setWhere(parsedCity.name);
      }

      // Première visite (pas de lieu enregistré) => focus sur “Où” comme Planity
      if (!savedWhere && !savedPos) {
        setTimeout(() => whereRef.current?.focus?.(), 50);
      }
    } catch {
      // noop
    }
  }, []);

  const { trucks, loading } = useTrucks({ query: q, locationText: where, position });
  const topTrucks = useMemo(() => trucks.slice(0, 4), [trucks]);

  const onSubmit = (e) => {
    e.preventDefault();
    const next = q.trim();

    try {
      localStorage.setItem(LS_WHERE, where.trim());
    } catch {
      // noop
    }

    const params = new URLSearchParams();
    if (next) params.set('q', next);
    if (where.trim()) params.set('where', where.trim());
    navigate(params.toString() ? `/trucks?${params.toString()}` : '/trucks');
  };

  const enableNearMe = async () => {
    setGeoLoading(true);
    try {
      const pos = await getBrowserPosition();
      setPosition(pos);

      try {
        if (pos) localStorage.setItem(LS_POSITION, JSON.stringify(pos));
      } catch {
        // noop
      }
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <div className="bg-gray-50">
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
              Trouvez un camion pizza <span className="text-gray-700">près de vous</span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-xl">
              Recherchez un pizzaiolo, consultez le menu et commandez en retrait. Simple, rapide, propre.
            </p>

            <form onSubmit={onSubmit} className="mt-6">
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="grid gap-0 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="p-4">
                    <div className="text-xs font-semibold text-gray-500">Que cherchez-vous ?</div>
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Nom du camion, type de pizza…"
                      aria-label="Que cherchez-vous"
                      className="mt-1 border-0 px-0 py-1 focus:ring-0"
                    />
                  </div>

                  <div className="p-4 border-t sm:border-t-0 sm:border-l">
                    <div className="text-xs font-semibold text-gray-500">Où</div>
                    <div className="mt-1">
                      <CityAutocomplete
                        inputRef={whereRef}
                        value={where}
                        onChange={(next) => setWhere(next)}
                        onSelect={(city) => {
                          setWhere(city.name);

                          // On utilise la ville sélectionnée comme position (utile pour “plus proche”)
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
                        placeholder="Adresse, ville…"
                        ariaLabel="Où"
                        position={position}
                        inputClassName="border-0 px-0 py-1 focus:ring-0 text-base font-medium"
                        className=""
                      />
                    </div>
                  </div>

                  <div className="p-4 border-t sm:border-t-0 sm:border-l flex items-center">
                    <Button type="submit" className="w-full sm:w-auto">
                      Rechercher
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={enableNearMe}
                  disabled={geoLoading}
                >
                  {position ? 'Position activée' : geoLoading ? 'Localisation…' : 'Activer ma position'}
                </Button>

                {!where.trim() && !position && (
                  <p className="text-sm text-gray-600">
                    Indique ta ville (ou active ta position) pour voir les camions près de toi.
                  </p>
                )}
              </div>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/trucks">
                <Button variant="secondary">Voir tous les camions</Button>
              </Link>
              <Link to="/pizzaiolo/dashboard">
                <Button variant="outline">Je suis pizzaiolo</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-gray-700">Pourquoi PLANIZZA ?</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li>• Une expérience "Planity-like" : claire, rapide, mobile-first.</li>
              <li>• Des cartes propres avec distance et statut d’ouverture.</li>
              <li>• Un espace pizzaiolo protégé pour gérer menu et commandes.</li>
            </ul>
            <div className="mt-5">
              <Link to="/register">
                <Button className="w-full">Créer un compte pizzaiolo</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Camions près de moi</h2>
            <p className="text-gray-600">Une sélection rapide pour commander en 2 minutes.</p>
          </div>
          <Link to={q.trim() ? `/trucks?q=${encodeURIComponent(q.trim())}` : '/trucks'} className="text-sm font-semibold text-gray-700 hover:underline">
            Tout voir
          </Link>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="text-gray-600">Chargement…</div>
          ) : topTrucks.length === 0 ? (
            <div className="text-gray-600">Aucun camion pour le moment.</div>
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
