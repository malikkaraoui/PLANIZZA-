import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ref, get, set, push, update, remove } from 'firebase/database';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { Pause, Play, Pizza, Edit2, ArrowLeft, Trash2, Radio, ListOrdered, Utensils, TrendingUp, X, Heart, Clock, Zap, MapPin, Image as ImageIcon, Download, LogOut, MessageSquare } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import QRCode from 'react-qr-code';
import Card from '../../components/ui/Card';
import { useAuth } from '../../app/providers/AuthProvider';
import { db, storage } from '../../lib/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { generateUniqueTruckSlug } from '../../features/trucks/utils/truckSlug';
import DayLocationInput from '../../components/ui/DayLocationInput';
import ImageUploader from '../../components/ui/ImageUploader';
import { useTruckPause } from '../../features/trucks/hooks/useTruckPause';
import { useActiveOrdersCount } from '../../features/orders/hooks/useActiveOrdersCount';
import { Badge } from '../../components/ui/Badge';
import { ROUTES } from '../../app/routes';
import { useAutoDismissMessage } from '../../hooks/useAutoDismissMessage';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import BackButton from '../../components/ui/BackButton';
import StripeConnectStatus from '../../components/pizzaiolo/StripeConnectStatus';
import { useTruckFavoritesCount } from '../../features/trucks/hooks/useTruckFavoritesCount';

const DEFAULT_OPENING_HOURS = {
  monday: { enabled: true, open: '11:00', close: '22:00' },
  tuesday: { enabled: true, open: '11:00', close: '22:00' },
  wednesday: { enabled: true, open: '11:00', close: '22:00' },
  thursday: { enabled: true, open: '11:00', close: '22:00' },
  friday: { enabled: true, open: '11:00', close: '22:00' },
  saturday: { enabled: true, open: '11:00', close: '23:00' },
  sunday: { enabled: false, open: '11:00', close: '22:00' },
};

