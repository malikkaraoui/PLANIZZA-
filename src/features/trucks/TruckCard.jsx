import { Link } from 'react-router-dom';
import { MapPin, Star, Clock, Pizza } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { ROUTES } from '../../app/routes';
import { isCurrentlyOpen, getOpeningStatusText } from '../../lib/openingHours';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatKm(km) {
  if (typeof km !== 'number' || Number.isNaN(km)) return null;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function TruckCard({ truck }) {
  const hero = Array.isArray(truck.photos) && truck.photos.length ? truck.photos[0] : null;
  const href = ROUTES.truck(truck.id);
  const kmText = formatKm(truck.distanceKm);
  const ratingAvg = typeof truck.ratingAvg === 'number' ? truck.ratingAvg : 0;
  const ratingCount = typeof truck.ratingCount === 'number' ? truck.ratingCount : 0;
  const badges = truck.badges || truck.tags || [];
  const isPaused = truck.isPaused === true;
  
  // Calculer dynamiquement si le camion est ouvert
  const isOpen = isCurrentlyOpen(truck.openingHours);
  const statusText = getOpeningStatusText(truck.openingHours);

  return (
    <Card className={`group glass-premium glass-glossy overflow-hidden border-white/30 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] ${isPaused ? 'opacity-60 blur-[0.5px] backdrop-blur-xl' : ''}`}>
      {/* Image d'en-tête */}
      <Link to={href} className="relative block aspect-[16/10] overflow-hidden">
        {hero ? (
          <img
            src={hero}
            alt={`Photo de ${truck.name}`}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/10 to-orange-500/5">
            <Pizza className="h-12 w-12 text-primary/20 animate-pulse" />
          </div>
        )}

        {/* Overlay gradient & Reflection */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <Badge
            variant={isOpen ? 'default' : 'secondary'}
            className={`${isOpen ? 'bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10'} backdrop-blur-xl border-white/20 text-white font-black tracking-tight`}
          >
            <div className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
            {isOpen ? 'OUVERT' : 'FERMÉ'}
          </Badge>
        </div>

        {/* Distance Badge */}
        {kmText && (
          <div className="absolute bottom-4 left-4 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
            <Badge className="bg-white/10 backdrop-blur-xl border-white/20 text-white font-bold">
              <MapPin className="mr-1.5 h-3 w-3 text-primary" />
              {kmText}
            </Badge>
          </div>
        )}

        {/* Quick view button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="px-6 py-3 rounded-2xl glass-premium border-white/40 text-sm font-black text-white transform scale-90 group-hover:scale-100 transition-transform duration-500 cursor-pointer">
            VOIR LE MENU
          </div>
        </div>
      </Link>

      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-start gap-5">
          {/* Logo Premium */}
          <div className="relative">
            <div className="absolute -inset-1 bg-linear-to-r from-primary to-orange-500 rounded-full blur opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
            <Avatar className="h-14 w-14 border-2 border-white/40 shadow-2xl relative">
              <AvatarImage src={truck.logoUrl} alt={truck.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
                {initials(truck.name)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-black tracking-tighter truncate group-hover:text-premium-gradient transition-all duration-300">
                <Link to={href}>
                  {truck.name}
                </Link>
              </CardTitle>
              {isPaused && (
                <Badge variant="secondary" className="text-xs font-bold">
                  En pause
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground/60 font-medium text-sm">
              <Clock className="h-3 w-3" />
              <span className="truncate">{statusText}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-6 px-6 space-y-6">
        {/* Note avec barre "Liquid" */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="font-black">{ratingAvg.toFixed(1)}</span>
              <span className="text-muted-foreground/40 font-bold">({ratingCount} avis)</span>
            </div>
            {truck.highlights && truck.highlights[0] && (
              <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-60">
                {truck.highlights[0]}
              </span>
            )}
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000 delay-300"
              style={{ width: `${(ratingAvg / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Badges refined */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.slice(0, 3).map((badge) => (
              <Badge
                key={badge}
                variant="outline"
                className="text-[9px] px-2.5 py-0.5 border-white/20 bg-white/5 backdrop-blur-md font-black tracking-widest uppercase text-muted-foreground/80 group-hover:border-primary/30 group-hover:text-primary transition-colors"
              >
                {badge}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 px-6 pb-6">
        <Link to={href} className="w-full">
          <Button className="w-full h-14 rounded-2xl bg-linear-to-r from-primary to-orange-500 shadow-xl shadow-primary/10 hover:shadow-primary/30 transition-all font-black text-sm tracking-widest" variant="default">
            EXPLORER LE CAMION
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
