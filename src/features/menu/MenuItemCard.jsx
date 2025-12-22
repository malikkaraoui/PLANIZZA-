import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function MenuItemCard({ item, onAdd }) {
  const isAvailable = item.available !== false;

  return (
    <Card className={`group transition-all ${!isAvailable ? 'opacity-60' : 'hover:shadow-md'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{item.name}</CardTitle>
            {item.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {item.description}
              </CardDescription>
            )}
          </div>

          {item.photo && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
              <img
                src={item.photo}
                alt={item.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardFooter className="pt-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">
            {formatEUR(item.priceCents)}
          </span>

          {!isAvailable && (
            <Badge variant="secondary" className="text-xs">
              Indisponible
            </Badge>
          )}

          {item.type && isAvailable && (
            <Badge variant="outline" className="text-xs">
              {item.type}
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => onAdd(item)}
          disabled={!isAvailable}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </CardFooter>
    </Card>
  );
}
