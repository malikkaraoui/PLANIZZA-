import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from './Input';

/**
 * Composant d'autocomplétion d'adresse utilisant l'API Adresse Data Gouv (France)
 * API gratuite et officielle du gouvernement français
 */
export default function AddressAutocomplete({ address, onAddressChange }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  
  // Autocomplétion pour le champ manuel "Nom de rue"
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [isStreetOpen, setIsStreetOpen] = useState(false);
  const [streetLoading, setStreetLoading] = useState(false);
  const streetWrapperRef = useRef(null);

  // Fermer la liste au clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
      if (streetWrapperRef.current && !streetWrapperRef.current.contains(event.target)) {
        setIsStreetOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Rechercher des adresses via l'API
  const searchAddress = async (searchQuery) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        setSuggestions(data.features);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Erreur API:', err);
    } finally {
      setLoading(false);
    }
  };

  // Rechercher par code postal
  const searchByPostalCode = async (postalCode) => {
    if (postalCode.length !== 5) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?postcode=${postalCode}&type=municipality&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        onAddressChange({
          ...address,
          city: feature.properties.city || feature.properties.name,
          postalCode: postalCode
        });
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Erreur recherche code postal:', err);
    } finally {
      setLoading(false);
    }
  };

  // Gérer le changement de l'input
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.length >= 3) {
      searchAddress(value);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  // Sélectionner une suggestion
  const selectSuggestion = (feature) => {
    const props = feature.properties;
    
    onAddressChange({
      streetNumber: props.housenumber || '',
      street: props.street || props.name || '',
      postalCode: props.postcode || '',
      city: props.city || '',
      country: 'France'
    });

    setQuery(`${props.housenumber || ''} ${props.street || props.name || ''}, ${props.city || ''}`);
    setIsOpen(false);
    setSuggestions([]);
  };

  // Gérer le changement du code postal
  const handlePostalCodeChange = (e) => {
    const value = e.target.value;
    onAddressChange({ ...address, postalCode: value });
    
    if (value.length === 5) {
      searchByPostalCode(value);
    }
  };

  // Rechercher des rues via l'API (pour le champ manuel "Nom de rue")
  const searchStreet = async (streetQuery) => {
    if (streetQuery.length < 3) {
      setStreetSuggestions([]);
      return;
    }

    setStreetLoading(true);
    try {
      // Construire la requête avec contexte (code postal + ville si disponibles)
      let searchQuery = streetQuery;
      if (address.city) {
        searchQuery = `${streetQuery} ${address.city}`;
      }
      if (address.postalCode && address.postalCode.length === 5) {
        searchQuery = `${streetQuery} ${address.postalCode}`;
      }

      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}&limit=8&type=street`
      );
      const data = await response.json();
      
      if (data.features) {
        setStreetSuggestions(data.features);
        setIsStreetOpen(true);
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Erreur recherche rue:', err);
    } finally {
      setStreetLoading(false);
    }
  };

  // Gérer le changement du champ "Nom de rue"
  const handleStreetChange = (e) => {
    const value = e.target.value;
    onAddressChange({ ...address, street: value });
    
    if (value.length >= 3) {
      searchStreet(value);
    } else {
      setStreetSuggestions([]);
      setIsStreetOpen(false);
    }
  };

  // Sélectionner une suggestion de rue
  const selectStreetSuggestion = (feature) => {
    const props = feature.properties;
    
    onAddressChange({
      ...address,
      street: props.street || props.name || '',
      postalCode: props.postcode || address.postalCode,
      city: props.city || address.city
    });

    setIsStreetOpen(false);
    setStreetSuggestions([]);
  };

  return (
    <div className="space-y-4">
      {/* Recherche d'adresse complète */}
      <div ref={wrapperRef} className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          🔍 Rechercher une adresse
        </label>
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Ex: 10 rue de la Paix, Paris"
            className="pr-10"
          />
          <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>

        {/* Liste de suggestions */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {suggestions.map((feature, index) => {
              const props = feature.properties;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectSuggestion(feature)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900">
                    {props.housenumber && `${props.housenumber} `}
                    {props.street || props.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {props.postcode} {props.city}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* OU divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">ou saisir manuellement</span>
        </div>
      </div>

      {/* Formulaire manuel */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Input
            type="text"
            value={address.streetNumber}
            onChange={(e) => onAddressChange({ ...address, streetNumber: e.target.value })}
            placeholder="N°"
            className="col-span-1"
          />
          <div ref={streetWrapperRef} className="col-span-2 relative">
            <Input
              type="text"
              value={address.street}
              onChange={handleStreetChange}
              placeholder="Nom de rue"
            />
            
            {/* Liste de suggestions pour le nom de rue */}
            {isStreetOpen && streetSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto">
                {streetSuggestions.map((feature, index) => {
                  const props = feature.properties;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectStreetSuggestion(feature)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900 text-sm">
                        {props.street || props.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {props.postcode} {props.city}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            {streetLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <Input
            type="text"
            value={address.postalCode}
            onChange={handlePostalCodeChange}
            placeholder="Code postal"
            className="col-span-1"
            maxLength={5}
          />
          <Input
            type="text"
            value={address.city}
            onChange={(e) => onAddressChange({ ...address, city: e.target.value })}
            placeholder="Ville"
            className="col-span-2"
          />
        </div>

{/* Pays bloqué sur France */}
        <div className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-gray-100 text-gray-600">
          🇫🇷 France
        </div>
      </div>
    </div>
  );
}
