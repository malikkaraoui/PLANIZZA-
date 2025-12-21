import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../app/routes';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatKm(km) {
  if (typeof km !== 'number' || Number.isNaN(km)) return null;
  // FR : virgule
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export default function TruckCard({ truck }) {
  const hero = Array.isArray(truck.photos) && truck.photos.length ? truck.photos[0] : null;
  const href = ROUTES.truck(truck.id);
  const kmText = formatKm(truck.distanceKm);
  const ratingAvg = typeof truck.ratingAvg === 'number' ? truck.ratingAvg.toFixed(1) : null;
  const ratingCount = typeof truck.ratingCount === 'number' ? truck.ratingCount : null;
  const badges = truck.badges || truck.tags || [];
  const highlights = Array.isArray(truck.highlights) ? truck.highlights : [];

  return (
    <Card className="overflow-hidden">
      {hero && (
        <Link to={href} className="block">
          <img
            src={hero}
            alt={`Photo de ${truck.name}`}
            className="h-40 w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </Link>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-lg border bg-gray-50 flex items-center justify-center text-xs font-extrabold text-gray-700">
            {truck.logoUrl ? (
              <img src={truck.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              initials(truck.name)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-extrabold text-gray-900 truncate">
                  <Link to={href} className="hover:underline">
                    {truck.name}
                  </Link>
                </h3>

                <div className="mt-1 text-sm text-gray-600 truncate">
                  <span>{truck.city}</span>
                  {kmText ? <span>{` · ${kmText}`}</span> : null}
                </div>

                <div className="mt-1 text-sm text-gray-700">
                  {ratingAvg && ratingCount != null ? (
                    <span>
                      ★ {ratingAvg} ({ratingCount} avis)
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <Badge className={truck.isOpenNow ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {truck.isOpenNow ? 'Ouvert' : 'Fermé'}
                </Badge>
              </div>
            </div>

            {(highlights.length > 0 || badges.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {highlights.map((h) => (
                  <Badge key={`h-${h}`} className="bg-amber-50 text-amber-800">
                    {h}
                  </Badge>
                ))}
                {badges.map((b) => (
                  <Badge key={b}>{b}</Badge>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to={href}>
                <Button variant="secondary" className="w-full">
                  Voir menu
                </Button>
              </Link>
              <Link to={href}>
                <Button className="w-full">Commander</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
