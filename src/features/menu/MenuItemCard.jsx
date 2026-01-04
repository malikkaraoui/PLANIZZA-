import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function MenuItemCard({ item, onAdd, isDisabled = false }) {
  const isAvailable = item.available !== false && !isDisabled;
  const hasSizes = (item.type === 'pizza' || ['soda', 'eau', 'biere'].includes(item.type)) && item.sizes && Object.keys(item.sizes).length > 0;
  
  // Initialiser avec la première taille disponible
  const firstAvailableSize = hasSizes ? Object.keys(item.sizes)[0] : 's';
  const [selectedSize, setSelectedSize] = useState(firstAvailableSize);

  const displayPrice = hasSizes 
    ? (item.sizes?.[selectedSize]?.priceCents || 0)
    : (item.priceCents || 0);

  const handleAdd = () => {
    if (hasSizes) {
      const sizeData = item.sizes?.[selectedSize] || { priceCents: item.prices?.[selectedSize] };
      const sizeLabel = selectedSize === 's' ? 'S' : selectedSize === 'm' ? 'M' : selectedSize === 'l' ? 'L' : selectedSize;
      const diameter = sizeData.diameter ? ` (${sizeData.diameter}cm)` : '';
      
      onAdd({
        ...item,
        id: `${item.id}_${selectedSize}`, // ID unique par taille
        priceCents: sizeData.priceCents,
        size: selectedSize,
        diameter: sizeData.diameter,
        name: `${item.name} ${sizeLabel}${diameter}`,
        baseItemId: item.id // Garder l'ID original pour référence
      });
    } else {
      onAdd(item);
    }
  };

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

      <CardFooter className="pt-4 px-8 pb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2 flex-1">
          {/* Sélecteur de taille pour les pizzas et boissons */}
          {hasSizes && (
            <div className="flex gap-2 flex-wrap">
              {item.sizes && Object.keys(item.sizes).length > 0 ? (
                // Afficher uniquement les tailles qui existent
                Object.keys(item.sizes).map(size => {
                  const sizeData = item.sizes[size];
                  let label = size.toUpperCase();
                  
                  // Pour les pizzas, afficher le diamètre
                  if (item.type === 'pizza' && sizeData.diameter) {
                    label += ` (${sizeData.diameter}cm)`;
                  }
                  // Pour les boissons, afficher le volume
                  else if (['soda', 'eau', 'biere'].includes(item.type)) {
                    label = size === '25cl' ? '25cL' : size === '33cl' ? '33cL' : size === '50cl' ? '50cL' : size === '1l' ? '1L' : size;
                  }
                  
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                        selectedSize === size
                          ? 'bg-primary text-white shadow-lg shadow-primary/30'
                          : 'bg-white/10 text-gray-700 hover:bg-white/20'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })
              ) : (
                // Ancien format Classic/Large (rétro-compatibilité)
                <>
                  <button
                    onClick={() => setSelectedSize('classic')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      selectedSize === 'classic'
                        ? 'bg-primary text-white'
                        : 'bg-white/10 text-gray-700 hover:bg-white/20'
                    }`}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => setSelectedSize('large')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      selectedSize === 'large'
                        ? 'bg-primary text-white'
                        : 'bg-white/10 text-gray-700 hover:bg-white/20'
                    }`}
                  >
                    Large
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl font-black text-premium-gradient tracking-tighter">
              {formatEUR(displayPrice)}
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
          onClick={handleAdd}
          disabled={!isAvailable}
          className="rounded-4xl h-14 px-8 bg-linear-to-r from-primary to-orange-500 shadow-xl shadow-primary/10 hover:shadow-primary/30 transition-all font-black text-xs tracking-widest uppercase gap-3 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
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
