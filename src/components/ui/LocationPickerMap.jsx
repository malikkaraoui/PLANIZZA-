import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue with Vite
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_CENTER = [46.603354, 1.888334]; // Centre de la France

function ensureDefaultMarkerIcon() {
  // Evite de réassigner à chaque render
  if (L?.Marker?.prototype?.options?.icon?._planizzaPatched) return;

  const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  // Marqueur pour éviter un double patch
  DefaultIcon._planizzaPatched = true;

  L.Marker.prototype.options.icon = DefaultIcon;
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

// Composant pour gérer les clics sur la carte
function LocationMarker({ position, onPositionChange }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onPositionChange?.({ lat, lng });

      // Reverse geocoding pour obtenir l'adresse
      reverseGeocode(lat, lng).then((addr) => {
        if (addr) {
          onPositionChange?.({ lat, lng, address: addr });
        }
      });
    },
  });

  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

export default function LocationPickerMap({ position, onPositionChange }) {
  // Le patch icon doit être fait côté client (Leaflet touche au DOM)
  ensureDefaultMarkerIcon();

  const center = position?.lat && position?.lng ? [position.lat, position.lng] : DEFAULT_CENTER;
  const zoom = position?.lat && position?.lng ? 15 : 6;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '400px', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker position={position} onPositionChange={onPositionChange} />
    </MapContainer>
  );
}
