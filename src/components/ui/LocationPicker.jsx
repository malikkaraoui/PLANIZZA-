import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './Button';
import { Input } from './Input';

// Fix Leaflet default icon issue with Vite
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Composant pour gérer les clics sur la carte
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition({ lat, lng });
      // Reverse geocoding pour obtenir l'adresse
      reverseGeocode(lat, lng).then(addr => {
        if (addr) {
          setPosition(prev => ({ ...prev, address: addr }));
        }
      });
    },
  });

  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

// Reverse geocoding avec Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    const data = await response.json();
    return data.display_name || '';
  } catch (err) {
    console.error('Erreur reverse geocoding:', err);
    return '';
  }
}

// Geocoding d'une adresse
async function geocodeAddress(address) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await response.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: data[0].display_name
      };
    }
    return null;
  } catch (err) {
    console.error('Erreur geocoding:', err);
    return null;
  }
}

export default function LocationPicker({ value, onChange }) {
  const [position, setPosition] = useState(
    value?.lat && value?.lng
      ? { lat: value.lat, lng: value.lng, address: value.address || '' }
      : null
  );
  const [searchAddress, setSearchAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Synchroniser avec le parent
  useEffect(() => {
    if (position && onChange) {
      onChange(position);
    }
  }, [position, onChange]);

  // Géolocalisation
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (geo) => {
        const lat = geo.coords.latitude;
        const lng = geo.coords.longitude;
        
        // Récupérer l'adresse
        const address = await reverseGeocode(lat, lng);
        
        setPosition({ lat, lng, address });
        setShowMap(true);
        setGettingLocation(false);
      },
      (error) => {
        console.error('Erreur géolocalisation:', error);
        alert('Impossible d\'obtenir votre position. Vérifiez les permissions.');
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Recherche d'adresse
  const handleSearchAddress = async (e) => {
    if (e) e.preventDefault();
    if (!searchAddress.trim()) return;

    setSearching(true);
    const result = await geocodeAddress(searchAddress);
    
    if (result) {
      setPosition(result);
      setShowMap(true);
    } else {
      alert('Adresse non trouvée. Essayez une autre recherche.');
    }
    setSearching(false);
  };

  const handlePositionChange = (newPosition) => {
    setPosition(newPosition);
  };

  // Détection mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="space-y-4">
      {/* Boutons rapides */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gettingLocation}
          className="flex-1"
        >
          {gettingLocation ? '📍 Localisation...' : isMobile ? '📍 Je suis ici' : '📍 Utiliser ma position'}
        </Button>
        
        <Button
          type="button"
          onClick={() => setShowMap(!showMap)}
          variant="outline"
          className="flex-1"
        >
          {showMap ? 'Masquer la carte' : '🗺️ Ouvrir la carte'}
        </Button>
      </div>

      {/* Recherche d'adresse */}
      <div className="flex gap-2">
        <Input
          value={searchAddress}
          onChange={(e) => setSearchAddress(e.target.value)}
          placeholder="Rechercher une adresse..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearchAddress(e);
            }
          }}
        />
        <Button 
          type="button" 
          onClick={handleSearchAddress}
          disabled={searching || !searchAddress.trim()}
        >
          {searching ? 'Recherche...' : '🔍'}
        </Button>
      </div>

      {/* Adresse sélectionnée */}
      {position && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-start gap-2">
            <span className="text-emerald-600 text-lg">✅</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Position sélectionnée</p>
              <p className="text-sm text-gray-700 mt-1">{position.address || 'Adresse en cours de récupération...'}</p>
              <p className="text-xs text-gray-500 mt-1">
                Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Carte interactive */}
      {showMap && (
        <div className="rounded-lg overflow-hidden border border-gray-300 shadow-lg">
          <div className="bg-gray-100 px-4 py-2 text-sm text-gray-700">
            💡 Cliquez sur la carte pour placer votre camion
          </div>
          <MapContainer
            center={position ? [position.lat, position.lng] : [46.603354, 1.888334]} // Centre de la France
            zoom={position ? 15 : 6}
            style={{ height: '400px', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={handlePositionChange} />
          </MapContainer>
        </div>
      )}

      {!showMap && !position && (
        <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
          <p className="text-sm">
            {isMobile 
              ? '📱 Utilisez "Je suis ici" pour vous localiser automatiquement'
              : '🖥️ Recherchez une adresse ou ouvrez la carte pour sélectionner votre emplacement'
            }
          </p>
        </div>
      )}
    </div>
  );
}
