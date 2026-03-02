import { useState, useRef, useEffect } from 'react';
import { Navigation, Loader2, X } from 'lucide-react';
import { getBrowserPosition } from '../../lib/geo';

/**
 * Input compact pour definir l'emplacement d'un jour.
 * GPS rapide + autocomplete via api-adresse.data.gouv.fr
 * Output: { lat, lng, address }
 */
export default function DayLocationInput({ value, onChange }) {
  const [query, setQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const wrapperRef = useRef(null);

  // Sync query quand value change de l'exterieur (ex: "Copier depuis")
  useEffect(() => {
    setQuery(value?.address || '');
  }, [value?.address]);

  // Fermer dropdown au clic exterieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (q) => {
    if (q.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
      );
      const data = await res.json();
      if (data.features) {
        setSuggestions(data.features);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('[DayLocationInput] Erreur API:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (feature) => {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const address = props.label || `${props.housenumber || ''} ${props.street || props.name || ''}, ${props.postcode || ''} ${props.city || ''}`.trim();
    onChange({ lat, lng, address });
    setQuery(address);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleGPS = async () => {
    setGpsLoading(true);
    try {
      const pos = await getBrowserPosition();
      // Reverse geocode via api-adresse.data.gouv.fr
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/reverse/?lon=${pos.lng}&lat=${pos.lat}&limit=1`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const props = data.features[0].properties;
        const address = props.label || `${props.housenumber || ''} ${props.street || props.name || ''}, ${props.postcode || ''} ${props.city || ''}`.trim();
        onChange({ lat: pos.lat, lng: pos.lng, address });
        setQuery(address);
      } else {
        onChange({ lat: pos.lat, lng: pos.lng, address: `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` });
        setQuery(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
      }
    } catch (err) {
      console.error('[DayLocationInput] Erreur GPS:', err);
      alert('Impossible d\'obtenir votre position. Verifiez les autorisations GPS.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              searchAddress(e.target.value);
            }}
            placeholder="Rechercher une adresse..."
            className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 pr-8 text-sm focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleGPS}
          disabled={gpsLoading}
          className="shrink-0 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 transition-all text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {gpsLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Navigation className="h-3.5 w-3.5" />
          )}
          GPS
        </button>
        {value?.lat && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-2 rounded-xl text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-48 overflow-auto">
          {suggestions.map((feature, i) => {
            const props = feature.properties;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(feature)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {props.label || `${props.housenumber || ''} ${props.street || props.name}`}
                </div>
                <div className="text-xs text-gray-500">
                  {props.postcode} {props.city}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
