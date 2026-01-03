import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ref, get, set, push, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Pause, Play, Pizza, Edit2, ArrowLeft, Trash2, Radio, ListOrdered, Utensils } from 'lucide-react';
import QRCode from 'react-qr-code';
import Card from '../../components/ui/Card';
import { useAuth } from '../../app/providers/AuthProvider';
import { useUserProfile } from '../../features/users/hooks/useUserProfile';
import { db, storage } from '../../lib/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { generateSlug } from '../../lib/utils';
import LocationPicker from '../../components/ui/LocationPicker';
import ImageUploader from '../../components/ui/ImageUploader';
import { useTruckPause } from '../../features/trucks/hooks/useTruckPause';
import { useActiveOrdersCount } from '../../features/orders/hooks/useActiveOrdersCount';
import { Badge } from '../../components/ui/Badge';
import { ROUTES } from '../../app/routes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

function initialsFromUser({ email, displayName } = {}) {
  const base = (displayName || email || '').trim();
  if (!base) return 'P';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function PizzaioloProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [truckSlug, setTruckSlug] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const { togglePause, isUpdating: isPauseUpdating } = useTruckPause(truckId);
  const { count: activeOrdersCount } = useActiveOrdersCount(truckId);
  
  // Dialog de confirmation de suppression
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fonction toggle pause
  const handleTogglePause = async () => {
    if (!truckId || isPauseUpdating) return;

    try {
      const newIsPaused = await togglePause(isPaused);
      setIsPaused(newIsPaused);

      // Si on vient de passer en pause et qu'il y a des commandes actives, afficher un rappel
      if (newIsPaused && activeOrdersCount > 0) {
        setTimeout(() => {
          alert(
            `✅ Mode pause activé\n\n` +
            `📋 Rappel : Vous avez ${activeOrdersCount} commande${activeOrdersCount > 1 ? 's' : ''} en cours à honorer.\n\n` +
            `Vous ne recevrez plus de nouvelles commandes jusqu'à la reprise de votre activité.`
          );
        }, 300);
      }
    } catch (err) {
      console.error('[Profile] Erreur toggle pause:', err);
    }
  };

  // Fonction suppression compte pro
  const handleDeleteProAccount = async () => {
    if (!user?.uid || !truckId || isDeleting) return;

    setIsDeleting(true);

    try {
      // 0. Récupérer les URLs des images du camion pour les supprimer
      const truckRef = ref(db, `public/trucks/${truckId}`);
      const truckSnap = await get(truckRef);
      
      if (truckSnap.exists()) {
        const truckData = truckSnap.val();
        
        // Supprimer le logo
        if (truckData.logoUrl && truckData.logoUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const urlParts = truckData.logoUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
              const logoPath = decodeURIComponent(urlParts);
              const logoRef = storageRef(storage, logoPath);
              await deleteObject(logoRef);
              console.log('[PLANIZZA] Logo supprimé:', logoPath);
            }
          } catch (err) {
            console.warn('[PLANIZZA] Impossible de supprimer le logo:', err);
          }
        }
        
        // Supprimer la photo du camion
        if (truckData.photoUrl && truckData.photoUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const urlParts = truckData.photoUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
              const photoPath = decodeURIComponent(urlParts);
              const photoRef = storageRef(storage, photoPath);
              await deleteObject(photoRef);
              console.log('[PLANIZZA] Photo supprimée:', photoPath);
            }
          } catch (err) {
            console.warn('[PLANIZZA] Impossible de supprimer la photo:', err);
          }
        }
      }

      // 1. Supprimer TOUTES les commandes rattachées au camion
      const ordersRef = ref(db, 'orders');
      const ordersQuery = query(ordersRef, orderByChild('truckId'), equalTo(truckId));
      const ordersSnap = await get(ordersQuery);
      
      if (ordersSnap.exists()) {
        const deletePromises = [];
        ordersSnap.forEach((orderSnap) => {
          deletePromises.push(remove(ref(db, `orders/${orderSnap.key}`)));
        });
        await Promise.all(deletePromises);
        console.log('[PLANIZZA] Commandes supprimées:', deletePromises.length);
      }

      // 2. Supprimer le camion de public/trucks (qui contient aussi le menu)
      await remove(ref(db, `public/trucks/${truckId}`));
      
      // 3. Supprimer l'entrée pizzaiolos
      await remove(ref(db, `pizzaiolos/${user.uid}`));
      
      // 4. Mettre à jour le rôle dans users
      const userRef = ref(db, `users/${user.uid}`);
      const userSnap = await get(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.val();
        await set(userRef, {
          ...userData,
          role: 'user',
          updatedAt: Date.now()
        });
      }

      console.log('[PLANIZZA] Compte pro supprimé avec succès (images + camion + menu + commandes)');
      
      // Fermer le dialog
      setShowDeleteDialog(false);
      
      // Rediriger vers l'exploration (reload pour réinitialiser l'état)
      window.location.href = '/explore';
    } catch (err) {
      console.error('[Profile] Erreur suppression compte pro:', err);
      alert('❌ Erreur lors de la suppression du compte pro. Réessayez.');
    } finally {
      setIsDeleting(false);
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
            setTruckSlug(truck.slug || null);
            
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
      const existingSlug = existingTruckSnap.exists() ? existingTruckSnap.val().slug : null;

      // Générer le slug si nouveau camion ou si pas de slug existant
      let finalSlug = existingSlug;
      if (!existingSlug) {
        // Récupérer tous les slugs existants pour éviter les doublons
        const allTrucksRef = ref(db, 'public/trucks');
        const allTrucksSnap = await get(allTrucksRef);
        const existingSlugs = [];
        if (allTrucksSnap.exists()) {
          Object.values(allTrucksSnap.val()).forEach(t => {
            if (t.slug) existingSlugs.push(t.slug);
          });
        }
        finalSlug = generateSlug(truckName.trim(), existingSlugs);
      }

      // Sauvegarder les données du camion
      const truckData = {
        slug: finalSlug,
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
        setTruckSlug(truck.slug || null);
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

  const toggleDelivery = async (key) => {
    if (!truckId) {
      // Si on est en mode édition (pas encore de truckId), juste mettre à jour l'état local
      setDeliveryOptions(prev => ({ ...prev, [key]: !prev[key] }));
      return;
    }

    // Si on est en mode visualisation, sauvegarder immédiatement dans Firebase
    const newValue = !deliveryOptions[key];
    setDeliveryOptions(prev => ({ ...prev, [key]: newValue }));

    try {
      const truckRef = ref(db, `public/trucks/${truckId}`);
      const snap = await get(truckRef);
      
      if (snap.exists()) {
        const existingData = snap.val();
        await update(truckRef, {
          deliveryOptions: {
            ...existingData.deliveryOptions,
            [key]: newValue
          },
          updatedAt: Date.now()
        });
        
        console.log(`[Profile] Option ${key} mise à jour:`, newValue);
      }
    } catch (err) {
      console.error('[Profile] Erreur mise à jour option livraison:', err);
      // Revenir à l'ancienne valeur en cas d'erreur
      setDeliveryOptions(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  return (
    <div className="space-y-8">
      {/* Bouton retour */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      {/* Navigation rapide */}
      {truckId && (
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            to={ROUTES.pizzaioloLive}
            className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-3 rounded-2xl bg-red-500/10 group-hover:bg-red-500/20 transition">
                  <Radio className="h-6 w-6 text-red-500" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>
              <div>
                <h3 className="font-black text-lg">Live</h3>
                <p className="text-xs text-muted-foreground">Prise de commande</p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloOrders}
            className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 transition">
                <ListOrdered className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-black text-lg">Commandes</h3>
                <p className="text-xs text-muted-foreground">Historique & Stats</p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloMenu}
            className="glass-premium glass-glossy border-white/20 p-6 rounded-[24px] hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition">
                <Utensils className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-black text-lg">Menu</h3>
                <p className="text-xs text-muted-foreground">Gérer mes pizzas</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {!truckId ? (
        <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-[32px] text-center">
          <div className="inline-flex p-6 rounded-3xl bg-orange-500/10 mb-6">
            <Pizza className="h-16 w-16 text-orange-500" />
          </div>
          <h2 className="text-3xl font-black tracking-tight">Créez votre camion pizza</h2>
          <p className="mt-3 text-muted-foreground font-medium">Commencez par renseigner les informations de votre camion</p>
          <Button onClick={() => setIsEditing(true)} className="mt-8 rounded-2xl px-8 h-12 font-bold bg-orange-500 hover:bg-orange-600">
            Créer mon camion
          </Button>
        </Card>
      ) : !isEditing ? (
        // MODE VISUALISATION
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px]">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-orange-500/10">
                <Pizza className="h-8 w-8 text-orange-500" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Mon Camion</h2>
                <p className="mt-1 text-muted-foreground font-medium">Votre vitrine professionnelle</p>
              </div>
              {isPaused && (
                <Badge variant="secondary" className="mt-1 rounded-full">
                  <Pause className="h-3 w-3 mr-1" />
                  En pause
                </Badge>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleTogglePause}
                disabled={isPauseUpdating}
                size="sm"
                variant={isPaused ? "default" : "outline"}
                className={isPaused ? "bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-bold" : "rounded-2xl font-bold"}
              >
                {isPauseUpdating ? (
                  '...'
                ) : isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Relancer
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-2xl font-bold">
                <Edit2 className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </div>
          </div>

          {/* QR Code Section */}
          {(truckSlug || truckId) && (
            <div className="mt-6 p-6 glass-premium rounded-3xl border border-white/20">
              <div className="text-center">
                <p className="text-sm font-bold mb-4">📱 QR Code - Accès direct à votre camion</p>
                <div className="inline-block p-4 bg-white rounded-2xl shadow-xl">
                  <QRCode
                    value={`${window.location.origin}${ROUTES.truck(truckSlug || truckId)}`}
                    size={200}
                    level="H"
                  />
                </div>
                <p className="mt-4 text-xs text-muted-foreground font-medium">
                  Scannez ce code pour accéder à votre page publique
                </p>
                <p className="mt-2 text-xs text-muted-foreground font-bold break-all">
                  {window.location.origin}{ROUTES.truck(truckSlug || truckId)}
                </p>
                {!truckSlug && (
                  <p className="mt-3 text-xs text-orange-500 font-medium">
                    💡 Modifiez et sauvegardez votre profil pour obtenir une URL optimisée
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Photos */}
          {(logoUrl || photoUrl) && (
            <div className="grid gap-6 mb-8">
              {photoUrl && (
                <div>
                  <p className="text-sm font-bold mb-3">📸 Photo principale</p>
                  <img
                    src={photoUrl}
                    alt={truckName}
                    className="w-full h-64 object-cover rounded-3xl border border-white/20 shadow-xl"
                  />
                </div>
              )}
              {logoUrl && (
                <div>
                  <p className="text-sm font-bold mb-3">🎨 Logo</p>
                  <img
                    src={logoUrl}
                    alt={`Logo ${truckName}`}
                    className="w-32 h-32 object-contain rounded-2xl border border-white/20 bg-white/5 p-3 shadow-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Informations */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black tracking-tight">{truckName || 'Sans nom'}</h3>
              {truckDescription && (
                <p className="mt-2 text-muted-foreground font-medium">{truckDescription}</p>
              )}
            </div>

            {/* Type de four */}
            {ovenType && (
              <div>
                <p className="text-sm font-bold mb-2">🔥 Type de four</p>
                <p className="text-sm text-muted-foreground font-medium">{ovenType}</p>
                
                {/* Alerte pour les installations au gaz */}
                {ovenType === 'Gaz' && (
                  <div className="mt-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-orange-500 mb-1">Rappel de sécurité</p>
                        <p className="text-xs text-muted-foreground font-medium">
                          Contrôles réguliers : faites vérifier vos installations au moins une fois par an pour garantir leur bon fonctionnement et leur conformité.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Emplacement */}
            {location?.address && (
              <div>
                <p className="text-sm font-bold mb-3">📍 Emplacement</p>
                <p className="text-sm text-muted-foreground font-medium mb-3">{location.address}</p>
                {location.lat && location.lng && (
                  <div className="mt-4 rounded-2xl overflow-hidden border border-white/20 shadow-xl">
                    <div className="bg-white/5 p-3 backdrop-blur-sm">
                      <p className="text-xs font-bold text-muted-foreground mb-1">📍 Carte de localisation</p>
                      <p className="text-xs text-muted-foreground font-medium">
                        Coordonnées: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      </p>
                    </div>
                    <iframe
                      width="100%"
                      height="200"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://www.google.com/maps?q=${location.lat},${location.lng}&z=15&output=embed`}
                      allowFullScreen
                    ></iframe>
                  </div>
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
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">🚴 Options de livraison</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => toggleDelivery('deliveroo')}
                  className={`group relative overflow-hidden rounded-[24px] p-5 transition-all duration-300 ${
                    deliveryOptions.deliveroo
                      ? 'bg-teal-500 text-white shadow-xl shadow-teal-500/30'
                      : 'glass-premium border-white/20 hover:border-teal-500/30 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="font-black text-base tracking-tight">Deliveroo</div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                      deliveryOptions.deliveroo 
                        ? 'bg-white/20 text-white' 
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {deliveryOptions.deliveroo ? '✓ Activé' : '✕ Désactivé'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => toggleDelivery('uber')}
                  className={`group relative overflow-hidden rounded-[24px] p-5 transition-all duration-300 ${
                    deliveryOptions.uber
                      ? 'bg-gray-700 text-white shadow-xl shadow-gray-700/30'
                      : 'glass-premium border-white/20 hover:border-gray-500/30 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="font-black text-base tracking-tight">Uber Eats</div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                      deliveryOptions.uber 
                        ? 'bg-white/20 text-white' 
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {deliveryOptions.uber ? '✓ Activé' : '✕ Désactivé'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

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
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-[32px]">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-orange-500/10">
                <Pizza className="h-8 w-8 text-orange-500" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">Configuration du Camion</h2>
                <p className="mt-1 text-muted-foreground font-medium">Renseignez les informations de votre camion pizza</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={handleSaveTruck} 
                disabled={saving}
                className="rounded-2xl font-bold bg-orange-500 hover:bg-orange-600"
              >
                {saving ? 'Enregistrement...' : '✓ Valider'}
              </Button>
              {truckId && (
                <Button onClick={() => setIsEditing(false)} variant="outline" className="rounded-2xl font-bold">
                  Annuler
                </Button>
              )}
            </div>
          </div>

        <form onSubmit={handleSaveTruck} className="mt-8 space-y-8">
          {/* Informations de base */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Pizza className="h-5 w-5 text-primary" />
              </div>
              Informations de base
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold mb-2">Nom du camion *</label>
                <Input
                  value={truckName}
                  onChange={(e) => setTruckName(e.target.value)}
                  placeholder="Ex: Pizza Sole Napoli"
                  required
                  className="rounded-2xl h-12 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Description</label>
                <textarea
                  value={truckDescription}
                  onChange={(e) => setTruckDescription(e.target.value)}
                  placeholder="Ex: Pizzas artisanales au feu de bois, pâte maison fermentée 48h..."
                  className="mt-1 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Type de four *</label>
                <select
                  value={ovenType}
                  onChange={(e) => setOvenType(e.target.value)}
                  className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all h-12"
                  required
                >
                  <option value="Bois">🪵 Bois</option>
                  <option value="Gaz">⛽ Gaz</option>
                  <option value="Électrique">⚡ Électrique</option>
                  <option value="Charbon">🪨 Charbon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Capacité de production *</label>
                <Input
                  type="number"
                  value={pizzaPerHour}
                  onChange={(e) => setPizzaPerHour(e.target.value)}
                  placeholder="30"
                  min="1"
                  max="100"
                  required
                  className="rounded-2xl h-12 font-medium"
                />
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  ⚡ Nombre de pizzas que vous pouvez produire par heure
                </p>
              </div>
            </div>
          </div>

          {/* Photos & Visuels */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10">
                <span className="text-xl">📸</span>
              </div>
              Photos & Visuels
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold mb-3">Photo du camion</label>
                <ImageUploader
                  value={photoUrl}
                  onChange={setPhotoUrl}
                  label=""
                  folder="trucks"
                />
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  🍕 Photo principale visible sur votre fiche
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold mb-3">Logo</label>
                <ImageUploader
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label=""
                  folder="logos"
                />
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  🎨 Apparaît dans les résultats de recherche
                </p>
              </div>
            </div>
          </div>

          {/* Localisation avec preview */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <span className="text-xl">📍</span>
              </div>
              Emplacement
            </h3>
            <div className="space-y-4">
              <LocationPicker
                value={location}
                onChange={setLocation}
                defaultOpen={true}
              />
            </div>
          </div>

          {/* Horaires d'ouverture modernisés */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <span className="text-xl">🕐</span>
              </div>
              Horaires d'ouverture
            </h3>
            <div className="space-y-3">
              {[
                { key: 'monday', label: 'Lun', fullLabel: 'Lundi' },
                { key: 'tuesday', label: 'Mar', fullLabel: 'Mardi' },
                { key: 'wednesday', label: 'Mer', fullLabel: 'Mercredi' },
                { key: 'thursday', label: 'Jeu', fullLabel: 'Jeudi' },
                { key: 'friday', label: 'Ven', fullLabel: 'Vendredi' },
                { key: 'saturday', label: 'Sam', fullLabel: 'Samedi' },
                { key: 'sunday', label: 'Dim', fullLabel: 'Dimanche' }
              ].map(({ key, label, fullLabel }) => (
                <div key={key} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${openingHours[key].enabled ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-white/5 border border-white/10'}`}>
                  <label className="flex items-center gap-3 cursor-pointer min-w-[120px]">
                    <input
                      type="checkbox"
                      checked={openingHours[key].enabled}
                      onChange={(e) => setOpeningHours(prev => ({
                        ...prev,
                        [key]: { ...prev[key], enabled: e.target.checked }
                      }))}
                      className="rounded w-5 h-5"
                    />
                    <div>
                      <span className="text-sm font-black block">{label}</span>
                      <span className="text-xs text-muted-foreground font-medium">{fullLabel}</span>
                    </div>
                  </label>
                  
                  {openingHours[key].enabled ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="time"
                        value={openingHours[key].open}
                        onChange={(e) => setOpeningHours(prev => ({
                          ...prev,
                          [key]: { ...prev[key], open: e.target.value }
                        }))}
                        className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-bold focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                      <span className="text-muted-foreground font-bold">→</span>
                      <input
                        type="time"
                        value={openingHours[key].close}
                        onChange={(e) => setOpeningHours(prev => ({
                          ...prev,
                          [key]: { ...prev[key], close: e.target.value }
                        }))}
                        className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-bold focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground font-medium italic">Fermé</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Badges & Options */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10">
                <span className="text-xl">🏷️</span>
              </div>
              Badges & Spécialités
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-3">Caractéristiques</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'bio', label: 'Bio', icon: '🌱', color: 'emerald' },
                    { key: 'terroir', label: 'Terroir', icon: '🌾', color: 'amber' },
                    { key: 'sansGluten', label: 'Sans gluten', icon: '🚫🌾', color: 'blue' },
                    { key: 'halal', label: 'Halal', icon: '☪️', color: 'purple' },
                    { key: 'kasher', label: 'Kasher', icon: '✡️', color: 'indigo' },
                    { key: 'sucre', label: 'Sucré', icon: '🍰', color: 'pink' }
                  ].map(({ key, label, icon, color }) => (
                    <label key={key} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all ${badges[key] ? `bg-${color}-500/10 border-2 border-${color}-500/30` : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                      <input
                        type="checkbox"
                        checked={badges[key]}
                        onChange={() => toggleBadge(key)}
                        className="rounded w-5 h-5"
                      />
                      <span className="text-lg">{icon}</span>
                      <span className="text-sm font-bold">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-3">🚴 Plateformes de livraison</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all ${deliveryOptions.deliveroo ? 'bg-teal-500/10 border-2 border-teal-500/30' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                    <input
                      type="checkbox"
                      checked={deliveryOptions.deliveroo}
                      onChange={() => toggleDelivery('deliveroo')}
                      className="rounded w-5 h-5"
                    />
                    <span className="text-sm font-bold">Deliveroo</span>
                  </label>

                  <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all ${deliveryOptions.uber ? 'bg-gray-500/10 border-2 border-gray-500/30' : 'bg-white/5 border border-white/10 hover:border-white/20'}`}>
                    <input
                      type="checkbox"
                      checked={deliveryOptions.uber}
                      onChange={() => toggleDelivery('uber')}
                      className="rounded w-5 h-5"
                    />
                    <span className="text-sm font-bold">Uber Eats</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-6 rounded-3xl font-bold ${message.includes('✅') ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              {message}
            </div>
          )}

          <div className="space-y-3">
            <Button type="submit" disabled={saving} className="w-full rounded-2xl h-14 font-bold text-lg bg-orange-500 hover:bg-orange-600">
              {saving ? 'Sauvegarde en cours...' : truckId ? 'Mettre à jour le camion' : 'Créer mon camion'}
            </Button>
            
            {truckId && (
              <Button 
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                variant="outline"
                className="w-full rounded-2xl h-12 font-bold text-red-600 border-red-600/30 hover:bg-red-600/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer le compte professionnel
              </Button>
            )}
          </div>
        </form>
      </Card>
      )}

      {/* Dialog de confirmation de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-900 border-red-500/50 border-2 rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight text-white">
              ⚠️ Supprimer le compte professionnel ?
            </DialogTitle>
          </DialogHeader>
          <div className="text-base text-gray-200 mt-4 space-y-4">
            <div className="font-semibold">Cette action supprimera définitivement :</div>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Votre camion et toutes ses informations</li>
              <li>Votre menu et vos pizzas</li>
              <li>Votre statut professionnel</li>
            </ul>
            <div className="font-bold text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/30">
              ⛔ Cette action est irréversible. Êtes-vous sûr de vouloir continuer ?
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
              disabled={isDeleting}
              className="rounded-2xl"
            >
              Non, annuler
            </Button>
            <Button
              onClick={handleDeleteProAccount}
              disabled={isDeleting}
              className="rounded-2xl bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Suppression...' : 'Oui, supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
