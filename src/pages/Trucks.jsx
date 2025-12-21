import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { getBrowserPosition } from '../lib/geo';
import CityAutocomplete from '../components/ui/CityAutocomplete';
import { reverseGeocodeCommune } from '../lib/franceCities';

const ALL_BADGES = ['Bio', 'Terroir', 'Sans gluten', 'Halal', 'Kasher', 'Sucré'];

export default function Trucks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = useMemo(() => (searchParams.get('q') || '').trim(), [searchParams]);
  const where = useMemo(() => (searchParams.get('where') || '').trim(), [searchParams]);
  const mockCount = useMemo(() => {
    const raw = searchParams.get('mock');
    const n = raw ? Number(raw) : 10;
    if (!Number.isFinite(n) || n <= 0) return 10;
    return Math.min(500, Math.max(10, Math.floor(n)));
  }, [searchParams]);

  const [whereInput, setWhereInput] = useState(where);

  const [position, setPosition] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Filtres / tri
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState('');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [sortBy, setSortBy] = useState('distance');
  const [selectedBadges, setSelectedBadges] = useState([]);

  const locationTextForFilter = position ? '' : where;
  const { trucks, loading } = useTrucks({
    query: q,
    locationText: locationTextForFilter,
    position,
    mockCount,
    filters: {
      maxDistanceKm,
      openNowOnly,
      minRating,
      sortBy,
      badges: selectedBadges,
    },
  });

  useEffect(() => {
    setWhereInput(where);
  }, [where]);

  const hasBaseLocation = Boolean(where || position);

  const toggleBadge = (badge) => {
    setSelectedBadges((prev) => {
      const set = new Set(prev);
      if (set.has(badge)) set.delete(badge);
      else set.add(badge);
      return Array.from(set);
    });
  };

  const resetFilters = () => {
    setMaxDistanceKm('');
    setOpenNowOnly(false);
    setMinRating('');
    setSortBy('distance');
    setSelectedBadges([]);
  };

  const enableNearMe = async () => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const pos = await getBrowserPosition();
      if (!pos) {
        setGeoError(
          'Impossible d’accéder à votre localisation. Autorisez la permission de localisation dans votre navigateur, puis réessayez.'
        );
        return;
      }

      setPosition(pos);

      // Déduire la commune depuis la position (API gratuite) et la refléter dans l'URL.
      try {
        const commune = await reverseGeocodeCommune(pos);
        const name = String(commune?.name || '').trim();
        if (name) {
          setWhereInput(name);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('where', name);
            return next;
          });
        } else {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('where', 'Autour de moi');
            return next;
          });
          setWhereInput('Autour de moi');
          setGeoError(
            'Localisation obtenue, mais impossible de déterminer votre commune. Les camions seront affichés par proximité.'
          );
        }
      } catch (e) {
        console.warn('[PLANIZZA] reverseGeocodeCommune error:', e);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('where', 'Autour de moi');
          return next;
        });
        setWhereInput('Autour de moi');
        setGeoError(
          'Localisation obtenue, mais impossible de déterminer votre commune. Les camions seront affichés par proximité.'
        );
      }
    } finally {
      setGeoLoading(false);
    }
  };

  const selectCity = (city) => {
    const name = String(city?.name || '').trim();
    if (!name) return;

    setGeoError(null);
    setWhereInput(name);
    setPosition(city?.lat != null && city?.lng != null ? { lat: city.lat, lng: city.lng } : null);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('where', name);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      {!hasBaseLocation ? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Où êtes-vous ?</h1>
          <div className="w-full max-w-xl">
            <CityAutocomplete
              value={whereInput}
              onChange={setWhereInput}
              onSelect={selectCity}
              placeholder="Ville, code postal…"
              ariaLabel="Rechercher une localisation"
              position={position}
              inputClassName="text-base"
            />
          </div>

          <Button variant="outline" onClick={enableNearMe} disabled={geoLoading}>
            {geoLoading ? 'Localisation…' : 'Près de moi'}
          </Button>

          {geoError && <p className="text-sm text-red-600 text-center max-w-xl">{geoError}</p>}

          <p className="text-sm text-gray-600">
            Choisissez une localisation pour voir les camions disponibles.
          </p>
        </div>
      ) : (
        <>
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

            <div className="flex flex-col gap-2 sm:items-end">
              <div className="w-full sm:w-[360px]">
                <CityAutocomplete
                  value={whereInput}
                  onChange={setWhereInput}
                  onSelect={selectCity}
                  placeholder="Changer de localisation…"
                  ariaLabel="Changer de localisation"
                  position={position}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={enableNearMe} disabled={geoLoading}>
                  {position ? 'Position activée' : geoLoading ? 'Localisation…' : 'Près de moi'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setPosition(null);
                    setWhereInput('');
                    setGeoError(null);
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete('where');
                      return next;
                    });
                  }}
                >
                  Réinitialiser
                </Button>
              </div>

              {geoError && <p className="text-sm text-red-600">{geoError}</p>}
            </div>
          </div>

          <div className="sticky top-[56px] z-10 rounded-xl border border-gray-200 bg-white/90 backdrop-blur p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)}>
                  Filtres
                </Button>

                <div className="text-sm text-gray-600">
                  {loading ? 'Chargement…' : `${trucks.length} camions`}
                  {mockCount ? <span className="text-gray-400"> {`(mock: ${mockCount})`}</span> : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Trier :</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  aria-label="Tri"
                >
                  <option value="distance">Distance</option>
                  <option value="note">Note</option>
                  <option value="popularite">Popularité</option>
                </select>
              </div>
            </div>

            {filtersOpen && (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Distance</label>
                  <select
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistanceKm(e.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Toutes</option>
                    <option value="1">&lt; 1 km</option>
                    <option value="5">&lt; 5 km</option>
                    <option value="10">&lt; 10 km</option>
                  </select>

                  <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={openNowOnly}
                      onChange={(e) => setOpenNowOnly(e.target.checked)}
                    />
                    Ouvert maintenant
                  </label>

                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-900">Note minimum</label>
                    <select
                      value={minRating}
                      onChange={(e) => setMinRating(e.target.value)}
                      className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Aucune</option>
                      <option value="4.0">≥ 4.0</option>
                      <option value="4.5">≥ 4.5</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-gray-900">Badges</label>
                    <button
                      type="button"
                      className="text-xs underline text-gray-600"
                      onClick={() => setSelectedBadges([])}
                    >
                      Effacer
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALL_BADGES.map((b) => {
                      const active = selectedBadges.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => toggleBadge(b)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                            active
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" onClick={resetFilters}>
                      Réinitialiser filtres
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set('mock', String(mockCount === 10 ? 100 : 10));
                          return next;
                        });
                      }}
                    >
                      {mockCount === 10 ? 'Tester 100 camions' : 'Revenir à 10'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-gray-600">Chargement…</div>
          ) : trucks.length === 0 ? (
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
