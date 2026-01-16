import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Pause, Play, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { ITEM_TYPES } from '../../constants';
import { formatDrinkVolumeLabel } from '../../utils/formatDrinkVolumeLabel';
import { useSingleOpenItem } from '../../tiles/useSingleOpenItem';

const SECTIONS_ORDER = ['pizzas', 'calzones', 'boissons', 'desserts', 'autres'];

function typeEmoji(type) {
  const raw = ITEM_TYPES.find((t) => t.value === type)?.label;
  if (!raw) return '🍽️';
  return raw.split(' ')[0] || '🍽️';
}

function getItemSummaryText(item) {
  const description = (item?.description || '').trim();
  if (description) return description;

  // Rétro-compat: certains anciens items stockaient les ingrédients ailleurs.
  const ingredients = (item?.ingredients || '').trim();
  if (ingredients) return ingredients;

  const composition = (item?.composition || '').trim();
  if (composition) return composition;

  return '';
}

function sectionForType(type) {
  const t = String(type || '').toLowerCase();
  switch (t) {
    case 'pizza':
      return 'pizzas';
    case 'calzone':
      return 'calzones';
    case 'soda':
    case 'eau':
    case 'biere':
    case 'vin':
      return 'boissons';
    case 'dessert':
      return 'desserts';
    default:
      return 'autres';
  }
}

function sectionTitle(sectionKey) {
  switch (sectionKey) {
    case 'pizzas':
      return 'Pizzas';
    case 'calzones':
      return 'Calzones';
    case 'boissons':
      return 'Boissons';
    case 'desserts':
      return 'Desserts';
    default:
      return 'Autres';
  }
}

