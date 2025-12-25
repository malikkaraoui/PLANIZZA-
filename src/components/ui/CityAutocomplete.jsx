import { useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash.debounce';
import { searchFrenchCities, sortCitiesByProximity } from '../../lib/franceCities';

function formatHint(city) {
  const pc = city.postcodes?.[0];
  const dept = city.departmentName;
  const parts = [pc, dept].filter(Boolean);
  return parts.join(' · ');
}

function highlightMatch(text, query) {
  const t = String(text || '');
  const q = String(query || '').trim();
  if (!t || q.length < 2) return t;

  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return t;

  const before = t.slice(0, idx);
  const mid = t.slice(idx, idx + q.length);
  const after = t.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="text-primary font-black underline decoration-primary/30 decoration-2 underline-offset-4">{mid}</span>
      {after}
    </>
  );
}

export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
  onSearch,
  placeholder = 'Adresse, ville…',
  ariaLabel = 'Où',
  position = null,
  inputRef,
  inputClassName = '',
  className = '',
}) {
  const innerRef = useRef(null);
  const refToUse = inputRef || innerRef;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState(null);

  const sortedItems = useMemo(() => sortCitiesByProximity(items, position), [items, position]);

  const doSearch = useMemo(
    () =>
      debounce(async (q) => {
        try {
          setError(null);
          setLoading(true);
          const res = await searchFrenchCities({ query: q, limit: 8 });
          setItems(res);
          setActiveIndex(res.length ? 0 : -1);
          setOpen(true);
        } catch (e) {
          setError(e);
          setItems([]);
          setActiveIndex(-1);
          setOpen(false);
        } finally {
          setLoading(false);
        }
      }, 250),
    []
  );

  useEffect(() => {
    return () => {
      doSearch.cancel();
    };
  }, [doSearch]);

  const handleChange = (e) => {
    const next = e.target.value;
    onChange?.(next);
    const trimmed = next.trim();

    if (trimmed.length < 2) {
      doSearch.cancel();
      setItems([]);
      setOpen(false);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    doSearch(trimmed);
  };

  const pick = (city) => {
    if (!city) return;
    onSelect?.(city);
    setOpen(false);
    setItems([]);
    setActiveIndex(-1);
  };

  const onKeyDown = (e) => {
    // Validation via Entrée même si le tiroir n'est pas ouvert
    // (ex: l'utilisateur finit de taper et appuie sur Entrée).
    if (!open && e.key === 'Enter') {
      // Dans un <form>, ça éviterait un submit involontaire si le parent gère via onSearch.
      // Si le parent ne fournit pas onSearch, ça n'a pas d'impact.
      if (onSearch) e.preventDefault();
      onSearch?.(value);
      setOpen(false);
      return;
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (sortedItems.length) setOpen(true);
      return;
    }

    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(sortedItems.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && sortedItems[activeIndex]) {
        e.preventDefault();
        pick(sortedItems[activeIndex]);
      } else {
        // Si aucun item n'est actif, on déclenche une recherche manuelle immédiate
        onSearch?.(value);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // fermeture au clic extérieur
  useEffect(() => {
    const onDocDown = (evt) => {
      const el = evt.target;
      const root = refToUse.current?.closest?.('[data-city-autocomplete-root]');
      if (!root) return;
      if (root.contains(el)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [refToUse]);

  return (
    <div className={`relative ${className}`} data-city-autocomplete-root>
      <input
        ref={refToUse}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (sortedItems.length) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full bg-transparent outline-none transition-all placeholder:text-muted-foreground/40 ${inputClassName}`}
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {open && sortedItems.length > 0 && (
        <div className="absolute left-0 right-0 mt-4 rounded-3xl glass-premium glass-glossy shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border-white/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <ul className="max-h-80 overflow-auto py-3 custom-scrollbar">
            {sortedItems.map((c, idx) => {
              const active = idx === activeIndex;
              const hint = formatHint(c);
              return (
                <li key={`${c.code || c.name}-${idx}`} className="px-2">
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    className={`w-full text-left px-5 py-3 rounded-2xl transition-all duration-200 group/item ${active ? 'bg-white/20 translate-x-1' : 'hover:bg-white/10'
                      }`}
                  >
                    <div className={`text-base font-black tracking-tight transition-colors ${active ? 'text-primary' : 'text-foreground'}`}>
                      {highlightMatch(c.name, value)}
                      {value && /^\d+$/.test(value.trim()) && c.postcodes?.some(pc => pc.includes(value.trim())) && (
                        <span className="ml-2 text-xs opacity-50 font-medium">
                          ({highlightMatch(c.postcodes?.find(pc => pc.includes(value.trim())), value)})
                        </span>
                      )}
                    </div>
                    {hint && (
                      <div className={`text-xs font-bold transition-colors ${active ? 'text-primary/60' : 'text-muted-foreground/60'}`}>
                        {hint}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {open && value.trim().length >= 2 && !loading && sortedItems.length === 0 && (
        <div className="absolute left-0 right-0 mt-4 rounded-3xl glass-premium glass-glossy p-6 text-center shadow-2xl border-white/40 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="text-sm font-bold text-muted-foreground/60">Aucun résultat pour cette recherche</p>
        </div>
      )}

      {error && (
        <div className="mt-1 text-xs text-red-600">Impossible de charger les villes.</div>
      )}
    </div>
  );
}
