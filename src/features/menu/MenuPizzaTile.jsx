import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import AddToCartButton from './AddToCartButton';

function formatEUR(cents) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function sizeLabel(sizeKey, diameter) {
  const k = String(sizeKey || '').toLowerCase();
  let label;
  switch (k) {
    case 's':
      label = 'S';
      break;
    case 'm':
      label = 'M';
      break;
    case 'l':
      label = 'L';
      break;
    default:
      label = String(sizeKey).toUpperCase();
      break;
  }
  return diameter ? `${label} (${diameter}cm)` : label;
}

function getPizzaSizes(item) {
  const sizes = item?.sizes && typeof item.sizes === 'object' ? item.sizes : null;
  if (sizes && Object.keys(sizes).length > 0) {
    const sizeOrder = { s: 1, m: 2, l: 3 };
    return Object.entries(sizes)
      .map(([k, v]) => ({
        key: k,
        priceCents: Number(v?.priceCents || 0),
        diameter: v?.diameter,
      }))
      .filter((s) => s.priceCents > 0)
      .sort((a, b) => {
        const orderA = sizeOrder[a.key.toLowerCase()] || 999;
        const orderB = sizeOrder[b.key.toLowerCase()] || 999;
        return orderA - orderB;
      });
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
  onAutoClose,
  enableCustomization = false,
  availableIngredients = [],
}) {
  const isAvailable = item?.available !== false && !isDisabled;

  const sizes = useMemo(() => getPizzaSizes(item), [item]);
  const defaultSizeKey = sizes[0]?.key;

  const [openState, setOpenState] = useState(Boolean(defaultOpen));
  const [selectedSize, setSelectedSize] = useState(defaultSizeKey);
  const [justAdded, setJustAdded] = useState(false);
  const [removedIngredients, setRemovedIngredients] = useState([]);
  const [addedIngredients, setAddedIngredients] = useState([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimerRef = useRef(null);
  const autoCloseTimerRef = useRef(null);

  const open = openProp ?? openState;
  const toggleOpen = () => {
    // Nettoyer le timer autoClose en cas de toggle manuel
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    if (typeof onToggle === 'function') {
      onToggle();
      return;
    }
    setOpenState((v) => !v);
  };

  // Nettoyer le timer autoClose quand open change
  useEffect(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, [open]);

  // Reset la taille sélectionnée au prix minimum quand on ferme la tuile
  useEffect(() => {
    if (!open) {
      setSelectedSize(defaultSizeKey);
    }
  }, [open, defaultSizeKey]);

  // Nettoyer tous les timers au démontage
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

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

  const extraIngredients = useMemo(() => {
    if (!enableCustomization) return [];
    const baseSet = new Set(ingredients.map((i) => i.toLowerCase()));
    return (availableIngredients || [])
      .map((i) => String(i || '').trim())
      .filter(Boolean)
      .filter((i) => !baseSet.has(i.toLowerCase()));
  }, [availableIngredients, enableCustomization, ingredients]);

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

    const customizationParts = [];
    if (removedIngredients.length > 0) customizationParts.push(`sans ${removedIngredients.join(', ')}`);
    if (addedIngredients.length > 0) customizationParts.push(`+ ${addedIngredients.join(', ')}`);
    const customizationLabel = customizationParts.length > 0 ? ` (${customizationParts.join(' / ')})` : '';

    onAdd({
      ...item,
      id: `${item.id}_${chosen.key}`,
      priceCents: chosen.priceCents,
      size: chosen.key,
      diameter,
      name: `${item.name} ${label}${diameter ? '' : ''}`.trim() + customizationLabel,
      baseItemId: item.id,
      customization: customizationParts.length > 0 ? {
        removedIngredients,
        addedIngredients,
      } : undefined,
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <Card
      className={`group self-start glass-premium glass-glossy overflow-hidden border-white/30 transition-all rounded-4xl ${
        !isAvailable
          ? 'opacity-50 grayscale pointer-events-none'
          : 'hover:shadow-[0_26px_56px_-20px_rgba(0,0,0,0.20)]'
      } ${hoverExpanded ? 'scale-[1.03] shadow-[0_30px_70px_-22px_rgba(0,0,0,0.22)]' : ''}`}
      onMouseEnter={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => setHoverExpanded(true), 1000);
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      }}
      onMouseLeave={() => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHoverExpanded(false);
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        if (open && !customizeOpen && typeof onAutoClose === 'function') {
          autoCloseTimerRef.current = setTimeout(() => onAutoClose(), 2000);
        }
      }}
    >
      {/* Preview (tuile compacte) */}
      <div
        onClick={toggleOpen}
        className="w-full text-left cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        <div className="relative">
          {item?.photo ? (
            <div className="h-40 w-full overflow-hidden">
              <img
                src={item.photo}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="h-40 w-full bg-linear-to-br from-orange-100 to-amber-50 flex items-center justify-center">
              <div className="text-4xl">🍕</div>
            </div>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-orange-600 shadow">
              {open && selectedSizeData?.priceCents
                ? formatEUR(selectedSizeData.priceCents)
                : minPrice
                ? `Dès ${formatEUR(minPrice)}`
                : '—'}
            </div>
            {!open && (
              <div className="group">
                <AddToCartButton
                  mode="compactHover"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAdd();
                  }}
                  disabled={!isAvailable}
                  justAdded={justAdded}
                  label="Ajouter"
                />
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black tracking-tight text-base truncate">{item?.name}</div>
              {item?.description && (
                <div className="mt-1 text-[12px] font-medium text-muted-foreground/70 line-clamp-2">
                  {item.description}
                </div>
              )}
            </div>

            <ChevronDown
              className={`h-5 w-5 text-muted-foreground/60 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </CardContent>
      </div>

      {/* Détails (naissance vers le bas) */}
      <div
        className={`border-t border-white/10 bg-white/5 overflow-hidden transition-[max-height,opacity] duration-700 ease-out ${
          open ? 'max-h-250 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="px-5 pt-3 pb-4 space-y-3">
          {/* Tailles - Segmented Control */}
          {sizes.length > 1 && (
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Tailles
              </div>
              <div className="inline-flex items-center bg-white/10 rounded-full p-0.5 border border-white/20 shadow-sm">
                {sizes.map((s, idx) => {
                  const active = s.key === (selectedSizeData?.key || selectedSize);
                  const letter = s.key.toUpperCase().charAt(0);
                  
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedSize(s.key);
                      }}
                      className="relative px-6 py-1.5 font-black text-[11px] tracking-tight whitespace-nowrap transition-colors duration-300"
                    >
                      {/* Background orange animé */}
                      <span
                        className={`absolute inset-0 rounded-full bg-linear-to-br from-orange-500 to-orange-600 shadow-md transition-all duration-300 ease-out ${
                          active ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                      />
                      
                      {/* Contenu */}
                      <span className={`relative z-10 transition-colors duration-300 ${active ? 'text-white' : 'text-gray-600'}`}>
                        {letter}
                      </span>
                    </button>
                  );
                })}
              </div>
              
              {/* Info taille sélectionnée en dessous */}
              {selectedSizeData && (
                <div className="text-[11px] font-bold text-gray-700 transition-opacity duration-300">
                  {sizeLabel(selectedSizeData.key, selectedSizeData.diameter)} - {formatEUR(selectedSizeData.priceCents)}
                </div>
              )}
            </div>
          )}

          {/* CTA + Personnalisation intégrée */}
          <div className="flex items-center gap-2 pt-1">
            {enableCustomization && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCustomizeOpen(true);
                }}
                className="group flex-shrink-0 h-10 w-10 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all bg-linear-to-br from-orange-100 to-orange-200 hover:from-orange-500 hover:to-orange-600 text-orange-600 hover:text-white border border-orange-300 hover:border-orange-600 shadow-sm hover:shadow-md flex items-center justify-center"
                title="Personnaliser"
              >
                <Pencil className="h-4 w-4 transition-transform group-hover:scale-110" />
              </button>
            )}

            <AddToCartButton
              mode="expanded"
              size="sm"
              justAdded={justAdded}
              disabled={!isAvailable}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAdd();
              }}
            />
          </div>
        </div>
      </div>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="glass-premium glass-glossy border-white/30">
          <DialogHeader>
            <DialogTitle>Personnaliser {item?.name}</DialogTitle>
          </DialogHeader>

          {ingredients.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Ingrédients
              </div>
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ing) => {
                  const removed = removedIngredients.includes(ing);
                  return (
                    <button
                      key={ing}
                      type="button"
                      onClick={() => {
                        setRemovedIngredients((prev) =>
                          prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all border ${
                        removed
                          ? 'bg-red-500/10 text-red-600 border-red-500/40 line-through'
                          : 'bg-white/10 text-gray-700 border-white/20 hover:bg-white/20'
                      }`}
                      title={removed ? 'Remettre' : 'Retirer'}
                    >
                      {ing}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {enableCustomization && extraIngredients.length > 0 && (
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Ajouter
              </div>
              <div className="flex flex-wrap gap-2">
                {extraIngredients.map((ing) => {
                  const added = addedIngredients.includes(ing);
                  return (
                    <button
                      key={ing}
                      type="button"
                      onClick={() => {
                        setAddedIngredients((prev) =>
                          prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all border ${
                        added
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40'
                          : 'bg-white/10 text-gray-700 border-white/20 hover:bg-white/20'
                      }`}
                      title={added ? 'Retirer' : 'Ajouter'}
                    >
                      {added ? '✓ ' : ''}{ing}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {(removedIngredients.length > 0 || addedIngredients.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setRemovedIngredients([]);
                  setAddedIngredients([]);
                }}
                className="text-[10px] font-bold text-muted-foreground/70 hover:text-muted-foreground"
              >
                Réinitialiser les ingrédients
              </button>
            )}

            <div className="flex-1 flex justify-center">
              {removedIngredients.length > 0 || addedIngredients.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCustomizeOpen(false)}
                  className="rounded-full px-5 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white shadow-md shadow-primary/30 hover:brightness-110"
                >
                  Valider
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomizeOpen(false)}
                  className="rounded-full px-5 py-2.5 text-[10px] font-black tracking-widest uppercase bg-orange-500 text-white shadow-md shadow-orange-500/30 hover:brightness-110"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