function renderCompactPriceLine({ item, formatPrice }) {
  const type = String(item?.type || '').toLowerCase();

  const isPizza = type === 'pizza' || type === 'calzone';
  const isDrink = ['soda', 'eau', 'biere', 'vin'].includes(type);

  if (isPizza && item?.sizes) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {item.sizes.s && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-semibold text-orange-900">
            S · {formatPrice(item.sizes.s.priceCents)}
          </span>
        )}
        {item.sizes.m && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-semibold text-orange-900">
            M · {formatPrice(item.sizes.m.priceCents)}
          </span>
        )}
        {item.sizes.l && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-semibold text-orange-900">
            L · {formatPrice(item.sizes.l.priceCents)}
          </span>
        )}
      </div>
    );
  }

  if (isDrink && item?.sizes && typeof item.sizes === 'object') {
    const sizes = Object.entries(item.sizes)
      .sort(([a], [b]) => {
        const order = ['25cl', '33cl', '50cl', '75cl', '1l', '1.5l'];
        const ia = order.indexOf(String(a).toLowerCase());
        const ib = order.indexOf(String(b).toLowerCase());
        if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(([sizeKey, data]) => {
        const cents = data?.priceCents;
        if (typeof cents !== 'number') return null;
        const label = formatDrinkVolumeLabel(sizeKey) || sizeKey;
        return (
          <span
            key={sizeKey}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-900"
          >
            {label} · {formatPrice(cents)}
          </span>
        );
      })
      .filter(Boolean);

    if (sizes.length > 0) {
      return <div className="flex flex-wrap items-center gap-2">{sizes}</div>;
    }
  }

  if (isPizza && item?.prices) {
    // Retro-compatibilité ancien format
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-semibold text-orange-900">
          Classic · {formatPrice(item.prices.classic)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-semibold text-orange-900">
          Large · {formatPrice(item.prices.large)}
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-900">
      {formatPrice(item.priceCents)}
    </span>
  );
}

export function PizzaioloMenuItemList({ items = [], onDelete, onSetAvailability, formatPrice }) {
  const disclosure = useSingleOpenItem(null);
  const [flashItemId, setFlashItemId] = useState(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const flashTile = (itemId) => {
    setFlashItemId(itemId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlashItemId(null);
    }, 900);
  };

  const grouped = useMemo(() => {
    return SECTIONS_ORDER
      .map((key) => ({
        key,
        title: sectionTitle(key),
        items: items.filter((it) => sectionForType(it?.type) === key),
      }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">Aucun article dans votre menu. Commencez par en ajouter un !</p>
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.key} className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-2">
              <h3 className="text-xs sm:text-sm font-black tracking-widest uppercase text-gray-800">
                {group.title}
              </h3>
              <span className="text-xs font-semibold text-gray-600">{group.items.length}</span>
            </div>

            <div className="grid gap-4 items-start sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => {
                const available = item?.available !== false;
                const canToggle = typeof onSetAvailability === 'function';
                const open = disclosure.isOpen(item.id);
                const summaryText = getItemSummaryText(item);

                return (
                  <Card
                    key={item.id}
                    className={`self-start overflow-hidden rounded-[24px] border border-slate-200/70 shadow-sm transition-shadow hover:shadow-md ${
                      available ? 'bg-white' : 'opacity-75'
                    } ${
                      flashItemId === item.id
                        ? 'ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-400/15 bg-emerald-50/40'
                        : ''
                    }`}
                  >
                    {/* Preview (tuile compacte) */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => disclosure.toggle(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          disclosure.toggle(item.id);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <CardContent className="p-4 flex flex-col gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-base shrink-0 mt-px">{typeEmoji(item.type)}</span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-[15px] leading-snug text-gray-900 wrap-break-word whitespace-normal">
                              {item.name}
                            </h4>
                          </div>
                        </div>

                        {/* Réserver la même hauteur pour le bloc prix (1 / 2 / 3 tailles) */}
                        <div className="min-h-12">{renderCompactPriceLine({ item, formatPrice })}</div>

                        {/* Footer actions: flèche + pause/lecture + corbeille (même style que panier) */}
                        <div className="mt-auto flex items-center justify-start">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                disclosure.toggle(item.id);
                              }}
                              title={open ? 'Masquer les détails' : 'Voir les détails'}
                              aria-label={open ? 'Masquer les détails' : 'Voir les détails'}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                              />
                            </button>

                            {canToggle && (
                              <button
                                type="button"
                                className={
                                  available
                                    ? 'p-1.5 rounded-lg text-orange-700/80 hover:text-orange-700 hover:bg-orange-50 transition-all'
                                    : 'p-1.5 rounded-lg text-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all'
                                }
                                title={
                                  available
                                    ? 'Mettre en pause (masquer du menu public)'
                                    : 'Remettre en vente (afficher sur le menu public)'
                                }
                                aria-label={
                                  available
                                    ? 'Mettre en pause (masquer du menu public)'
                                    : 'Remettre en vente (afficher sur le menu public)'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Feedback visuel plus fort uniquement quand on PAUSE.
                                  if (available) flashTile(item.id);
                                  onSetAvailability(item.id, !available);
                                }}
                              >
                                {available ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                              }}
                              title="Supprimer"
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* Détails */}
                    {open && (
                      <div className="border-t border-slate-100 bg-slate-50/60 animate-in slide-in-from-top-2 duration-200">
                        <div className="p-4 space-y-3">
                          {summaryText ? (
                            <div className="text-xs text-gray-700 leading-relaxed">{summaryText}</div>
                          ) : (
                            <div className="text-xs text-gray-500">Aucune description.</div>
                          )}

                          {/* Boissons: afficher volumes si présents */}
                          {['soda', 'eau', 'biere', 'vin'].includes(String(item?.type || '').toLowerCase()) &&
                            item?.sizes &&
                            typeof item.sizes === 'object' &&
                            Object.keys(item.sizes).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(item.sizes)
                                  .sort(([a], [b]) => {
                                    const order = ['25cl', '33cl', '50cl', '75cl', '1l', '1.5l'];
                                    const ia = order.indexOf(String(a).toLowerCase());
                                    const ib = order.indexOf(String(b).toLowerCase());
                                    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
                                    if (ia === -1) return 1;
                                    if (ib === -1) return -1;
                                    return ia - ib;
                                  })
                                  .map(([sizeKey, data]) => {
                                    const cents = data?.priceCents;
                                    if (typeof cents !== 'number') return null;
                                    const label = formatDrinkVolumeLabel(sizeKey) || sizeKey;
                                    return (
                                      <span
                                        key={sizeKey}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-900"
                                      >
                                        {label} · {formatPrice(cents)}
                                      </span>
                                    );
                                  })
                                  .filter(Boolean)}
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
