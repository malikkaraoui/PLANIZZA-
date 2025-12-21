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
      <mark className="rounded bg-amber-100 px-1 text-gray-900">{mid}</mark>
      {after}
    </>
  );
}

export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
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
        className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20 ${inputClassName}`}
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          …
        </div>
      )}

      {open && sortedItems.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl border bg-white shadow-lg overflow-hidden z-50">
          <ul className="max-h-72 overflow-auto py-1">
            {sortedItems.map((c, idx) => {
              const active = idx === activeIndex;
              const hint = formatHint(c);
              return (
                <li key={`${c.code || c.name}-${idx}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()} // évite blur avant click
                    onClick={() => pick(c)}
                    className={`w-full text-left px-3 py-2 transition ${
                      active ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {highlightMatch(c.name, value)}
                    </div>
                    {hint && <div className="text-xs text-gray-600">{hint}</div>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-1 text-xs text-red-600">Impossible de charger les villes.</div>
      )}
    </div>
  );
}
