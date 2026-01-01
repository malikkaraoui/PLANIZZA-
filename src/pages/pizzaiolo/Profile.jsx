import { useState, useEffect } from 'react';
import { ref, get, set, push, update } from 'firebase/database';
import { Pause, Play } from 'lucide-react';
import Card from '../../components/ui/Card';
import { useAuth } from '../../app/providers/AuthProvider';
import { useUserProfile } from '../../features/users/hooks/useUserProfile';
import { db } from '../../lib/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import LocationPicker from '../../components/ui/LocationPicker';
import ImageUploader from '../../components/ui/ImageUploader';
import { useTruckPause } from '../../features/trucks/hooks/useTruckPause';
import { useActiveOrdersCount } from '../../features/orders/hooks/useActiveOrdersCount';
import { Badge } from '../../components/ui/Badge';

function initialsFromUser({ email, displayName } = {}) {
  const base = (displayName || email || '').trim();
  if (!base) return 'P';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function PizzaioloProfile() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();

  const email = profile?.email || user?.email || null;
  const displayName = profile?.displayName || user?.displayName || null;
  const photoURL = profile?.photoURL || user?.photoURL || null;

  // Mode édition ou visualisation
  const [isEditing, setIsEditing] = useState(false);

  // États du formulaire camion
  const [truckName, setTruckName] = useState('');
  const [truckDescription, setTruckDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [ovenType, setOvenType] = useState('Bois');
  
  // Badges
  const [badges, setBadges] = useState({
    bio: false,
    terroir: false,
    sansGluten: false,
    halal: false,
    kasher: false,
    sucre: false
  });

  // Livraison
  const [deliveryOptions, setDeliveryOptions] = useState({
    deliveroo: false,
    uber: false
  });

  // Horaires
  const [openingHours, setOpeningHours] = useState({
    monday: { enabled: true, open: '11:00', close: '22:00' },
    tuesday: { enabled: true, open: '11:00', close: '22:00' },
    wednesday: { enabled: true, open: '11:00', close: '22:00' },
    thursday: { enabled: true, open: '11:00', close: '22:00' },
    friday: { enabled: true, open: '11:00', close: '22:00' },
    saturday: { enabled: true, open: '11:00', close: '23:00' },
    sunday: { enabled: false, open: '11:00', close: '22:00' }
  });

  // Cadence de travail
  const [pizzaPerHour, setPizzaPerHour] = useState(30);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [truckId, setTruckId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const { togglePause, isUpdating: isPauseUpdating } = useTruckPause(truckId);
  const { count: activeOrdersCount } = useActiveOrdersCount(truckId);

  // Fonction toggle pause
  const handleTogglePause = async () => {
    if (!truckId || isPauseUpdating) return;

    // Si on veut passer en pause et qu'il y a des commandes actives
    if (!isPaused && activeOrdersCount > 0) {
      const confirmPause = window.confirm(
        `⚠️ Attention ! Vous avez ${activeOrdersCount} commande${activeOrdersCount > 1 ? 's' : ''} en cours.\n\n` +
        `En passant en pause, vous ne recevrez plus de nouvelles commandes, mais vous devrez honorer les commandes déjà acceptées.\n\n` +
        `Souhaitez-vous continuer ?`
      );
      
      if (!confirmPause) return;
    }

    try {
      const newIsPaused = await togglePause(isPaused);
      setIsPaused(newIsPaused);
    } catch (err) {
      console.error('[Profile] Erreur toggle pause:', err);
    }
  };

  // Charger les données existantes
  useEffect(() => {
    if (!user?.uid) return;

    const loadTruckData = async () => {
      try {
        const pizzaioloRef = ref(db, `pizzaiolos/${user.uid}`);
        const snap = await get(pizzaioloRef);
        
        console.log('[PLANIZZA] Chargement pizzaiolo:', snap.exists(), snap.val());
        
        if (snap.exists()) {
          const data = snap.val();
          const existingTruckId = data.truckId;
          setTruckId(existingTruckId);

          console.log('[PLANIZZA] TruckId trouvé:', existingTruckId);

          // Charger les données du camion
          const truckRef = ref(db, `public/trucks/${existingTruckId}`);
          const truckSnap = await get(truckRef);
          
          console.log('[PLANIZZA] Camion trouvé:', truckSnap.exists());
          
          if (truckSnap.exists()) {
            const truck = truckSnap.val();
            setTruckName(truck.name || '');
            setTruckDescription(truck.description || '');
            setIsPaused(truck.isPaused || false);
            setLocation(truck.location || null);
            setLogoUrl(truck.logoUrl || '');
            setPhotoUrl(truck.photoUrl || '');
            setOvenType(truck.ovenType || 'Bois');
            setBadges(truck.badges || {});
            setDeliveryOptions(truck.deliveryOptions || {});
            setOpeningHours(truck.openingHours || openingHours);
            setPizzaPerHour(truck.capacity?.pizzaPerHour || 30);
            
            console.log('[PLANIZZA] Données camion chargées:', truck);
          }
        } else {
          console.log('[PLANIZZA] Aucun camion existant pour cet utilisateur');
          setIsEditing(true); // Passer en mode édition si pas de camion
        }
      } catch (err) {
        console.error('Erreur chargement camion:', err);
      }
    };

    loadTruckData();
  }, [user?.uid]);

  const handleSaveTruck = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSaving(true);
    setMessage('');

    try {
      let finalTruckId = truckId;

      // Si pas de truckId, en créer un nouveau
      if (!finalTruckId) {
        const trucksRef = ref(db, 'public/trucks');
        const newTruckRef = push(trucksRef);
        finalTruckId = newTruckRef.key;
        setTruckId(finalTruckId);

        // Créer le lien pizzaiolo -> truck
        await set(ref(db, `pizzaiolos/${user.uid}`), {
          truckId: finalTruckId,
          createdAt: Date.now()
        });
      }

      // Charger le menu existant pour le préserver
      const existingTruckRef = ref(db, `public/trucks/${finalTruckId}`);
      const existingTruckSnap = await get(existingTruckRef);
      const existingMenu = existingTruckSnap.exists() ? existingTruckSnap.val().menu : null;

      // Sauvegarder les données du camion
      const truckData = {
        name: truckName.trim(),
        description: truckDescription.trim(),
        logoUrl: logoUrl.trim(),
        photoUrl: photoUrl.trim(),
        location: location || { lat: 0, lng: 0, address: '' },
        city: location?.address?.split(',').pop()?.trim() || 'France',
        ovenType,
        badges,
        deliveryOptions,
        openingHours,
        capacity: { minPerPizza: 10, pizzaPerHour: parseInt(pizzaPerHour) || 30 },
        ratingAvg: 0,
        ratingCount: 0,
        isOpenNow: true,
        openingToday: 'Ouvert maintenant',
        estimatedPrepMin: 15,
        updatedAt: Date.now()
      };

      // Préserver le menu existant
      if (existingMenu) {
        truckData.menu = existingMenu;
      }

      // Ajouter createdAt uniquement si nouveau camion
      if (!truckId) {
        truckData.createdAt = Date.now();
      }

      await set(ref(db, `public/trucks/${finalTruckId}`), truckData);

      setMessage('✅ Camion sauvegardé avec succès !');
      
      console.log('[PLANIZZA] Camion créé/mis à jour:', {
        truckId: finalTruckId,
        ...truckData
      });

      // Recharger les données pour s'assurer que tout est synchronisé
      const truckRef = ref(db, `public/trucks/${finalTruckId}`);
      const truckSnap = await get(truckRef);
      
      if (truckSnap.exists()) {
        const truck = truckSnap.val();
        setTruckName(truck.name || '');
        setTruckDescription(truck.description || '');
        setLocation(truck.location || null);
        setLogoUrl(truck.logoUrl || '');
        setPhotoUrl(truck.photoUrl || '');
        setOvenType(truck.ovenType || 'Bois');
        setBadges(truck.badges || {});
        setDeliveryOptions(truck.deliveryOptions || {});
        setOpeningHours(truck.openingHours || openingHours);
        setPizzaPerHour(truck.capacity?.pizzaPerHour || 30);
      }

      // Basculer en mode visualisation
      setIsEditing(false);
    } catch (err) {
      console.error('Erreur sauvegarde camion:', err);
      setMessage('❌ Erreur lors de la sauvegarde. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const toggleBadge = (key) => {
    setBadges(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDelivery = (key) => {
    setDeliveryOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-xl font-bold text-gray-900">Mon compte</h1>
        <p className="mt-2 text-gray-600">
          {profileLoading ? 'Chargement du profil…' : 'Informations de connexion.'}
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full border bg-gray-50 overflow-hidden flex items-center justify-center text-sm font-extrabold text-gray-700">
            {photoURL ? (
              <img
                src={photoURL}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              initialsFromUser({ email, displayName })
            )}
          </div>

          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">
              {displayName || 'Utilisateur'}
            </div>
            <div className="text-sm text-gray-600 truncate">
              {email || 'Email indisponible'}
            </div>
          </div>
        </div>
      </Card>

      {!truckId ? (
        <Card className="p-8 text-center border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">🚚</div>
          <h2 className="text-2xl font-bold text-gray-900">Créez votre camion pizza</h2>
          <p className="mt-2 text-gray-600">Commencez par renseigner les informations de votre camion</p>
          <Button onClick={() => setIsEditing(true)} className="mt-6">
            Créer mon camion
          </Button>
        </Card>
      ) : !isEditing ? (
        // MODE VISUALISATION
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">🍕 Mon Camion</h2>
                <p className="mt-1 text-gray-600">Votre vitrine professionnelle</p>
              </div>
              {isPaused && (
                <Badge variant="secondary" className="mt-1">
                  <Pause className="h-3 w-3 mr-1" />
                  En pause
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleTogglePause}
                disabled={isPauseUpdating}
                size="sm"
                variant={isPaused ? "default" : "outline"}
                className={isPaused ? "bg-emerald-500 hover:bg-emerald-600" : ""}
              >
                {isPauseUpdating ? (
                  '...'
                ) : isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Relancer
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
              <Button onClick={() => setIsEditing(true)} variant="outline">
                ✏️ Modifier
              </Button>
            </div>
          </div>

          {/* Photos */}
          {(logoUrl || photoUrl) && (
            <div className="grid gap-4 mb-6">
              {photoUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Photo principale</p>
                  <img
                    src={photoUrl}
                    alt={truckName}
                    className="w-full h-64 object-cover rounded-lg border border-gray-300"
                  />
                </div>
              )}
              {logoUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Logo</p>
                  <img
                    src={logoUrl}
                    alt={`Logo ${truckName}`}
                    className="w-32 h-32 object-contain rounded-lg border border-gray-300 bg-white p-2"
                  />
                </div>
              )}
            </div>
          )}

          {/* Informations */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{truckName || 'Sans nom'}</h3>
              {truckDescription && (
                <p className="mt-1 text-gray-700">{truckDescription}</p>
              )}
            </div>

            {/* Type de four */}
            {ovenType && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">🔥 Type de four</p>
                <p className="text-sm text-gray-700">{ovenType}</p>
              </div>
            )}

            {/* Emplacement */}
            {location?.address && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">📍 Emplacement</p>
                <p className="text-sm text-gray-700">{location.address}</p>
                {location.lat && location.lng && (
                  <p className="text-xs text-gray-500 mt-1">
                    Coordonnées: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                )}
              </div>
            )}

            {/* Badges */}
            {Object.values(badges).some(v => v) && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">🏷️ Badges</p>
                <div className="flex flex-wrap gap-2">
                  {badges.bio && <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">🌱 Bio</span>}
                  {badges.terroir && <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">🌾 Terroir</span>}
                  {badges.sansGluten && <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">🚫🌾 Sans gluten</span>}
                  {badges.halal && <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">☪️ Halal</span>}
                  {badges.kasher && <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">✡️ Kasher</span>}
                  {badges.sucre && <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm">🍰 Sucré</span>}
                </div>
              </div>
            )}

            {/* Livraison */}
            {(deliveryOptions.deliveroo || deliveryOptions.uber) && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">🚴 Options de livraison</p>
                <div className="flex gap-2">
                  {deliveryOptions.deliveroo && <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">Deliveroo</span>}
                  {deliveryOptions.uber && <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">Uber Eats</span>}
                </div>
              </div>
            )}

            {/* Horaires */}
            {openingHours && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">🕐 Horaires d'ouverture</p>
                <div className="space-y-1 text-sm">
                  {Object.entries(openingHours).map(([day, hours]) => {
                    const dayLabels = {
                      monday: 'Lundi',
                      tuesday: 'Mardi',
                      wednesday: 'Mercredi',
                      thursday: 'Jeudi',
                      friday: 'Vendredi',
                      saturday: 'Samedi',
                      sunday: 'Dimanche'
                    };
                    return hours.enabled ? (
                      <p key={day} className="text-gray-700">
                        <span className="font-medium">{dayLabels[day]}:</span> {hours.open} - {hours.close}
                      </p>
                    ) : (
                      <p key={day} className="text-gray-400">
                        <span className="font-medium">{dayLabels[day]}:</span> Fermé
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cadence */}
            {pizzaPerHour && (
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">⚡ Cadence de travail</p>
                <p className="text-sm text-gray-700">{pizzaPerHour} pizzas/heure</p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        // MODE ÉDITION
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">🍕 Configuration du Camion</h2>
              <p className="mt-1 text-gray-600">Renseignez les informations de votre camion pizza</p>
            </div>
            {truckId && (
              <Button onClick={() => setIsEditing(false)} variant="outline">
                Annuler
              </Button>
            )}
          </div>

        <form onSubmit={handleSaveTruck} className="mt-6 space-y-6">
          {/* Informations de base */}
          <div>
            <h3 className="font-semibold text-gray-900">Informations de base</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom du camion *</label>
                <Input
                  value={truckName}
                  onChange={(e) => setTruckName(e.target.value)}
                  placeholder="Ex: Pizza Sole Napoli"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={truckDescription}
                  onChange={(e) => setTruckDescription(e.target.value)}
                  placeholder="Ex: Pizzas artisanales au feu de bois..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Type de four */}
          <div>
            <h3 className="font-semibold text-gray-900">🔥 Type de four</h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Choisissez votre type de four *</label>
              <select
                value={ovenType}
                onChange={(e) => setOvenType(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                required
              >
                <option value="Bois">🪵 Bois</option>
                <option value="Gaz">⛽ Gaz</option>
                <option value="Électrique">⚡ Électrique</option>
                <option value="Charbon">🪨 Charbon</option>
              </select>
            </div>
          </div>

          {/* Localisation */}
          <div>
            <h3 className="font-semibold text-gray-900">📍 Emplacement</h3>
            <div className="mt-4">
              <LocationPicker
                value={location}
                onChange={setLocation}
              />
            </div>
          </div>

          {/* Médias */}
          <div>
            <h3 className="font-semibold text-gray-900">📸 Photos & Logo</h3>
            <div className="mt-4 space-y-6">
              <ImageUploader
                value={logoUrl}
                onChange={setLogoUrl}
                label="Logo du camion"
                folder="logos"
              />

              <ImageUploader
                value={photoUrl}
                onChange={setPhotoUrl}
                label="Photo principale du camion"
                folder="trucks"
              />
            </div>
          </div>

          {/* Badges */}
          <div>
            <h3 className="font-semibold text-gray-900">🏷️ Badges</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { key: 'bio', label: '🌱 Bio' },
                { key: 'terroir', label: '🌾 Terroir' },
                { key: 'sansGluten', label: '🚫🌾 Sans gluten' },
                { key: 'halal', label: '☪️ Halal' },
                { key: 'kasher', label: '✡️ Kasher' },
                { key: 'sucre', label: '🍰 Sucré' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={badges[key]}
                    onChange={() => toggleBadge(key)}
                    className="rounded"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Livraison */}
          <div>
            <h3 className="font-semibold text-gray-900">🚴 Options de livraison</h3>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deliveryOptions.deliveroo}
                  onChange={() => toggleDelivery('deliveroo')}
                  className="rounded"
                />
                <span className="text-sm">Deliveroo</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deliveryOptions.uber}
                  onChange={() => toggleDelivery('uber')}
                  className="rounded"
                />
                <span className="text-sm">Uber Eats</span>
              </label>
            </div>
          </div>

          {/* Horaires d'ouverture */}
          <div>
            <h3 className="font-semibold text-gray-900">🕐 Horaires d'ouverture</h3>
            <div className="mt-4 space-y-3">
              {[
                { key: 'monday', label: 'Lundi' },
                { key: 'tuesday', label: 'Mardi' },
                { key: 'wednesday', label: 'Mercredi' },
                { key: 'thursday', label: 'Jeudi' },
                { key: 'friday', label: 'Vendredi' },
                { key: 'saturday', label: 'Samedi' },
                { key: 'sunday', label: 'Dimanche' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer w-32">
                    <input
                      type="checkbox"
                      checked={openingHours[key].enabled}
                      onChange={(e) => setOpeningHours(prev => ({
                        ...prev,
                        [key]: { ...prev[key], enabled: e.target.checked }
                      }))}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                  
                  {openingHours[key].enabled && (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={openingHours[key].open}
                        onChange={(e) => setOpeningHours(prev => ({
                          ...prev,
                          [key]: { ...prev[key], open: e.target.value }
                        }))}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="time"
                        value={openingHours[key].close}
                        onChange={(e) => setOpeningHours(prev => ({
                          ...prev,
                          [key]: { ...prev[key], close: e.target.value }
                        }))}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cadence de travail */}
          <div>
            <h3 className="font-semibold text-gray-900">⚡ Cadence de travail</h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de pizzas par heure *
              </label>
              <Input
                type="number"
                value={pizzaPerHour}
                onChange={(e) => setPizzaPerHour(e.target.value)}
                placeholder="30"
                min="1"
                max="100"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Indique votre capacité de production (pizzas/heure)
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${message.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
              {message}
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Sauvegarde en cours...' : truckId ? 'Mettre à jour le camion' : 'Créer mon camion'}
          </Button>
        </form>
      </Card>
      )}
    </div>
  );
}
