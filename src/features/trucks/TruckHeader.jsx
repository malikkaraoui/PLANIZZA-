import Badge from '../../components/ui/Badge';

export default function TruckHeader({ truck }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-gray-900">{truck.name}</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge className={truck.isOpenNow ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}>
            {truck.isOpenNow ? 'Ouvert' : 'Fermé'}
          </Badge>
          {truck.tags?.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      </div>
      <p className="text-gray-600">
        {truck.city}
        {typeof truck.distanceKm === 'number' ? ` · ${truck.distanceKm} km` : ''}
        {truck.openingToday ? ` · ${truck.openingToday}` : ''}
      </p>
    </div>
  );
}
