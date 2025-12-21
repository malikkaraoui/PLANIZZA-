import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TruckCard({ truck }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 overflow-hidden rounded-xl border bg-gray-50 flex items-center justify-center text-sm font-extrabold text-gray-700">
          {truck.logoUrl ? (
            <img src={truck.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(truck.name)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">
                <Link to={`/t/${truck.id}`} className="hover:underline">
                  {truck.name}
                </Link>
              </h3>
              <p className="text-sm text-gray-600 truncate">
                {truck.city}
                {typeof truck.distanceKm === 'number' ? ` · ${truck.distanceKm} km` : ''}
                {truck.openingToday ? ` · ${truck.openingToday}` : ''}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Badge className={truck.isOpenNow ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
                {truck.isOpenNow ? 'Ouvert' : 'Fermé'}
              </Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {truck.tags?.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>

            <Link to={`/t/${truck.id}`} className="shrink-0">
              <Button variant="secondary">Voir menu</Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
