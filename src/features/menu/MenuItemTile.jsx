import { useMemo, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function typeEmoji(type) {
  const t = typeof type === 'string' ? type.toLowerCase() : '';
  if (t === 'soda') return '🥤';
  if (t === 'eau') return '💧';
  if (t === 'biere') return '🍺';
  if (t === 'vin') return '🍷';
  if (t === 'dessert') return '🍰';
  return '🍽️';
}

/**
 * Tuile compacte pour boissons/desserts (affichage multi-colonnes).
 * Conserve la logique de tailles (boissons) et le feedback "Ajouté".
 */
export default function MenuItemTile({ item, onAdd, isDisabled = false }) {
  const isAvailable = item.available !== false && !isDisabled;

  const hasSizes =
    (item.type === 'pizza' || ['soda', 'eau', 'biere'].includes(item.type)) &&
    item.sizes &&
    Object.keys(item.sizes).length > 0;

  const availableSizes = useMemo(() => {
    if (!hasSizes) return [];
    return Object.keys(item.sizes || {});
  }, [hasSizes, item.sizes]);

  const firstAvailableSize = hasSizes ? availableSizes[0] : null;
  const [selectedSize, setSelectedSize] = useState(firstAvailableSize);
  const [justAdded, setJustAdded] = useState(false);

  const displayPrice = hasSizes
    ? item.sizes?.[selectedSize]?.priceCents || 0
    : item.priceCents || 0;

  const sizeLabel = useMemo(() => {
    if (!hasSizes) return null;
    const size = selectedSize;
    if (!size) return null;

    // Boissons: afficher volume si possible
    const sizeMap = {
      '25cl': '25cL',
      '33cl': '33cL',
      '50cl': '50cL',
      '75cl': '75cL',
      '1l': '1L',
      '1.5l': '1,5L',
    };

    return sizeMap[size] || String(size).toUpperCase();
  }, [hasSizes, selectedSize]);

  const handleAdd = () => {
    if (!isAvailable) return;

    if (hasSizes) {
      const sizeData = item.sizes?.[selectedSize] || { priceCents: item.prices?.[selectedSize] };
      const label = sizeLabel ? ` ${sizeLabel}` : '';

      onAdd({
        ...item,
        id: `${item.id}_${selectedSize}`,
        priceCents: sizeData.priceCents,
        size: selectedSize,
        name: `${item.name}${label}`,
        baseItemId: item.id,
      });
    } else {
      onAdd(item);
    }

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <Card
      className={`group glass-premium glass-glossy overflow-hidden border-white/30 transition-all duration-300 rounded-[28px] ${
        !isAvailable ? 'opacity-50 grayscale pointer-events-none' : 'hover:shadow-[0_24px_48px_-18px_rgba(0,0,0,0.18)]'
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {item.photo && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] shadow-lg border-white/40 border group-hover:border-primary/40 transition-all">
              <img src={item.photo} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black tracking-tight text-sm truncate">{item.name}</div>
                {item.description && (
                  <div className="mt-1 text-[11px] font-medium text-muted-foreground/70 line-clamp-2">
                    {item.description}
                  </div>
                )}
              </div>

              {!isAvailable ? (
                <Badge
                  variant="destructive"
                  className="shrink-0 rounded-full bg-destructive/10 text-destructive border-destructive/20 font-black px-2 text-[9px] uppercase tracking-widest"
                >
                  OUT
                </Badge>
              ) : (
                <div className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full glass-premium border-white/20" title={item.type || 'Produit'}>
                  <span className="text-sm leading-none">{typeEmoji(item.type)}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg font-black text-premium-gradient tracking-tight whitespace-nowrap">
                  {formatEUR(displayPrice)}
                </span>
              </div>

              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!isAvailable}
                className={`shrink-0 h-9 px-3 rounded-3xl shadow-lg transition-all font-black text-[9px] tracking-widest uppercase gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  justAdded
                    ? 'bg-green-500 hover:bg-green-500 shadow-green-500/30'
                    : 'bg-linear-to-r from-primary to-orange-500 shadow-primary/10 hover:shadow-primary/25'
                }`}
              >
                <div className="p-1.5 rounded-full bg-white/20">
                  {justAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </div>
                <span className="hidden sm:inline">{justAdded ? 'Ajouté' : 'Ajouter'}</span>
              </Button>
            </div>

            {hasSizes && availableSizes.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {availableSizes.map((size) => {
                  const active = size === selectedSize;
                  const label =
                    {
                      '25cl': '25cL',
                      '33cl': '33cL',
                      '50cl': '50cL',
                      '75cl': '75cL',
                      '1l': '1L',
                      '1.5l': '1,5L',
                    }[size] || size;

                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide transition-all ${
                        active ? 'bg-primary text-white shadow-md shadow-primary/25' : 'bg-white/10 text-gray-700 hover:bg-white/20'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
