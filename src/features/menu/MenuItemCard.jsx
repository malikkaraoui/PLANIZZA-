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
    <Card className={`group glass-premium glass-glossy overflow-hidden border-white/30 transition-all duration-500 ${!isAvailable ? 'opacity-50 grayscale pointer-events-none' : 'hover:scale-[1.02] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]'}`}>
      <CardHeader className="pb-4 pt-8 px-8">
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1 min-w-0 space-y-3">
            <CardTitle className="text-2xl font-black tracking-tighter transition-all duration-300 group-hover:text-premium-gradient">
              {item.name}
            </CardTitle>
            {item.description && (
              <CardDescription className="text-sm font-medium text-muted-foreground/70 leading-relaxed line-clamp-3">
                {item.description}
              </CardDescription>
            )}
          </div>

          {item.photo && (
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[24px] shadow-2xl border-white/40 border-2 group-hover:border-primary/40 transition-all duration-500">
              <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-10" />
              <img
                src={item.photo}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardFooter className="pt-4 px-8 pb-8 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-premium-gradient tracking-tighter">
              {formatEUR(item.priceCents)}
            </span>

            {!isAvailable && (
              <Badge variant="destructive" className="rounded-full bg-destructive/10 text-destructive border-destructive/20 font-black px-3 text-[10px] uppercase tracking-widest">
                OUT
              </Badge>
            )}

            {item.type && isAvailable && (
              <Badge variant="outline" className="glass-premium border-white/30 rounded-full px-3 py-1 text-[10px] uppercase font-black tracking-widest text-primary/80">
                {item.type}
              </Badge>
            )}
          </div>
        </div>

        <Button
          size="lg"
          onClick={() => onAdd(item)}
          disabled={!isAvailable}
          className="rounded-[20px] h-14 px-8 bg-linear-to-r from-primary to-orange-500 shadow-xl shadow-primary/10 hover:shadow-primary/30 transition-all font-black text-xs tracking-widest uppercase gap-3"
        >
          <div className="p-1.5 rounded-full bg-white/20">
            <Plus className="h-4 w-4" />
          </div>
          Ajouter
        </Button>
      </CardFooter>
    </Card>
  );
}
