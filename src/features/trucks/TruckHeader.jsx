import { MapPin, Clock, Star, Pause } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { FavoriteButton } from '../../components/ui/FavoriteButton';
import { isCurrentlyOpen, getOpeningStatusText } from '../../lib/openingHours';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TruckHeader({ truck }) {
  const hero = Array.isArray(truck.photos) && truck.photos.length ? truck.photos[0] : null;
  const rating = typeof truck.ratingAvg === 'number' ? truck.ratingAvg : null;
  const ratingCount = typeof truck.ratingCount === 'number' ? truck.ratingCount : null;
  const etaMin = typeof truck.estimatedPrepMin === 'number' ? truck.estimatedPrepMin : null;
  const isPaused = truck.isPaused === true;
  
  // Calculer dynamiquement si le camion est ouvert
  const isOpen = isCurrentlyOpen(truck.openingHours);
  const statusText = getOpeningStatusText(truck.openingHours);

  return (
    <div className="relative isolate overflow-hidden rounded-4xl">
      {/* Photo derrière le texte (liquid glass) */}
      {hero && (
        <img
          src={hero}
          alt={`Photo de ${truck.name}`}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      {/* Overlays pour lisibilité + effet glass */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/55 via-black/25 to-background/85" />
      <div className="absolute inset-0 -z-10 backdrop-blur-[2px]" />
      <div className="absolute -top-10 -right-10 -z-10 h-40 w-40 bg-primary/20 blur-3xl" />

      <div className="glass-premium glass-glossy border-white/25 rounded-4xl p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex items-start gap-5 min-w-0">
              {/* Logo */}
              <div className="relative shrink-0">
                <div className="absolute -inset-2 bg-linear-to-r from-primary to-orange-500 rounded-full blur opacity-25" />
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-white/40 shadow-2xl relative">
                  <AvatarImage src={truck.logoUrl} alt={truck.name} />
                  <AvatarFallback className="bg-primary/5 text-primary text-xl sm:text-2xl font-black">
                    {initials(truck.name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className="glass-premium border-white/25 rounded-full px-4 py-1.5 text-[10px] uppercase font-black tracking-[0.2em] text-white/90"
                  >
                    {truck.tags?.[0] || 'ARTISAN'}
                  </Badge>
                  {isPaused ? (
                    <Badge
                      variant="secondary"
                      className="bg-amber-500/90 hover:bg-amber-500 text-white border-amber-400/50 rounded-full px-4 py-1.5 text-[10px] uppercase font-black tracking-[0.2em] animate-pulse"
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      EN PAUSE
                    </Badge>
                  ) : isOpen && (
                    <span className="flex items-center gap-2 text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                      <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-5xl font-black tracking-tighter leading-none truncate text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                  {truck.name}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <div className="flex items-center gap-2 font-bold text-white/80">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="underline decoration-primary/30 underline-offset-4">{statusText}</span>
                  </div>
                  {truck.distanceKm != null && (
                    <span className="text-white/45 font-black tracking-widest">• {truck.distanceKm}KM</span>
                  )}
                  {rating != null && (
                    <div className="flex items-center gap-2 font-black text-white/80">
                      <Star className="h-4 w-4 text-amber-300" />
                      <span className="text-white/90">{rating.toFixed(1)}</span>
                      {ratingCount != null && (
                        <span className="text-white/50 font-bold">({ratingCount})</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <FavoriteButton truckId={truck.id} truckName={truck.name} size="sm" />
                    <span className="font-bold text-white/70 whitespace-nowrap">Favoris</span>
                  </div>
                  {etaMin != null && (
                    <div className="flex items-center gap-2 font-black text-white/70">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="whitespace-nowrap">~{Math.round(etaMin)} min</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          <div className="flex items-start justify-start md:justify-end">
            <Badge
              variant={isOpen ? 'default' : 'secondary'}
              className={`${isOpen ? 'bg-emerald-500/85 animate-in zoom-in-50' : 'bg-white/10'} backdrop-blur-3xl border-white/25 text-white rounded-full px-5 py-2.5 font-black text-[11px] tracking-widest uppercase shadow-xl flex gap-2`}
              title={!isOpen ? statusText : undefined}
            >
              <Clock className="h-4 w-4" />
              {isOpen ? 'Ouvert' : 'Fermé'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
