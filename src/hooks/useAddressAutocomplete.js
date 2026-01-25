import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook pour gérer l'autocomplétion d'adresses françaises
 * Utilise l'API adresse.data.gouv.fr (gratuite et officielle)
 */
export function useAddressAutocomplete() {
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);
  const [loadingStreet, setLoadingStreet] = useState(false);
  const streetWrapperRef = useRef(null);

  // Rechercher des adresses via l'API adresse.data.gouv.fr
  const searchStreet = useCallback(async (query) => {
    if (query.length < 3) {
      setStreetSuggestions([]);
      setShowStreetSuggestions(false);
      return;
    }

    setLoadingStreet(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5&type=street`
      );
      const data = await response.json();
      if (data.features) {
        setStreetSuggestions(data.features);
        setShowStreetSuggestions(true);
      }
    } catch (err) {
      console.error('[useAddressAutocomplete] Erreur API adresse:', err);
    } finally {
      setLoadingStreet(false);
    }
  }, []);

  // Rechercher la ville par code postal
  const searchCityByPostalCode = useCallback(async (code) => {
    if (code.length !== 5) return null;

    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?postcode=${code}&type=municipality&limit=1`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        return feature.properties.city || feature.properties.name || '';
      }
    } catch (err) {
      console.error('[useAddressAutocomplete] Erreur recherche code postal:', err);
    }
    return null;
  }, []);

  // Parser une suggestion en objet adresse
  const parseSuggestion = useCallback((feature) => {
    const props = feature.properties;
    return {
      streetNumber: props.housenumber || '',
      street: props.street || props.name || '',
      postalCode: props.postcode || '',
      city: props.city || '',
      country: 'France',
    };
  }, []);

  // Sélectionner une suggestion
  const selectSuggestion = useCallback((feature, onSelect) => {
    const address = parseSuggestion(feature);
    setShowStreetSuggestions(false);
    setStreetSuggestions([]);
    if (onSelect) {
      onSelect(address);
    }
    return address;
  }, [parseSuggestion]);

  // Fermer les suggestions
  const closeSuggestions = useCallback(() => {
    setShowStreetSuggestions(false);
  }, []);

  // Fermer les suggestions au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (streetWrapperRef.current && !streetWrapperRef.current.contains(event.target)) {
        setShowStreetSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    // State
    streetSuggestions,
    showStreetSuggestions,
    loadingStreet,
    streetWrapperRef,

    // Actions
    searchStreet,
    searchCityByPostalCode,
    selectSuggestion,
    closeSuggestions,
    parseSuggestion,
  };
}

export default useAddressAutocomplete;
