import { MapPin, Clock, ShieldCheck, Heart } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TruckHeader({ truck }) {
  const hero = Array.isArray(truck.photos) && truck.photos.length ? truck.photos[0] : null;

  return (
    <div className="relative isolate">
      {/* Background Hero with Deep Blur */}
      {hero && (
        <div className="absolute inset-0 -z-10 rounded-[40px] overflow-hidden opacity-20">
          <img src={hero} className="w-full h-full object-cover blur-3xl scale-125 saturate-200" alt="background blur" />
          <div className="absolute inset-0 bg-linear-to-b from-transparent to-background/80" />
        </div>
      )}

      <div className="p-8 sm:p-12 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
          <div className="flex items-start gap-8">
            {/* Logo Ultra-Premium */}
            <div className="relative">
              <div className="absolute -inset-2 bg-linear-to-r from-primary to-orange-500 rounded-full blur opacity-20" />
              <Avatar className="h-24 w-24 border-4 border-white/40 shadow-2xl relative">
                <AvatarImage src={truck.logoUrl} alt={truck.name} />
                <AvatarFallback className="bg-primary/5 text-primary text-3xl font-black">
                  {initials(truck.name)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="glass-premium border-white/20 rounded-full px-4 py-1.5 text-[10px] uppercase font-black tracking-[0.2em] text-primary/80">
                  {truck.tags?.[0] || 'ARTISAN'}
                </Badge>
                {truck.isOpenNow && (
                  <span className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>

              <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-premium-gradient leading-[0.9]">
                {truck.name}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2 font-bold text-muted-foreground/80">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="underline decoration-primary/20 underline-offset-4">{truck.city}</span>
                </div>
                {truck.distanceKm && (
                  <span className="text-muted-foreground/40 font-black tracking-widest">• {truck.distanceKm}KM</span>
                )}
                <div className="flex items-center gap-2 font-bold text-muted-foreground/80">
                  <Heart className="h-4 w-4 text-rose-500" />
                  <span>Coup de ❤️ local</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 h-fit pb-2">
            <Badge
              variant={truck.isOpenNow ? 'default' : 'secondary'}
              className={`${truck.isOpenNow ? 'bg-emerald-500 animate-in zoom-in-50' : 'bg-white/10'} backdrop-blur-3xl border-white/20 text-white rounded-[20px] px-8 py-4 font-black text-xs tracking-widest uppercase shadow-2xl flex gap-3`}
            >
              {truck.isOpenNow ? (
                <>
                  <Clock className="h-4 w-4" />
                  Ouvert actuellement
                </>
              ) : (
                'Fermé actuellement'
              )}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
