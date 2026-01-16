import { useRef, useState } from 'react';
import AddToCartButton from './AddToCartButton';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function MenuItemCard({ item = {}, onAdd, isDisabled = false }) {
  const isAvailable = item?.available !== false && !isDisabled;
  const drinkTypes = ['soda', 'eau', 'biere', 'vin'];
  const hasSizes = (item.type === 'pizza' || ['soda', 'eau', 'biere'].includes(item.type)) && item.sizes && Object.keys(item.sizes).length > 0;
  const isDrink = drinkTypes.includes(item.type);
  const typeEmojiMap = {
    soda: '🥤',
    eau: '💧',
    biere: '🍺',
    vin: '🍷',
    dessert: '🍰',
  };
  const typeEmoji = typeEmojiMap[item.type] || '🍽️';
  const sizeKeys = hasSizes ? Object.keys(item.sizes) : [];
  
  // Initialiser avec la première taille disponible
  const firstAvailableSize = hasSizes ? Object.keys(item.sizes)[0] : 's';
  const [selectedSize, setSelectedSize] = useState(firstAvailableSize);
  const [justAdded, setJustAdded] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimerRef = useRef(null);
  
  const selectedSizeLabel = (() => {
    if (!hasSizes) return null;
    const sizeData = item.sizes?.[selectedSize];
    if (item.type === 'pizza' && sizeData?.diameter) {
      return `${selectedSize.toUpperCase()} (${sizeData.diameter}cm)`;
    }
    if (['soda', 'eau', 'biere'].includes(item.type)) {
      const sizeMap = {
        '25cl': '25cL',
        '33cl': '33cL',
        '50cl': '50cL',
        '75cl': '75cL',
        '1l': '1L',
        '1L': '1L',
        '1.5l': '1,5L',
        '1.5L': '1,5L',
      };
      return sizeMap[selectedSize] || selectedSize;
    }
    return selectedSize.toUpperCase();
  })();

  const displayPrice = hasSizes 
    ? (item.sizes?.[selectedSize]?.priceCents || 0)
    : (item.priceCents || 0);

  const handleAdd = () => {
    if (hasSizes) {
      const sizeData = item.sizes?.[selectedSize] || { priceCents: item.prices?.[selectedSize] };
      
      // Mapping des tailles pour affichage
      let sizeLabel = selectedSize;
      if (selectedSize === 's') {
        sizeLabel = 'S';
      } else if (selectedSize === 'm') {
        sizeLabel = 'M';
      } else if (selectedSize === 'l') {
        sizeLabel = 'L';
      } else if (isDrink) {
        // Pour les boissons, utiliser le mapping de volume
        const volumeMap = {
          '25cl': '25cL',
          '33cl': '33cL',
          '50cl': '50cL',
          '75cl': '75cL',
          '1l': '1L',
          '1L': '1L',
          '1.5l': '1,5L',
          '1.5L': '1,5L',
        };
        sizeLabel = volumeMap[selectedSize] || selectedSize.toUpperCase();
      } else {
        sizeLabel = selectedSize.toUpperCase();
      }
      
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

    // Feedback visuel
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <Card
      className={`group glass-premium glass-glossy overflow-hidden border-white/30 transition-all duration-500 rounded-[28px] h-48 ${
        !isAvailable
          ? 'opacity-50 grayscale pointer-events-none'
          : 'hover:shadow-[0_26px_56px_-20px_rgba(0,0,0,0.20)]'
      } ${hoverExpanded ? 'scale-[1.03] shadow-[0_30px_70px_-22px_rgba(0,0,0,0.22)]' : ''}`}
      onMouseEnter={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHoverExpanded(true), 1000);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHoverExpanded(false);
      }}
    >
      <div className="relative">
        {item.photo ? (
          <div className="h-24 w-full overflow-hidden">
            <img
              src={item.photo}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="h-24 w-full bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center">
            <div className="text-3xl">{typeEmoji}</div>
          </div>
        )}
      </div>

      <CardContent className="p-4 flex flex-col h-24 relative">
        {isDrink && hasSizes && selectedSizeLabel && (
          <div className="absolute top-3 right-4 rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-widest uppercase border border-orange-400 text-orange-500 bg-transparent">
            {selectedSizeLabel}
          </div>
        )}
        <div>
          <div className="font-black tracking-tight text-sm truncate">{item.name}</div>
          {item.description && (
            <div className="mt-1 text-[11px] font-medium text-muted-foreground/70 line-clamp-2">
              {item.description}
            </div>
          )}
        </div>

        {hasSizes && (!isDrink || sizeKeys.length > 1) && (
          <div className="flex gap-2 flex-wrap">
            {item.sizes && Object.keys(item.sizes).length > 0 ? (
              Object.keys(item.sizes).map((size) => {
                const sizeData = item.sizes[size];
                let label = size.toUpperCase();

                if (item.type === 'pizza' && sizeData.diameter) {
                  label += ` (${sizeData.diameter}cm)`;
                } else if (['soda', 'eau', 'biere'].includes(item.type)) {
                  const sizeMap = {
                    '25cl': '25cL',
                    '33cl': '33cL',
                    '50cl': '50cL',
                    '75cl': '75cL',
                    '1l': '1L',
                    '1L': '1L',
                    '1.5l': '1,5L',
                    '1.5L': '1,5L',
                  };
                  label = sizeMap[size] || size;
                }

                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all border ${
                      selectedSize === size
                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/30'
                        : isDrink
                          ? 'bg-transparent text-orange-500 border-orange-300 hover:border-orange-400'
                          : 'bg-white/10 text-gray-700 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {label}
                  </button>
                );
              })
            ) : (
              <>
                <button
                  onClick={() => setSelectedSize('classic')}
                  className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                    selectedSize === 'classic'
                      ? 'bg-primary text-white'
                      : 'bg-white/10 text-gray-700 hover:bg-white/20'
                  }`}
                >
                  Classic
                </button>
                <button
                  onClick={() => setSelectedSize('large')}
                  className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
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

        <div className="mt-auto grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="text-xl font-black text-premium-gradient tracking-tighter">
            {formatEUR(displayPrice)}
          </span>

          <div className="justify-self-end">
            <AddToCartButton
              mode="compactHover"
              size="sm"
              onClick={handleAdd}
              disabled={!isAvailable}
              justAdded={justAdded}
              label="Ajouter"
              addedLabel="Ajouté !"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
