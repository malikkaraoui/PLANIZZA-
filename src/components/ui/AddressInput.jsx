import { Input } from './Input';
import { useAddressAutocomplete } from '../../hooks/useAddressAutocomplete';

/**
 * Composant d'input adresse avec autocomplétion via l'API adresse.data.gouv.fr
 * - Autocomplétion de la rue
 * - Remplissage automatique de la ville depuis le code postal
 * - France fixe
 */
export default function AddressInput({
  streetNumber,
  street,
  postalCode,
  city,
  onStreetNumberChange,
  onStreetChange,
  onPostalCodeChange,
  onCityChange,
  onAddressSelect,
  className = '',
  showCountry = true,
}) {
  const {
    streetSuggestions,
    showStreetSuggestions,
    loadingStreet,
    streetWrapperRef,
    searchStreet,
    searchCityByPostalCode,
    selectSuggestion,
  } = useAddressAutocomplete();

  const handleStreetChange = (e) => {
    const value = e.target.value;
    onStreetChange(value);
    searchStreet(value);
  };

  const handlePostalCodeChange = async (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    onPostalCodeChange(value);

    if (value.length === 5) {
      const cityName = await searchCityByPostalCode(value);
      if (cityName) {
        onCityChange(cityName);
      }
    }
  };

  const handleSuggestionSelect = (feature) => {
    const address = selectSuggestion(feature);

    // Mettre à jour tous les champs
    onStreetNumberChange(address.streetNumber);
    onStreetChange(address.street);
    onPostalCodeChange(address.postalCode);
    onCityChange(address.city);

    // Callback optionnel
    if (onAddressSelect) {
      onAddressSelect(address);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-3 gap-3" ref={streetWrapperRef}>
        <Input
          type="text"
          value={streetNumber}
          onChange={(e) => onStreetNumberChange(e.target.value)}
          placeholder="N°"
          className="col-span-1"
        />
        <div className="col-span-2 relative">
          <Input
            type="text"
            value={street}
            onChange={handleStreetChange}
            placeholder="Nom de rue"
            autoComplete="off"
          />
          {loadingStreet && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
          {showStreetSuggestions && streetSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto">
              {streetSuggestions.map((feature, index) => {
                const props = feature.properties;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionSelect(feature)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {props.housenumber && `${props.housenumber} `}
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input
          type="text"
          value={postalCode}
          onChange={handlePostalCodeChange}
          placeholder="Code postal"
          className="col-span-1"
          maxLength={5}
        />
        <Input
          type="text"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="Ville"
          className="col-span-2"
        />
      </div>

      {showCountry && (
        <div className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-gray-100 text-gray-500">
          🇫🇷 France
        </div>
      )}
    </div>
  );
}
