import { Link } from 'react-router-dom';
import { MapPin, Star, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { ROUTES } from '../../app/routes';

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
  const ratingAvg = typeof truck.ratingAvg === 'number' ? truck.ratingAvg.toFixed(1) : null;
  const ratingCount = typeof truck.ratingCount === 'number' ? truck.ratingCount : null;
  const badges = truck.badges || truck.tags || [];

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      {/* Image d'en-tête */}
      <Link to={href} className="relative block aspect-4/3 overflow-hidden bg-muted">
        {hero ? (
          <img
            src={hero}
            alt={`Photo de ${truck.name}`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/10 to-primary/5">
            <span className="text-6xl">🍕</span>
          </div>
        )}

        {/* Badge ouvert/fermé */}
        <div className="absolute top-3 right-3">
          <Badge 
            variant={truck.isOpenNow ? 'default' : 'secondary'}
            className={truck.isOpenNow ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
          >
            <Clock className="mr-1 h-3 w-3" />
            {truck.isOpenNow ? 'Ouvert' : 'Fermé'}
          </Badge>
        </div>
      </Link>

      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Logo */}
          <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
            <AvatarImage src={truck.logoUrl} alt={truck.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {initials(truck.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">
              <Link to={href} className="hover:text-primary transition-colors">
                {truck.name}
              </Link>
            </CardTitle>

            <CardDescription className="flex items-center gap-2 mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{truck.city}</span>
              {kmText && (
                <>
                  <span>·</span>
                  <span>{kmText}</span>
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* Note */}
        {ratingAvg && ratingCount != null && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold text-foreground">{ratingAvg}</span>
            </div>
            <span className="text-muted-foreground">({ratingCount} avis)</span>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.slice(0, 3).map((badge) => (
              <Badge key={badge} variant="outline" className="text-xs">
                {badge}
              </Badge>
            ))}
            {badges.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{badges.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <Link to={href} className="w-full">
          <Button className="w-full" variant="default">
            Voir le menu
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
