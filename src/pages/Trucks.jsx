import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { MapPin, SlidersHorizontal, X, Search, Crosshair, Pizza } from 'lucide-react';
import TruckCard from '../features/trucks/TruckCard';
import { useTrucks } from '../features/trucks/hooks/useTrucks';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import LocationSearch from '../components/ui/LocationSearch';
import { getBrowserPosition } from '../lib/geo';
import { reverseGeocodeCommune, searchFrenchCities } from '../lib/franceCities';
import RecommendedTrucks from '../features/trucks/RecommendedTrucks';

const ALL_BADGES = ['Bio', 'Terroir', 'Sans gluten', 'Halal', 'Kasher', 'Sucré'];

export default function TrucksNew() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = useMemo(() => (searchParams.get('q') || '').trim(), [searchParams]);
  const where = useMemo(() => (searchParams.get('where') || '').trim(), [searchParams]);
  const urlLat = useMemo(() => searchParams.get('lat'), [searchParams]);
  const urlLng = useMemo(() => searchParams.get('lng'), [searchParams]);
  const hasCoordsInUrl = useMemo(() => {
    const la = urlLat != null ? Number(urlLat) : NaN;
    const lo = urlLng != null ? Number(urlLng) : NaN;
    return Number.isFinite(la) && Number.isFinite(lo);
  }, [urlLat, urlLng]);
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

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

  // Mémorise la dernière URL /explore (avec query params) pour un retour fiable depuis /truck/:id
  useEffect(() => {
    try {
      localStorage.setItem('planizza.lastExploreUrl', `${location.pathname}${location.search}`);
    } catch {
      // noop
    }
  }, [location.pathname, location.search]);

  // Synchroniser whereInput avec l'URL
  useEffect(() => {
    setWhereInput(where);
  }, [where]);

  // Hydrater la position depuis l'URL (liens partageables)
  useEffect(() => {
    if (hasCoordsInUrl) {
      const la = Number(urlLat);
      const lo = Number(urlLng);
      setPosition({ lat: la, lng: lo });
      return;
    }

    // Important UX: l'URL est la source de vérité.
    // Si on n'a pas de coords dans l'URL, on efface toute position résiduelle
    // (sinon on peut afficher une page différente avec la même URL, et le bouton
    // retour devient déroutant après un refresh).
    setPosition(null);
  }, [hasCoordsInUrl, urlLat, urlLng]);


  // Déterministe: dépend uniquement de l'URL (pas d'un state résiduel)
  const hasBaseLocation = Boolean(where || hasCoordsInUrl);

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

  const handleWhereChange = (val) => {
    setWhereInput(val);
    // On ne touche pas à 'position' ici pour éviter de déclencher 
    // un re-filtrage immédiat de useTrucks pendant que l'utilisateur tape.
  };

  const enableNearMe = async () => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const pos = await getBrowserPosition();
      if (!pos) throw new Error('GEO_EMPTY');

      // IMPORTANT : On attend le reverse geocoding AVANT de mettre à jour position et URL
      try {
        const commune = await reverseGeocodeCommune(pos);
        const name = String(commune?.name || '').trim();

        if (name) {
          // Maintenant qu'on a le nom de la ville, on peut tout mettre à jour ensemble
          setWhereInput(name);
          setPosition(pos);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('where', name);
            next.set('lat', String(pos.lat));
            next.set('lng', String(pos.lng));
            if (commune?.postcodes?.[0]) next.set('pc', String(commune.postcodes[0]));
            else next.delete('pc');
            return next;
          }, { replace: false });
        } else {
          // Pas de nom de ville, on utilise "Autour de moi"
          setWhereInput('Autour de moi');
          setPosition(pos);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('where', 'Autour de moi');
            next.set('lat', String(pos.lat));
            next.set('lng', String(pos.lng));
            next.delete('pc');
            return next;
          }, { replace: false });
        }
      } catch (geoError) {
        console.warn('Reverse geocoding failed:', geoError);
        // En cas d'erreur de reverse geocoding, on utilise quand même les coordonnées
        setWhereInput('Autour de moi');
        setPosition(pos);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('where', 'Autour de moi');
          next.set('lat', String(pos.lat));
          next.set('lng', String(pos.lng));
          next.delete('pc');
          return next;
        }, { replace: false });
      }
    } catch (error) {
      console.error('GPS error:', error);
      // Erreurs explicites pour Safari / dev server
      if (error?.code === 'GEO_INSECURE_CONTEXT') {
        const origin = error?.origin || window.location?.origin || '';
        setGeoError(
          `Localisation bloquée car la page n'est pas en HTTPS (${origin}). Ouvrez http://localhost:5173 ou utilisez HTTPS pour les tests sur IP.`
        );
      } else if (error?.code === 1) {
        // PERMISSION_DENIED
        setGeoError('Accès à la localisation refusé. Autorisez la localisation pour ce site dans Safari.');
      } else if (error?.code === 2) {
        // POSITION_UNAVAILABLE
        setGeoError('Position indisponible. Vérifiez que la localisation est activée sur macOS et que Safari est autorisé.');
      } else if (error?.code === 3) {
        // TIMEOUT
        setGeoError('Localisation trop longue à obtenir (timeout). Réessayez ou désactivez/réactivez la localisation.');
      } else {
        setGeoError('Impossible d\'accéder à votre localisation.');
      }
    } finally {
      setGeoLoading(false);
    }
  };

  const handleSearchSubmit = async (rawValue) => {
    const queryText = String(rawValue ?? whereInput ?? '').trim();

    if (!queryText) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('where');
        next.delete('lat');
        next.delete('lng');
        next.delete('pc');
        return next;
      }, { replace: false });
      setPosition(null);
      return;
    }

    // Si l'utilisateur tape explicitement "Autour de moi", on déclenche le GPS.
    if (queryText.toLowerCase().includes('autour de moi')) {
      await enableNearMe();
      return;
    }

    // Résolution API: ville/CP -> centre de commune -> tri distance fiable
    try {
      const candidates = await searchFrenchCities({ query: queryText, limit: 6 });
      const best = Array.isArray(candidates) && candidates.length ? candidates[0] : null;

      if (best?.name && typeof best.lat === 'number' && typeof best.lng === 'number') {
        setGeoError(null);
        setWhereInput(best.name);
        setPosition({ lat: best.lat, lng: best.lng });

        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('where', best.name);
          next.set('lat', String(best.lat));
          next.set('lng', String(best.lng));
          if (best?.postcodes?.[0]) next.set('pc', String(best.postcodes[0]));
          else next.delete('pc');
          return next;
        }, { replace: false });

        return;
      }
    } catch {
      // On retombe sur un filtrage texte si l'API ne répond pas
    }

    // Fallback: on conserve le texte, mais pas de position => filtrage par ville/CP
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('where', queryText);
      next.delete('lat');
      next.delete('lng');
      next.delete('pc');
      return next;
    }, { replace: false });
    setPosition(null);
  };

  const selectCity = (city) => {
    const name = String(city?.name || '').trim();
    if (!name) return;
    setGeoError(null);
    setWhereInput(name);
    const nextPos = city?.lat != null && city?.lng != null ? { lat: city.lat, lng: city.lng } : null;
    setPosition(nextPos);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('where', name);
      if (nextPos) {
        next.set('lat', String(nextPos.lat));
        next.set('lng', String(nextPos.lng));
      } else {
        next.delete('lat');
        next.delete('lng');
      }
      if (city?.postcodes?.[0]) next.set('pc', String(city.postcodes[0]));
      else next.delete('pc');
      return next;
    }, { replace: false });
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
      <div className="relative isolate min-h-[500px] lg:min-h-[calc(100vh-140px)] flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 -z-10 w-125 h-125 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 -z-10 w-100 h-100 bg-blue-500/10 rounded-full blur-[100px] animate-pulse duration-700" />

        <div className="w-full max-w-4xl space-y-12 py-20 relative overflow-visible z-30">
          <div className="glass-premium relative z-40 p-12 sm:p-20 text-center shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] border-white/30 backdrop-blur-3xl overflow-visible group">
            <div className="glass-glossy absolute inset-0 rounded-[inherit] pointer-events-none" />

            <div className="relative z-10 space-y-10">
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
                <LocationSearch
                  variant="hero"
                  value={whereInput}
                  onChange={handleWhereChange}
                  onSelect={selectCity}
                  onSearch={handleSearchSubmit}
                  onOpenChange={setSuggestionsOpen}
                  className="max-w-lg mx-auto"
                />

                <div className={`flex items-center justify-center gap-4 py-2 transition-opacity duration-200 ${suggestionsOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <div className="h-px w-12 bg-white/10" />
                  <span className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest">Ou laissez la magie opérer</span>
                  <div className="h-px w-12 bg-white/10" />
                </div>

                <Button
                  variant="ghost"
                  onClick={enableNearMe}
                  disabled={geoLoading}
                  className={`group relative h-16 w-full max-w-md rounded-2xl glass-premium border-white/30 hover:bg-white/10 text-lg font-black tracking-tight transition-all hover:scale-[1.02] active:scale-95 overflow-hidden ${suggestionsOpen ? 'opacity-0 pointer-events-none translate-y-2' : ''}`}
                >
                  <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <div className="relative flex items-center justify-center gap-3">
                    <div className={`p-2 rounded-full ${geoLoading ? 'bg-primary/20' : 'bg-primary/10 group-hover:bg-primary/20'} transition-colors`}>
                      <Crosshair className={`h-5 w-5 text-primary ${geoLoading ? 'animate-spin' : 'group-hover:rotate-90 transition-transform duration-500'}`} />
                    </div>
                    {geoLoading ? 'Localisation...' : (
                      <>
                        <span className="sm:hidden">Autour de moi</span>
                        <span className="hidden sm:inline">Utiliser ma position actuelle</span>
                      </>
                    )}
                  </div>
                </Button>

                {geoError && (
                  <p className="text-sm font-bold text-destructive animate-in fade-in slide-in-from-top-2">{geoError}</p>
                )}
              </div>
            </div>
          </div>

          <RecommendedTrucks />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8 space-y-10 sm:space-y-16">
      <div className="glass-premium p-6 sm:p-14 space-y-6 sm:space-y-10 relative z-40 overflow-visible group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />

        <div className="space-y-8 relative">
          <div className="space-y-4 text-left">
            <div className="inline-flex items-center gap-2 text-primary font-black tracking-widest text-xs uppercase opacity-80">
              <div className="w-8 h-px bg-primary/40" />
              Exploration culinaire
            </div>
            <h1 className="text-4xl font-black tracking-tighter sm:text-7xl text-premium-gradient leading-tight">
              Explorez les camions
            </h1>
            <p className="text-lg font-medium text-muted-foreground/80 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              À proximité de <span className="font-black text-foreground underline decoration-primary/30 underline-offset-4">{where}</span>
            </p>
          </div>

          {/* Barre uniforme: 2 cellules de même largeur sur desktop, empilées sur mobile */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <LocationSearch
              variant="compact"
              value={whereInput}
              onChange={handleWhereChange}
              onSelect={selectCity}
              onSearch={handleSearchSubmit}
              onOpenChange={setSuggestionsOpen}
              placeholder="Changer de lieu..."
            />

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 w-full px-8 rounded-[24px] glass-premium border-white/30 hover:bg-white/10 font-black tracking-tight gap-3 transition-all justify-center"
                >
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
      </div>

      <div className="space-y-10 relative z-0">
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
              <div key={i} className="h-112.5 rounded-3xl glass-premium animate-pulse p-6 space-y-6">
                <div className="w-full aspect-4/3 rounded-2xl bg-white/10" />
                <div className="space-y-4">
                  <div className="h-8 w-2/3 bg-white/10 rounded-lg" />
                  <div className="h-4 w-1/3 bg-white/10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : trucks.length > 0 ? (
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {trucks
              .sort((a, b) => {
                // Les camions en pause toujours en dernier
                if (a.isPaused && !b.isPaused) return 1;
                if (!a.isPaused && b.isPaused) return -1;
                return 0;
              })
              .map((truck) => (
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
