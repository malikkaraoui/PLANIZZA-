import { useMemo, useState } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function sizeLabel(sizeKey, diameter) {
  const k = String(sizeKey || '').toLowerCase();
  const label = k === 's' ? 'S' : k === 'm' ? 'M' : k === 'l' ? 'L' : String(sizeKey).toUpperCase();
  return diameter ? `${label} (${diameter}cm)` : label;
}

function getPizzaSizes(item) {
  const sizes = item?.sizes && typeof item.sizes === 'object' ? item.sizes : null;
  if (sizes && Object.keys(sizes).length > 0) {
    return Object.entries(sizes)
      .map(([k, v]) => ({
        key: k,
        priceCents: Number(v?.priceCents || 0),
        diameter: v?.diameter,
      }))
      .filter((s) => s.priceCents > 0);
  }

  // Fallback rétro-compat: prix unique
  const priceCents = Number(item?.priceCents || 0);
  if (priceCents > 0) {
    return [{ key: 'classic', priceCents, diameter: undefined }];
  }

  return [];
}

export default function MenuPizzaTile({
  item,
  onAdd,
  isDisabled = false,
  defaultOpen = false,
  open: openProp,
  onToggle,
}) {
  const isAvailable = item?.available !== false && !isDisabled;

  const sizes = useMemo(() => getPizzaSizes(item), [item]);
  const defaultSizeKey = sizes[0]?.key;

  const [openState, setOpenState] = useState(Boolean(defaultOpen));
  const [selectedSize, setSelectedSize] = useState(defaultSizeKey);
  const [justAdded, setJustAdded] = useState(false);

  const open = openProp ?? openState;
  const toggleOpen = () => {
    if (typeof onToggle === 'function') {
      onToggle();
      return;
    }
    setOpenState((v) => !v);
  };

  const selectedSizeData = useMemo(() => {
    return sizes.find((s) => s.key === selectedSize) || sizes[0];
  }, [sizes, selectedSize]);

  const ingredients = useMemo(() => {
    const raw = (item?.description || '').trim();
    if (!raw) return [];
    // On split par virgule; si la description est une phrase, ça reste ok.
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [item?.description]);

  const minPrice = useMemo(() => {
    if (!sizes.length) return 0;
    return Math.min(...sizes.map((s) => s.priceCents));
  }, [sizes]);

  const handleAdd = () => {
    if (!isAvailable) return;

    const chosen = selectedSizeData;
    if (!chosen) return;

    const diameter = chosen.diameter;
    const label = sizeLabel(chosen.key, diameter);

    onAdd({
      ...item,
      id: `${item.id}_${chosen.key}`,
      priceCents: chosen.priceCents,
      size: chosen.key,
      diameter,
      name: `${item.name} ${label}${diameter ? '' : ''}`.trim(),
      baseItemId: item.id,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <Card
      className={`self-start glass-premium glass-glossy overflow-hidden border-white/30 transition-all rounded-[32px] ${
        !isAvailable ? 'opacity-50 grayscale pointer-events-none' : 'hover:shadow-[0_26px_56px_-20px_rgba(0,0,0,0.20)]'
      }`}
    >
      {/* Preview (tuile compacte) */}
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full text-left"
        aria-expanded={open}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {item?.photo && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] shadow-lg border-white/40 border">
                <img src={item.photo} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black tracking-tight text-sm truncate">{item?.name}</div>
                  {ingredients.length > 0 && (
                    <div className="mt-1 text-[11px] font-medium text-muted-foreground/70 line-clamp-1">
                      {ingredients.join(', ')}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-lg font-black text-premium-gradient tracking-tight whitespace-nowrap">
                    {minPrice ? formatEUR(minPrice) : ''}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground/60 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </button>

      {/* Détails (naissance vers le bas) */}
      {open && (
        <div className="border-t border-white/10 bg-white/5 animate-in slide-in-from-top-2 duration-300">
          <div className="p-5 space-y-4">
            {/* Tailles */}
            {sizes.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Tailles
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const active = s.key === (selectedSizeData?.key || selectedSize);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedSize(s.key);
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all ${
                          active
                            ? 'bg-primary text-white shadow-md shadow-primary/25'
                            : 'bg-white/10 text-gray-700 hover:bg-white/20'
                        }`}
                      >
                        {sizeLabel(s.key, s.diameter)} • {formatEUR(s.priceCents)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ingrédients */}
            {ingredients.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Ingrédients
                </div>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {ingredients.map((ing) => (
                    <li key={ing} className="text-xs font-medium text-muted-foreground/80 truncate">
                      • {ing}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs font-bold text-muted-foreground/60">
                {selectedSizeData ? (
                  <>
                    {sizeLabel(selectedSizeData.key, selectedSizeData.diameter)} •{' '}
                    <span className="font-black text-foreground/80">{formatEUR(selectedSizeData.priceCents)}</span>
                  </>
                ) : null}
              </div>

              <Button
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAdd();
                }}
                disabled={!isAvailable}
                className={`shrink-0 h-10 px-4 rounded-3xl shadow-lg transition-all font-black text-[10px] tracking-widest uppercase gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  justAdded
                    ? 'bg-green-500 hover:bg-green-500 shadow-green-500/30'
                    : 'bg-linear-to-r from-primary to-orange-500 shadow-primary/10 hover:shadow-primary/25'
                }`}
              >
                <div className="p-1.5 rounded-full bg-white/20">
                  {justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                {justAdded ? 'Ajouté' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
