import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, SlidersHorizontal, X } from 'lucide-react';
import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import CityAutocomplete from '../components/ui/CityAutocomplete';
import { getBrowserPosition } from '../lib/geo';
import { reverseGeocodeCommune } from '../lib/franceCities';

const ALL_BADGES = ['Bio', 'Terroir', 'Sans gluten', 'Halal', 'Kasher', 'Sucré'];

export default function TrucksNew() {
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

  // Filtres
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
        setGeoError('Impossible d\'accéder à votre localisation.');
        return;
      }

      setPosition(pos);

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
        }
      } catch (e) {
        console.warn('[PLANIZZA] reverseGeocodeCommune error:', e);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('where', 'Autour de moi');
          return next;
        });
        setWhereInput('Autour de moi');
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

  const activeFiltersCount = [
    maxDistanceKm,
    openNowOnly,
    minRating,
    selectedBadges.length > 0,
  ].filter(Boolean).length;

  // Vue sans localisation
  if (!hasBaseLocation) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Où êtes-vous ?
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Trouvez les meilleurs camions à pizza autour de vous
            </p>
          </div>

          <Card className="w-full max-w-2xl">
            <CardContent className="pt-6 space-y-4">
              <CityAutocomplete
                value={whereInput}
                onChange={setWhereInput}
                onSelect={selectCity}
                placeholder="Ville, code postal..."
                ariaLabel="Rechercher une localisation"
                position={position}
              />

              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">OU</span>
                <Separator className="flex-1" />
              </div>

              <Button 
                variant="outline" 
                onClick={enableNearMe} 
                disabled={geoLoading}
                className="w-full"
                size="lg"
              >
                <MapPin className="mr-2 h-4 w-4" />
                {geoLoading ? 'Localisation...' : 'Utiliser ma position'}
              </Button>

              {geoError && (
                <p className="text-sm text-destructive text-center">{geoError}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Vue avec localisation
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Camions à pizza
            </h1>
            {where && (
              <p className="mt-2 text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {where}
              </p>
            )}
          </div>

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 relative">
                <SlidersHorizontal className="h-4 w-4" />
                Filtres
                {activeFiltersCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtres et tri</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Distance */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Distance max (km)</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 10"
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistanceKm(e.target.value)}
                  />
                </div>

                {/* Note minimale */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note minimale</label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    placeholder="Ex: 4"
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                  />
                </div>

                {/* Ouvert maintenant */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="openNow"
                    checked={openNowOnly}
                    onChange={(e) => setOpenNowOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="openNow" className="text-sm font-medium cursor-pointer">
                    Ouvert maintenant
                  </label>
                </div>

                <Separator />

                {/* Badges */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Spécialités</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_BADGES.map((badge) => (
                      <Badge
                        key={badge}
                        variant={selectedBadges.includes(badge) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleBadge(badge)}
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Tri */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Trier par</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="distance">Distance</option>
                    <option value="rating">Note</option>
                    <option value="popularity">Popularité</option>
                  </select>
                </div>

                {/* Reset */}
                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Barre de recherche localisation */}
        <div className="max-w-md">
          <CityAutocomplete
            value={whereInput}
            onChange={setWhereInput}
            onSelect={selectCity}
            placeholder="Changer de localisation..."
            ariaLabel="Changer de localisation"
            position={position}
          />
        </div>
      </div>

      {/* Liste des camions */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : trucks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg text-muted-foreground">
              Aucun camion trouvé pour cette localisation
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Essayez d'élargir vos critères de recherche
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trucks.map((truck) => (
            <TruckCard key={truck.id} truck={truck} />
          ))}
        </div>
      )}
    </div>
  );
}
