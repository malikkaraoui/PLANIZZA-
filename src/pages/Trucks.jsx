import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, SlidersHorizontal, X, Search, Crosshair, Pizza } from 'lucide-react';
import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
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
    const n = raw ? Number(raw) : 50; // Augmenté de 10 à 50 pour couvrir plus de villes
    if (!Number.isFinite(n) || n <= 0) return 50;
    return Math.min(500, Math.max(10, Math.floor(n)));
  }, [searchParams]);

  const [whereInput, setWhereInput] = useState(where);
  const [position, setPosition] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Filtres - Restaurer depuis localStorage au montage
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState(() => {
    return localStorage.getItem('planizza_filter_distance') || '';
  });
  const [openNowOnly, setOpenNowOnly] = useState(() => {
    return localStorage.getItem('planizza_filter_openNow') === 'true';
  });
  const [minRating, setMinRating] = useState(() => {
    return localStorage.getItem('planizza_filter_rating') || '';
  });
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('planizza_filter_sort') || 'distance';
  });
  const [selectedBadges, setSelectedBadges] = useState(() => {
    const saved = localStorage.getItem('planizza_filter_badges');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedOvenTypes, setSelectedOvenTypes] = useState(() => {
    const saved = localStorage.getItem('planizza_filter_ovens');
    return saved ? JSON.parse(saved) : [];
  });

  // Sauvegarder les filtres dans localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem('planizza_filter_distance', maxDistanceKm);
  }, [maxDistanceKm]);

  useEffect(() => {
    localStorage.setItem('planizza_filter_openNow', openNowOnly);
  }, [openNowOnly]);

  useEffect(() => {
    localStorage.setItem('planizza_filter_rating', minRating);
  }, [minRating]);

  useEffect(() => {
    localStorage.setItem('planizza_filter_sort', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('planizza_filter_badges', JSON.stringify(selectedBadges));
  }, [selectedBadges]);

  useEffect(() => {
    localStorage.setItem('planizza_filter_ovens', JSON.stringify(selectedOvenTypes));
  }, [selectedOvenTypes]);

  const { trucks, loading } = useTrucks({
    query: q,
    locationText: where,
    position,
    mockCount,
    filters: {
      maxDistanceKm,
      openNowOnly,
      minRating,
      sortBy,
      badges: selectedBadges,
      ovenTypes: selectedOvenTypes,
    },
  });

  // Synchroniser whereInput avec l'URL
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

  const toggleOvenType = (type) => {
    setSelectedOvenTypes((prev) => {
      const set = new Set(prev);
      if (set.has(type)) set.delete(type);
      else set.add(type);
      return Array.from(set);
    });
  };

  const resetFilters = () => {
    setMaxDistanceKm('');
    setOpenNowOnly(false);
    setMinRating('');
    setSortBy('distance');
    setSelectedBadges([]);
    setSelectedOvenTypes([]);
    // Nettoyer également le localStorage
    localStorage.removeItem('planizza_filter_distance');
    localStorage.removeItem('planizza_filter_openNow');
    localStorage.removeItem('planizza_filter_rating');
    localStorage.removeItem('planizza_filter_sort');
    localStorage.removeItem('planizza_filter_badges');
    localStorage.removeItem('planizza_filter_ovens');
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
        }
      } catch (e) {
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
    selectedOvenTypes.length > 0,
  ].filter(Boolean).length;

  if (!hasBaseLocation) {
    return (
      <div className="relative isolate min-h-[calc(100vh-140px)] flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 -z-10 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 -z-10 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse duration-700" />

        <div className="w-full max-w-4xl space-y-12 py-20 relative">
          <div className="glass-premium glass-glossy p-12 sm:p-20 text-center space-y-10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] border-white/30 backdrop-blur-3xl">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-premium border-white/40 text-xs font-black tracking-widest uppercase text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Le futur de la pizza est ici
              </div>
              <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-premium-gradient animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                Où êtes-vous ?
              </h1>
              <p className="mx-auto max-w-2xl text-lg sm:text-xl font-medium text-muted-foreground/80 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                Découvrez les camions à pizza les plus futuristes et gourmands de votre ville.
                Une expérience culinaire hors du commun.
              </p>
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
              <div className="relative group max-w-lg mx-auto text-left">
                <div className="absolute -inset-1 bg-linear-to-r from-primary to-orange-500 rounded-[32px] blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
                <div className="relative flex items-center h-20 px-6 rounded-[28px] glass-deep border-white/40 focus-within:border-primary/50 transition-all shadow-xl backdrop-blur-3xl">
                  <MapPin className="h-6 w-6 text-primary flex-shrink-0" />
                  <CityAutocomplete
                    value={whereInput}
                    onChange={setWhereInput}
                    onSelect={selectCity}
                    placeholder="Entrez une ville ou un code postal..."
                    className="flex-1 ml-4"
                    inputClassName="h-full text-xl font-bold tracking-tight text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 py-2">
                <div className="h-px w-12 bg-white/10" />
                <span className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest">Ou laissez la magie opérer</span>
                <div className="h-px w-12 bg-white/10" />
              </div>

              <Button
                variant="ghost"
                onClick={enableNearMe}
                disabled={geoLoading}
                className="group relative h-16 w-full max-w-md rounded-2xl glass-premium border-white/30 hover:bg-white/10 text-lg font-black tracking-tight transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <div className="relative flex items-center justify-center gap-3">
                  <div className={`p-2 rounded-full ${geoLoading ? 'bg-primary/20' : 'bg-primary/10 group-hover:bg-primary/20'} transition-colors`}>
                    <Crosshair className={`h-5 w-5 text-primary ${geoLoading ? 'animate-spin' : 'group-hover:rotate-90 transition-transform duration-500'}`} />
                  </div>
                  {geoLoading ? 'Localisation...' : 'Utiliser ma position actuelle'}
                </div>
              </Button>

              {geoError && (
                <p className="text-sm font-bold text-destructive animate-in fade-in slide-in-from-top-2">{geoError}</p>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-8 opacity-40 hover:opacity-100 transition-opacity duration-700 cursor-default grayscale hover:grayscale-0">
            <div className="w-24 h-24 glass-premium p-3">
              <img src="/Users/malik/.gemini/antigravity/brain/4667bdcc-f6c3-4a13-a6c5-008352cbb39e/modern_glass_pizza_truck_1_1766418239603.png" className="w-full h-full object-contain" alt="Camion 1" />
            </div>
            <div className="w-24 h-24 glass-premium p-3">
              <img src="/Users/malik/.gemini/antigravity/brain/4667bdcc-f6c3-4a13-a6c5-008352cbb39e/modern_glass_pizza_truck_2_1766418252608.png" className="w-full h-full object-contain" alt="Camion 2" />
            </div>
            <div className="w-24 h-24 glass-premium p-3">
              <img src="/Users/malik/.gemini/antigravity/brain/4667bdcc-f6c3-4a13-a6c5-008352cbb39e/modern_glass_pizza_truck_3_1766418271033.png" className="w-full h-full object-contain" alt="Camion 3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
      <div className="glass-premium p-10 sm:p-14 space-y-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />

        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between relative">
          <div className="space-y-4 text-left">
            <div className="inline-flex items-center gap-2 text-primary font-black tracking-widest text-xs uppercase opacity-80">
              <div className="w-8 h-px bg-primary/40" />
              Exploration culinaire
            </div>
            <h1 className="text-5xl font-black tracking-tighter sm:text-7xl text-premium-gradient leading-tight">
              Explorez les camions
            </h1>
            <p className="text-lg font-medium text-muted-foreground/80 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              À proximité de <span className="font-black text-foreground underline decoration-primary/30 underline-offset-4">{where}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" className="h-14 px-8 rounded-2xl glass-premium border-white/30 hover:bg-white/10 font-black tracking-tight gap-3 transition-all">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Affiner ma recherche
                  {activeFiltersCount > 0 && (
                    <Badge variant="default" className="ml-2 h-6 min-w-6 bg-primary font-black animate-in zoom-in">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="glass-premium border-l-white/20 sm:max-w-md p-0 overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="p-6 space-y-1 border-b border-white/10">
                    <SheetTitle className="text-2xl font-black tracking-tighter">Filtres</SheetTitle>
                    <p className="text-sm text-muted-foreground font-medium">Personnalisez votre expérience</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Note Minimum</label>
                      <div className="glass-deep rounded-2xl p-2 px-1">
                        <select
                          value={minRating}
                          onChange={(e) => setMinRating(e.target.value)}
                          className="w-full bg-transparent border-none outline-none px-3 h-10 font-bold text-sm cursor-pointer"
                        >
                          <option value="">Toutes les notes</option>
                          <option value="3">3.0+</option>
                          <option value="4">4.0+</option>
                          <option value="4.5">4.5+</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl glass shadow-sm">
                      <label htmlFor="openNow" className="text-sm font-bold cursor-pointer">
                        Ouvert maintenant
                      </label>
                      <input
                        type="checkbox"
                        id="openNow"
                        checked={openNowOnly}
                        onChange={(e) => setOpenNowOnly(e.target.checked)}
                        className="h-6 w-6 rounded-lg accent-primary border-white/40"
                      />
                    </div>

                    <Separator className="bg-white/10 my-4" />

                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Préférences</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_BADGES.map((badge) => (
                          <Badge
                            key={badge}
                            variant={selectedBadges.includes(badge) ? 'default' : 'outline'}
                            className={`cursor-pointer px-3 py-1.5 rounded-xl border-white/40 transition-all text-sm ${selectedBadges.includes(badge)
                              ? 'bg-primary text-white scale-105 shadow-md shadow-primary/20'
                              : 'glass hover:bg-white/40'
                              }`}
                            onClick={() => toggleBadge(badge)}
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-white/10 my-4" />

                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Type de four</label>
                      <div className="flex flex-wrap gap-2">
                        {['Bois', 'Gaz', 'Électrique'].map((type) => (
                          <Badge
                            key={type}
                            variant={selectedOvenTypes.includes(type) ? 'default' : 'outline'}
                            className={`cursor-pointer px-3 py-1.5 rounded-xl border-white/40 transition-all text-sm ${selectedOvenTypes.includes(type)
                              ? 'bg-primary text-white scale-105 shadow-md shadow-primary/20'
                              : 'glass hover:bg-white/40'
                              }`}
                            onClick={() => toggleOvenType(type)}
                          >
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator className="bg-white/10 my-4" />

                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Organiser par</label>
                      <div className="glass-deep rounded-2xl p-2 px-1">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full bg-transparent border-none outline-none px-3 h-10 font-bold text-sm cursor-pointer"
                        >
                          <option value="distance">Distance la plus courte</option>
                          <option value="rating">Meilleures notes</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-white/10 space-y-3">
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        onClick={resetFilters}
                        className="w-full h-12 rounded-2xl glass text-destructive hover:bg-destructive/10 font-bold border-destructive/20 text-sm"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Tout réinitialiser
                      </Button>
                    )}
                    <Button
                      onClick={() => setFiltersOpen(false)}
                      className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Search className="mr-2 h-5 w-5" />
                      Rechercher ({trucks.length})
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="relative group max-w-2xl text-left">
          <div className="absolute -inset-1 bg-linear-to-r from-primary to-orange-500 rounded-[28px] blur opacity-5 group-hover:opacity-15 transition duration-1000" />
          <div className="relative flex items-center h-16 px-5 rounded-[24px] glass-deep border-white/30 focus-within:border-primary/40 transition-all shadow-lg">
            <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
            <CityAutocomplete
              value={whereInput}
              onChange={setWhereInput}
              onSelect={selectCity}
              placeholder="Changer de lieu..."
              className="flex-1 ml-3"
              inputClassName="h-full text-lg font-bold tracking-tight text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3 opacity-90">
            <div className="w-2 h-10 bg-primary/20 rounded-full" />
            Résultats trouvés
            <span className="text-muted-foreground/40 font-bold ml-2">({trucks.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[450px] rounded-3xl glass-premium animate-pulse p-6 space-y-6">
                <div className="w-full aspect-[4/3] rounded-2xl bg-white/10" />
                <div className="space-y-4">
                  <div className="h-8 w-2/3 bg-white/10 rounded-lg" />
                  <div className="h-4 w-1/3 bg-white/10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : trucks.length > 0 ? (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {trucks.map((truck) => (
              <TruckCard key={truck.id} truck={truck} />
            ))}
          </div>
        ) : (
          <Card className="glass-premium p-24 text-center rounded-[48px] space-y-6 border-white/10 animate-in fade-in zoom-in">
            <CardContent className="space-y-6">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Search className="h-12 w-12 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tighter">Oups, aucun camion ici</h3>
                <p className="mx-auto max-w-md text-muted-foreground font-medium text-lg">
                  Essayez d'élargir votre zone de recherche ou de modifier vos filtres.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={resetFilters}
                className="mt-6 rounded-2xl glass-premium px-10 h-14 font-black transition-all hover:scale-105 active:scale-95"
              >
                Réinitialiser les filtres
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
