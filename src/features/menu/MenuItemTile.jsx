import { useMemo, useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import AddToCartButton from './AddToCartButton';
import { formatDrinkVolumeLabel } from './utils/formatDrinkVolumeLabel';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function typeEmoji(type) {
  const t = typeof type === 'string' ? type.toLowerCase() : '';
  switch (t) {
    case 'soda':
      return '🥤';
    case 'eau':
      return '💧';
    case 'biere':
      return '🍺';
    case 'vin':
      return '🍷';
    case 'dessert':
      return '🍰';
    default:
      return '🍽️';
  }
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
    return formatDrinkVolumeLabel(size) || String(size).toUpperCase();
  }, [hasSizes, selectedSize]);

  // N'afficher le litrage que si c'est bien un volume (évite d'afficher S/M/L pour d'autres types)
  const volumeLabel = useMemo(() => {
    if (!sizeLabel) return null;
    return /cL|L/.test(sizeLabel) ? sizeLabel : null;
  }, [sizeLabel]);

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
      role={isAvailable ? 'button' : undefined}
      tabIndex={isAvailable ? 0 : undefined}
      onClick={() => {
        handleAdd();
      }}
      onKeyDown={(e) => {
        if (!isAvailable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAdd();
        }
      }}
      className={`group glass-premium glass-glossy overflow-hidden border-white/30 transition-all duration-300 rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        !isAvailable
          ? 'opacity-50 grayscale pointer-events-none'
          : 'cursor-pointer hover:shadow-[0_24px_48px_-18px_rgba(0,0,0,0.18)]'
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
                <div className="flex items-baseline gap-2 min-w-0">
                  <div className="font-black tracking-tight text-sm truncate min-w-0">{item.name}</div>
                  {volumeLabel && (
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground/70 tracking-wide">
                      {volumeLabel}
                    </span>
                  )}
                </div>
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

              <AddToCartButton
                onClick={(e) => {
                  // Toute la tuile est cliquable : éviter un double ajout.
                  e.stopPropagation();
                  handleAdd();
                }}
                disabled={!isAvailable}
                justAdded={justAdded}
                mode="compactHover"
                className="shrink-0"
              />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSize(size);
                      }}
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