export default function PizzaioloProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mode édition ou visualisation
  const [isEditing, setIsEditing] = useState(false);

  // États du formulaire camion
  const [truckName, setTruckName] = useState('');
  const [truckDescription, setTruckDescription] = useState('');
  const [locations, setLocations] = useState({});
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
  const [openingHours, setOpeningHours] = useState(DEFAULT_OPENING_HOURS);

  // Cadence de travail
  const [pizzaPerHour, setPizzaPerHour] = useState(30);

  // Fiscalité - TVA
  const [tvaEnabled, setTvaEnabled] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Les messages de succès/info doivent disparaître après 5s (les ❌ restent).
  useAutoDismissMessage(message, setMessage, { delayMs: 5000, dismissErrors: false });
  const [truckId, setTruckId] = useState(null);
  const [truckSlug, setTruckSlug] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const { togglePause, isUpdating: isPauseUpdating } = useTruckPause(truckId);
  const { count: activeOrdersCount } = useActiveOrdersCount(truckId);
  const { count: favoritesCount } = useTruckFavoritesCount(truckId);
  
  // Dialog de confirmation de suppression
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ref pour le QR code
  const qrCodeRef = useRef(null);

  // Fonction pour exporter le QR code avec logo pizza
  const exportQRCode = async () => {
    if (!qrCodeRef.current) return;

    try {
      const svg = qrCodeRef.current.querySelector('svg');
      if (!svg) return;

      // Créer un canvas pour dessiner le QR code + logo
      const canvas = document.createElement('canvas');
      const size = 800; // Taille haute résolution pour l'impression
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Fond blanc
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Convertir le SVG en image
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        // Dessiner le QR code
        ctx.drawImage(img, 0, 0, size, size);

        // Ajouter un cercle blanc au centre pour le logo
        const centerX = size / 2;
        const centerY = size / 2;
        const logoSize = size * 0.25; // Logo prend 25% du QR code

        // Cercle blanc avec bordure
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoSize / 2 + 10, 0, 2 * Math.PI);
        ctx.fill();

        // Bordure orange
        ctx.strokeStyle = '#FF8A4C';
        ctx.lineWidth = 8;
        ctx.stroke();

        // Dessiner l'emoji pizza au centre
        ctx.font = `${logoSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍕', centerX, centerY);

        // Ajouter le nom du camion en bas
        ctx.fillStyle = '#1F2937';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(truckName || 'Mon Camion', centerX, size - 40);

        // Télécharger l'image
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `qrcode-${truckSlug || truckId}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/png');

        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (err) {
      console.error('Erreur export QR code:', err);
      alert('❌ Erreur lors de l\'export du QR code');
    }
  };

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

      // 1. Commandes: on ne supprime pas côté client.
      // Les commandes doivent rester traçables. Si besoin, prévoir une Function admin.

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
      
      // Rediriger vers l'exploration (SPA)
      navigate(ROUTES.explore, { replace: true });
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
            // Migration douce : si locations existe, l'utiliser ; sinon copier location sur tous les jours actifs
            if (truck.locations && typeof truck.locations === 'object') {
              setLocations(truck.locations);
            } else if (truck.location && truck.location.lat && truck.location.lng) {
              const migratedLocations = {};
              for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
                migratedLocations[day] = { ...truck.location };
              }
              setLocations(migratedLocations);
            }
            setLogoUrl(truck.logoUrl || '');
            setPhotoUrl(truck.photoUrl || '');
            setOvenType(truck.ovenType || 'Bois');
            setBadges(truck.badges || {});
            setDeliveryOptions(truck.deliveryOptions || {});
            setOpeningHours(truck.openingHours || DEFAULT_OPENING_HOURS);
            setPizzaPerHour(truck.capacity?.pizzaPerHour || 30);
            setTruckSlug(truck.slug || null);
            setTvaEnabled(truck.legal?.tvaEnabled || false);

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
      const isNewTruck = !truckId;
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
      const existingTruck = existingTruckSnap.exists() ? (existingTruckSnap.val() || {}) : {};
      const existingMenu = existingTruck.menu || null;
      const existingSlug = existingTruck.slug || null;
      const existingName = existingTruck.name || '';

      const nextName = truckName.trim();
      const nameChanged = existingTruckSnap.exists() && String(existingName).trim() !== nextName;

      // Générer / régénérer le slug si:
      // - nouveau camion
      // - pas de slug existant
      // - renommage (=> nouvelle URL + nouveau QRCode)
      let finalSlug = existingSlug;
      if (!existingSlug || isNewTruck || nameChanged) {
        finalSlug = await generateUniqueTruckSlug({
          db,
          name: nextName,
          excludeTruckId: finalTruckId,
          suffixLength: 3,
        });
      }

      // Sauvegarder les données du camion
      const truckData = {
        // Préserver les champs non gérés par ce formulaire (ex: ownerId, legal, siret, etc.)
        ...existingTruck,

        // Mettre à jour legal avec tvaEnabled
        legal: {
          ...(existingTruck.legal || {}),
          tvaEnabled,
        },

        slug: finalSlug,
        name: nextName,
        description: truckDescription.trim(),
        logoUrl: logoUrl.trim(),
        photoUrl: photoUrl.trim(),
        locations: locations || {},
        // Retro-compat : location = emplacement du jour actuel
        location: (() => {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const today = dayNames[new Date().getDay()];
          const todayLoc = locations?.[today];
          if (todayLoc?.lat && todayLoc?.lng) return todayLoc;
          // Fallback : premier emplacement defini
          for (const d of dayNames) {
            const loc = locations?.[d];
            if (loc?.lat && loc?.lng) return loc;
          }
          return { lat: 0, lng: 0, address: '' };
        })(),
        city: (() => {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const today = dayNames[new Date().getDay()];
          const todayLoc = locations?.[today];
          const addr = todayLoc?.address;
          return addr?.split(',').pop()?.trim() || 'France';
        })(),
        ovenType,
        badges,
        deliveryOptions,
        openingHours,
        capacity: {
          ...(existingTruck.capacity || {}),
          minPerPizza: 10,
          pizzaPerHour: parseInt(pizzaPerHour) || 30,
        },
        ratingAvg: typeof existingTruck.ratingAvg === 'number' ? existingTruck.ratingAvg : 0,
        ratingCount: typeof existingTruck.ratingCount === 'number' ? existingTruck.ratingCount : 0,
        isOpenNow: existingTruck.isOpenNow ?? true,
        openingToday: existingTruck.openingToday || 'Ouvert maintenant',
        estimatedPrepMin: existingTruck.estimatedPrepMin || 15,
        updatedAt: Date.now(),
      };

      // Préserver le menu existant
      if (existingMenu) {
        truckData.menu = existingMenu;
      }

      // Ajouter createdAt uniquement si nouveau camion
      if (isNewTruck) {
        truckData.createdAt = Date.now();
      }

      await set(ref(db, `public/trucks/${finalTruckId}`), truckData);

      if (nameChanged && finalSlug && finalSlug !== existingSlug) {
        setMessage(`✅ Camion renommé ! Nouvelle URL : ${window.location.origin}${ROUTES.truck(finalSlug)}`);
      } else {
        setMessage('✅ Camion sauvegardé avec succès !');
      }
      
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
        setLocations(truck.locations || {});
        setLogoUrl(truck.logoUrl || '');
        setPhotoUrl(truck.photoUrl || '');
        setOvenType(truck.ovenType || 'Bois');
        setBadges(truck.badges || {});
        setDeliveryOptions(truck.deliveryOptions || {});
        setOpeningHours(truck.openingHours || DEFAULT_OPENING_HOURS);
        setPizzaPerHour(truck.capacity?.pizzaPerHour || 30);
        setTruckSlug(truck.slug || null);
        setTvaEnabled(truck.legal?.tvaEnabled || false);
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
      <BackButton to="/pro/truck" />

      {/* Section Stripe Connect en priorité */}
      {truckId && (
        <StripeConnectStatus userId={user?.uid} />
      )}

      {/* Navigation rapide */}
      {truckId && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            to={ROUTES.pizzaioloLive}
            className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-red-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="p-2.5 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition">
                  <Radio className="h-5 w-5 text-red-500" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight">Live</h3>
                <p className="text-[11px] text-muted-foreground truncate">Prise de commande</p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloOrders}
            className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition">
                <ListOrdered className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight">Commandes</h3>
                <p className="text-[11px] text-muted-foreground truncate">Gestion en direct</p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloStats}
            className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight">Statistiques</h3>
                <p className="text-[11px] text-muted-foreground truncate">Analytics & CA</p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloMenu}
            className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition">
                <Utensils className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight">Menu</h3>
                <p className="text-[11px] text-muted-foreground truncate">Gérer mes pizzas</p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.pizzaioloReviews}
            className="glass-premium glass-glossy border-white/20 p-4 rounded-2xl hover:border-yellow-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 p-2.5 rounded-xl bg-yellow-500/10 group-hover:bg-yellow-500/20 transition">
                <MessageSquare className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight">Avis</h3>
                <p className="text-[11px] text-muted-foreground truncate">Répondre aux clients</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {!truckId ? (
        <Card className="glass-premium glass-glossy border-white/20 p-12 rounded-4xl text-center">
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
        // MODE VISUALISATION - DASHBOARD MODERNE
        <div className="space-y-6">
          {/* Header avec actions rapides */}
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={truckName}
                    className="w-16 h-16 object-contain rounded-2xl border border-white/20 bg-white/5 p-2"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-black tracking-tight">{truckName || 'Mon Camion'}</h2>
                  <p className="text-sm text-muted-foreground font-medium">{(() => {
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const today = dayNames[new Date().getDay()];
                    return locations?.[today]?.address || 'Emplacement non defini';
                  })()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleTogglePause}
                  disabled={isPauseUpdating}
                  variant={isPaused ? "default" : "outline"}
                  className={isPaused
                    ? "bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-bold h-10 px-4"
                    : "rounded-2xl font-bold h-10 px-4 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500"}
                >
                  {isPauseUpdating ? '...' : isPaused ? (
                    <><Play className="h-4 w-4 mr-2" />Reprendre</>
                  ) : (
                    <><Pause className="h-4 w-4 mr-2" />Pause</>
                  )}
                </Button>
                <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-2xl font-bold h-10 px-4">
                  <Edit2 className="h-4 w-4 mr-2" />Modifier
                </Button>
              </div>
            </div>
          </Card>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Favoris */}
            <Card className="glass-premium glass-glossy border-white/20 p-5 rounded-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Favoris</p>
                  <p className="text-3xl font-black">{favoritesCount || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-orange-500/10">
                  <Heart className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </Card>

            {/* Commandes actives */}
            <Card className="glass-premium glass-glossy border-white/20 p-5 rounded-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Commandes actives</p>
                  <p className="text-3xl font-black">{activeOrdersCount || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-blue-500/10">
                  <Pizza className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </Card>

            {/* Cadence */}
            <Card className="glass-premium glass-glossy border-white/20 p-5 rounded-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Cadence</p>
                  <p className="text-3xl font-black">{pizzaPerHour}<span className="text-lg text-muted-foreground">/h</span></p>
                </div>
                <div className="p-3 rounded-2xl bg-purple-500/10">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </Card>
          </div>

          {/* Grid principale - 2 colonnes */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Colonne gauche - Infos principales (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informations générales */}
              <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
                <h3 className="text-lg font-black mb-4">Informations générales</h3>
                <div className="space-y-4">
                  {truckDescription && (
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1">Description</p>
                      <p className="text-sm font-medium">{truckDescription}</p>
                    </div>
                  )}
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1">Type de four</p>
                      <p className="text-sm font-medium">🔥 {ovenType}</p>
                      {ovenType === 'Gaz' && (
                        <p className="text-xs text-orange-500 mt-1">⚠️ Vérifications annuelles requises</p>
                      )}
                    </div>
                    
                    {isPaused && (
                      <div>
                        <p className="text-sm font-bold text-muted-foreground mb-1">Statut</p>
                        <Badge variant="secondary" className="rounded-full">
                          <Pause className="h-3 w-3 mr-1" />
                          En pause
                        </Badge>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1">Régime fiscal</p>
                      <p className="text-sm font-medium">
                        {tvaEnabled ? '🧾 Assujetti TVA (10%)' : '📋 Micro-entrepreneur'}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  {Object.values(badges).some(v => v) && (
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-2">Badges</p>
                      <div className="flex flex-wrap gap-2">
                        {badges.bio && <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold border border-emerald-500/20">🌱 Bio</span>}
                        {badges.terroir && <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-bold border border-amber-500/20">🌾 Terroir</span>}
                        {badges.sansGluten && <span className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-xs font-bold border border-blue-500/20">🚫🌾 Sans gluten</span>}
                        {badges.halal && <span className="px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full text-xs font-bold border border-purple-500/20">☪️ Halal</span>}
                        {badges.kasher && <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-xs font-bold border border-indigo-500/20">✡️ Kasher</span>}
                        {badges.sucre && <span className="px-3 py-1 bg-pink-500/10 text-pink-600 rounded-full text-xs font-bold border border-pink-500/20">🍰 Sucré</span>}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Visuels */}
              {(logoUrl || photoUrl) && (
                <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Visuels
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {photoUrl && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2">Photo principale</p>
                        <img
                          src={photoUrl}
                          alt={truckName}
                          className="w-full h-32 object-cover rounded-2xl border border-white/20"
                        />
                      </div>
                    )}
                    {logoUrl && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2">Logo</p>
                        <img
                          src={logoUrl}
                          alt={`Logo ${truckName}`}
                          className="w-full h-32 object-contain rounded-2xl border border-white/20 bg-white/5 p-3"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Planning hebdomadaire (horaires + emplacements) */}
              {openingHours && (
                <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Planning hebdomadaire
                    </h3>
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-bold"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      Modifier
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: 'monday', label: 'Lundi' },
                      { key: 'tuesday', label: 'Mardi' },
                      { key: 'wednesday', label: 'Mercredi' },
                      { key: 'thursday', label: 'Jeudi' },
                      { key: 'friday', label: 'Vendredi' },
                      { key: 'saturday', label: 'Samedi' },
                      { key: 'sunday', label: 'Dimanche' }
                    ].map(({ key, label }) => {
                      const hours = openingHours[key];
                      const dayLoc = locations?.[key];
                      const isToday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()] === key;
                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-xl transition-all ${
                            hours?.enabled
                              ? isToday ? 'bg-primary/10 border-2 border-primary/30' : 'bg-emerald-500/10 border border-emerald-500/20'
                              : 'bg-gray-100/50 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold ${hours?.enabled ? isToday ? 'text-primary' : 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400'}`}>
                              {label} {isToday && '(aujourd\'hui)'}
                            </span>
                            {hours?.enabled ? (
                              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {hours.open} → {hours.close}
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-gray-400 italic">Ferme</span>
                            )}
                          </div>
                          {dayLoc?.address && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground truncate">{dayLoc.address}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Carte de l'emplacement du jour */}
                  {(() => {
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const today = dayNames[new Date().getDay()];
                    const todayLoc = locations?.[today];
                    if (!todayLoc?.lat || !todayLoc?.lng) return null;
                    return (
                      <div className="mt-4">
                        <p className="text-xs font-bold text-muted-foreground mb-2">Emplacement du jour</p>
                        <div className="rounded-2xl overflow-hidden border border-white/20">
                          <iframe
                            width="100%"
                            height="200"
                            frameBorder="0"
                            style={{ border: 0 }}
                            src={`https://www.google.com/maps?q=${todayLoc.lat},${todayLoc.lng}&z=15&output=embed`}
                            allowFullScreen
                          ></iframe>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}

            </div>

            {/* Colonne droite - QR Code (1/3) */}
            <div className="space-y-6">
              {/* QR Code */}
              {(truckSlug || truckId) && (
                <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
                  <h3 className="text-lg font-black mb-4 text-center">📱 QR Code</h3>

                  <div className="flex justify-center mb-4" ref={qrCodeRef}>
                    <div className="relative p-3 bg-white rounded-2xl">
                      <QRCode
                        value={`${window.location.origin}${ROUTES.truck(truckSlug || truckId)}`}
                        size={160}
                        level="H"
                      />
                      {/* Logo pizza au centre */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 border-4 border-orange-500 shadow-lg">
                        <span className="text-4xl leading-none block">🍕</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={exportQRCode}
                    variant="outline"
                    className="w-full rounded-2xl font-bold mb-3 border-orange-500/30 hover:bg-orange-500/10"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger pour imprimer
                  </Button>

                  <p className="text-xs text-muted-foreground font-medium text-center break-all">
                    {window.location.origin}{ROUTES.truck(truckSlug || truckId)}
                  </p>
                  {!truckSlug && (
                    <p className="mt-3 text-xs text-orange-500 font-medium text-center">
                      💡 Modifiez votre profil pour une URL optimisée
                    </p>
                  )}
                </Card>
              )}
            </div>
          </div>

          {/* Plateformes de livraison - DÉSACTIVÉ TEMPORAIREMENT (tout en bas) */}
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
            <h3 className="text-lg font-black mb-4">🚴 Plateformes de livraison</h3>
            <div className="flex gap-3">
              <div className="relative flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-muted-foreground opacity-50 cursor-not-allowed">
                <span>Deliveroo</span>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-bold text-amber-700">BIENTÔT</span>
              </div>
              <div className="relative flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-muted-foreground opacity-50 cursor-not-allowed">
                <span>Uber Eats</span>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-bold text-amber-700">BIENTÔT</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-amber-600 font-medium text-center">
              L'intégration avec les plateformes de livraison arrive bientôt&nbsp;!
            </p>
          </Card>

          {/* Actions compte */}
          <Card className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl">
            <h3 className="text-lg font-black mb-4">Compte</h3>
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => signOut(auth)}
                variant="outline"
                className="w-full rounded-2xl h-12 font-bold"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Se déconnecter
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
          </Card>
        </div>
      ) : (
        // MODE ÉDITION
        <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl">
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
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="rounded-2xl font-bold border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
                >
                  <X className="h-4 w-4" />
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
                  className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-gray-400"
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

          {/* Badges & Spécialités - juste après infos de base comme en mode visu */}
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
            </div>
          </div>

          {/* Fiscalité */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <span className="text-xl">🧾</span>
              </div>
              Fiscalité
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all bg-white/5 border border-white/10 hover:border-white/20">
                <div>
                  <span className="text-sm font-bold block">Assujetti à la TVA</span>
                  <span className="text-xs text-muted-foreground">
                    Les micro-entrepreneurs ne sont pas assujettis. Les entreprises classiques le sont.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={tvaEnabled}
                  onChange={(e) => setTvaEnabled(e.target.checked)}
                  className="rounded w-5 h-5"
                />
              </label>
              {tvaEnabled ? (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-600 font-medium">
                    Le ticket client affichera la décomposition HT + TVA (10%) + TTC
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-600 font-medium">
                    TVA non applicable, art. 293 B du CGI (micro-entrepreneur)
                  </p>
                </div>
              )}
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
                  maxSizeMB={1}
                  maxWidthOrHeight={1200}
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
                  maxSizeMB={0.5}
                  maxWidthOrHeight={500}
                />
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  🎨 Apparaît dans les résultats de recherche
                </p>
              </div>
            </div>
          </div>

          {/* Planning hebdomadaire : horaires + emplacements par jour */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-2 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <span className="text-xl">📅</span>
              </div>
              Planning hebdomadaire
            </h3>
            <p className="text-xs text-muted-foreground mb-6">Definissez vos horaires et votre emplacement pour chaque jour</p>
            <div className="space-y-3">
              {[
                { key: 'monday', label: 'Lun', fullLabel: 'Lundi' },
                { key: 'tuesday', label: 'Mar', fullLabel: 'Mardi' },
                { key: 'wednesday', label: 'Mer', fullLabel: 'Mercredi' },
                { key: 'thursday', label: 'Jeu', fullLabel: 'Jeudi' },
                { key: 'friday', label: 'Ven', fullLabel: 'Vendredi' },
                { key: 'saturday', label: 'Sam', fullLabel: 'Samedi' },
                { key: 'sunday', label: 'Dim', fullLabel: 'Dimanche' }
              ].map(({ key, label, fullLabel }) => {
                const dayLoc = locations?.[key];
                // Trouver les jours avec un emplacement pour la fonction "Copier depuis"
                const daysWithLocation = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                  .filter(d => d !== key && locations?.[d]?.lat && locations?.[d]?.lng);

                return (
                  <div key={key} className={`rounded-2xl transition-all ${openingHours[key].enabled ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-white/5 border border-white/10'}`}>
                    {/* Ligne horaire */}
                    <div className="flex items-center gap-4 p-4">
                      <label className="flex items-center gap-3 cursor-pointer min-w-30">
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
                        <span className="text-sm text-muted-foreground font-medium italic">Ferme</span>
                      )}
                    </div>

                    {/* Emplacement du jour */}
                    <div className="px-4 pb-3 space-y-2">
                      {daysWithLocation.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium">Copier :</span>
                          {daysWithLocation.map(d => {
                            const dayLabels = { monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer', thursday: 'Jeu', friday: 'Ven', saturday: 'Sam', sunday: 'Dim' };
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setLocations(prev => ({ ...prev, [key]: { ...prev[d] } }))}
                                className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 text-[10px] font-bold hover:bg-blue-500/20 transition-all"
                              >
                                {dayLabels[d]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <DayLocationInput
                        value={dayLoc || null}
                        onChange={(newLoc) => setLocations(prev => ({ ...prev, [key]: newLoc }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plateformes de livraison - DÉSACTIVÉ TEMPORAIREMENT */}
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <span className="text-xl">🚴</span>
              </div>
              Plateformes de livraison
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 opacity-50 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded w-5 h-5"
                />
                <span className="text-sm font-bold text-muted-foreground">Deliveroo</span>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-bold text-amber-700">BIENTÔT</span>
              </div>
              <div className="relative flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 opacity-50 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded w-5 h-5"
                />
                <span className="text-sm font-bold text-muted-foreground">Uber Eats</span>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-bold text-amber-700">BIENTÔT</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-amber-600 font-medium">
              L'intégration avec les plateformes de livraison arrive bientôt&nbsp;!
            </p>
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
            
            <Button
              type="button"
              onClick={() => signOut(auth)}
              variant="outline"
              className="w-full rounded-2xl h-12 font-bold"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Se déconnecter
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
